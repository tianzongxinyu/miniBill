package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
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
		JWTSecret:         "test-integration-jwt-secret-min-32-chars",
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

func TestTransactionUpdateRefreshesListTags(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	token := registerTestUser(t, ts, "bob", "secret1")

	tagA := createTestTag(t, ts, token, "餐饮")
	tagB := createTestTag(t, ts, token, "交通")

	txBody, _ := json.Marshal(map[string]any{
		"amount":           10000,
		"type":             "expense",
		"transaction_date": "2026-06-15",
		"note":             "test",
		"tag_ids":          []int64{tagA},
	})
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/transactions", bytes.NewReader(txBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create tx status %d", res.StatusCode)
	}
	var created struct {
		ID int64 `json:"id"`
	}
	json.NewDecoder(res.Body).Decode(&created)
	res.Body.Close()
	if created.ID == 0 {
		t.Fatal("expected transaction id")
	}

	tags := listTestTransactionTags(t, ts, token, 2026, 6, created.ID)
	if len(tags) != 1 || tags[0] != "餐饮" {
		t.Fatalf("initial tags = %v, want [餐饮]", tags)
	}

	updateBody, _ := json.Marshal(map[string]any{
		"amount":           10000,
		"type":             "expense",
		"transaction_date": "2026-06-15",
		"note":             "test",
		"tag_ids":          []int64{tagB},
	})
	req2, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/transactions/"+strconv.FormatInt(created.ID, 10), bytes.NewReader(updateBody))
	req2.Header.Set("Authorization", "Bearer "+token)
	req2.Header.Set("Content-Type", "application/json")
	res2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("update tx status %d", res2.StatusCode)
	}
	res2.Body.Close()

	tags = listTestTransactionTags(t, ts, token, 2026, 6, created.ID)
	if len(tags) != 1 || tags[0] != "交通" {
		t.Fatalf("after update tags = %v, want [交通]", tags)
	}
}

func registerTestUser(t *testing.T, ts *httptest.Server, username, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	res, err := http.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register status %d", res.StatusCode)
	}
	var reg struct {
		Token string `json:"token"`
	}
	json.NewDecoder(res.Body).Decode(&reg)
	res.Body.Close()
	if reg.Token == "" {
		t.Fatal("expected token")
	}
	return reg.Token
}

func createTestTag(t *testing.T, ts *httptest.Server, token, name string) int64 {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"name": name})
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/tags", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("create tag status %d", res.StatusCode)
	}
	var tag struct {
		ID int64 `json:"id"`
	}
	json.NewDecoder(res.Body).Decode(&tag)
	res.Body.Close()
	if tag.ID == 0 {
		t.Fatalf("expected tag id for %q", name)
	}
	return tag.ID
}

func listTestTransactionTags(t *testing.T, ts *httptest.Server, token string, year, month int, txID int64) []string {
	t.Helper()
	url := ts.URL + "/api/transactions?year=" + strconv.Itoa(year) + "&month=" + strconv.Itoa(month)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("list tx status %d", res.StatusCode)
	}
	var page struct {
		Items []struct {
			ID   int64    `json:"id"`
			Tags []string `json:"tags"`
		} `json:"items"`
	}
	json.NewDecoder(res.Body).Decode(&page)
	res.Body.Close()
	for _, item := range page.Items {
		if item.ID == txID {
			return item.Tags
		}
	}
	t.Fatalf("transaction %d not found in list", txID)
	return nil
}

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}
