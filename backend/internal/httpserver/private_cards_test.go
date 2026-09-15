package httpserver

import (
	"context"
	"reflect"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/gocloudio/link-hub/backend/gen/linkhub/v1"
	rpc "github.com/gocloudio/link-hub/backend/gen/linkhub/v1/linkhubv1connect"
)

func testPrivateCardsAndPreferences(t *testing.T, ctx context.Context, client rpc.HubServiceClient) {
	t.Helper()
	identities := map[string]string{}
	for _, token := range []string{"admin", "viewer", "recipient", "stranger"} {
		me, err := client.GetMe(ctx, request(&pb.GetMeRequest{}, token))
		if err != nil {
			t.Fatal(err)
		}
		identities[token] = me.Msg.Id
	}
	members, err := client.ListMembers(ctx, request(&pb.ListMembersRequest{}, "viewer"))
	if err != nil || len(members.Msg.Members) != 4 {
		t.Fatal("sharing directory", err)
	}
	group, err := client.CreateCategory(ctx, request(&pb.CreateCategoryRequest{Name: "个人工具"}, "admin"))
	if err != nil {
		t.Fatal(err)
	}
	input := &pb.CardInput{Name: "Private tool", Url: "https://private.example.com", CategoryIds: []string{group.Msg.Category.Id}, IsPrivate: true}
	made, err := client.CreateCard(ctx, request(&pb.CreateCardRequest{Card: input}, "viewer"))
	if err != nil {
		t.Fatal("member creates private", err)
	}
	card := made.Msg.Card
	if !card.CanEdit || card.OwnerId != identities["viewer"] || !card.IsPrivate {
		t.Fatal("private owner", card)
	}
	for _, token := range []string{"", "invalid"} {
		calls := []func() error{
			func() error {
				_, e := client.GetCardPreferences(ctx, request(&pb.GetCardPreferencesRequest{}, token))
				return e
			},
			func() error {
				_, e := client.SetCardFavorite(ctx, request(&pb.SetCardFavoriteRequest{CardId: card.Id, Favorite: true}, token))
				return e
			},
			func() error {
				_, e := client.SaveCardOrder(ctx, request(&pb.SaveCardOrderRequest{CardIds: []string{card.Id}}, token))
				return e
			},
			func() error { _, e := client.ListMembers(ctx, request(&pb.ListMembersRequest{}, token)); return e },
		}
		for _, call := range calls {
			if connect.CodeOf(call()) != connect.CodeUnauthenticated {
				t.Fatal("anonymous personal API")
			}
		}
	}
	for _, token := range []string{"viewer", "admin", "recipient", "stranger"} {
		allowed := token == "viewer" || token == "admin"
		list, e := client.ListCards(ctx, request(&pb.ListCardsRequest{CategoryId: group.Msg.Category.Id}, token))
		if e != nil {
			t.Fatal(e)
		}
		want := 0
		if allowed {
			want = 1
		}
		if len(list.Msg.Cards) != want {
			t.Fatalf("%s sees wrong cards", token)
		}
		categories, e := client.ListCategories(ctx, request(&pb.ListCategoriesRequest{}, token))
		if e != nil {
			t.Fatal(e)
		}
		if categories.Msg.Categories[0].CardCount != int32(want) {
			t.Fatalf("%s category count leaked", token)
		}
		detail, e := client.GetCard(ctx, request(&pb.GetCardRequest{Id: card.Id}, token))
		if allowed {
			if e != nil || !detail.Msg.Card.CanEdit {
				t.Fatal("owner/admin access", e)
			}
		} else if connect.CodeOf(e) != connect.CodeNotFound {
			t.Fatal("private detail leak", e)
		}
	}
	if _, e := client.SetCardFavorite(ctx, request(&pb.SetCardFavoriteRequest{CardId: card.Id, Favorite: true}, "stranger")); connect.CodeOf(e) != connect.CodeNotFound {
		t.Fatal("favorite inaccessible card", e)
	}
	if _, e := client.SaveCardOrder(ctx, request(&pb.SaveCardOrderRequest{CardIds: []string{card.Id}}, "stranger")); connect.CodeOf(e) != connect.CodeNotFound {
		t.Fatal("reorder inaccessible card", e)
	}
	if _, e := client.DeleteCard(ctx, request(&pb.DeleteCardRequest{Id: card.Id}, "stranger")); connect.CodeOf(e) != connect.CodeNotFound {
		t.Fatal("stranger delete", e)
	}
	if _, e := client.SetCardFavorite(ctx, request(&pb.SetCardFavoriteRequest{CardId: card.Id, Favorite: true}, "viewer")); e != nil {
		t.Fatal(e)
	}
	if _, e := client.SaveCardOrder(ctx, request(&pb.SaveCardOrderRequest{CardIds: []string{card.Id}}, "viewer")); e != nil {
		t.Fatal(e)
	}
	own, e := client.GetCardPreferences(ctx, request(&pb.GetCardPreferencesRequest{}, "viewer"))
	if e != nil || !reflect.DeepEqual(own.Msg.FavoriteCardIds, []string{card.Id}) || !reflect.DeepEqual(own.Msg.OrderedCardIds, []string{card.Id}) {
		t.Fatal("personal persistence", e)
	}
	adminPrefs, e := client.GetCardPreferences(ctx, request(&pb.GetCardPreferencesRequest{}, "admin"))
	if e != nil || len(adminPrefs.Msg.FavoriteCardIds) != 0 {
		t.Fatal("cross-account preferences", e)
	}
	if _, e := client.SaveCardOrder(ctx, request(&pb.SaveCardOrderRequest{CardIds: []string{card.Id, card.Id}}, "viewer")); connect.CodeOf(e) != connect.CodeInvalidArgument {
		t.Fatal("duplicate order", e)
	}
	// Owner shares with a known team member; recipient can only read and personalize.
	input.SharedUserIds = []string{identities["recipient"]}
	shared, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "viewer"))
	if e != nil {
		t.Fatal("share", e)
	}
	card = shared.Msg.Card
	detail, e := client.GetCard(ctx, request(&pb.GetCardRequest{Id: card.Id}, "recipient"))
	if e != nil || detail.Msg.Card.CanEdit || len(detail.Msg.Card.SharedUserIds) != 0 {
		t.Fatal("recipient read-only", e)
	}
	if _, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "recipient")); connect.CodeOf(e) != connect.CodePermissionDenied {
		t.Fatal("recipient edit", e)
	}
	if _, e := client.DeleteCard(ctx, request(&pb.DeleteCardRequest{Id: card.Id}, "recipient")); connect.CodeOf(e) != connect.CodeNotFound {
		t.Fatal("recipient delete", e)
	}
	if _, e := client.SetCardFavorite(ctx, request(&pb.SetCardFavoriteRequest{CardId: card.Id, Favorite: true}, "recipient")); e != nil {
		t.Fatal(e)
	}
	// Administrators may edit any private card without changing its original owner.
	input.Name = "Admin edited"
	edited, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "admin"))
	if e != nil || edited.Msg.Card.OwnerId != identities["viewer"] {
		t.Fatal("admin manages private", e)
	}
	card = edited.Msg.Card
	input.SharedUserIds = nil
	revoked, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "viewer"))
	if e != nil {
		t.Fatal("revoke", e)
	}
	card = revoked.Msg.Card
	if _, e := client.GetCard(ctx, request(&pb.GetCardRequest{Id: card.Id}, "recipient")); connect.CodeOf(e) != connect.CodeNotFound {
		t.Fatal("revoked detail", e)
	}
	list, e := client.ListCards(ctx, request(&pb.ListCardsRequest{}, "recipient"))
	if e != nil || len(list.Msg.Cards) != 0 {
		t.Fatal("revoked list", e)
	}
	pref, e := client.GetCardPreferences(ctx, request(&pb.GetCardPreferencesRequest{}, "recipient"))
	if e != nil || len(pref.Msg.FavoriteCardIds) != 0 {
		t.Fatal("revoked favorite", e)
	}
	input.IsPrivate = false
	if _, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "viewer")); connect.CodeOf(e) != connect.CodePermissionDenied {
		t.Fatal("member published", e)
	}
	if _, e := client.CreateCard(ctx, request(&pb.CreateCardRequest{Card: input}, "viewer")); connect.CodeOf(e) != connect.CodePermissionDenied {
		t.Fatal("member created public", e)
	}
	published, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "admin"))
	if e != nil {
		t.Fatal("admin publish", e)
	}
	public, e := client.GetCard(ctx, request(&pb.GetCardRequest{Id: card.Id}, "viewer"))
	if e != nil || public.Msg.Card.CanEdit {
		t.Fatal("public owner read-only", e)
	}
	input.IsPrivate = true
	privatized, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: published.Msg.Card.UpdatedAt}, "admin"))
	if e != nil || !privatized.Msg.Card.IsPrivate {
		t.Fatal("admin privatize", e)
	}
	if _, e := client.DeleteCard(ctx, request(&pb.DeleteCardRequest{Id: card.Id}, "admin")); e != nil {
		t.Fatal("admin delete other's private", e)
	}
	pref, e = client.GetCardPreferences(ctx, request(&pb.GetCardPreferencesRequest{}, "viewer"))
	if e != nil || len(pref.Msg.FavoriteCardIds) != 0 || len(pref.Msg.OrderedCardIds) != 0 {
		t.Fatal("deleted preferences", e)
	}
}
