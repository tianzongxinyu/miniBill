package middleware

import (
	"context"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
)

type gatewayTrustedKeyType struct{}

// GatewayTrustedKey marks requests accepted on the fnOS gateway Unix socket.
var GatewayTrustedKey = gatewayTrustedKeyType{}

// WithGatewayTrusted returns a child context flagged as gateway-trusted.
func WithGatewayTrusted(ctx context.Context) context.Context {
	return context.WithValue(ctx, GatewayTrustedKey, true)
}

// IsGatewayTrusted reports whether the request arrived via the trusted Unix gateway socket.
func IsGatewayTrusted(c *gin.Context) bool {
	v, _ := c.Request.Context().Value(GatewayTrustedKey).(bool)
	return v
}

// GatewayConnContext tags Unix socket connections so handlers can trust X-Trim-* headers.
func GatewayConnContext(ctx context.Context, c net.Conn) context.Context {
	if _, ok := c.(*net.UnixConn); ok {
		return WithGatewayTrusted(ctx)
	}
	return ctx
}

// StripPrefixHandler removes gatewayPrefix from the request path before serving.
func StripPrefixHandler(prefix string, next http.Handler) http.Handler {
	if prefix == "" {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == prefix || len(path) > len(prefix) && path[:len(prefix)] == prefix && path[len(prefix)] == '/' {
			r2 := r.Clone(r.Context())
			r2.URL.Path = path[len(prefix):]
			if r2.URL.Path == "" {
				r2.URL.Path = "/"
			}
			next.ServeHTTP(w, r2)
			return
		}
		next.ServeHTTP(w, r)
	})
}
