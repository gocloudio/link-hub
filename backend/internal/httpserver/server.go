package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/gocloudio/link-hub/backend/gen/linkhub/v1/linkhubv1connect"
	"github.com/gocloudio/link-hub/backend/internal/auth"
	"github.com/gocloudio/link-hub/backend/internal/config"
	"github.com/gocloudio/link-hub/backend/internal/service"
	"github.com/gocloudio/link-hub/backend/internal/store"
)

func authorization(verifier auth.Verifier) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			switch req.Spec().Procedure {
			case linkhubv1connect.HubServiceListCategoriesProcedure, linkhubv1connect.HubServiceListCardsProcedure, linkhubv1connect.HubServiceGetCardProcedure:
				return next(ctx, req)
			}
			scheme, token, ok := strings.Cut(req.Header().Get("Authorization"), " ")
			if !ok || !strings.EqualFold(scheme, "Bearer") || token == "" || verifier == nil {
				return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
			}
			p, err := verifier.Verify(ctx, token)
			if err != nil {
				return nil, connect.NewError(connect.CodeUnauthenticated, auth.ErrInvalidToken)
			}
			if req.Spec().Procedure != linkhubv1connect.HubServiceGetMeProcedure && !p.IsAdmin {
				return nil, connect.NewError(connect.CodePermissionDenied, errors.New("当前账号没有管理员权限"))
			}
			return next(auth.WithPrincipal(ctx, p), req)
		}
	}
}

func New(c config.Config, s *store.Store, verifier auth.Verifier) http.Handler {
	mux := http.NewServeMux()
	base, handler := linkhubv1connect.NewHubServiceHandler(&service.Service{Store: s}, connect.WithInterceptors(authorization(verifier)), connect.WithReadMaxBytes(256<<10))
	mux.Handle(base, handler)
	mux.HandleFunc("GET /api/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		if err := s.Pool.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status":"unavailable"}`))
			return
		}
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("GET /api/runtime-config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			TenantID string `json:"tenantId"`
			ClientID string `json:"clientId"`
			APIScope string `json:"apiScope"`
		}{c.TenantID, c.ClientID, c.APIScope})
	})
	mux.Handle("/", static(c.WebDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://login.microsoftonline.com https://*.msauth.net; frame-src 'self' https://login.microsoftonline.com; base-uri 'self'; form-action 'self' https://login.microsoftonline.com; frame-ancestors 'self'; object-src 'none'")
		w.Header().Set("Cache-Control", "no-store")
		r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
		ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
		defer cancel()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}

func static(dir string) http.Handler {
	files := os.DirFS(dir)
	server := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		info, err := fs.Stat(files, name)
		if err != nil || info.IsDir() || strings.HasPrefix(name, ".") {
			http.NotFound(w, r)
			return
		}
		if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		server.ServeHTTP(w, r)
	})
}
