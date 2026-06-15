package service

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/minibill/minibill/internal/cache"
	"github.com/minibill/minibill/internal/domain"
)

var ErrValidation = errors.New("validation")
var ErrSystemTransaction = errors.New("system transaction")

type TransactionService struct {
	stats *StatsService
	now   func() time.Time
}

func NewTransactionService(stats *StatsService) *TransactionService {
	return &TransactionService{stats: stats, now: time.Now}
}

type TransactionTagItem struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	ColorBg string `json:"color_bg"`
	ColorFg string `json:"color_fg"`
}

type Transaction struct {
	ID              int64                `json:"id"`
	Amount          int64                `json:"amount"`
	Type            string               `json:"type"`
	TransactionDate string               `json:"transaction_date"`
	Note            string               `json:"note"`
	ContactID       *int64               `json:"contact_id"`
	ContactName     string               `json:"contact_name,omitempty"`
	TagIDs          []int64              `json:"tag_ids"`
	Tags            []string             `json:"tags"`
	TagItems        []TransactionTagItem `json:"tag_items,omitempty"`
	IsSystem        bool                 `json:"is_system"`
	CreatedAt       string               `json:"created_at"`
	UpdatedAt       string               `json:"updated_at"`
}

type CreateTransactionInput struct {
	Amount          int64
	Type            string
	TransactionDate string
	Note            string
	ContactID       *int64
	TagIDs          []int64
}

type TransactionsPage struct {
	Items      []Transaction `json:"items"`
	NextCursor *string       `json:"next_cursor"`
	HasMore    bool          `json:"has_more"`
}

func parseTxCursor(cursor string) (date string, id int64, err error) {
	i := strings.LastIndex(cursor, ":")
	if i <= 0 {
		return "", 0, fmt.Errorf("%w: invalid cursor", ErrValidation)
	}
	date = cursor[:i]
	id, err = strconv.ParseInt(cursor[i+1:], 10, 64)
	if err != nil || id <= 0 {
		return "", 0, fmt.Errorf("%w: invalid cursor", ErrValidation)
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return "", 0, fmt.Errorf("%w: invalid cursor", ErrValidation)
	}
	return date, id, nil
}

func formatTxCursor(date string, id int64) string {
	return fmt.Sprintf("%s:%d", date, id)
}

type ListFilter struct {
	Year      int
	Month     int
	Type      string
	TagIDs    []int64
	ContactID *int64
	NoteQuery string
	Cursor    string
}

func (f ListFilter) HasSearch() bool {
	if strings.TrimSpace(f.NoteQuery) != "" || f.ContactID != nil {
		return true
	}
	return len(f.TagIDs) > 0 && (f.Year <= 0 || f.Month <= 0)
}

func (s *TransactionService) buildListWhere(f ListFilter) (whereSQL string, args []interface{}, err error) {
	where := []string{"1=1"}
	args = []interface{}{}
	filterSQL, filterArgs := noteTagContactFilterSQL(f.NoteQuery, f.TagIDs, f.ContactID)
	if filterSQL != "" {
		where = append(where, filterSQL)
		args = append(args, filterArgs...)
	}
	if !f.HasSearch() {
		if f.Year > 0 && f.Month > 0 {
			start, end := monthRange(f.Year, f.Month)
			where = append(where, "t.transaction_date >= ? AND t.transaction_date < ?")
			args = append(args, start, end)
		} else if f.Year > 0 {
			start := fmt.Sprintf("%04d-01-01", f.Year)
			end := fmt.Sprintf("%04d-01-01", f.Year+1)
			where = append(where, "t.transaction_date >= ? AND t.transaction_date < ?")
			args = append(args, start, end)
		}
	}
	if f.Type != "" {
		where = append(where, "t.type = ?")
		args = append(args, f.Type)
	}
	if f.Cursor != "" {
		cDate, cID, err := parseTxCursor(f.Cursor)
		if err != nil {
			return "", nil, err
		}
		where = append(where, "(t.transaction_date < ? OR (t.transaction_date = ? AND t.id < ?))")
		args = append(args, cDate, cDate, cID)
	}
	return strings.Join(where, " AND "), args, nil
}

