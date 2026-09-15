package logging

import (
	"context"
	"errors"
	"net"
	"syscall"

	"github.com/jackc/pgx/v5/pgconn"
)

// ErrorKind preserves diagnostic categories without exposing connection strings,
// SQL parameters, PostgreSQL error details, or authentication tokens.
func ErrorKind(err error) string {
	var pg *pgconn.PgError
	var dns *net.DNSError
	var network net.Error
	switch {
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.As(err, &pg):
		return "postgres:" + pg.Code
	case errors.As(err, &dns):
		return "dns_lookup_failed"
	case errors.Is(err, syscall.ECONNREFUSED):
		return "connection_refused"
	case errors.As(err, &network) && network.Timeout():
		return "timeout"
	default:
		return "operation_failed"
	}
}
