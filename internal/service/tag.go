package service

import (
	"database/sql"
	"errors"
)

var ErrSystemTag = errors.New("system tag")
var ErrTagInUse = errors.New("tag in use")

type Tag struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	IsSystem   bool   `json:"is_system"`
	Enabled    bool   `json:"enabled"`
	Selectable bool   `json:"selectable"`
}

type TagService struct{}

func (s *TagService) List(db *sql.DB, enabledOnly bool) ([]Tag, error) {
	q := `SELECT id, name, is_system, enabled FROM tags`
	if enabledOnly {
		q += ` WHERE enabled = 1`
	}
	q += ` ORDER BY is_system DESC, name ASC`
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Tag
	for rows.Next() {
		var t Tag
		var sys, en int
		if err := rows.Scan(&t.ID, &t.Name, &sys, &en); err != nil {
			return nil, err
		}
		list = append(list, tagFromInts(t.ID, t.Name, sys, en))
	}
	return list, nil
}

func (s *TagService) Create(db *sql.DB, name string) (*Tag, error) {
	res, err := db.Exec(`INSERT INTO tags (name, is_system, enabled) VALUES (?, 0, 1)`, name)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &Tag{ID: id, Name: name, Enabled: true, Selectable: true}, nil
}

func (s *TagService) Update(db *sql.DB, id int64, enabled bool) (*Tag, error) {
	var t Tag
	var sys, en int
	err := db.QueryRow(`SELECT id, name, is_system, enabled FROM tags WHERE id=?`, id).
		Scan(&t.ID, &t.Name, &sys, &en)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	enVal := 0
	if enabled {
		enVal = 1
	}
	_, err = db.Exec(`UPDATE tags SET enabled=? WHERE id=?`, enVal, id)
	if err != nil {
		return nil, err
	}
	result := tagFromInts(t.ID, t.Name, sys, en)
	result.Enabled = enabled
	return &result, nil
}

func (s *TagService) Delete(db *sql.DB, id int64) error {
	var sys int
	err := db.QueryRow(`SELECT is_system FROM tags WHERE id=?`, id).Scan(&sys)
	if err == sql.ErrNoRows {
		return sql.ErrNoRows
	}
	if err != nil {
		return err
	}
	if sys == 1 {
		return ErrSystemTag
	}
	var cnt int
	if err := db.QueryRow(`SELECT COUNT(*) FROM transaction_tags WHERE tag_id=?`, id).Scan(&cnt); err != nil {
		return err
	}
	if cnt > 0 {
		return ErrTagInUse
	}
	_, err = db.Exec(`DELETE FROM tags WHERE id=?`, id)
	return err
}
