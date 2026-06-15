package service

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/minibill/minibill/internal/cache"
	"github.com/minibill/minibill/internal/domain"
)

const (
	ledgerCSVHeader0   = "日期"
	ledgerCSVHeader1   = "流向"
	ledgerCSVHeader2   = "金额"
	ledgerCSVHeader3   = "标签"
	ledgerCSVHeader4   = "联系人"
	ledgerCSVHeader5   = "备注"
	balanceNoteMarker  = "月度余额"
	utf8BOM            = "\ufeff"
	exportFlushEvery   = 200
)

var ledgerCSVHeader = []string{ledgerCSVHeader0, ledgerCSVHeader1, ledgerCSVHeader2, ledgerCSVHeader3, ledgerCSVHeader4, ledgerCSVHeader5}

type LedgerCSVService struct {
	txSvc     *TransactionService
	stats     *StatsService
	metaStore *cache.LedgerMetaStore
	now       func() time.Time
}

func NewLedgerCSVService(txSvc *TransactionService, stats *StatsService, metaStore *cache.LedgerMetaStore) *LedgerCSVService {
	if metaStore == nil {
		metaStore = cache.NewLedgerMetaStore(0)
	}
	return &LedgerCSVService{txSvc: txSvc, stats: stats, metaStore: metaStore, now: time.Now}
}

type ImportResult struct {
	ImportedTransactions int `json:"imported_transactions"`
	ImportedBalances     int `json:"imported_balances"`
	SkippedDailyExpense  int `json:"skipped_daily_expense"`
	CreatedTags          int `json:"created_tags"`
	CreatedContacts      int `json:"created_contacts"`
}

type csvRawRow struct {
	cols []string
}

type parsedTx struct {
	amount    int64
	typ       string
	date      string
	note      string
	contactID *int64
	tagIDs    []int64
}

type pendingBalance struct {
	year    int
	month   int
	balance int64
}

type exportTxRow struct {
	id        int64
	amount    int64
	typ       string
	date      string
	note      string
	contactID sql.NullInt64
}

