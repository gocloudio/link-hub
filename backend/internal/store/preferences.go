package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type CardPreferences struct {
	FavoriteCardIDs []string
	OrderedCardIDs  []string
}

func (s *Store) GetCardPreferences(ctx context.Context, actor Actor) (CardPreferences, error) {
	p := CardPreferences{FavoriteCardIDs: []string{}, OrderedCardIDs: []string{}}
	rows, err := s.Pool.Query(ctx, `SELECT p.card_id::text, p.favorite, p.position FROM user_card_preferences p JOIN cards c ON c.id=p.card_id WHERE p.user_id=$1 AND `+visibleCardSQL+` ORDER BY p.position NULLS LAST, p.card_id`, actor.ID, actor.IsAdmin)
	if err != nil {
		return p, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var favorite bool
		var position *int32
		if err := rows.Scan(&id, &favorite, &position); err != nil {
			return p, err
		}
		if favorite {
			p.FavoriteCardIDs = append(p.FavoriteCardIDs, id)
		}
		if position != nil {
			p.OrderedCardIDs = append(p.OrderedCardIDs, id)
		}
	}
	return p, rows.Err()
}

func (s *Store) SetCardFavorite(ctx context.Context, actor Actor, cardID string, favorite bool) error {
	return s.transaction(ctx, func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM cards c WHERE c.id=$3 AND `+visibleCardSQL+`)`, actor.ID, actor.IsAdmin, cardID).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
		_, err := tx.Exec(ctx, `INSERT INTO user_card_preferences(user_id,card_id,favorite) VALUES($1,$2,$3)
			ON CONFLICT(user_id,card_id) DO UPDATE SET favorite=EXCLUDED.favorite`, actor.ID, cardID, favorite)
		return err
	})
}

// The full order is saved atomically; favorites remain independent of position.
func (s *Store) SaveCardOrder(ctx context.Context, actor Actor, ids []string) error {
	return s.transaction(ctx, func(tx pgx.Tx) error {
		var count int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM cards c WHERE c.id=ANY($3::uuid[]) AND `+visibleCardSQL, actor.ID, actor.IsAdmin, ids).Scan(&count); err != nil {
			return err
		}
		if count != len(ids) {
			return ErrNotFound
		}
		if _, err := tx.Exec(ctx, `UPDATE user_card_preferences SET position=NULL WHERE user_id=$1`, actor.ID); err != nil {
			return err
		}
		for position, id := range ids {
			if _, err := tx.Exec(ctx, `INSERT INTO user_card_preferences(user_id,card_id,position) VALUES($1,$2,$3)
				ON CONFLICT(user_id,card_id) DO UPDATE SET position=EXCLUDED.position`, actor.ID, id, position); err != nil {
				return err
			}
		}
		return nil
	})
}