func (s *TransactionService) listByCursorPage(db *sql.DB, f ListFilter, limit int) (*TransactionsPage, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	if !f.HasSearch() && (f.Year <= 0 || f.Month <= 0) {
		return nil, fmt.Errorf("%w: year and month required", ErrValidation)
	}
	whereSQL, args, err := s.buildListWhere(f)
	if err != nil {
		return nil, err
	}
	q := fmt.Sprintf(`
		SELECT %s
		FROM transactions t WHERE %s ORDER BY t.transaction_date DESC, t.is_system ASC, t.id DESC LIMIT ?`, txSelectColumns, whereSQL)
	args = append(args, limit+1)
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	now := s.now()
	var list []Transaction
	for rows.Next() {
		tx, err := scanTransactionRow(rows, now)
		if err != nil {
			return nil, err
		}
		list = append(list, *tx)
	}
	page := &TransactionsPage{Items: []Transaction{}}
	if len(list) > limit {
		page.HasMore = true
		list = list[:limit]
	}
	page.Items = list
	if page.HasMore && len(list) > 0 {
		last := list[len(list)-1]
		c := formatTxCursor(last.TransactionDate, last.ID)
		page.NextCursor = &c
	}
	return page, nil
}

func (s *TransactionService) ListByCursorFiltered(db *sql.DB, f ListFilter, limit int) (*TransactionsPage, error) {
	return s.listByCursorPage(db, f, limit)
}

func (s *TransactionService) Get(db *sql.DB, id int64) (*Transaction, error) {
	now := s.now()
	row := db.QueryRow(fmt.Sprintf(`
		SELECT %s FROM transactions WHERE id = ?`, txSelectColumnsBare), id)
	return scanTransactionRow(row, now)
}

func scanTransactionRow(scanner interface {
	Scan(dest ...interface{}) error
}, now time.Time) (*Transaction, error) {
	var tx Transaction
	var cid sql.NullInt64
	var isSystem int
	err := scanner.Scan(&tx.ID, &tx.Amount, &tx.Type, &tx.TransactionDate, &tx.Note, &cid, &isSystem, &tx.CreatedAt, &tx.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if cid.Valid {
		tx.ContactID = &cid.Int64
	}
	tx.IsSystem = isSystem == 1
	_ = now
	return &tx, nil
}

func (s *TransactionService) enrich(db *sql.DB, tx *Transaction) error {
	rows, err := db.Query(`
		SELECT tt.tag_id, g.name, g.color_bg, g.color_fg FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id WHERE tt.transaction_id = ? ORDER BY g.name`, tx.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item TransactionTagItem
		if err := rows.Scan(&item.ID, &item.Name, &item.ColorBg, &item.ColorFg); err != nil {
			return err
		}
		tx.TagIDs = append(tx.TagIDs, item.ID)
		tx.Tags = append(tx.Tags, item.Name)
		tx.TagItems = append(tx.TagItems, item)
	}
	if tx.ContactID != nil {
		var name string
		if err := db.QueryRow(`SELECT name FROM contacts WHERE id = ?`, *tx.ContactID).Scan(&name); err == nil {
			tx.ContactName = name
		}
	}
	return nil
}

func (s *TransactionService) EnrichBatch(db *sql.DB, items []Transaction) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, len(items))
	idSet := map[int64]int{}
	for i := range items {
		ids[i] = items[i].ID
		idSet[items[i].ID] = i
		items[i].TagIDs = nil
		items[i].Tags = nil
		items[i].TagItems = nil
		items[i].ContactName = ""
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	tagQ := fmt.Sprintf(`
		SELECT tt.transaction_id, tt.tag_id, g.name, g.color_bg, g.color_fg FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		WHERE tt.transaction_id IN (%s)
		ORDER BY tt.transaction_id, g.name`, strings.Join(placeholders, ","))
	rows, err := db.Query(tagQ, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var txID int64
		var item TransactionTagItem
		if err := rows.Scan(&txID, &item.ID, &item.Name, &item.ColorBg, &item.ColorFg); err != nil {
			return err
		}
		if idx, ok := idSet[txID]; ok {
			items[idx].TagIDs = append(items[idx].TagIDs, item.ID)
			items[idx].Tags = append(items[idx].Tags, item.Name)
			items[idx].TagItems = append(items[idx].TagItems, item)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	contactIDs := map[int64]struct{}{}
	for i := range items {
		if items[i].ContactID != nil {
			contactIDs[*items[i].ContactID] = struct{}{}
		}
	}
	if len(contactIDs) == 0 {
		return nil
	}
	cids := make([]int64, 0, len(contactIDs))
	for id := range contactIDs {
		cids = append(cids, id)
	}
	cPlaceholders := make([]string, len(cids))
	cArgs := make([]interface{}, len(cids))
	for i, id := range cids {
		cPlaceholders[i] = "?"
		cArgs[i] = id
	}
	cQ := fmt.Sprintf(`SELECT id, name FROM contacts WHERE id IN (%s)`, strings.Join(cPlaceholders, ","))
	cRows, err := db.Query(cQ, cArgs...)
	if err != nil {
		return err
	}
	defer cRows.Close()
	names := map[int64]string{}
	for cRows.Next() {
		var id int64
		var name string
		if err := cRows.Scan(&id, &name); err != nil {
			return err
		}
		names[id] = name
	}
	if err := cRows.Err(); err != nil {
		return err
	}
	for i := range items {
		if items[i].ContactID != nil {
			items[i].ContactName = names[*items[i].ContactID]
		}
	}
	return nil
}

func (s *TransactionService) EnrichBatchWithMeta(db *sql.DB, meta *cache.LedgerMeta, items []Transaction) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, len(items))
	contactIDs := map[int64]struct{}{}
	for i := range items {
		ids[i] = items[i].ID
		items[i].TagIDs = nil
		items[i].Tags = nil
		items[i].TagItems = nil
		items[i].ContactName = ""
		if items[i].ContactID != nil {
			contactIDs[*items[i].ContactID] = struct{}{}
		}
	}

	tagMap, err := meta.TxTagsForIDs(db, ids)
	if err != nil {
		return err
	}
	for i := range items {
		if entries, ok := tagMap[items[i].ID]; ok && len(entries) > 0 {
			for _, e := range entries {
				items[i].TagIDs = append(items[i].TagIDs, e.ID)
				items[i].Tags = append(items[i].Tags, e.Name)
				items[i].TagItems = append(items[i].TagItems, TransactionTagItem{
					ID: e.ID, Name: e.Name, ColorBg: e.ColorBg, ColorFg: e.ColorFg,
				})
			}
		}
	}

	if len(contactIDs) == 0 {
		return nil
	}
	cids := make([]int64, 0, len(contactIDs))
	for id := range contactIDs {
		cids = append(cids, id)
	}
	names, err := meta.ContactNamesBatch(db, cids)
	if err != nil {
		return err
	}
	for i := range items {
		if items[i].ContactID != nil {
			items[i].ContactName = names[*items[i].ContactID]
		}
	}
	return nil
}

