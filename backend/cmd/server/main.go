package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gocloudio/link-hub/backend/internal/auth"
	"github.com/gocloudio/link-hub/backend/internal/config"
	"github.com/gocloudio/link-hub/backend/internal/httpserver"
	"github.com/gocloudio/link-hub/backend/internal/logging"
	"github.com/gocloudio/link-hub/backend/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	if err := run(); err != nil {
		slog.Error("服务退出", "error", err)
		os.Exit(1)
	}
}
func run() error {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		addr := os.Getenv("HTTP_ADDR")
		if addr == "" {
			addr = ":8080"
		}
		if strings.HasPrefix(addr, ":") {
			addr = "127.0.0.1" + addr
		}
		client := http.Client{Timeout: 4 * time.Second}
		res, err := client.Get("http://" + addr + "/api/healthz")
		if err != nil {
			return errors.New("健康检查失败")
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return errors.New("健康检查失败")
		}
		return nil
	}
	started := time.Now()
	slog.Info("服务启动中")
	c, err := config.Load()
	if err != nil {
		return err
	}
	slog.Info("配置加载完成", "address", c.HTTPAddr, "web_dir", c.WebDir, "auth_mode", "entra", "database_env", "DATABASE_URL")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	s, err := store.Open(startup, c.DatabaseURL)
	if err != nil {
		return err
	}
	defer s.Close()
	migrationStarted := time.Now()
	slog.Info("数据库迁移开始")
	if err = s.Migrate(startup); err != nil {
		slog.Error("数据库迁移失败", "error_type", logging.ErrorKind(err), "duration_ms", time.Since(migrationStarted).Milliseconds())
		return errors.New("数据库迁移失败，请检查数据库日志及应用迁移权限")
	}
	slog.Info("数据库迁移完成", "duration_ms", time.Since(migrationStarted).Milliseconds())
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		return nil
	}
	verifier := auth.NewEntra(ctx, c.TenantID, c.Audience, c.RequiredScope, c.AdminRole)
	slog.Info("Entra 验证器已配置", "required_scope", c.RequiredScope, "admin_role", c.AdminRole)
	server := &http.Server{Addr: c.HTTPAddr, Handler: httpserver.New(c, s, verifier), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
	listener, err := net.Listen("tcp", c.HTTPAddr)
	if err != nil {
		return err
	}
	slog.Info("团队导航已启动", "address", listener.Addr().String(), "duration_ms", time.Since(started).Milliseconds())
	finished := make(chan error, 1)
	go func() { finished <- server.Serve(listener) }()
	select {
	case err = <-finished:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		slog.Info("收到停止信号，正在关闭服务")
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			return err
		}
	}
	slog.Info("服务已停止")
	return nil
}
