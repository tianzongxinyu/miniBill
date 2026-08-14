package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/middleware"
)

func TestFnosLoginRequiresGatewayTrust(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/auth/fnos", nil)
	req.Header.Set("X-Trim-Username", "alice")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 without gateway trust", res.StatusCode)
	}
}

func TestFnosLoginMatchingUser(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	body, _ := json.Marshal(map[string]string{"username": "alice", "password": "secret1"})
	reg, err := http.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	reg.Body.Close()
	if reg.StatusCode != http.StatusCreated {
		t.Fatalf("register %d", reg.StatusCode)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/fnos", nil)
	req = req.WithContext(middleware.WithGatewayTrusted(req.Context()))
	req.Header.Set("X-Trim-Username", "alice")
	rec := httptest.NewRecorder()
	ts.Config.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	var out struct {
		Token string `json:"token"`
		User  struct {
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Token == "" || out.User.Username != "alice" {
		t.Fatalf("unexpected response %+v", out)
	}
}

func TestFnosLoginNoMatchingUser(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/fnos", nil)
	req = req.WithContext(middleware.WithGatewayTrusted(req.Context()))
	req.Header.Set("X-Trim-Username", "nobody")
	rec := httptest.NewRecorder()
	ts.Config.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	var errBody struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &errBody)
	if errBody.Error != "NO_MATCHING_USER" {
		t.Fatalf("error = %q, want NO_MATCHING_USER", errBody.Error)
	}
}

func TestFnosLoginDisabledUser(t *testing.T) {
	ts, cfg := setupTestServer(t)
	defer ts.Close()

	adminBody, _ := json.Marshal(map[string]string{"username": "admin", "password": "secret1"})
	reg, err := http.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(adminBody))
	if err != nil {
		t.Fatal(err)
	}
	reg.Body.Close()
	if reg.StatusCode != http.StatusCreated {
		t.Fatalf("register admin %d", reg.StatusCode)
	}

	bobBody, _ := json.Marshal(map[string]string{"username": "bob", "password": "secret1"})
	reg2, err := http.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(bobBody))
	if err != nil {
		t.Fatal(err)
	}
	reg2.Body.Close()
	if reg2.StatusCode != http.StatusCreated {
		t.Fatalf("register bob %d", reg2.StatusCode)
	}

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer sys.Close()
	admin, err := sys.Store.GetByUsername("admin")
	if err != nil || admin == nil {
		t.Fatal(err)
	}
	bob, err := sys.Store.GetByUsername("bob")
	if err != nil || bob == nil {
		t.Fatal(err)
	}
	dis := true
	if err := sys.Store.UpdateUserFlags(admin.ID, bob.ID, nil, &dis); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/auth/fnos", nil)
	req = req.WithContext(middleware.WithGatewayTrusted(req.Context()))
	req.Header.Set("X-Trim-Username", "bob")
	rec := httptest.NewRecorder()
	ts.Config.Handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
