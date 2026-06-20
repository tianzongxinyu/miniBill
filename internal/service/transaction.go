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
			start, end := yearRange(f.Year)
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
	var list []Transaction
	for rows.Next() {
		tx, err := scanTransactionRow(rows)
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
	row := db.QueryRow(fmt.Sprintf(`
		SELECT %s FROM transactions WHERE id = ?`, txSelectColumnsBare), id)
	return scanTransactionRow(row)
}

func scanTransactionRow(scanner interface {
	Scan(dest ...interface{}) error
}) (*Transaction, error) {
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
	return &tx, nil
}

func validateTransactionCore(amount int64, typ, date string, now time.Time) error {
	if amount <= 0 {
		return fmt.Errorf("%w: amount_positive", ErrValidation)
	}
	if typ != "income" && typ != "expense" {
		return fmt.Errorf("%w: invalid_type", ErrValidation)
	}
	if !domain.IsDateNotAfterToday(date, now) {
		return fmt.Errorf("%w: date_after_today", ErrValidation)
	}
	return nil
}

func (s *TransactionService) hasDailyExpenseTag(db *sql.DB, tagIDs []int64) (bool, error) {
	if len(tagIDs) == 0 {
		return false, nil
	}
	placeholders := make([]string, len(tagIDs))
	args := make([]interface{}, len(tagIDs)+1)
	for i, id := range tagIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	args[len(tagIDs)] = domain.DailyExpensePresetKey
	q := fmt.Sprintf(`SELECT COUNT(*) FROM tags WHERE id IN (%s) AND preset_key = ?`, strings.Join(placeholders, ","))
	var cnt int
	if err := db.QueryRow(q, args...).Scan(&cnt); err != nil {
		return false, err
	}
	return cnt > 0, nil
}

func loadTagsForTxIDs(db *sql.DB, ids []int64) (map[int64][]TransactionTagItem, error) {
	out := map[int64][]TransactionTagItem{}
	if len(ids) == 0 {
		return out, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	q := fmt.Sprintf(domain.TxTagsByTransactionIDsSQL, strings.Join(placeholders, ","))
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var txID int64
		var item TransactionTagItem
		if err := rows.Scan(&txID, &item.ID, &item.Name, &item.ColorBg, &item.ColorFg); err != nil {
			return nil, err
		}
		out[txID] = append(out[txID], item)
	}
	return out, rows.Err()
}

func loadContactNamesForIDs(db *sql.DB, ids []int64) (map[int64]string, error) {
	out := map[int64]string{}
	if len(ids) == 0 {
		return out, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	q := fmt.Sprintf(domain.ContactNamesByIDsSQL, strings.Join(placeholders, ","))
	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		out[id] = name
	}
	return out, rows.Err()
}

func (s *TransactionService) enrich(db *sql.DB, tx *Transaction) error {
	tagMap, err := loadTagsForTxIDs(db, []int64{tx.ID})
	if err != nil {
		return err
	}
	for _, item := range tagMap[tx.ID] {
		tx.TagIDs = append(tx.TagIDs, item.ID)
		tx.Tags = append(tx.Tags, item.Name)
		tx.TagItems = append(tx.TagItems, item)
	}
	if tx.ContactID != nil {
		names, err := loadContactNamesForIDs(db, []int64{*tx.ContactID})
		if err != nil {
			return err
		}
		tx.ContactName = names[*tx.ContactID]
	}
	return nil
}

func resetBatchEnrichment(items []Transaction) ([]int64, map[int64]struct{}) {
	ids := make([]int64, len(items))
	contactIDSet := map[int64]struct{}{}
	for i := range items {
		ids[i] = items[i].ID
		items[i].TagIDs = nil
		items[i].Tags = nil
		items[i].TagItems = nil
		items[i].ContactName = ""
		if items[i].ContactID != nil {
			contactIDSet[*items[i].ContactID] = struct{}{}
		}
	}
	return ids, contactIDSet
}

func applyTagEnrichment(items []Transaction, tagMap map[int64][]TransactionTagItem) {
	for i := range items {
		for _, item := range tagMap[items[i].ID] {
			items[i].TagIDs = append(items[i].TagIDs, item.ID)
			items[i].Tags = append(items[i].Tags, item.Name)
			items[i].TagItems = append(items[i].TagItems, item)
		}
	}
}

func applyContactEnrichment(items []Transaction, names map[int64]string) {
	for i := range items {
		if items[i].ContactID != nil {
			items[i].ContactName = names[*items[i].ContactID]
		}
	}
}

func (s *TransactionService) EnrichBatch(db *sql.DB, items []Transaction) error {
	if len(items) == 0 {
		return nil
	}
	ids, contactIDSet := resetBatchEnrichment(items)

	tagMap, err := loadTagsForTxIDs(db, ids)
	if err != nil {
		return err
	}
	applyTagEnrichment(items, tagMap)

	if len(contactIDSet) == 0 {
		return nil
	}
	cids := make([]int64, 0, len(contactIDSet))
	for id := range contactIDSet {
		cids = append(cids, id)
	}
	names, err := loadContactNamesForIDs(db, cids)
	if err != nil {
		return err
	}
	applyContactEnrichment(items, names)
	return nil
}

func (s *TransactionService) EnrichBatchWithMeta(db *sql.DB, meta *cache.LedgerMeta, items []Transaction) error {
	if len(items) == 0 {
		return nil
	}
	ids, contactIDSet := resetBatchEnrichment(items)

	tagMapRaw, err := meta.TxTagsForIDs(db, ids)
	if err != nil {
		return err
	}
	tagMap := make(map[int64][]TransactionTagItem, len(tagMapRaw))
	for txID, entries := range tagMapRaw {
		for _, e := range entries {
			tagMap[txID] = append(tagMap[txID], TransactionTagItem{
				ID: e.ID, Name: e.Name, ColorBg: e.ColorBg, ColorFg: e.ColorFg,
			})
		}
	}
	applyTagEnrichment(items, tagMap)

	if len(contactIDSet) == 0 {
		return nil
	}
	cids := make([]int64, 0, len(contactIDSet))
	for id := range contactIDSet {
		cids = append(cids, id)
	}
	names, err := meta.ContactNamesBatch(db, cids)
	if err != nil {
		return err
	}
	applyContactEnrichment(items, names)
	return nil
}

func (s *TransactionService) Create(db *sql.DB, in CreateTransactionInput) (*Transaction, error) {
	if err := s.validate(db, in); err != nil {
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
	if err := s.validate(db, in); err != nil {
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

func (s *TransactionService) validate(db *sql.DB, in CreateTransactionInput) error {
	hasDE, err := s.hasDailyExpenseTag(db, in.TagIDs)
	if err != nil {
		return err
	}
	if hasDE {
		return fmt.Errorf("%w: daily_expense_tag", ErrValidation)
	}
	return validateTransactionCore(in.Amount, in.Type, in.TransactionDate, s.now())
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
		SELECT DISTINCT g.id, g.name, g.preset_key, g.is_system, g.enabled, g.color_bg, g.color_fg, g.usage_count
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
		t, err := scanTag(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, t)
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
