package auth

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/google/uuid"
)

var ErrInvalidToken = errors.New("登录已失效，请重新登录")

type Principal struct {
	ID, Name, Username string
	IsAdmin            bool
}
type Verifier interface {
	Verify(context.Context, string) (Principal, error)
}
type Entra struct {
	verifier            *oidc.IDTokenVerifier
	tenant, scope, role string
}

// 固定租户及其签名密钥端点；登录服务不可用时，匿名浏览仍不依赖外部网络。
func NewEntra(ctx context.Context, tenant, audience, scope, role string) *Entra {
	ctx = oidc.ClientContext(ctx, &http.Client{Timeout: 10 * time.Second})
	issuer := "https://login.microsoftonline.com/" + tenant + "/v2.0"
	keys := oidc.NewRemoteKeySet(ctx, "https://login.microsoftonline.com/"+tenant+"/discovery/v2.0/keys")
	return newVerifier(issuer, tenant, audience, scope, role, keys)
}

func newVerifier(issuer, tenant, audience, scope, role string, keys oidc.KeySet) *Entra {
	return &Entra{verifier: oidc.NewVerifier(issuer, keys, &oidc.Config{ClientID: audience, SupportedSigningAlgs: []string{oidc.RS256}}), tenant: tenant, scope: scope, role: role}
}

func (v *Entra) Verify(ctx context.Context, raw string) (Principal, error) {
	token, err := v.verifier.Verify(ctx, raw)
	if err != nil {
		return Principal{}, ErrInvalidToken
	}
	var claims struct {
		OID       string   `json:"oid"`
		Tenant    string   `json:"tid"`
		Version   string   `json:"ver"`
		Scope     string   `json:"scp"`
		Name      string   `json:"name"`
		Username  string   `json:"preferred_username"`
		UPN       string   `json:"upn"`
		Roles     []string `json:"roles"`
		NotBefore int64    `json:"nbf"`
	}
	if token.Claims(&claims) != nil || claims.Version != "2.0" || !strings.EqualFold(claims.Tenant, v.tenant) || uuid.Validate(claims.OID) != nil || !slices.Contains(strings.Fields(claims.Scope), v.scope) || claims.NotBefore > time.Now().Add(30*time.Second).Unix() {
		return Principal{}, ErrInvalidToken
	}
	if claims.Username == "" {
		claims.Username = claims.UPN
	}
	if claims.Name == "" {
		claims.Name = claims.Username
	}
	return Principal{ID: claims.OID, Name: claims.Name, Username: claims.Username, IsAdmin: slices.Contains(claims.Roles, v.role)}, nil
}

type principalKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, p)
}
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(principalKey{}).(Principal)
	return p, ok
}
