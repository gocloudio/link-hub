package store

import (
	"context"
	"errors"
	"github.com/google/uuid"
	"reflect"
	"testing"
)

func TestPersonalPreferences(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	category, err := s.SaveCategory(ctx, "", "Preferences")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, name := range []string{"A", "B", "C"} {
		card, err := s.SaveCard(ctx, Card{Name: name, URL: "https://example.com", CategoryIDs: []string{category.ID}}, nil, testActor)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, card.ID)
	}
	a, b := Actor{ID: uuid.NewString()}, Actor{ID: uuid.NewString()}
	if err := s.SetCardFavorite(ctx, a, ids[0], true); err != nil {
		t.Fatal(err)
	}
	if err := s.SetCardFavorite(ctx, a, ids[0], true); err != nil {
		t.Fatal(err)
	}
	order := []string{ids[2], ids[0], ids[1]}
	if err := s.SaveCardOrder(ctx, a, order); err != nil {
		t.Fatal(err)
	}
	p, err := s.GetCardPreferences(ctx, a)
	if err != nil || !reflect.DeepEqual(p.FavoriteCardIDs, []string{ids[0]}) || !reflect.DeepEqual(p.OrderedCardIDs, order) {
		t.Fatalf("preferences: %+v %v", p, err)
	}
	other, err := s.GetCardPreferences(ctx, b)
	if err != nil || len(other.FavoriteCardIDs) != 0 || len(other.OrderedCardIDs) != 0 {
		t.Fatalf("cross-user preferences: %+v %v", other, err)
	}
	if err := s.SaveCardOrder(ctx, a, []string{ids[0], uuid.NewString()}); !errors.Is(err, ErrNotFound) {
		t.Fatal("invalid order", err)
	}
	p, err = s.GetCardPreferences(ctx, a)
	if err != nil || !reflect.DeepEqual(p.OrderedCardIDs, order) {
		t.Fatal("failed order must roll back", p, err)
	}
	if err := s.SetCardFavorite(ctx, a, ids[0], false); err != nil {
		t.Fatal(err)
	}
	p, err = s.GetCardPreferences(ctx, a)
	if err != nil || len(p.FavoriteCardIDs) != 0 || !reflect.DeepEqual(p.OrderedCardIDs, order) {
		t.Fatal("unfavorite changed order", p, err)
	}
	if err := s.DeleteCard(ctx, ids[0], testActor); err != nil {
		t.Fatal(err)
	}
	p, err = s.GetCardPreferences(ctx, a)
	if err != nil || !reflect.DeepEqual(p.OrderedCardIDs, []string{ids[2], ids[1]}) {
		t.Fatal("deleted card preferences remain", p, err)
	}
}
