package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/minibill/minibill/internal/middleware"
)

func TestStripPrefixHandler(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Path", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	})
	h := middleware.StripPrefixHandler("/app/minibill", next)

	req := httptest.NewRequest(http.MethodGet, "/app/minibill/api/health", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if got := rec.Header().Get("X-Path"); got != "/api/health" {
		t.Fatalf("path = %q, want /api/health", got)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if got := rec2.Header().Get("X-Path"); got != "/api/health" {
		t.Fatalf("unprefixed path = %q", got)
	}
}
