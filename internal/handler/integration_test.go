package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/handler"

	_ "modernc.org/sqlite"
)

func setupTestServer(t *testing.T) (*httptest.Server, config.Config) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	dir := t.TempDir()
	cfg := config.Config{
		JWTSecret:         "test-secret",
		DataDir:           dir,
		AllowRegistration: true,
		JWTExpireDays:     7,
		MigrationsSystem:  filepath.Join("..", "..", "migrations", "system"),
		MigrationsLedger:  filepath.Join("..", "..", "migrations", "ledger"),
	}
	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sys.Close() })
	authSvc := auth.NewService(cfg.JWTSecret, cfg.JWTExpireDuration())
	srv := handler.NewServer(cfg, sys.Store, sys.Factory, authSvc)
	return httptest.NewServer(srv.Router()), cfg
}

func TestRegisterAndLogin(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	body, _ := json.Marshal(map[string]string{"username": "alice", "password": "secret1"})
	res, err := http.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register status %d", res.StatusCode)
	}
	var reg struct {
		Token string `json:"token"`
		User  struct {
			ID int64 `json:"id"`
		} `json:"user"`
	}
	json.NewDecoder(res.Body).Decode(&reg)
	if reg.Token == "" {
		t.Fatal("expected token")
	}

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	req.Header.Set("Authorization", "Bearer "+reg.Token)
	res2, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("tags status %d", res2.StatusCode)
	}
}

func TestHealth(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()
	res, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("health status %d", res.StatusCode)
	}
}

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}
