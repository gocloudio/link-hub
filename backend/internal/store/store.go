package store

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/collate"
	"golang.org/x/text/language"
)

//go:embed migrations/*.sql
var migrations embed.FS
var ErrNotFound = errors.New("记录不存在或已被删除")
var ErrConflict = errors.New("卡片已被其他管理员修改，请刷新后重新编辑")
var ErrInUse = errors.New("该分类仍有关联卡片，请先调整卡片分类")

type Card struct {
	ID, Name, Description, URL string
	CategoryIDs                []string
	CreatedAt, UpdatedAt       time.Time
}
type Category struct {
	ID, Name  string
	CardCount int32
}
type Store struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, databaseURL string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL 格式错误")
	}
	cfg.MaxConns = 10
	cfg.MinConns = 0
	cfg.ConnConfig.ConnectTimeout = 5 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("数据库连接池初始化失败")
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("无法连接 PostgreSQL，请检查连接配置和服务状态")
	}
	return &Store{Pool: pool}, nil
}
func (s *Store) Close() { s.Pool.Close() }

func (s *Store) Migrate(ctx context.Context) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(71094620)`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, file := range entries {
		var exists bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, file.Name()).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		data, err := migrations.ReadFile("migrations/" + file.Name())
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("migration %s: %w", file.Name(), err)
		}
		if _, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, file.Name()); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// 所有写入口遵循同一个锁顺序，兼顾分类删除、卡片修改和延迟约束。
func (s *Store) transaction(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(71094621)`); err != nil {
		return err
	}
	if err = fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) ListCategories(ctx context.Context) ([]Category, error) {
	rows, err := s.Pool.Query(ctx, `SELECT c.id::text,c.name,count(cc.card_id)::integer FROM categories c LEFT JOIN card_categories cc ON cc.category_id=c.id GROUP BY c.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Category{}
	for rows.Next() {
		var c Category
		if err = rows.Scan(&c.ID, &c.Name, &c.CardCount); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	cmp := collate.New(language.Chinese)
	sort.Slice(result, func(i, j int) bool {
		n := cmp.CompareString(result[i].Name, result[j].Name)
		if n == 0 {
			return result[i].ID < result[j].ID
		}
		return n < 0
	})
	return result, nil
}

const cardColumns = `c.id::text,c.name,c.description_markdown,c.url,c.created_at,c.updated_at,ARRAY(SELECT cc.category_id::text FROM card_categories cc WHERE cc.card_id=c.id ORDER BY cc.category_id)`

func scanCard(row pgx.Row) (Card, error) {
	var c Card
	err := row.Scan(&c.ID, &c.Name, &c.Description, &c.URL, &c.CreatedAt, &c.UpdatedAt, &c.CategoryIDs)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return c, err
}
func (s *Store) ListCards(ctx context.Context, categoryID string) ([]Card, error) {
	query := `SELECT ` + cardColumns + ` FROM cards c`
	args := []any{}
	if categoryID != "" {
		query += ` WHERE EXISTS (SELECT 1 FROM card_categories cc WHERE cc.card_id=c.id AND cc.category_id=$1)`
		args = append(args, categoryID)
	}
	query += ` ORDER BY c.created_at DESC,c.id DESC`
	rows, err := s.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Card{}
	for rows.Next() {
		c, err := scanCard(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}
func (s *Store) GetCard(ctx context.Context, id string) (Card, error) {
	return scanCard(s.Pool.QueryRow(ctx, `SELECT `+cardColumns+` FROM cards c WHERE c.id=$1`, id))
}

func (s *Store) SaveCard(ctx context.Context, c Card, expected *time.Time) (Card, error) {
	creating := c.ID == ""
	if creating {
		c.ID = uuid.NewString()
	}
	err := s.transaction(ctx, func(tx pgx.Tx) error {
		if creating {
			if _, err := tx.Exec(ctx, `INSERT INTO cards(id,name,description_markdown,url) VALUES($1,$2,$3,$4)`, c.ID, c.Name, c.Description, c.URL); err != nil {
				return err
			}
		} else {
			var current time.Time
			if err := tx.QueryRow(ctx, `SELECT updated_at FROM cards WHERE id=$1 FOR UPDATE`, c.ID).Scan(&current); errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			} else if err != nil {
				return err
			}
			if expected == nil || !current.Equal(*expected) {
				return ErrConflict
			}
			if _, err := tx.Exec(ctx, `UPDATE cards SET name=$2,description_markdown=$3,url=$4,updated_at=clock_timestamp() WHERE id=$1`, c.ID, c.Name, c.Description, c.URL); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `DELETE FROM card_categories WHERE card_id=$1`, c.ID); err != nil {
			return err
		}
		for _, id := range c.CategoryIDs {
			if _, err := tx.Exec(ctx, `INSERT INTO card_categories(card_id,category_id) VALUES($1,$2)`, c.ID, id); err != nil {
				return err
			}
		}
		var err error
		c, err = scanCard(tx.QueryRow(ctx, `SELECT `+cardColumns+` FROM cards c WHERE c.id=$1`, c.ID))
		return err
	})
	return c, err
}
func (s *Store) DeleteCard(ctx context.Context, id string) error {
	return s.transaction(ctx, func(tx pgx.Tx) error {
		r, err := tx.Exec(ctx, `DELETE FROM cards WHERE id=$1`, id)
		if err == nil && r.RowsAffected() == 0 {
			return ErrNotFound
		}
		return err
	})
}
func (s *Store) SaveCategory(ctx context.Context, id, name string) (Category, error) {
	c := Category{ID: id, Name: name}
	err := s.transaction(ctx, func(tx pgx.Tx) error {
		if id == "" {
			c.ID = uuid.NewString()
			_, err := tx.Exec(ctx, `INSERT INTO categories(id,name) VALUES($1,$2)`, c.ID, name)
			return err
		}
		r, err := tx.Exec(ctx, `UPDATE categories SET name=$2,updated_at=clock_timestamp() WHERE id=$1`, id, name)
		if err != nil {
			return err
		}
		if r.RowsAffected() == 0 {
			return ErrNotFound
		}
		return tx.QueryRow(ctx, `SELECT count(*)::integer FROM card_categories WHERE category_id=$1`, id).Scan(&c.CardCount)
	})
	return c, err
}
func (s *Store) DeleteCategory(ctx context.Context, id string) error {
	return s.transaction(ctx, func(tx pgx.Tx) error {
		var used bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM card_categories WHERE category_id=$1)`, id).Scan(&used); err != nil {
			return err
		}
		if used {
			return ErrInUse
		}
		r, err := tx.Exec(ctx, `DELETE FROM categories WHERE id=$1`, id)
		if err == nil && r.RowsAffected() == 0 {
			return ErrNotFound
		}
		return err
	})
}
