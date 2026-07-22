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
	"github.com/minibill/minibill/internal/i18n"
)

const (
	utf8BOM          = "\ufeff"
	exportFlushEvery = 200

	MaxLedgerCSVImportBytes = 50 << 20 // 50 MiB
	MaxLedgerCSVImportRows  = 100_000
)

func csvHeaders(locale string) []string {
	return []string{
		i18n.T(locale, "csv.header.date"),
		i18n.T(locale, "csv.header.flow"),
		i18n.T(locale, "csv.header.amount"),
		i18n.T(locale, "csv.header.tags"),
		i18n.T(locale, "csv.header.contact"),
		i18n.T(locale, "csv.header.note"),
	}
}

func balanceNoteMarker(locale string) string {
	return i18n.T(locale, "csv.balance_marker")
}

func dailyExpenseTagAliases() []string {
	seen := map[string]struct{}{}
	var out []string
	for _, loc := range i18n.CatalogLocales() {
		name := i18n.T(loc, "tag.daily_expense")
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			out = append(out, name)
		}
	}
	if _, ok := seen[domain.DailyExpenseTagName]; !ok {
		out = append(out, domain.DailyExpenseTagName)
	}
	return out
}

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
	DerivedBalances      int `json:"derived_balances"`
	SkippedDailyExpense  int `json:"skipped_daily_expense"`
	SkippedDuplicates    int `json:"skipped_duplicates"`
	CreatedTags          int `json:"created_tags"`
	CreatedContacts      int `json:"created_contacts"`
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

func (s *LedgerCSVService) Export(db *sql.DB, userID int64, locale string, w io.Writer) error {
	if _, err := io.WriteString(w, utf8BOM); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	header := csvHeaders(locale)
	if err := cw.Write(header); err != nil {
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
				formatCSVFlow(row.typ, locale),
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
				balanceNoteMarker(locale),
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

func validateImportTx(date, typ string, amount int64, now time.Time) error {
	return validateTransactionCore(amount, typ, date, now)
}

func validateCSVHeader(header []string) error {
	if len(header) < 6 {
		return fmt.Errorf("%w: invalid_csv_header", ErrValidation)
	}
	header[0] = strings.TrimPrefix(strings.TrimSpace(header[0]), utf8BOM)
	col0 := strings.TrimSpace(header[0])
	col1 := strings.TrimSpace(header[1])
	// Accept zh-Hans or en headers (and aliases via catalog)
	validSets := [][]string{csvHeaders("zh-Hans"), csvHeaders("en")}
	for _, want := range validSets {
		if col0 == want[0] && col1 == want[1] {
			return nil
		}
	}
	return fmt.Errorf("%w: invalid_csv_header", ErrValidation)
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
	aliases := dailyExpenseTagAliases()
	for _, name := range splitTagNames(tagsCol) {
		for _, alias := range aliases {
			if name == alias {
				return true
			}
		}
	}
	return false
}

func formatCSVFlow(typ, locale string) string {
	if typ == "income" {
		return i18n.T(locale, "csv.flow.income")
	}
	return i18n.T(locale, "csv.flow.expense")
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
	flow = strings.TrimSpace(flow)
	incomeAliases := []string{i18n.T("zh-Hans", "csv.flow.income"), i18n.T("en", "csv.flow.income"), "收入", "Income"}
	expenseAliases := []string{i18n.T("zh-Hans", "csv.flow.expense"), i18n.T("en", "csv.flow.expense"), "支出", "Expense"}
	for _, a := range incomeAliases {
		if flow == a {
			return "income", nil
		}
	}
	for _, a := range expenseAliases {
		if flow == a {
			return "expense", nil
		}
	}
	return "", fmt.Errorf("%w: flow_required", ErrValidation)
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
		return 0, fmt.Errorf("%w: amount_required", ErrValidation)
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: invalid_amount", ErrValidation)
	}
	return int64(math.Round(f * 100)), nil
}

// ParseYuanToCents parses a yuan amount string into cents (for multipart form helpers).
func ParseYuanToCents(s string) (int64, error) {
	return parseYuanToCents(s)
}

func isYearMonth(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) != 7 || s[4] != '-' {
		return false
	}
	_, err := time.Parse("2006-01", s)
	return err == nil
}

func parseYearMonthKey(key string) (domain.YearMonth, error) {
	t, err := time.Parse("2006-01", strings.TrimSpace(key))
	if err != nil {
		return domain.YearMonth{}, fmt.Errorf("%w: invalid_month", ErrValidation)
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

func joinTags(tags []string) string {
	if len(tags) == 0 {
		return ""
	}
	s := tags[0]
	for i := 1; i < len(tags); i++ {
		s += "|" + tags[i]
	}
	return s
}
