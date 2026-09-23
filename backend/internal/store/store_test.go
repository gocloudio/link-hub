package store

import (
	"context"
	"errors"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var testActor = Actor{ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", IsAdmin: true}

func testStore(t *testing.T) *Store {
	t.Helper()
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, address)
	if err != nil {
		t.Fatal(err)
	}
	schema := "test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = conn.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(address)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	s, err := Open(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close(); conn.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`); conn.Close(ctx) })
	if err = s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err = s.Migrate(ctx); err != nil {
		t.Fatalf("idempotent migration: %v", err)
	}
	return s
}
func TestCardCategoryTransactions(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	a, err := s.SaveCategory(ctx, "", "开发工具")
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.SaveCategory(ctx, "", "运营系统")
	if err != nil {
		t.Fatal(err)
	}
	card, err := s.SaveCard(ctx, Card{Name: "A", URL: "https://example.com", CategoryIDs: []string{a.ID, b.ID}}, nil, testActor)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.SaveCard(ctx, Card{Name: "B", URL: "https://example.org", CategoryIDs: []string{a.ID}}, nil, testActor)
	if err != nil {
		t.Fatal(err)
	}
	for _, filter := range []string{"", a.ID} {
		list, err := s.ListCards(ctx, filter, testActor)
		if err != nil || len(list) != 2 || list[0].ID != second.ID {
			t.Fatalf("dedup/order: %v %v", list, err)
		}
	}
	list, err := s.ListCards(ctx, b.ID, testActor)
	if err != nil || len(list) != 1 {
		t.Fatalf("filter: %v %v", list, err)
	}
	if !errors.Is(s.DeleteCategory(ctx, b.ID), ErrInUse) {
		t.Fatal("must refuse deleting even a non-exclusive category")
	}
	original := card
	card.Name = "Changed"
	card.CategoryIDs = []string{a.ID}
	card, err = s.SaveCard(ctx, card, &original.UpdatedAt, testActor)
	if err != nil {
		t.Fatal(err)
	}
	if !card.CreatedAt.Equal(original.CreatedAt) || !card.UpdatedAt.After(original.UpdatedAt) {
		t.Fatal("timestamp rules")
	}
	if _, err = s.SaveCard(ctx, card, &original.UpdatedAt, testActor); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale write: %v", err)
	}
	if err = s.DeleteCategory(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	invalid := card
	invalid.CategoryIDs = []string{uuid.NewString()}
	invalid.Name = "must rollback"
	if _, err = s.SaveCard(ctx, invalid, &card.UpdatedAt, testActor); err == nil {
		t.Fatal("missing category accepted")
	}
	persisted, err := s.GetCard(ctx, card.ID, testActor)
	if err != nil || persisted.Name != "Changed" || len(persisted.CategoryIDs) != 1 {
		t.Fatalf("transaction rollback: %v %v", persisted, err)
	}
	if _, err = s.Pool.Exec(ctx, `DELETE FROM card_categories WHERE card_id=$1`, card.ID); err == nil {
		t.Fatal("database accepted zero categories")
	}
	if _, err = s.Pool.Exec(ctx, `INSERT INTO cards(id,name,url) VALUES($1,'Orphan','https://example.com')`, uuid.NewString()); err == nil {
		t.Fatal("database accepted orphan card")
	}
	if err = s.DeleteCard(ctx, card.ID, testActor); err != nil {
		t.Fatal(err)
	}
	if err = s.DeleteCard(ctx, second.ID, testActor); err != nil {
		t.Fatal(err)
	}
	if err = s.DeleteCategory(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
}
func TestMemberCardOwnership(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	member := Actor{ID: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
	stranger := Actor{ID: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"}
	cat, err := s.SaveCategory(ctx, "", "分类")
	if err != nil {
		t.Fatal(err)
	}
	made, err := s.SaveCard(ctx, Card{Name: "成员公开", URL: "https://example.com", CategoryIDs: []string{cat.ID}}, nil, member)
	if err != nil {
		t.Fatal("member creates public card", err)
	}
	if made.IsPrivate || made.OwnerID != member.ID {
		t.Fatalf("public owner: %+v", made)
	}
	made.Name = "抢占"
	if _, err = s.SaveCard(ctx, made, &made.UpdatedAt, stranger); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger edits public: %v", err)
	}
	if err = s.DeleteCard(ctx, made.ID, stranger); !errors.Is(err, ErrNotFound) {
		t.Fatalf("stranger deletes public: %v", err)
	}
	made.Name = "成员改名"
	edited, err := s.SaveCard(ctx, made, &made.UpdatedAt, member)
	if err != nil || edited.OwnerID != member.ID {
		t.Fatalf("owner edits public: %v", err)
	}
	if _, err = s.SaveCard(ctx, Card{ID: edited.ID, Name: "管理员接管", URL: "https://example.com", CategoryIDs: []string{cat.ID}}, &edited.UpdatedAt, testActor); err != nil {
		t.Fatalf("admin edits member public: %v", err)
	}
	legacy := uuid.NewString()
	if err = s.transaction(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO cards(id,name,url) VALUES($1,'既有公开','https://example.com')`, legacy); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO card_categories(card_id,category_id) VALUES($1,$2)`, legacy, cat.ID)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	historical, err := s.GetCard(ctx, legacy, member)
	if err != nil {
		t.Fatal(err)
	}
	historical.Name = "越权"
	if _, err = s.SaveCard(ctx, historical, &historical.UpdatedAt, member); !errors.Is(err, ErrForbidden) {
		t.Fatalf("member edits legacy public: %v", err)
	}
	if err = s.DeleteCard(ctx, edited.ID, member); err != nil {
		t.Fatalf("owner deletes public: %v", err)
	}
}
func TestConcurrentEdits(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	cat, err := s.SaveCategory(ctx, "", "分类")
	if err != nil {
		t.Fatal(err)
	}
	card, err := s.SaveCard(ctx, Card{Name: "Concurrent", URL: "https://example.com", CategoryIDs: []string{cat.ID}}, nil, testActor)
	if err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := s.SaveCard(ctx, card, &card.UpdatedAt, testActor); results <- err }()
	}
	wg.Wait()
	close(results)
	success, conflict := 0, 0
	for err := range results {
		if err == nil {
			success++
		} else if errors.Is(err, ErrConflict) {
			conflict++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("success %d conflict %d", success, conflict)
	}
}
