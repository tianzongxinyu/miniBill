package service

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/minibill/minibill/internal/domain"
)

const recurringMaxCatchupMonths = 24

type RecurringRule struct {
	ID               int64                `json:"id"`
	Amount           int64                `json:"amount"`
	Type             string               `json:"type"`
	DayOfMonth       int                  `json:"day_of_month"`
	Note             string               `json:"note"`
	ContactID        *int64               `json:"contact_id"`
	ContactName      string               `json:"contact_name,omitempty"`
	TagIDs           []int64              `json:"tag_ids"`
	TagItems         []TransactionTagItem `json:"tag_items,omitempty"`
	Enabled          bool                 `json:"enabled"`
	LastRunYearMonth *string              `json:"last_run_year_month,omitempty"`
	CreatedAt        string               `json:"created_at"`
	UpdatedAt        string               `json:"updated_at"`
}

type RecurringRuleInput struct {
	Amount     int64
	Type       string
	DayOfMonth int
	Note       string
	ContactID  *int64
	TagIDs     []int64
	Enabled    bool
}

type RecurringService struct {
	txSvc *TransactionService
	now   func() time.Time
}

func NewRecurringService(txSvc *TransactionService) *RecurringService {
	return &RecurringService{txSvc: txSvc, now: time.Now}
}

const recurringSelectCols = `id, amount, type, day_of_month, note, contact_id, enabled, last_run_year_month, created_at, updated_at`

func scanRecurringRule(scanner interface {
	Scan(dest ...interface{}) error
}) (RecurringRule, error) {
	var r RecurringRule
	var contactID sql.NullInt64
	var enabled int
	var lastRun sql.NullString
	err := scanner.Scan(
		&r.ID, &r.Amount, &r.Type, &r.DayOfMonth, &r.Note, &contactID,
		&enabled, &lastRun, &r.CreatedAt, &r.UpdatedAt,
	)
	if err != nil {
		return RecurringRule{}, err
	}
	r.Enabled = enabled == 1
	if contactID.Valid {
		id := contactID.Int64
		r.ContactID = &id
	}
	if lastRun.Valid && lastRun.String != "" {
		s := lastRun.String
		r.LastRunYearMonth = &s
	}
	if r.TagIDs == nil {
		r.TagIDs = []int64{}
	}
	return r, nil
}

func (s *RecurringService) validate(db *sql.DB, in RecurringRuleInput) error {
	if in.Amount <= 0 {
		return fmt.Errorf("%w: amount_positive", ErrValidation)
	}
	if in.Type != "income" && in.Type != "expense" {
		return fmt.Errorf("%w: invalid_type", ErrValidation)
	}
	if in.DayOfMonth < 1 || in.DayOfMonth > 28 {
		return fmt.Errorf("%w: invalid_day_of_month", ErrValidation)
	}
	hasDE, err := s.txSvc.hasDailyExpenseTag(db, in.TagIDs)
	if err != nil {
		return err
	}
	if hasDE {
		return fmt.Errorf("%w: daily_expense_tag", ErrValidation)
	}
	return nil
}

func (s *RecurringService) setTags(db *sql.DB, ruleID int64, tagIDs []int64) error {
	for _, tid := range tagIDs {
		if _, err := db.Exec(`INSERT INTO recurring_rule_tags (rule_id, tag_id) VALUES (?, ?)`, ruleID, tid); err != nil {
			return err
		}
	}
	return nil
}

