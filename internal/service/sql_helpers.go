package service

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/minibill/minibill/internal/domain"
)

const txSelectColumns = `t.id, t.amount, t.type, t.transaction_date, t.note, t.contact_id, t.is_system, t.created_at, t.updated_at`
const txSelectColumnsBare = `id, amount, type, transaction_date, note, contact_id, is_system, created_at, updated_at`

func excludeDailyExpenseTagSQL(alias string) string {
	return fmt.Sprintf(`NOT EXISTS (
		SELECT 1 FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		WHERE tt.transaction_id = %s.id AND g.preset_key = ?
	)`, alias)
}

func monthRange(year, month int) (start, end string) {
	start = fmt.Sprintf("%04d-%02d-01", year, month)
	endMonth := month + 1
	endYear := year
	if endMonth > 12 {
		endMonth = 1
		endYear++
	}
	end = fmt.Sprintf("%04d-%02d-01", endYear, endMonth)
	return start, end
}

func yearRange(year int) (start, end string) {
	return fmt.Sprintf("%04d-01-01", year), fmt.Sprintf("%04d-01-01", year+1)
}

func loadMonthlyBalance(db *sql.DB, year, month int) (sql.NullInt64, error) {
	var bal sql.NullInt64
	err := db.QueryRow(
		`SELECT balance FROM monthly_balances WHERE year = ? AND month = ?`,
		year, month,
	).Scan(&bal)
	if err == sql.ErrNoRows {
		return sql.NullInt64{}, nil
	}
	return bal, err
}

func loadPrevMonthBalance(db *sql.DB, ym domain.YearMonth) (*int64, error) {
	prev := domain.PrevMonth(ym)
	bal, err := loadMonthlyBalance(db, prev.Year, prev.Month)
	if err != nil {
		return nil, err
	}
	if !bal.Valid {
		return nil, nil
	}
	return &bal.Int64, nil
}

func loadPriorDecemberBalance(db *sql.DB, year int) (*int64, error) {
	bal, err := loadMonthlyBalance(db, year-1, 12)
	if err != nil {
		return nil, err
	}
	if !bal.Valid {
		return nil, nil
	}
	return &bal.Int64, nil
}

func noteTagContactFilterSQL(note string, tagIDs []int64, contactID *int64, tagMatch string) (string, []interface{}) {
	parts := make([]string, 0, 3)
	args := make([]interface{}, 0, len(tagIDs)+2)
	any := NormalizeTagMatch(tagMatch) == TagMatchAny
	note = strings.TrimSpace(note)

	// Prefer indexed predicates first (contact, tags), then note LIKE.
	if contactID != nil {
		parts = append(parts, "t.contact_id = ?")
		args = append(args, *contactID)
	}
	if len(tagIDs) > 0 {
		if any {
			placeholders := make([]string, len(tagIDs))
			for i, tid := range tagIDs {
				placeholders[i] = "?"
				args = append(args, tid)
			}
			parts = append(parts, `EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id=t.id AND tt.tag_id IN (`+strings.Join(placeholders, ",")+`))`)
		} else {
			for _, tid := range tagIDs {
				parts = append(parts, `EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id=t.id AND tt.tag_id=?)`)
				args = append(args, tid)
			}
		}
	}
	if note != "" {
		parts = append(parts, "t.note LIKE ?")
		args = append(args, "%"+note+"%")
	}
	if len(parts) == 0 {
		return "", args
	}
	if any {
		if len(parts) == 1 {
			return parts[0], args
		}
		return "(" + strings.Join(parts, " OR ") + ")", args
	}
	return strings.Join(parts, " AND "), args
}

const (
	TagMatchAll = "all"
	TagMatchAny = "any"
)

func NormalizeTagMatch(tagMatch string) string {
	if strings.TrimSpace(tagMatch) == TagMatchAny {
		return TagMatchAny
	}
	return TagMatchAll
}

func tagFromRow(id int64, name string, presetKey sql.NullString, sys, en int, colorBg, colorFg string, usageCount int64) Tag {
	pk := ""
	if presetKey.Valid {
		pk = presetKey.String
	}
	t := Tag{
		ID:         id,
		Name:       name,
		IsSystem:   sys == 1,
		Enabled:    en == 1,
		Selectable: domain.IsSelectablePresetKey(pk),
		ColorBg:    colorBg,
		ColorFg:    domain.TagTextColor,
		UsageCount: usageCount,
	}
	if pk != "" {
		t.PresetKey = &pk
	}
	return t
}
