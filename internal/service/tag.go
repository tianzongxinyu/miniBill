package service

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/minibill/minibill/internal/domain"
)

var ErrSystemTag = errors.New("system tag")
var ErrTagInUse = errors.New("tag in use")

type Tag struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	IsSystem   bool   `json:"is_system"`
	Enabled    bool   `json:"enabled"`
	Selectable bool   `json:"selectable"`
	ColorBg    string `json:"color_bg"`
	ColorFg    string `json:"color_fg"`
}

type TagService struct{}

func (s *TagService) List(db *sql.DB, enabledOnly bool) ([]Tag, error) {
	q := `SELECT id, name, is_system, enabled, color_bg, color_fg FROM tags`
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
		if err := rows.Scan(&t.ID, &t.Name, &sys, &en, &t.ColorBg, &t.ColorFg); err != nil {
			return nil, err
		}
		list = append(list, tagFromRow(t.ID, t.Name, sys, en, t.ColorBg, t.ColorFg))
	}
	return list, nil
}

func (s *TagService) Create(db *sql.DB, name string) (*Tag, error) {
	bg, fg := domain.RandomTagColors()
	res, err := db.Exec(`INSERT INTO tags (name, is_system, enabled, color_bg, color_fg) VALUES (?, 0, 1, ?, ?)`, name, bg, fg)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &Tag{ID: id, Name: name, Enabled: true, Selectable: true, ColorBg: bg, ColorFg: fg}, nil
}

type TagUpdateInput struct {
	Enabled *bool
	ColorBg *string
	ColorFg *string
}

func (s *TagService) Update(db *sql.DB, id int64, in TagUpdateInput) (*Tag, error) {
	var t Tag
	var sys, en int
	err := db.QueryRow(`SELECT id, name, is_system, enabled, color_bg, color_fg FROM tags WHERE id=?`, id).
		Scan(&t.ID, &t.Name, &sys, &en, &t.ColorBg, &t.ColorFg)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	if in.Enabled == nil && in.ColorBg == nil && in.ColorFg == nil {
		return nil, fmt.Errorf("%w: 无更新字段", ErrValidation)
	}
	if in.ColorFg != nil && in.ColorBg == nil {
		return nil, fmt.Errorf("%w: 仅支持修改 color_bg", ErrValidation)
	}
	if in.ColorBg != nil {
		if !domain.ValidateTagColorHex(*in.ColorBg) {
			return nil, fmt.Errorf("%w: 标签背景色格式无效", ErrValidation)
		}
		t.ColorBg = *in.ColorBg
		t.ColorFg = domain.TagTextColor
	}
	if in.Enabled != nil {
		en = 0
		if *in.Enabled {
			en = 1
		}
		t.Enabled = *in.Enabled
	} else {
		t.Enabled = en == 1
	}
	_, err = db.Exec(
		`UPDATE tags SET enabled=?, color_bg=?, color_fg=? WHERE id=?`,
		boolToInt(t.Enabled), t.ColorBg, t.ColorFg, id,
	)
	if err != nil {
		return nil, err
	}
	result := tagFromRow(t.ID, t.Name, sys, en, t.ColorBg, t.ColorFg)
	return &result, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
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