func (s *RecurringService) loadTagIDs(db *sql.DB, ruleID int64) ([]int64, error) {
	rows, err := db.Query(`SELECT tag_id FROM recurring_rule_tags WHERE rule_id=? ORDER BY tag_id`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if ids == nil {
		ids = []int64{}
	}
	return ids, rows.Err()
}

func (s *RecurringService) enrich(db *sql.DB, r *RecurringRule) error {
	ids, err := s.loadTagIDs(db, r.ID)
	if err != nil {
		return err
	}
	r.TagIDs = ids
	if len(ids) > 0 {
		placeholders := make([]string, len(ids))
		args := make([]interface{}, len(ids))
		for i, id := range ids {
			placeholders[i] = "?"
			args[i] = id
		}
		q := `SELECT id, name, color_bg, color_fg FROM tags WHERE id IN (` + strings.Join(placeholders, ",") + `)`
		rows, err := db.Query(q, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		byID := map[int64]TransactionTagItem{}
		for rows.Next() {
			var item TransactionTagItem
			if err := rows.Scan(&item.ID, &item.Name, &item.ColorBg, &item.ColorFg); err != nil {
				return err
			}
			byID[item.ID] = item
		}
		if err := rows.Err(); err != nil {
			return err
		}
		r.TagItems = make([]TransactionTagItem, 0, len(ids))
		for _, id := range ids {
			if item, ok := byID[id]; ok {
				r.TagItems = append(r.TagItems, item)
			}
		}
	}
	if r.ContactID != nil {
		_ = db.QueryRow(`SELECT name FROM contacts WHERE id=?`, *r.ContactID).Scan(&r.ContactName)
	}
	return nil
}

func (s *RecurringService) List(db *sql.DB) ([]RecurringRule, error) {
	rows, err := db.Query(`SELECT ` + recurringSelectCols + ` FROM recurring_rules ORDER BY enabled DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []RecurringRule
	for rows.Next() {
		r, err := scanRecurringRule(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range list {
		if err := s.enrich(db, &list[i]); err != nil {
			return nil, err
		}
	}
	if list == nil {
		list = []RecurringRule{}
	}
	return list, nil
}

func (s *RecurringService) Get(db *sql.DB, id int64) (*RecurringRule, error) {
	r, err := scanRecurringRule(db.QueryRow(`SELECT `+recurringSelectCols+` FROM recurring_rules WHERE id=?`, id))
	if err != nil {
		return nil, err
	}
	if err := s.enrich(db, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *RecurringService) Create(db *sql.DB, in RecurringRuleInput) (*RecurringRule, error) {
	if err := s.validate(db, in); err != nil {
		return nil, err
	}
	en := 0
	if in.Enabled {
		en = 1
	}
	res, err := db.Exec(`
		INSERT INTO recurring_rules (amount, type, day_of_month, note, contact_id, enabled, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
		in.Amount, in.Type, in.DayOfMonth, strings.TrimSpace(in.Note), nullInt64(in.ContactID), en,
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	if err := s.setTags(db, id, in.TagIDs); err != nil {
		return nil, err
	}
	return s.Get(db, id)
}

func (s *RecurringService) Update(db *sql.DB, id int64, in RecurringRuleInput) (*RecurringRule, error) {
	if err := s.validate(db, in); err != nil {
		return nil, err
	}
	en := 0
	if in.Enabled {
		en = 1
	}
	res, err := db.Exec(`
		UPDATE recurring_rules
		SET amount=?, type=?, day_of_month=?, note=?, contact_id=?, enabled=?, updated_at=datetime('now')
		WHERE id=?`,
		in.Amount, in.Type, in.DayOfMonth, strings.TrimSpace(in.Note), nullInt64(in.ContactID), en, id,
	)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, sql.ErrNoRows
	}
	if _, err := db.Exec(`DELETE FROM recurring_rule_tags WHERE rule_id=?`, id); err != nil {
		return nil, err
	}
	if err := s.setTags(db, id, in.TagIDs); err != nil {
		return nil, err
	}
	return s.Get(db, id)
}

func (s *RecurringService) Delete(db *sql.DB, id int64) error {
	res, err := db.Exec(`DELETE FROM recurring_rules WHERE id=?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func yearMonthFromCreatedAt(createdAt string) domain.YearMonth {
	createdAt = strings.TrimSpace(createdAt)
	if len(createdAt) >= 7 {
		if ym, err := parseYearMonthKey(createdAt[:7]); err == nil {
			return ym
		}
	}
	t, err := time.Parse("2006-01-02 15:04:05", createdAt)
	if err != nil {
		t, err = time.Parse(time.RFC3339, createdAt)
	}
	if err != nil {
		now := time.Now()
		y, m, _ := now.Date()
		return domain.YearMonth{Year: y, Month: int(m)}
	}
	y, m, _ := t.Date()
	return domain.YearMonth{Year: y, Month: int(m)}
}

func recurringMonthDue(ym domain.YearMonth, dayOfMonth int, now time.Time) bool {
	loc := now.Location()
	today := now.In(loc)
	ty, tm, td := today.Date()
	curr := domain.YearMonth{Year: ty, Month: int(tm)}
	if ym.Year < curr.Year || (ym.Year == curr.Year && ym.Month < curr.Month) {
		return true
	}
	if ym.Year == curr.Year && ym.Month == curr.Month {
		return td >= dayOfMonth
	}
	return false
}

func recurringTxDate(ym domain.YearMonth, dayOfMonth int) string {
	return fmt.Sprintf("%04d-%02d-%02d", ym.Year, ym.Month, dayOfMonth)
}

func (s *RecurringService) markLastRun(db *sql.DB, ruleID int64, ym domain.YearMonth) error {
	_, err := db.Exec(
		`UPDATE recurring_rules SET last_run_year_month=?, updated_at=datetime('now') WHERE id=?`,
		ym.String(), ruleID,
	)
	return err
}

// ProcessDue creates due monthly transactions for enabled rules (with catch-up).
func (s *RecurringService) ProcessDue(db *sql.DB) (created int, err error) {
	now := s.now()
	rows, err := db.Query(`SELECT ` + recurringSelectCols + ` FROM recurring_rules WHERE enabled = 1`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	var rules []RecurringRule
	for rows.Next() {
		r, err := scanRecurringRule(rows)
		if err != nil {
			return 0, err
		}
		rules = append(rules, r)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	for i := range rules {
		n, err := s.processRule(db, &rules[i], now)
		if err != nil {
			return created, err
		}
		created += n
	}
	return created, nil
}

func (s *RecurringService) processRule(db *sql.DB, r *RecurringRule, now time.Time) (int, error) {
	tagIDs, err := s.loadTagIDs(db, r.ID)
	if err != nil {
		return 0, err
	}
	var start domain.YearMonth
	if r.LastRunYearMonth != nil {
		last, err := parseYearMonthKey(*r.LastRunYearMonth)
		if err != nil {
			return 0, fmt.Errorf("rule %d last_run: %w", r.ID, err)
		}
		start = domain.NextMonth(last)
	} else {
		start = yearMonthFromCreatedAt(r.CreatedAt)
	}

	loc := now.Location()
	ty, tm, _ := now.In(loc).Date()
	curr := domain.YearMonth{Year: ty, Month: int(tm)}

	created := 0
	ym := start
	for i := 0; i < recurringMaxCatchupMonths; i++ {
		if ym.Year > curr.Year || (ym.Year == curr.Year && ym.Month > curr.Month) {
			break
		}
		if !recurringMonthDue(ym, r.DayOfMonth, now) {
			break
		}
		date := recurringTxDate(ym, r.DayOfMonth)
		_, err := s.txSvc.Create(db, CreateTransactionInput{
			Amount:          r.Amount,
			Type:            r.Type,
			TransactionDate: date,
			Note:            r.Note,
			ContactID:       r.ContactID,
			TagIDs:          tagIDs,
		})
		if err != nil {
			return created, fmt.Errorf("rule %d create %s: %w", r.ID, date, err)
		}
		if err := s.markLastRun(db, r.ID, ym); err != nil {
			return created, err
		}
		created++
		ym = domain.NextMonth(ym)
	}
	return created, nil
}
