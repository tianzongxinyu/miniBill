package systemdb

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/minibill/minibill/internal/sqliteutil"
)

var (
	ErrLastAdmin     = errors.New("cannot remove last admin")
	ErrSelfForbidden = errors.New("cannot modify own account this way")
)

type Store struct {
	db      *sql.DB
	dataDir string
}

type User struct {
	ID           int64
	Username     string
	PasswordHash string
	DataPath     string
	TokenVersion int64
	IsAdmin      bool
	Disabled     bool
	CreatedAt    string
}

type LedgerGrant struct {
	ID            int64
	OwnerUserID   int64
	GranteeUserID int64
	Permission    string
	CreatedAt     string
	// Joined fields (optional)
	GranteeUsername string
	OwnerUsername   string
}

type LedgerAccess struct {
	OwnerUserID int64
	Username    string
	Permission  string // owner | read | edit
}

const userSelectCols = `id, username, password_hash, data_path, token_version, is_admin, disabled, created_at`

func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(dataDir, "system.db")
	db, err := sqliteutil.Open(path)
	if err != nil {
		return nil, err
	}
	return &Store{db: db, dataDir: dataDir}, nil
}

func (s *Store) DB() *sql.DB { return s.db }

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) DataDir() string { return s.dataDir }

func scanUser(scanner interface{ Scan(dest ...any) error }) (*User, error) {
	u := &User{}
	var isAdmin, disabled int
	err := scanner.Scan(
		&u.ID, &u.Username, &u.PasswordHash, &u.DataPath, &u.TokenVersion,
		&isAdmin, &disabled, &u.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	u.IsAdmin = isAdmin != 0
	u.Disabled = disabled != 0
	return u, nil
}

func (s *Store) CountUsers() (int64, error) {
	var n int64
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) CountAdmins() (int64, error) {
	var n int64
	err := s.db.QueryRow(`SELECT COUNT(*) FROM users WHERE is_admin = 1 AND disabled = 0`).Scan(&n)
	return n, err
}

func (s *Store) CreateUser(username, passwordHash string) (*User, error) {
	count, err := s.CountUsers()
	if err != nil {
		return nil, err
	}
	isAdmin := 0
	if count == 0 {
		isAdmin = 1
	}
	res, err := s.db.Exec(
		`INSERT INTO users (username, password_hash, data_path, is_admin, disabled) VALUES (?, ?, '', ?, 0)`,
		username, passwordHash, isAdmin,
	)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	dataPath := fmt.Sprintf("users/%d/ledger.db", id)
	if _, err := s.db.Exec(`UPDATE users SET data_path = ? WHERE id = ?`, dataPath, id); err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *Store) GetByUsername(username string) (*User, error) {
	row := s.db.QueryRow(
		`SELECT `+userSelectCols+` FROM users WHERE username = ?`,
		username,
	)
	u, err := scanUser(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetByID(id int64) (*User, error) {
	row := s.db.QueryRow(
		`SELECT `+userSelectCols+` FROM users WHERE id = ?`,
		id,
	)
	u, err := scanUser(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetTokenVersion(id int64) (int64, error) {
	var v int64
	err := s.db.QueryRow(`SELECT token_version FROM users WHERE id = ?`, id).Scan(&v)
	if err == sql.ErrNoRows {
		return 0, sql.ErrNoRows
	}
	return v, err
}

// GetAuthGate returns token_version and disabled for middleware session checks.
func (s *Store) GetAuthGate(id int64) (tokenVersion int64, disabled bool, err error) {
	var d int
	err = s.db.QueryRow(`SELECT token_version, disabled FROM users WHERE id = ?`, id).Scan(&tokenVersion, &d)
	if err == sql.ErrNoRows {
		return 0, false, sql.ErrNoRows
	}
	if err != nil {
		return 0, false, err
	}
	return tokenVersion, d != 0, nil
}

// UpdatePassword sets a new password hash and increments token_version so existing JWTs fail.
func (s *Store) UpdatePassword(id int64, hash string) error {
	res, err := s.db.Exec(
		`UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?`,
		hash, id,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) ListUsers() ([]*User, error) {
	rows, err := s.db.Query(`SELECT ` + userSelectCols + ` FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}

// ListDirectory returns non-disabled users excluding excludeID (for grant picker).
func (s *Store) ListDirectory(excludeID int64) ([]*User, error) {
	rows, err := s.db.Query(
		`SELECT `+userSelectCols+` FROM users WHERE disabled = 0 AND id != ? ORDER BY username`,
		excludeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}

// UpdateUserFlags updates is_admin and/or disabled. actorID cannot target themselves for these ops.
func (s *Store) UpdateUserFlags(actorID, targetID int64, isAdmin, disabled *bool) error {
	if actorID == targetID {
		return ErrSelfForbidden
	}
	target, err := s.GetByID(targetID)
	if err != nil {
		return err
	}
	if target == nil {
		return sql.ErrNoRows
	}
	newAdmin := target.IsAdmin
	newDisabled := target.Disabled
	if isAdmin != nil {
		newAdmin = *isAdmin
	}
	if disabled != nil {
		newDisabled = *disabled
	}
	// Removing admin status or disabling an admin: ensure another active admin remains.
	losingAdmin := target.IsAdmin && (!newAdmin || newDisabled)
	if losingAdmin {
		n, err := s.CountAdmins()
		if err != nil {
			return err
		}
		if n <= 1 {
			return ErrLastAdmin
		}
	}
	adminInt, disabledInt := 0, 0
	if newAdmin {
		adminInt = 1
	}
	if newDisabled {
		disabledInt = 1
	}
	_, err = s.db.Exec(
		`UPDATE users SET is_admin = ?, disabled = ? WHERE id = ?`,
		adminInt, disabledInt, targetID,
	)
	return err
}

// DeleteUser removes the user row and related grants. Caller must close ledger DB and remove files.
func (s *Store) DeleteUser(actorID, targetID int64) error {
	if actorID == targetID {
		return ErrSelfForbidden
	}
	target, err := s.GetByID(targetID)
	if err != nil {
		return err
	}
	if target == nil {
		return sql.ErrNoRows
	}
	if target.IsAdmin && !target.Disabled {
		n, err := s.CountAdmins()
		if err != nil {
			return err
		}
		if n <= 1 {
			return ErrLastAdmin
		}
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(
		`DELETE FROM ledger_grants WHERE owner_user_id = ? OR grantee_user_id = ?`,
		targetID, targetID,
	); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM users WHERE id = ?`, targetID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}

func (s *Store) UpsertGrant(ownerID, granteeID int64, permission string) error {
	if ownerID == granteeID {
		return fmt.Errorf("cannot grant to self")
	}
	if permission != "read" && permission != "edit" {
		return fmt.Errorf("invalid permission")
	}
	grantee, err := s.GetByID(granteeID)
	if err != nil {
		return err
	}
	if grantee == nil || grantee.Disabled {
		return sql.ErrNoRows
	}
	_, err = s.db.Exec(`
		INSERT INTO ledger_grants (owner_user_id, grantee_user_id, permission)
		VALUES (?, ?, ?)
		ON CONFLICT(owner_user_id, grantee_user_id) DO UPDATE SET permission = excluded.permission
	`, ownerID, granteeID, permission)
	return err
}

func (s *Store) DeleteGrant(ownerID, granteeID int64) error {
	res, err := s.db.Exec(
		`DELETE FROM ledger_grants WHERE owner_user_id = ? AND grantee_user_id = ?`,
		ownerID, granteeID,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) ListGrantsByOwner(ownerID int64) ([]LedgerGrant, error) {
	rows, err := s.db.Query(`
		SELECT g.id, g.owner_user_id, g.grantee_user_id, g.permission, g.created_at, u.username
		FROM ledger_grants g
		JOIN users u ON u.id = g.grantee_user_id
		WHERE g.owner_user_id = ?
		ORDER BY u.username
	`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []LedgerGrant
	for rows.Next() {
		var g LedgerGrant
		if err := rows.Scan(
			&g.ID, &g.OwnerUserID, &g.GranteeUserID, &g.Permission, &g.CreatedAt, &g.GranteeUsername,
		); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, rows.Err()
}

// GetGrantPermission returns read/edit if grant exists, empty string otherwise.
func (s *Store) GetGrantPermission(ownerID, granteeID int64) (string, error) {
	var perm string
	err := s.db.QueryRow(
		`SELECT permission FROM ledger_grants WHERE owner_user_id = ? AND grantee_user_id = ?`,
		ownerID, granteeID,
	).Scan(&perm)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return perm, nil
}

// ListAccessibleLedgers returns own ledger plus grants where owner is not disabled.
func (s *Store) ListAccessibleLedgers(userID int64) ([]LedgerAccess, error) {
	self, err := s.GetByID(userID)
	if err != nil {
		return nil, err
	}
	if self == nil {
		return nil, sql.ErrNoRows
	}
	out := []LedgerAccess{{
		OwnerUserID: self.ID,
		Username:    self.Username,
		Permission:  "owner",
	}}
	rows, err := s.db.Query(`
		SELECT u.id, u.username, g.permission
		FROM ledger_grants g
		JOIN users u ON u.id = g.owner_user_id
		WHERE g.grantee_user_id = ? AND u.disabled = 0
		ORDER BY u.username
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var a LedgerAccess
		if err := rows.Scan(&a.OwnerUserID, &a.Username, &a.Permission); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
