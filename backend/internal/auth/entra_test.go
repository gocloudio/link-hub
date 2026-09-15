package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
)

type signedKeys struct{ key *rsa.PublicKey }

func (k signedKeys) VerifySignature(_ context.Context, raw string) ([]byte, error) {
	object, err := jose.ParseSigned(raw, []jose.SignatureAlgorithm{jose.RS256})
	if err != nil {
		return nil, err
	}
	return object.Verify(k.key)
}
func TestEntraValidation(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	const tenant = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	const audience = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	issuer := "https://login.microsoftonline.com/" + tenant + "/v2.0"
	verifier := newVerifier(issuer, tenant, audience, "dm.access", "dm.admin", signedKeys{&key.PublicKey})
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, nil)
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name         string
		change       func(map[string]any)
		valid, admin bool
	}{
		{"admin", func(c map[string]any) {}, true, true},
		{"viewer", func(c map[string]any) { delete(c, "roles") }, true, false},
		{"similar role", func(c map[string]any) { c["roles"] = []string{"dm.admin.extra"} }, true, false},
		{"expired", func(c map[string]any) { c["exp"] = time.Now().Add(-time.Hour).Unix() }, false, false},
		{"wrong audience", func(c map[string]any) { c["aud"] = "other" }, false, false},
		{"wrong issuer", func(c map[string]any) { c["iss"] = "https://example.com" }, false, false},
		{"wrong tenant", func(c map[string]any) { c["tid"] = "other" }, false, false},
		{"id token", func(c map[string]any) { delete(c, "scp") }, false, false},
		{"wrong scope", func(c map[string]any) { c["scp"] = "dm.access.extra" }, false, false},
		{"future token", func(c map[string]any) { c["nbf"] = time.Now().Add(time.Hour).Unix() }, false, false},
		{"v1 token", func(c map[string]any) { c["ver"] = "1.0" }, false, false},
		{"missing oid", func(c map[string]any) { delete(c, "oid") }, false, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			c := map[string]any{"iss": issuer, "aud": audience, "tid": tenant, "ver": "2.0", "oid": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "exp": time.Now().Add(time.Hour).Unix(), "nbf": time.Now().Add(-time.Minute).Unix(), "scp": "openid dm.access", "roles": []string{"dm.admin"}, "name": "Admin"}
			tc.change(c)
			payload, _ := json.Marshal(c)
			object, err := signer.Sign(payload)
			if err != nil {
				t.Fatal(err)
			}
			raw, _ := object.CompactSerialize()
			principal, err := verifier.Verify(context.Background(), raw)
			if (err == nil) != tc.valid || principal.IsAdmin != tc.admin {
				t.Fatalf("valid=%v admin=%v error=%v", tc.valid, principal.IsAdmin, err)
			}
		})
	}
	other, _ := rsa.GenerateKey(rand.Reader, 2048)
	badSigner, _ := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: other}, nil)
	payload, _ := json.Marshal(map[string]any{"iss": issuer, "aud": audience, "exp": time.Now().Add(time.Hour).Unix()})
	object, _ := badSigner.Sign(payload)
	raw, _ := object.CompactSerialize()
	if _, err = verifier.Verify(context.Background(), raw); err == nil {
		t.Fatal("bad signature accepted")
	}
}
