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
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	PresetKey  *string `json:"preset_key,omitempty"`
	IsSystem   bool    `json:"is_system"`
	Enabled    bool    `json:"enabled"`
	Selectable bool    `json:"selectable"`
	ColorBg    string  `json:"color_bg"`
	ColorFg    string  `json:"color_fg"`
	UsageCount int64   `json:"usage_count"`
}

type TagSummary struct {
	Tag
	TotalExpense    int64 `json:"total_expense"`
	TotalIncome     int64 `json:"total_income"`
	NetAmount       int64 `json:"net_amount"`
	LastTransaction *struct {
		ID              int64  `json:"id"`
		Amount          int64  `json:"amount"`
		Type            string `json:"type"`
		TransactionDate string `json:"transaction_date"`
	} `json:"last_transaction"`
}

type TagService struct{}

const tagSelectCols = `id, name, preset_key, is_system, enabled, color_bg, color_fg, usage_count`

func scanTag(scanner interface {
	Scan(dest ...interface{}) error
}) (Tag, error) {
	var t Tag
	var sys, en int
	var presetKey sql.NullString
	err := scanner.Scan(&t.ID, &t.Name, &presetKey, &sys, &en, &t.ColorBg, &t.ColorFg, &t.UsageCount)
	if err != nil {
		return Tag{}, err
	}
	return tagFromRow(t.ID, t.Name, presetKey, sys, en, t.ColorBg, t.ColorFg, t.UsageCount), nil
}

func (s *TagService) List(db *sql.DB, enabledOnly bool) ([]Tag, error) {
	q := `SELECT ` + tagSelectCols + ` FROM tags`
	if enabledOnly {
		q += ` WHERE enabled = 1`
	}
	q += ` ORDER BY is_system DESC, usage_count DESC, name ASC`
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Tag
	for rows.Next() {
		t, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (s *TagService) Get(db *sql.DB, id int64) (*TagSummary, error) {
	t, err := scanTag(db.QueryRow(`SELECT `+tagSelectCols+` FROM tags WHERE id=?`, id))
	if err != nil {
		return nil, err
	}
	sum := &TagSummary{Tag: t}
	if err := db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		WHERE tt.tag_id = ?
		  AND t.is_system = 0`,
		id,
	).Scan(&sum.TotalExpense, &sum.TotalIncome); err != nil {
		return nil, err
	}
	sum.NetAmount = sum.TotalIncome - sum.TotalExpense

	var txID int64
	var amount int64
	var txType, txDate string
	err = db.QueryRow(`
		SELECT t.id, t.amount, t.type, t.transaction_date
		FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		WHERE tt.tag_id = ?
		  AND t.is_system = 0
		ORDER BY t.transaction_date DESC, t.id DESC
		LIMIT 1`, id,
	).Scan(&txID, &amount, &txType, &txDate)
	if err == nil {
		sum.LastTransaction = &struct {
			ID              int64  `json:"id"`
			Amount          int64  `json:"amount"`
			Type            string `json:"type"`
			TransactionDate string `json:"transaction_date"`
		}{ID: txID, Amount: amount, Type: txType, TransactionDate: txDate}
	} else if err != sql.ErrNoRows {
		return nil, err
	}
	return sum, nil
}

func (s *TagService) Create(db *sql.DB, name string) (*Tag, error) {
	existing, err := scanTag(db.QueryRow(
		`SELECT `+tagSelectCols+` FROM tags WHERE LOWER(name) = LOWER(?) LIMIT 1`,
		name,
	))
	if err == nil {
		return &existing, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	bg, fg := domain.RandomTagColors()
	res, err := db.Exec(`INSERT INTO tags (name, is_system, enabled, color_bg, color_fg) VALUES (?, 0, 1, ?, ?)`, name, bg, fg)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &Tag{ID: id, Name: name, Enabled: true, Selectable: true, ColorBg: bg, ColorFg: fg, UsageCount: 0}, nil
}

type TagUpdateInput struct {
	Enabled *bool
	ColorBg *string
	ColorFg *string
}

func (s *TagService) Update(db *sql.DB, id int64, in TagUpdateInput) (*Tag, error) {
	t, err := scanTag(db.QueryRow(`SELECT `+tagSelectCols+` FROM tags WHERE id=?`, id))
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, err
	}
	if in.Enabled == nil && in.ColorBg == nil && in.ColorFg == nil {
		return nil, fmt.Errorf("%w: no_update_fields", ErrValidation)
	}
	if in.ColorFg != nil && in.ColorBg == nil {
		return nil, fmt.Errorf("%w: color_bg_only", ErrValidation)
	}
	if in.ColorBg != nil {
		if !domain.ValidateTagColorHex(*in.ColorBg) {
			return nil, fmt.Errorf("%w: invalid_tag_color", ErrValidation)
		}
		t.ColorBg = *in.ColorBg
		t.ColorFg = domain.TagTextColor
	}
	en := 0
	if t.Enabled {
		en = 1
	}
	if in.Enabled != nil {
		en = 0
		if *in.Enabled {
			en = 1
		}
		t.Enabled = *in.Enabled
	}
	_, err = db.Exec(
		`UPDATE tags SET enabled=?, color_bg=?, color_fg=? WHERE id=?`,
		en, t.ColorBg, t.ColorFg, id,
	)
	if err != nil {
		return nil, err
	}
	t.Enabled = en == 1
	return &t, nil
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