func (s *TransactionService) Create(db *sql.DB, in CreateTransactionInput) (*Transaction, error) {
	if err := s.validate(db, in, ""); err != nil {
		return nil, err
	}
	res, err := db.Exec(`
		INSERT INTO transactions (amount, type, transaction_date, note, contact_id, updated_at)
		VALUES (?, ?, ?, ?, ?, datetime('now'))`,
		in.Amount, in.Type, in.TransactionDate, in.Note, nullInt64(in.ContactID),
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	if err := s.setTags(db, id, in.TagIDs); err != nil {
		return nil, err
	}
	if err := adjustContactUsage(db, nil, in.ContactID); err != nil {
		return nil, err
	}
	if err := bumpTagsUsage(db, in.TagIDs, 1); err != nil {
		return nil, err
	}
	if err := s.stats.RecalcAfterTransaction(db, in.TransactionDate); err != nil {
		return nil, err
	}
	tx, err := s.Get(db, id)
	if err != nil {
		return nil, err
	}
	_ = s.enrich(db, tx)
	return tx, nil
}

func (s *TransactionService) Update(db *sql.DB, id int64, in CreateTransactionInput) (*Transaction, error) {
	old, err := s.Get(db, id)
	if err != nil {
		return nil, err
	}
	if err := s.enrich(db, old); err != nil {
		return nil, err
	}
	if old.IsSystem {
		return nil, ErrSystemTransaction
	}
	if err := s.validate(db, in, old.TransactionDate); err != nil {
		return nil, err
	}
	_, err = db.Exec(`
		UPDATE transactions SET amount=?, type=?, transaction_date=?, note=?, contact_id=?, updated_at=datetime('now')
		WHERE id=?`,
		in.Amount, in.Type, in.TransactionDate, in.Note, nullInt64(in.ContactID), id,
	)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`DELETE FROM transaction_tags WHERE transaction_id=?`, id); err != nil {
		return nil, err
	}
	if err := s.setTags(db, id, in.TagIDs); err != nil {
		return nil, err
	}
	oldTagIDs := append([]int64(nil), old.TagIDs...)
	if err := adjustContactUsage(db, old.ContactID, in.ContactID); err != nil {
		return nil, err
	}
	if err := adjustTagsUsage(db, oldTagIDs, in.TagIDs); err != nil {
		return nil, err
	}
	dates := []string{old.TransactionDate}
	if in.TransactionDate != old.TransactionDate {
		dates = append(dates, in.TransactionDate)
	}
	if err := s.stats.RecalcAfterTransaction(db, dates...); err != nil {
		return nil, err
	}
	tx, err := s.Get(db, id)
	if err != nil {
		return nil, err
	}
	_ = s.enrich(db, tx)
	return tx, nil
}

