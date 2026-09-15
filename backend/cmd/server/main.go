package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gocloudio/link-hub/backend/internal/auth"
	"github.com/gocloudio/link-hub/backend/internal/config"
	"github.com/gocloudio/link-hub/backend/internal/httpserver"
	"github.com/gocloudio/link-hub/backend/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("服务启动失败", "error", err)
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
	c, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	startup, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	s, err := store.Open(startup, c.DatabaseURL)
	if err != nil {
		return err
	}
	defer s.Close()
	if err = s.Migrate(startup); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		return nil
	}
	verifier := auth.NewEntra(ctx, c.TenantID, c.Audience, c.RequiredScope, c.AdminRole)
	server := &http.Server{Addr: c.HTTPAddr, Handler: httpserver.New(c, s, verifier), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10}
	finished := make(chan error, 1)
	go func() { slog.Info("团队导航已启动", "address", c.HTTPAddr); finished <- server.ListenAndServe() }()
	select {
	case err = <-finished:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
	return nil
}
