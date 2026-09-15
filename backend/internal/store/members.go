package store

import "context"

// $1 is always the authenticated user's Entra object ID, never a request field.
const visibleCardSQL = `($2::boolean OR NOT c.is_private OR c.owner_id=$1 OR EXISTS(SELECT 1 FROM card_shares sh WHERE sh.card_id=c.id AND sh.user_id=$1))`

type Member struct{ ID, Name, Username string }

func (s *Store) RecordMember(ctx context.Context, m Member) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO members(id,name,username) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,username=EXCLUDED.username`, m.ID, m.Name, m.Username)
	return err
}
func (s *Store) ListMembers(ctx context.Context) ([]Member, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id::text,name,username FROM members ORDER BY name,id LIMIT 1000`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Name, &m.Username); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
