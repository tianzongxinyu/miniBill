package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
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
	authSvc := auth.NewService(sys.Cfg.JWTSecret, sys.Cfg.JWTExpireDuration())
	srv := handler.NewServer(sys.Cfg, sys.Store, sys.Factory, authSvc)
	return httptest.NewServer(srv.Router()), sys.Cfg
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

func TestLoginCookieAuth(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Jar: jar}

	body, _ := json.Marshal(map[string]string{"username": "carol", "password": "secret1"})
	res, err := client.Post(ts.URL+"/api/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register status %d", res.StatusCode)
	}
	res.Body.Close()

	reqTags, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	resTags, err := client.Do(reqTags)
	if err != nil {
		t.Fatal(err)
	}
	if resTags.StatusCode != http.StatusOK {
		t.Fatalf("tags with cookie status %d", resTags.StatusCode)
	}
	resTags.Body.Close()

	reqSession, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/auth/session", nil)
	resSession, err := client.Do(reqSession)
	if err != nil {
		t.Fatal(err)
	}
	if resSession.StatusCode != http.StatusOK {
		t.Fatalf("session status %d", resSession.StatusCode)
	}
	var session struct {
		Token string `json:"token"`
		User  struct {
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := json.NewDecoder(resSession.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	resSession.Body.Close()
	if session.Token == "" || session.User.Username != "carol" {
		t.Fatalf("unexpected session %+v", session)
	}

	reqLogout, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/auth/logout", nil)
	resLogout, err := client.Do(reqLogout)
	if err != nil {
		t.Fatal(err)
	}
	if resLogout.StatusCode != http.StatusNoContent {
		t.Fatalf("logout status %d", resLogout.StatusCode)
	}
	resLogout.Body.Close()

	reqAfter, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	resAfter, err := client.Do(reqAfter)
	if err != nil {
		t.Fatal(err)
	}
	if resAfter.StatusCode != http.StatusUnauthorized {
		t.Fatalf("tags after logout status %d, want 401", resAfter.StatusCode)
	}
	resAfter.Body.Close()
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

func TestChangePasswordInvalidatesOldToken(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	token := registerTestUser(t, ts, "dave", "secret1")

	body, _ := json.Marshal(map[string]string{
		"old_password": "secret1",
		"new_password": "secret2",
	})
	req, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/auth/password", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("change password status %d", res.StatusCode)
	}
	res.Body.Close()

	reqOld, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	reqOld.Header.Set("Authorization", "Bearer "+token)
	resOld, err := http.DefaultClient.Do(reqOld)
	if err != nil {
		t.Fatal(err)
	}
	if resOld.StatusCode != http.StatusUnauthorized {
		t.Fatalf("old token status %d, want 401", resOld.StatusCode)
	}
	resOld.Body.Close()

	loginBody, _ := json.Marshal(map[string]string{"username": "dave", "password": "secret2"})
	resLogin, err := http.Post(ts.URL+"/api/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatal(err)
	}
	if resLogin.StatusCode != http.StatusOK {
		t.Fatalf("login status %d", resLogin.StatusCode)
	}
	var login struct {
		Token string `json:"token"`
	}
	json.NewDecoder(resLogin.Body).Decode(&login)
	resLogin.Body.Close()
	if login.Token == "" {
		t.Fatal("expected new token")
	}

	reqNew, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	reqNew.Header.Set("Authorization", "Bearer "+login.Token)
	resNew, err := http.DefaultClient.Do(reqNew)
	if err != nil {
		t.Fatal(err)
	}
	if resNew.StatusCode != http.StatusOK {
		t.Fatalf("new token status %d", resNew.StatusCode)
	}
	resNew.Body.Close()
}

func TestResetPasswordInvalidatesOldToken(t *testing.T) {
	ts, cfg := setupTestServer(t)
	defer ts.Close()

	token := registerTestUser(t, ts, "erin", "secret1")

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer sys.Close()

	if _, err := bootstrap.ResetUserPassword(sys, "erin", "secret9"); err != nil {
		t.Fatal(err)
	}

	reqOld, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	reqOld.Header.Set("Authorization", "Bearer "+token)
	resOld, err := http.DefaultClient.Do(reqOld)
	if err != nil {
		t.Fatal(err)
	}
	if resOld.StatusCode != http.StatusUnauthorized {
		t.Fatalf("old token after reset status %d, want 401", resOld.StatusCode)
	}
	resOld.Body.Close()

	loginBody, _ := json.Marshal(map[string]string{"username": "erin", "password": "secret9"})
	resLogin, err := http.Post(ts.URL+"/api/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatal(err)
	}
	if resLogin.StatusCode != http.StatusOK {
		t.Fatalf("login after reset status %d", resLogin.StatusCode)
	}
	resLogin.Body.Close()
}

func TestLegacyTokenWithoutTVStillValidAtVersionZero(t *testing.T) {
	ts, cfg := setupTestServer(t)
	defer ts.Close()

	_ = registerTestUser(t, ts, "frank", "secret1")

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer sys.Close()
	user, err := sys.Store.GetByUsername("frank")
	if err != nil || user == nil {
		t.Fatal("user not found")
	}
	if user.TokenVersion != 0 {
		t.Fatalf("token_version = %d, want 0", user.TokenVersion)
	}

	// Simulate pre-upgrade JWT missing `tv` (Go zero-value TokenVersion = 0).
	authSvc := auth.NewService(sys.Cfg.JWTSecret, sys.Cfg.JWTExpireDuration())
	legacy, err := authSvc.Sign(user.ID, user.Username, 0)
	if err != nil {
		t.Fatal(err)
	}

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/tags", nil)
	req.Header.Set("Authorization", "Bearer "+legacy)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("legacy tv=0 token status %d, want 200", res.StatusCode)
	}
	res.Body.Close()
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