func (s *TransactionService) Delete(db *sql.DB, id int64) error {
	tx, err := s.Get(db, id)
	if err != nil {
		return err
	}
	if err := s.enrich(db, tx); err != nil {
		return err
	}
	if tx.IsSystem {
		return ErrSystemTransaction
	}
	if err := adjustContactUsage(db, tx.ContactID, nil); err != nil {
		return err
	}
	if err := bumpTagsUsage(db, tx.TagIDs, -1); err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM transactions WHERE id=?`, id)
	if err != nil {
		return err
	}
	return s.stats.RecalcAfterTransaction(db, tx.TransactionDate)
}

func (s *TransactionService) validate(db *sql.DB, in CreateTransactionInput, oldDate string) error {
	now := s.now()
	if in.Amount <= 0 {
		return fmt.Errorf("%w: amount must be positive", ErrValidation)
	}
	if in.Type != "income" && in.Type != "expense" {
		return fmt.Errorf("%w: invalid type", ErrValidation)
	}
	if !domain.IsDateNotAfterToday(in.TransactionDate, now) {
		return fmt.Errorf("%w: 日期不能晚于今天", ErrValidation)
	}
	names, err := s.tagNames(db, in.TagIDs)
	if err != nil {
		return err
	}
	if domain.HasDailyExpenseTag(names) {
		return fmt.Errorf("%w: 不可使用系统标签「日常支出」", ErrValidation)
	}
	return nil
}

func (s *TransactionService) tagNames(db *sql.DB, ids []int64) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	q := fmt.Sprintf(`SELECT name FROM tags WHERE id IN (%s)`, strings.Join(placeholders, ","))
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, nil
}

func (s *TransactionService) Enrich(db *sql.DB, tx *Transaction) error {
	return s.enrich(db, tx)
}

func (s *TransactionService) setTags(db *sql.DB, txID int64, tagIDs []int64) error {
	for _, tid := range tagIDs {
		if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tid); err != nil {
			return err
		}
	}
	return nil
}

func nullInt64(p *int64) interface{} {
	if p == nil {
		return nil
	}
	return *p
}

func (s *TransactionService) ListUsedTags(db *sql.DB) ([]Tag, error) {
	rows, err := db.Query(`
		SELECT DISTINCT g.id, g.name, g.is_system, g.enabled, g.color_bg, g.color_fg, g.usage_count
		FROM tags g
		JOIN transaction_tags tt ON tt.tag_id = g.id
		WHERE g.enabled = 1
		ORDER BY g.usage_count DESC, g.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Tag
	for rows.Next() {
		var t Tag
		var sys, en int
		if err := rows.Scan(&t.ID, &t.Name, &sys, &en, &t.ColorBg, &t.ColorFg, &t.UsageCount); err != nil {
			return nil, err
		}
		list = append(list, tagFromRow(t.ID, t.Name, sys, en, t.ColorBg, t.ColorFg, t.UsageCount))
	}
	return list, nil
}

func (s *TransactionService) ListUsedContacts(db *sql.DB) ([]Contact, error) {
	rows, err := db.Query(`
		SELECT DISTINCT c.id, c.name, c.nickname, c.relation_group, c.note, c.phone, c.usage_count
		FROM contacts c
		JOIN transactions t ON t.contact_id = c.id
		ORDER BY c.usage_count DESC, c.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Contact
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Nickname, &c.RelationGroup, &c.Note, &c.Phone, &c.UsageCount); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}
