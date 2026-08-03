package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"
)

func registerUser(t *testing.T, tsURL, username, password string) (token string, userID int64) {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	res, err := http.Post(tsURL+"/api/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register %s status %d", username, res.StatusCode)
	}
	var out struct {
		Token string `json:"token"`
		User  struct {
			ID      int64 `json:"id"`
			IsAdmin bool  `json:"is_admin"`
		} `json:"user"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}
	return out.Token, out.User.ID
}

func authJSON(t *testing.T, method, url, token string, body any, headerOwnerID int64) *http.Response {
	t.Helper()
	var rdr *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, rdr)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if headerOwnerID > 0 {
		req.Header.Set("X-Ledger-Owner-Id", strconv.FormatInt(headerOwnerID, 10))
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func TestFirstUserIsAdmin(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	token, _ := registerUser(t, ts.URL, "admin1", "secret1")
	res := authJSON(t, http.MethodGet, ts.URL+"/api/auth/session", token, nil, 0)
	defer res.Body.Close()
	var sess struct {
		User struct {
			IsAdmin bool `json:"is_admin"`
		} `json:"user"`
	}
	json.NewDecoder(res.Body).Decode(&sess)
	if !sess.User.IsAdmin {
		t.Fatal("first user should be admin")
	}

	token2, _ := registerUser(t, ts.URL, "bob", "secret1")
	res2 := authJSON(t, http.MethodGet, ts.URL+"/api/auth/session", token2, nil, 0)
	defer res2.Body.Close()
	var sess2 struct {
		User struct {
			IsAdmin bool `json:"is_admin"`
		} `json:"user"`
	}
	json.NewDecoder(res2.Body).Decode(&sess2)
	if sess2.User.IsAdmin {
		t.Fatal("second user should not be admin")
	}
}

func TestLedgerGrantReadWrite(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	adminToken, adminID := registerUser(t, ts.URL, "owner1", "secret1")
	bobToken, bobID := registerUser(t, ts.URL, "reader1", "secret1")

	res := authJSON(t, http.MethodPut, ts.URL+"/api/ledger/grants", adminToken, map[string]any{
		"grantee_user_id": bobID,
		"permission":      "read",
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("grant status %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodGet, ts.URL+"/api/tags", bobToken, nil, adminID)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("read tags status %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPost, ts.URL+"/api/tags", bobToken, map[string]string{"name": "x"}, adminID)
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("read create tag want 403 got %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPut, ts.URL+"/api/ledger/grants", adminToken, map[string]any{
		"grantee_user_id": bobID,
		"permission":      "edit",
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("upgrade grant status %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPost, ts.URL+"/api/tags", bobToken, map[string]string{"name": "shared-tag"}, adminID)
	res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("edit create tag want 201 got %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPut, ts.URL+"/api/settings", bobToken, map[string]any{
		"locale": "en", "default_date_mode": "today", "amount_color_scheme": "red_up",
	}, adminID)
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("settings put want 403 got %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPut, ts.URL+"/api/admin/users/"+strconv.FormatInt(bobID, 10), adminToken, map[string]any{
		"is_admin": true,
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("make bob admin status %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodPut, ts.URL+"/api/admin/users/"+strconv.FormatInt(adminID, 10), bobToken, map[string]any{
		"disabled": true,
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("disable owner status %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodGet, ts.URL+"/api/tags", bobToken, nil, adminID)
	res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("disabled owner ledger want 403 got %d", res.StatusCode)
	}

	res = authJSON(t, http.MethodGet, ts.URL+"/api/ledgers", bobToken, nil, 0)
	defer res.Body.Close()
	var ledgers struct {
		Items []struct {
			OwnerID int64 `json:"owner_id"`
		} `json:"items"`
	}
	json.NewDecoder(res.Body).Decode(&ledgers)
	for _, it := range ledgers.Items {
		if it.OwnerID == adminID {
			t.Fatal("disabled owner ledger should not appear in list")
		}
	}
}

func TestAdminCreateUser(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	adminToken, _ := registerUser(t, ts.URL, "root", "secret1")
	res := authJSON(t, http.MethodPost, ts.URL+"/api/admin/users", adminToken, map[string]string{
		"username": "newbie",
		"password": "secret1",
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatalf("admin create status %d", res.StatusCode)
	}
}

func TestDisabledUserCannotLogin(t *testing.T) {
	ts, _ := setupTestServer(t)
	defer ts.Close()

	adminToken, _ := registerUser(t, ts.URL, "root2", "secret1")
	_, bobID := registerUser(t, ts.URL, "disabled_bob", "secret1")

	res := authJSON(t, http.MethodPut, ts.URL+"/api/admin/users/"+strconv.FormatInt(bobID, 10), adminToken, map[string]any{
		"disabled": true,
	}, 0)
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("disable status %d", res.StatusCode)
	}

	body, _ := json.Marshal(map[string]string{"username": "disabled_bob", "password": "secret1"})
	res, err := http.Post(ts.URL+"/api/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("login disabled want 401 got %d", res.StatusCode)
	}
}
