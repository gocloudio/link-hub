package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/gocloudio/link-hub/backend/gen/linkhub/v1"
	rpc "github.com/gocloudio/link-hub/backend/gen/linkhub/v1/linkhubv1connect"
	"github.com/gocloudio/link-hub/backend/internal/auth"
	"github.com/gocloudio/link-hub/backend/internal/config"
	"github.com/gocloudio/link-hub/backend/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// 仅测试注入；正式服务始终使用 Entra 签名验证器。
type testVerifier struct{}

func (testVerifier) Verify(_ context.Context, raw string) (auth.Principal, error) {
	ids := map[string]string{"admin": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "viewer": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "recipient": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "stranger": "dddddddd-dddd-4ddd-8ddd-dddddddddddd"}
	if id, ok := ids[raw]; ok {
		return auth.Principal{ID: id, Name: raw, Username: raw + "@example.com", IsAdmin: raw == "admin"}, nil
	}
	return auth.Principal{}, errors.New("invalid token")
}
func request[T any](msg *T, token string) *connect.Request[T] {
	r := connect.NewRequest(msg)
	if token != "" {
		r.Header().Set("Authorization", "Bearer "+token)
	}
	return r
}
func TestHTTPAuthorizationAndCRUD(t *testing.T) {
	address := os.Getenv("TEST_DATABASE_URL")
	if address == "" {
		t.Skip("set TEST_DATABASE_URL for integration test")
	}
	ctx := context.Background()
	root, err := pgx.Connect(ctx, address)
	if err != nil {
		t.Fatal(err)
	}
	schema := "http_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = root.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(address)
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	s, err := store.Open(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { s.Close(); root.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`); root.Close(ctx) }()
	if err = s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	web := t.TempDir()
	os.WriteFile(filepath.Join(web, "index.html"), []byte("<!doctype html><title>团队导航</title>"), 0600)
	server := httptest.NewServer(New(config.Config{WebDir: web, TenantID: "tenant", ClientID: "client", APIScope: "api://aud/scope"}, s, testVerifier{}))
	defer server.Close()
	client := rpc.NewHubServiceClient(server.Client(), server.URL)
	for _, token := range []string{"", "invalid", "viewer"} {
		want := connect.CodeUnauthenticated
		if token == "viewer" {
			want = connect.CodePermissionDenied
		}
		mutations := []func() error{
			func() error { _, e := client.CreateCard(ctx, request(&pb.CreateCardRequest{}, token)); return e },
			func() error { _, e := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{}, token)); return e },
			func() error { _, e := client.DeleteCard(ctx, request(&pb.DeleteCardRequest{}, token)); return e },
			func() error {
				_, e := client.CreateCategory(ctx, request(&pb.CreateCategoryRequest{Name: "Blocked"}, token))
				return e
			},
			func() error {
				_, e := client.UpdateCategory(ctx, request(&pb.UpdateCategoryRequest{}, token))
				return e
			},
			func() error {
				_, e := client.DeleteCategory(ctx, request(&pb.DeleteCategoryRequest{}, token))
				return e
			},
		}
		for i, call := range mutations {
			expected := want
			if token == "viewer" && i == 2 {
				expected = connect.CodeInvalidArgument
			}
			if code := connect.CodeOf(call()); code != expected {
				t.Fatalf("token %q mutation %d code %v want %v", token, i, code, want)
			}
		}
	}
	if _, err = client.GetMe(ctx, request(&pb.GetMeRequest{}, "")); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatal(err)
	}
	me, err := client.GetMe(ctx, request(&pb.GetMeRequest{}, "viewer"))
	if err != nil || me.Msg.IsAdmin {
		t.Fatal("viewer authorization", err)
	}
	for _, token := range []string{"", "invalid"} {
		reads := []func() error{
			func() error { _, e := client.ListCards(ctx, request(&pb.ListCardsRequest{}, token)); return e },
			func() error {
				_, e := client.ListCategories(ctx, request(&pb.ListCategoriesRequest{}, token))
				return e
			},
			func() error {
				_, e := client.GetCard(ctx, request(&pb.GetCardRequest{Id: uuid.NewString()}, token))
				return e
			},
		}
		for i, read := range reads {
			if code := connect.CodeOf(read()); code != connect.CodeUnauthenticated {
				t.Fatalf("token %q read %d: got %v", token, i, code)
			}
		}
	}
	cat, err := client.CreateCategory(ctx, request(&pb.CreateCategoryRequest{Name: "开发工具"}, "admin"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = client.CreateCategory(ctx, request(&pb.CreateCategoryRequest{Name: " 开发工具 "}, "admin")); connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatal("duplicate category", err)
	}
	id := cat.Msg.Category.Id
	input := &pb.CardInput{Name: "Test", Url: "https://example.com", DescriptionMarkdown: "# 说明\n\n正文", CategoryIds: []string{id, id}}
	made, err := client.CreateCard(ctx, request(&pb.CreateCardRequest{Card: input}, "admin"))
	if err != nil {
		t.Fatal(err)
	}
	card := made.Msg.Card
	if len(card.CategoryIds) != 1 {
		t.Fatal("must dedup input categories")
	}
	list, err := client.ListCards(ctx, request(&pb.ListCardsRequest{}, "viewer"))
	if err != nil || len(list.Msg.Cards) != 1 {
		t.Fatal("viewer list", err)
	}
	if _, err = client.GetCard(ctx, request(&pb.GetCardRequest{Id: card.Id}, "viewer")); err != nil {
		t.Fatal("viewer detail", err)
	}
	cats, err := client.ListCategories(ctx, request(&pb.ListCategoriesRequest{}, "viewer"))
	if err != nil || cats.Msg.Categories[0].CardCount != 1 {
		t.Fatal("category count", err)
	}
	if _, err = client.DeleteCategory(ctx, request(&pb.DeleteCategoryRequest{Id: id}, "admin")); connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatal("in-use category", err)
	}
	input.Name = "Updated"
	updated, err := client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "admin"))
	if err != nil {
		t.Fatal(err)
	}
	if updated.Msg.Card.CreatedAt.AsTime() != card.CreatedAt.AsTime() {
		t.Fatal("created time changed")
	}
	if _, err = client.UpdateCard(ctx, request(&pb.UpdateCardRequest{Id: card.Id, Card: input, ExpectedUpdatedAt: card.UpdatedAt}, "admin")); connect.CodeOf(err) != connect.CodeAborted {
		t.Fatal("lost update", err)
	}
	input.Url = "javascript:alert(1)"
	if _, err = client.CreateCard(ctx, request(&pb.CreateCardRequest{Card: input}, "admin")); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatal("unsafe URL", err)
	}
	if _, err = client.DeleteCard(ctx, request(&pb.DeleteCardRequest{Id: card.Id}, "admin")); err != nil {
		t.Fatal(err)
	}
	if _, err = client.DeleteCategory(ctx, request(&pb.DeleteCategoryRequest{Id: id}, "admin")); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/", "/api/healthz", "/api/runtime-config"} {
		res, err := server.Client().Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusOK {
			t.Fatalf("%s: %d", path, res.StatusCode)
		}
		if res.Header.Get("Content-Security-Policy") == "" {
			t.Fatal("missing CSP")
		}
		if path == "/api/runtime-config" {
			var data map[string]any
			json.NewDecoder(res.Body).Decode(&data)
			if len(data) != 3 {
				t.Fatal("public config leaked private fields")
			}
		}
		res.Body.Close()
	}
	for _, path := range []string{"/.env", "/assets/", "/unknown", "/api/unknown"} {
		res, err := server.Client().Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Fatalf("unexpected static path %s: %d", path, res.StatusCode)
		}
	}
	testPrivateCardsAndPreferences(t, ctx, client)

}
