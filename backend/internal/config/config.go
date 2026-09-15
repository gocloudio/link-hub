package config

import (
	"fmt"
	"net"
	"os"
	"strings"

	"github.com/google/uuid"
)

type Config struct {
	HTTPAddr, DatabaseURL, WebDir                                    string
	TenantID, ClientID, Audience, RequiredScope, APIScope, AdminRole string
}

func Load() (Config, error) {
	value := func(fallback string, keys ...string) string {
		for _, key := range keys {
			if v := strings.TrimSpace(os.Getenv(key)); v != "" {
				return v
			}
		}
		return fallback
	}
	c := Config{
		HTTPAddr: value(":8080", "HTTP_ADDR"), DatabaseURL: value("", "DATABASE_URL"), WebDir: value("../web/dist", "WEB_DIR"),
		TenantID: value("", "ENTRA_TENANT_ID", "VITE_ENTRA_TENANT_ID"),
		ClientID: value("", "ENTRA_CLIENT_ID", "VITE_ENTRA_CLIENT_ID"),
		Audience: value("", "ENTRA_AUDIENCE"), RequiredScope: value("dm.access", "ENTRA_REQUIRED_SCOPE"),
		APIScope: value("", "ENTRA_API_SCOPE", "VITE_ENTRA_API_SCOPE"), AdminRole: value("dm.admin", "ENTRA_ADMIN_ROLE"),
	}
	if mode := value("entra", "AUTH_MODE", "VITE_AUTH_MODE"); mode != "entra" {
		return c, fmt.Errorf("AUTH_MODE 只支持 entra，正式应用没有开发身份入口")
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("缺少 DATABASE_URL")
	}
	if _, err := net.ResolveTCPAddr("tcp", c.HTTPAddr); err != nil {
		return c, fmt.Errorf("HTTP_ADDR 格式错误")
	}
	for name, value := range map[string]string{"ENTRA_TENANT_ID": c.TenantID, "ENTRA_CLIENT_ID": c.ClientID, "ENTRA_AUDIENCE": c.Audience} {
		if err := uuid.Validate(value); err != nil {
			return c, fmt.Errorf("%s 必须配置为有效的应用或租户 UUID", name)
		}
	}
	if strings.ContainsAny(c.RequiredScope, " \t\r\n/") {
		return c, fmt.Errorf("ENTRA_REQUIRED_SCOPE 必须为单个短作用域名称")
	}
	if c.APIScope == "" {
		c.APIScope = "api://" + c.Audience + "/" + c.RequiredScope
	}
	if !strings.HasSuffix(c.APIScope, "/"+c.RequiredScope) || strings.ContainsAny(c.APIScope, " \t\r\n") {
		return c, fmt.Errorf("前端 API scope 必须与 ENTRA_REQUIRED_SCOPE 匹配")
	}
	return c, nil
}
