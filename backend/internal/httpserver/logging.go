package httpserver

import (
	"context"
	"log/slog"
	"time"

	"connectrpc.com/connect"
	"github.com/google/uuid"
)

func requestLogging(logger *slog.Logger) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			started := time.Now()
			requestID := uuid.NewString()
			res, err := next(ctx, req)
			level, code := slog.LevelInfo, "ok"
			if err != nil {
				status := connect.CodeOf(err)
				code, level = status.String(), slog.LevelWarn
				if status == connect.CodeInternal || status == connect.CodeUnknown || status == connect.CodeUnavailable || status == connect.CodeDataLoss {
					level = slog.LevelError
				}
			}
			if res != nil {
				res.Header().Set("X-Request-ID", requestID)
			}
			if connectErr, ok := err.(*connect.Error); ok {
				connectErr.Meta().Set("X-Request-ID", requestID)
			}
			// Only protocol metadata is logged; never request headers, bodies or error messages.
			logger.Log(ctx, level, "RPC 请求完成", "request_id", requestID,
				"procedure", req.Spec().Procedure, "code", code,
				"duration_ms", time.Since(started).Milliseconds())
			return res, err
		}
	}
}
