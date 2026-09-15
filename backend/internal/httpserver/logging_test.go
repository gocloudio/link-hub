package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"connectrpc.com/connect"
	pb "github.com/gocloudio/link-hub/backend/gen/linkhub/v1"
	rpc "github.com/gocloudio/link-hub/backend/gen/linkhub/v1/linkhubv1connect"
	"github.com/google/uuid"
)

type loggingService struct {
	rpc.UnimplementedHubServiceHandler
}

func (loggingService) CreateCategory(context.Context, *connect.Request[pb.CreateCategoryRequest]) (*connect.Response[pb.CreateCategoryResponse], error) {
	return connect.NewResponse(&pb.CreateCategoryResponse{}), nil
}

// Exercise the actual Connect handler: logging must cover authorization failures,
// preserve success/error responses, and omit credentials and user content.
func TestRequestLogging(t *testing.T) {
	for _, tc := range []struct{ token, code, level string }{
		{"admin", "ok", "INFO"},
		{"private-token", "unauthenticated", "WARN"},
		{"viewer", "permission_denied", "WARN"},
	} {
		t.Run(tc.code, func(t *testing.T) {
			var output bytes.Buffer
			logger := slog.New(slog.NewJSONHandler(&output, nil))
			_, handler := rpc.NewHubServiceHandler(loggingService{}, connect.WithInterceptors(requestLogging(logger), authorization(testVerifier{})))
			server := httptest.NewServer(handler)
			defer server.Close()
			client := rpc.NewHubServiceClient(server.Client(), server.URL)
			req := request(&pb.CreateCategoryRequest{Name: "private-description"}, tc.token)
			req.Header().Set("Cookie", "session=private-cookie")
			req.Header().Set("X-Request-ID", "untrusted-request-id")
			res, err := client.CreateCategory(context.Background(), req)
			var responseID string
			if tc.code == "ok" {
				if err != nil {
					t.Fatal(err)
				}
				responseID = res.Header().Get("X-Request-ID")
			} else {
				if err == nil || connect.CodeOf(err).String() != tc.code {
					t.Fatalf("unexpected response: %v", err)
				}
				responseID = err.(*connect.Error).Meta().Get("X-Request-ID")
			}
			var record map[string]any
			if err := json.Unmarshal(output.Bytes(), &record); err != nil {
				t.Fatal(err)
			}
			if uuid.Validate(responseID) != nil || record["request_id"] != responseID || record["code"] != tc.code || record["level"] != tc.level || record["procedure"] != rpc.HubServiceCreateCategoryProcedure {
				t.Fatalf("unexpected log: %s", output.String())
			}
			for _, secret := range []string{"private-token", "private-cookie", "private-description", "untrusted-request-id"} {
				if strings.Contains(output.String(), secret) {
					t.Fatalf("sensitive value appeared in logs: %s", secret)
				}
			}
		})
	}
}