func (s *LedgerCSVService) Export(db *sql.DB, userID int64, w io.Writer) error {
	if _, err := io.WriteString(w, utf8BOM); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	if err := cw.Write(ledgerCSVHeader); err != nil {
		return err
	}
	cw.Flush()
	if err := cw.Error(); err != nil {
		return err
	}
	flushWriter(w)

	meta := s.metaStore.ForUser(userID)
	if err := meta.EnsureWarm(db); err != nil {
		return err
	}
	if err := meta.LoadTxTags(db); err != nil {
		return err
	}

	rows, err := db.Query(`
		SELECT t.id, t.amount, t.type, t.transaction_date, t.note, t.contact_id
		FROM transactions t
		ORDER BY t.transaction_date ASC, t.id ASC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	txByMonth := map[string][]exportTxRow{}
	monthSet := map[string]bool{}
	for rows.Next() {
		var row exportTxRow
		if err := rows.Scan(&row.id, &row.amount, &row.typ, &row.date, &row.note, &row.contactID); err != nil {
			return err
		}
		ym, err := domain.MonthOfDate(row.date)
		if err != nil {
			return err
		}
		monthKey := ym.String()
		txByMonth[monthKey] = append(txByMonth[monthKey], row)
		monthSet[monthKey] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}

	balanceByMonth := map[string]pendingBalance{}
	balRows, err := db.Query(`SELECT year, month, balance FROM monthly_balances ORDER BY year, month`)
	if err != nil {
		return err
	}
	defer balRows.Close()
	for balRows.Next() {
		var y, m int
		var bal int64
		if err := balRows.Scan(&y, &m, &bal); err != nil {
			return err
		}
		key := formatCSVMonth(y, m)
		balanceByMonth[key] = pendingBalance{year: y, month: m, balance: bal}
		monthSet[key] = true
	}

	monthKeys := make([]string, 0, len(monthSet))
	for k := range monthSet {
		monthKeys = append(monthKeys, k)
	}
	sort.Strings(monthKeys)

	rowCount := 0
	writeRow := func(cols []string) error {
		if err := cw.Write(cols); err != nil {
			return err
		}
		rowCount++
		if rowCount%exportFlushEvery == 0 {
			cw.Flush()
			if err := cw.Error(); err != nil {
				return err
			}
			flushWriter(w)
		}
		return nil
	}

	for _, monthKey := range monthKeys {
		for _, row := range txByMonth[monthKey] {
			contactName := ""
			if row.contactID.Valid {
				contactName, err = meta.ContactName(db, row.contactID.Int64)
				if err != nil {
					return err
				}
			}
			if err := writeRow([]string{
				formatCSVDate(row.date),
				formatCSVFlow(row.typ),
				formatYuanFromCents(row.amount),
				joinTags(meta.TxTagNames(row.id)),
				contactName,
				row.note,
			}); err != nil {
				return err
			}
		}
		if b, ok := balanceByMonth[monthKey]; ok {
			if err := writeRow([]string{
				formatCSVMonth(b.year, b.month),
				"",
				formatYuanFromCents(b.balance),
				"",
				"",
				balanceNoteMarker,
			}); err != nil {
				return err
			}
		}
	}

	cw.Flush()
	return cw.Error()
}

func flushWriter(w io.Writer) {
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
}

func (s *LedgerCSVService) ImportReplace(db *sql.DB, userID int64, r io.Reader) (*ImportResult, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("%w: invalid csv header", ErrValidation)
	}
	if err := validateCSVHeader(header); err != nil {
		return nil, err
	}

	txBuckets := map[string][]csvRawRow{}
	balanceByMonth := map[string]pendingBalance{}
	result := &ImportResult{}

	for {
		record, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrValidation, err)
		}
		if len(record) < 6 {
			return nil, fmt.Errorf("%w: row has fewer than 6 columns", ErrValidation)
		}
		for len(record) < 6 {
			record = append(record, "")
		}
		row := csvRawRow{cols: record[:6]}
		note := strings.TrimSpace(row.cols[5])
		date := strings.TrimSpace(row.cols[0])

		if note == balanceNoteMarker {
			if !isYearMonth(date) {
				return nil, fmt.Errorf("%w: 月度余额行日期须为 YYYY-MM", ErrValidation)
			}
			ym, err := parseYearMonthKey(date)
			if err != nil {
				return nil, err
			}
			bal, err := parseYuanToCents(row.cols[2])
			if err != nil {
				return nil, err
			}
			if bal < 0 {
				return nil, fmt.Errorf("%w: 余额不能为负", ErrValidation)
			}
			if _, exists := balanceByMonth[date]; exists {
				return nil, fmt.Errorf("%w: 重复月度余额 %s", ErrValidation, date)
			}
			balanceByMonth[date] = pendingBalance{year: ym.Year, month: ym.Month, balance: bal}
			continue
		}

		if tagsFieldHasDailyExpense(row.cols[3]) {
			result.SkippedDailyExpense++
			continue
		}

		if !isFullDate(date) {
			return nil, fmt.Errorf("%w: 流水日期须为 YYYY-MM-DD", ErrValidation)
		}
		monthKey := date[:7]
		txBuckets[monthKey] = append(txBuckets[monthKey], row)
	}

	txSQL, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = txSQL.Rollback() }()

	if err := clearLedgerData(txSQL); err != nil {
		return nil, err
	}

	meta := s.metaStore.ForUser(userID)
	if err := meta.WarmTagsAndContacts(txSQL); err != nil {
		return nil, err
	}

	monthKeys := sortedMapKeys(txBuckets)
	recalcMonths := map[domain.YearMonth]bool{}

	for _, monthKey := range monthKeys {
		rawRows := txBuckets[monthKey]
		parsed, err := s.parseMonthTxs(txSQL, rawRows, meta, result)
		if err != nil {
			return nil, err
		}
		if err := insertMonthTxs(txSQL, parsed); err != nil {
			return nil, err
		}
		result.ImportedTransactions += len(parsed)
		ym, _ := parseYearMonthKey(monthKey)
		recalcMonths[ym] = true
	}

	balMonthKeys := sortedMapKeys(balanceByMonth)
	for _, key := range balMonthKeys {
		b := balanceByMonth[key]
		_, err := txSQL.Exec(`
			INSERT INTO monthly_balances (year, month, balance, note, updated_at)
			VALUES (?, ?, ?, '', datetime('now'))`,
			b.year, b.month, b.balance)
		if err != nil {
			return nil, err
		}
		result.ImportedBalances++
		ym := domain.YearMonth{Year: b.year, Month: b.month}
		recalcMonths[ym] = true
		recalcMonths[domain.NextMonth(ym)] = true
	}

	if err := txSQL.Commit(); err != nil {
		return nil, err
	}
	if err := s.recalcMonthsOnDB(db, recalcMonths); err != nil {
		return nil, err
	}
	s.metaStore.Invalidate(userID)
	return result, nil
}

func (s *LedgerCSVService) parseMonthTxs(
	tx *sql.Tx,
	rawRows []csvRawRow,
	meta *cache.LedgerMeta,
	result *ImportResult,
) ([]parsedTx, error) {
	now := s.now()
	out := make([]parsedTx, 0, len(rawRows))
	for _, row := range rawRows {
		date := strings.TrimSpace(row.cols[0])
		flow := strings.TrimSpace(row.cols[1])
		typ, err := parseCSVFlow(flow)
		if err != nil {
			return nil, err
		}
		amount, err := parseYuanToCents(row.cols[2])
		if err != nil {
			return nil, err
		}
		date = formatCSVDate(date)
		tagNames := splitTagNames(row.cols[3])
		contactName := strings.TrimSpace(row.cols[4])
		note := row.cols[5]

		var contactID *int64
		if contactName != "" {
			id, err := meta.ResolveContactID(tx, contactName, &result.CreatedContacts)
			if err != nil {
				return nil, err
			}
			contactID = id
		}

		tagIDs := make([]int64, 0, len(tagNames))
		for _, name := range tagNames {
			n := strings.TrimSpace(name)
			if n == "" {
				return nil, fmt.Errorf("%w: 标签名不能为空", ErrValidation)
			}
			id, err := meta.ResolveTagID(tx, n, &result.CreatedTags)
			if err != nil {
				return nil, err
			}
			tagIDs = append(tagIDs, id)
		}

		if err := validateImportTx(date, typ, amount, tagNames, contactID, now); err != nil {
			return nil, err
		}

		out = append(out, parsedTx{
			amount:    amount,
			typ:       typ,
			date:      date,
			note:      note,
			contactID: contactID,
			tagIDs:    tagIDs,
		})
	}
	return out, nil
}

func (s *LedgerCSVService) recalcMonthsOnDB(db *sql.DB, months map[domain.YearMonth]bool) error {
	list := make([]domain.YearMonth, 0, len(months))
	for ym := range months {
		list = append(list, ym)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Year != list[j].Year {
			return list[i].Year < list[j].Year
		}
		return list[i].Month < list[j].Month
	})
	for _, ym := range list {
		if err := s.stats.syncDailyExpenseForMonth(db, ym.Year, ym.Month); err != nil {
			return err
		}
	}
	return nil
}

func clearLedgerData(tx *sql.Tx) error {
	stmts := []string{
		`DELETE FROM transaction_tags`,
		`DELETE FROM transactions`,
		`DELETE FROM monthly_balances`,
		`DELETE FROM stat_monthly`,
	}
	for _, q := range stmts {
		if _, err := tx.Exec(q); err != nil {
			return err
		}
	}
	return nil
}

func insertMonthTxs(tx *sql.Tx, txs []parsedTx) error {
	if len(txs) == 0 {
		return nil
	}
	txStmt, err := tx.Prepare(`INSERT INTO transactions (amount, type, transaction_date, note, contact_id, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`)
	if err != nil {
		return err
	}
	defer txStmt.Close()

	tagStmt, err := tx.Prepare(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`)
	if err != nil {
		return err
	}
	defer tagStmt.Close()

	for _, p := range txs {
		res, err := txStmt.Exec(p.amount, p.typ, p.date, p.note, nullInt64(p.contactID))
		if err != nil {
			return err
		}
		txID, err := res.LastInsertId()
		if err != nil {
			return err
		}
		for _, tagID := range p.tagIDs {
			if _, err := tagStmt.Exec(txID, tagID); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateImportTx(date, typ string, amount int64, tagNames []string, contactID *int64, now time.Time) error {
	if amount <= 0 {
		return fmt.Errorf("%w: amount must be positive", ErrValidation)
	}
	if typ != "income" && typ != "expense" {
		return fmt.Errorf("%w: invalid type", ErrValidation)
	}
	if !domain.IsDateNotAfterToday(date, now) {
		return fmt.Errorf("%w: 日期不能晚于今天", ErrValidation)
	}
	if domain.HasSocialTag(tagNames) && contactID == nil {
		return fmt.Errorf("%w: 含人情标签时必须选择联系人", ErrValidation)
	}
	if domain.HasDailyExpenseTag(tagNames) {
		return fmt.Errorf("%w: 不可使用系统标签「日常支出」", ErrValidation)
	}
	return nil
}

func validateCSVHeader(header []string) error {
	if len(header) < 6 {
		return fmt.Errorf("%w: invalid csv header", ErrValidation)
	}
	header[0] = strings.TrimPrefix(strings.TrimSpace(header[0]), utf8BOM)
	for i, want := range ledgerCSVHeader {
		if strings.TrimSpace(header[i]) != want {
			return fmt.Errorf("%w: expected header %v", ErrValidation, ledgerCSVHeader)
		}
	}
	return nil
}

func splitTagNames(col string) []string {
	col = strings.TrimSpace(col)
	if col == "" {
		return nil
	}
	parts := strings.Split(col, "|")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func tagsFieldHasDailyExpense(tagsCol string) bool {
	for _, name := range splitTagNames(tagsCol) {
		if name == domain.DailyExpenseTagName {
			return true
		}
	}
	return false
}

func formatCSVFlow(typ string) string {
	if typ == "income" {
		return "收入"
	}
	return "支出"
}

func formatCSVDate(date string) string {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(date))
	if err != nil {
		return strings.TrimSpace(date)
	}
	return t.Format("2006-01-02")
}

func formatCSVMonth(year, month int) string {
	return fmt.Sprintf("%04d-%02d", year, month)
}

func parseCSVFlow(flow string) (string, error) {
	switch flow {
	case "收入":
		return "income", nil
	case "支出":
		return "expense", nil
	default:
		return "", fmt.Errorf("%w: 流向须为收入或支出", ErrValidation)
	}
}

func formatYuanFromCents(cents int64) string {
	neg := cents < 0
	if neg {
		cents = -cents
	}
	yuan := cents / 100
	frac := cents % 100
	if neg {
		return fmt.Sprintf("-%d.%02d", yuan, frac)
	}
	return fmt.Sprintf("%d.%02d", yuan, frac)
}

func parseYuanToCents(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("%w: 金额不能为空", ErrValidation)
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: invalid amount", ErrValidation)
	}
	return int64(math.Round(f * 100)), nil
}

func isYearMonth(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) != 7 || s[4] != '-' {
		return false
	}
	_, err := time.Parse("2006-01", s)
	return err == nil
}

func isFullDate(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) != 10 {
		return false
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func parseYearMonthKey(key string) (domain.YearMonth, error) {
	t, err := time.Parse("2006-01", strings.TrimSpace(key))
	if err != nil {
		return domain.YearMonth{}, fmt.Errorf("%w: invalid month %s", ErrValidation, key)
	}
	y, m, _ := t.Date()
	return domain.YearMonth{Year: y, Month: int(m)}, nil
}

func sortedMapKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
