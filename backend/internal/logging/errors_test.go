package logging

import (
	"context"
	"fmt"
	"net"
	"syscall"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestErrorKindDoesNotExposeDetails(t *testing.T) {
	for _, tc := range []struct {
		err  error
		want string
	}{
		{&pgconn.PgError{Code: "28P01", Message: "private-user", Detail: "private-password"}, "postgres:28P01"},
		{&net.DNSError{Name: "private-host", Err: "private-details"}, "dns_lookup_failed"},
		{syscall.ECONNREFUSED, "connection_refused"},
		{context.DeadlineExceeded, "timeout"},
		{context.Canceled, "canceled"},
		{fmt.Errorf("postgres://private-user:private-password@private-host/db"), "operation_failed"},
	} {
		if got := ErrorKind(fmt.Errorf("connection includes private credentials: %w", tc.err)); got != tc.want {
			t.Errorf("got %q, want %q", got, tc.want)
		}
	}
}
