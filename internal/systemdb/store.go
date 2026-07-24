package systemdb

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/minibill/minibill/internal/sqliteutil"
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
}

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

func (s *Store) CreateUser(username, passwordHash string) (*User, error) {
	res, err := s.db.Exec(
		`INSERT INTO users (username, password_hash, data_path) VALUES (?, ?, '')`,
		username, passwordHash,
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
	return &User{ID: id, Username: username, PasswordHash: passwordHash, DataPath: dataPath, TokenVersion: 0}, nil
}

func (s *Store) GetByUsername(username string) (*User, error) {
	u := &User{}
	err := s.db.QueryRow(
		`SELECT id, username, password_hash, data_path, token_version FROM users WHERE username = ?`,
		username,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DataPath, &u.TokenVersion)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetByID(id int64) (*User, error) {
	u := &User{}
	err := s.db.QueryRow(
		`SELECT id, username, password_hash, data_path, token_version FROM users WHERE id = ?`,
		id,
	).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DataPath, &u.TokenVersion)
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
	rows, err := s.db.Query(`SELECT id, username, password_hash, data_path, token_version FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*User
	for rows.Next() {
		u := &User{}
		if err := rows.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.DataPath, &u.TokenVersion); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, rows.Err()
}
