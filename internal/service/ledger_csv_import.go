package service

import (
	"database/sql"
	"encoding/binary"
	"encoding/csv"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"

	"github.com/minibill/minibill/internal/cache"
	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/i18n"
)

// CSVImportMapping maps logical fields to CSV column names or 0-based indices (as strings).
// Empty values mean the field is not mapped (ignored).
type CSVImportMapping struct {
	Date    string `json:"date,omitempty"`
	Flow    string `json:"flow,omitempty"`
	Amount  string `json:"amount,omitempty"`
	Tags    string `json:"tags,omitempty"`
	Contact string `json:"contact,omitempty"`
	Note    string `json:"note,omitempty"`
	Balance string `json:"balance,omitempty"` // running balance / 结余
}

// CSVImportOpts controls ImportCSV behavior.
type CSVImportOpts struct {
	Mapping        CSVImportMapping
	KeepHistory    bool
	DeriveBalances bool
	OpeningBalance *int64 // cents; required for derive when Balance column is not mapped
}

func (m CSVImportMapping) isEmpty() bool {
	return m.Date == "" && m.Flow == "" && m.Amount == "" &&
		m.Tags == "" && m.Contact == "" && m.Note == "" && m.Balance == ""
}

type csvMappedRow struct {
	date           string
	flow           string
	amount         string
	tags           string
	contact        string
	note           string
	runningBalance string
}

type fieldCols struct {
	date, flow, amount, tags, contact, note, balance int
}

func (s *LedgerCSVService) ImportReplace(db *sql.DB, userID int64, r io.Reader) (*ImportResult, error) {
	return s.ImportCSV(db, userID, r, CSVImportOpts{KeepHistory: false})
}

func (s *LedgerCSVService) ImportCSV(db *sql.DB, userID int64, r io.Reader, opts CSVImportOpts) (*ImportResult, error) {
	raw, err := io.ReadAll(io.LimitReader(r, MaxLedgerCSVImportBytes+1))
	if err != nil {
		return nil, err
	}
	if len(raw) > MaxLedgerCSVImportBytes {
		return nil, fmt.Errorf("%w: csv_too_large", ErrValidation)
	}
	text, err := decodeCSVText(raw)
	if err != nil {
		return nil, err
	}
	comma := sniffCSVDelimiter(text)
	cr := csv.NewReader(strings.NewReader(text))
	cr.Comma = comma
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("%w: invalid_csv_header", ErrValidation)
	}
	if len(header) > 0 {
		header[0] = strings.TrimPrefix(strings.TrimSpace(header[0]), utf8BOM)
	}

	cols, err := resolveImportColumns(header, opts.Mapping)
	if err != nil {
		return nil, err
	}

	txBuckets := map[string][]csvMappedRow{}
	balanceByMonth := map[string]pendingBalance{}
	result := &ImportResult{}
	rowCount := 0

	for {
		record, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrValidation, err)
		}
		rowCount++
		if rowCount > MaxLedgerCSVImportRows {
			return nil, fmt.Errorf("%w: csv_row_limit", ErrValidation)
		}
		row := mapCSVRecord(record, cols)
		note := strings.TrimSpace(row.note)
		dateRaw := strings.TrimSpace(row.date)

		if note == balanceNoteMarker("zh-Hans") || note == balanceNoteMarker("en") {
			if !isYearMonth(dateRaw) {
				return nil, fmt.Errorf("%w: balance_date_format", ErrValidation)
			}
			ym, err := parseYearMonthKey(dateRaw)
			if err != nil {
				return nil, err
			}
			bal, err := parseYuanToCents(row.amount)
			if err != nil {
				return nil, err
			}
			if bal < 0 {
				return nil, fmt.Errorf("%w: balance_negative", ErrValidation)
			}
			if _, exists := balanceByMonth[dateRaw]; exists {
				return nil, fmt.Errorf("%w: duplicate_balance", ErrValidation)
			}
			balanceByMonth[dateRaw] = pendingBalance{year: ym.Year, month: ym.Month, balance: bal}
			continue
		}

		if tagsFieldHasDailyExpense(row.tags) {
			result.SkippedDailyExpense++
			continue
		}

		date, err := parseFlexibleDate(dateRaw)
		if err != nil {
			return nil, err
		}
		monthKey := date[:7]
		row.date = date
		txBuckets[monthKey] = append(txBuckets[monthKey], row)
	}

	txSQL, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() { _ = txSQL.Rollback() }()

	if !opts.KeepHistory {
		if err := clearLedgerData(txSQL); err != nil {
			return nil, err
		}
	}

	meta := s.metaStore.ForUser(userID)
	if err := meta.WarmTagsAndContacts(txSQL); err != nil {
		return nil, err
	}

	existingFP := map[string]struct{}{}
	existingBalanceMonths := map[string]struct{}{}
	if opts.KeepHistory {
		existingFP, err = loadExistingTxFingerprints(txSQL, meta)
		if err != nil {
			return nil, err
		}
		existingBalanceMonths, err = loadExistingBalanceMonths(txSQL)
		if err != nil {
			return nil, err
		}
	}

	monthKeys := sortedMapKeys(txBuckets)
	recalcMonths := map[domain.YearMonth]bool{}

	for _, monthKey := range monthKeys {
		rawRows := txBuckets[monthKey]
		parsed, skipped, err := s.parseMappedMonthTxs(txSQL, rawRows, meta, result, existingFP)
		if err != nil {
			return nil, err
		}
		result.SkippedDuplicates += skipped
		if err := insertMonthTxs(txSQL, parsed); err != nil {
			return nil, err
		}
		result.ImportedTransactions += len(parsed)
		ym, _ := parseYearMonthKey(monthKey)
		recalcMonths[ym] = true
	}

	occupiedBalances := map[string]struct{}{}
	for k := range existingBalanceMonths {
		occupiedBalances[k] = struct{}{}
	}

	balMonthKeys := sortedMapKeys(balanceByMonth)
	for _, key := range balMonthKeys {
		if _, ok := occupiedBalances[key]; ok {
			continue
		}
		b := balanceByMonth[key]
		if err := insertMonthlyBalance(txSQL, b); err != nil {
			return nil, err
		}
		result.ImportedBalances++
		occupiedBalances[key] = struct{}{}
		ym := domain.YearMonth{Year: b.year, Month: b.month}
		recalcMonths[ym] = true
		recalcMonths[domain.NextMonth(ym)] = true
	}

	if opts.DeriveBalances {
		n, err := deriveMonthlyBalances(txSQL, opts, cols.balance >= 0, txBuckets, occupiedBalances, recalcMonths)
		if err != nil {
			return nil, err
		}
		result.DerivedBalances = n
	}

	if err := rebuildAllUsageCounts(txSQL); err != nil {
		return nil, err
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

func (s *LedgerCSVService) parseMappedMonthTxs(
	tx *sql.Tx,
	rawRows []csvMappedRow,
	meta *cache.LedgerMeta,
	result *ImportResult,
	existingFP map[string]struct{},
) ([]parsedTx, int, error) {
	now := s.now()
	out := make([]parsedTx, 0, len(rawRows))
	skipped := 0
	for _, row := range rawRows {
		typ, err := parseCSVFlow(row.flow)
		if err != nil {
			return nil, 0, err
		}
		amount, err := parseYuanToCents(row.amount)
		if err != nil {
			return nil, 0, err
		}
		date := row.date
		tagNames := splitTagNames(row.tags)
		contactName := strings.TrimSpace(row.contact)
		note := row.note

		fp := txFingerprint(date, amount, note, tagNames)
		if existingFP != nil {
			if _, ok := existingFP[fp]; ok {
				skipped++
				continue
			}
		}

		var contactID *int64
		if contactName != "" {
			id, err := meta.ResolveContactID(tx, contactName, &result.CreatedContacts)
			if err != nil {
				return nil, 0, err
			}
			contactID = id
		}

		tagIDs := make([]int64, 0, len(tagNames))
		for _, name := range tagNames {
			n := strings.TrimSpace(name)
			if n == "" {
				return nil, 0, fmt.Errorf("%w: tag_name_empty", ErrValidation)
			}
			id, err := meta.ResolveTagID(tx, n, &result.CreatedTags)
			if err != nil {
				return nil, 0, err
			}
			tagIDs = append(tagIDs, id)
		}

		if err := validateImportTx(date, typ, amount, now); err != nil {
			return nil, 0, err
		}

		out = append(out, parsedTx{
			amount:    amount,
			typ:       typ,
			date:      date,
			note:      note,
			contactID: contactID,
			tagIDs:    tagIDs,
		})
		if existingFP != nil {
			existingFP[fp] = struct{}{}
		}
	}
	return out, skipped, nil
}

func resolveImportColumns(header []string, mapping CSVImportMapping) (fieldCols, error) {
	if mapping.isEmpty() {
		if err := validateCSVHeader(header); err == nil {
			return fieldCols{date: 0, flow: 1, amount: 2, tags: 3, contact: 4, note: 5, balance: -1}, nil
		}
		mapping = GuessCSVMapping(header)
	}
	cols := fieldCols{date: -1, flow: -1, amount: -1, tags: -1, contact: -1, note: -1, balance: -1}
	var err error
	if cols.date, err = resolveColumnIndex(header, mapping.Date); err != nil {
		return cols, err
	}
	if cols.flow, err = resolveColumnIndex(header, mapping.Flow); err != nil {
		return cols, err
	}
	if cols.amount, err = resolveColumnIndex(header, mapping.Amount); err != nil {
		return cols, err
	}
	if cols.tags, err = resolveColumnIndex(header, mapping.Tags); err != nil {
		return cols, err
	}
	if cols.contact, err = resolveColumnIndex(header, mapping.Contact); err != nil {
		return cols, err
	}
	if cols.note, err = resolveColumnIndex(header, mapping.Note); err != nil {
		return cols, err
	}
	if cols.balance, err = resolveColumnIndex(header, mapping.Balance); err != nil {
		return cols, err
	}
	if cols.date < 0 || cols.flow < 0 || cols.amount < 0 {
		return cols, fmt.Errorf("%w: csv_mapping_required", ErrValidation)
	}
	return cols, nil
}

func resolveColumnIndex(header []string, ref string) (int, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return -1, nil
	}
	if idx, err := strconv.Atoi(ref); err == nil {
		if idx < 0 || idx >= len(header) {
			return -1, fmt.Errorf("%w: csv_mapping_index", ErrValidation)
		}
		return idx, nil
	}
	for i, h := range header {
		if strings.TrimSpace(h) == ref {
			return i, nil
		}
	}
	return -1, fmt.Errorf("%w: csv_mapping_column", ErrValidation)
}

func mapCSVRecord(record []string, cols fieldCols) csvMappedRow {
	get := func(i int) string {
		if i < 0 || i >= len(record) {
			return ""
		}
		return record[i]
	}
	return csvMappedRow{
		date:           get(cols.date),
		flow:           get(cols.flow),
		amount:         get(cols.amount),
		tags:           get(cols.tags),
		contact:        get(cols.contact),
		note:           get(cols.note),
		runningBalance: get(cols.balance),
	}
}

// GuessCSVMapping picks field→header mapping from common aliases (鲨鱼记账 / MiniBill / English).
func GuessCSVMapping(headers []string) CSVImportMapping {
	aliases := map[string][]string{
		"date": {
			"日期", "Date",
			i18n.T("zh-Hans", "csv.header.date"),
			i18n.T("zh-Hant", "csv.header.date"),
			i18n.T("en", "csv.header.date"),
		},
		"flow": {
			"收支类型", "流向", "类型", "Flow", "Type",
			i18n.T("zh-Hans", "csv.header.flow"),
			i18n.T("zh-Hant", "csv.header.flow"),
			i18n.T("en", "csv.header.flow"),
		},
		"amount": {
			"金额", "金額", "Amount",
			i18n.T("zh-Hans", "csv.header.amount"),
			i18n.T("en", "csv.header.amount"),
		},
		"tags": {
			"类别", "類別", "分类", "分類", "标签", "標籤", "Tags", "Category",
			i18n.T("zh-Hans", "csv.header.tags"),
			i18n.T("zh-Hant", "csv.header.tags"),
			i18n.T("en", "csv.header.tags"),
		},
		"contact": {
			"联系人", "聯繫人", "Contact",
			i18n.T("zh-Hans", "csv.header.contact"),
			i18n.T("zh-Hant", "csv.header.contact"),
			i18n.T("en", "csv.header.contact"),
		},
		"note": {
			"备注", "備註", "说明", "說明", "Note", "Memo",
			i18n.T("zh-Hans", "csv.header.note"),
			i18n.T("zh-Hant", "csv.header.note"),
			i18n.T("en", "csv.header.note"),
		},
		"balance": {
			"结余", "結餘", "账户结余", "帳戶結餘", "账户余额", "帳戶餘額",
			"账户结余(元)", "账户结余（元）", "Running balance", "Balance after",
			"余额", "餘額",
		},
	}
	used := map[int]struct{}{}
	pick := func(field string) string {
		for _, alias := range aliases[field] {
			for i, h := range headers {
				if _, ok := used[i]; ok {
					continue
				}
				if strings.EqualFold(strings.TrimSpace(h), strings.TrimSpace(alias)) {
					used[i] = struct{}{}
					return strings.TrimSpace(h)
				}
			}
		}
		return ""
	}
	// Pick amount before balance so bare「金额」is not stolen;「余额」only if still free.
	return CSVImportMapping{
		Date:    pick("date"),
		Flow:    pick("flow"),
		Amount:  pick("amount"),
		Tags:    pick("tags"),
		Contact: pick("contact"),
		Note:    pick("note"),
		Balance: pick("balance"),
	}
}

func insertMonthlyBalance(tx *sql.Tx, b pendingBalance) error {
	_, err := tx.Exec(`
		INSERT INTO monthly_balances (year, month, balance, note, updated_at)
		VALUES (?, ?, ?, '', datetime('now'))`,
		b.year, b.month, b.balance)
	return err
}

func deriveMonthlyBalances(
	tx *sql.Tx,
	opts CSVImportOpts,
	hasBalanceCol bool,
	txBuckets map[string][]csvMappedRow,
	occupied map[string]struct{},
	recalcMonths map[domain.YearMonth]bool,
) (int, error) {
	if hasBalanceCol {
		return deriveBalancesFromRunningColumn(tx, txBuckets, occupied, recalcMonths)
	}
	if opts.OpeningBalance == nil {
		return 0, fmt.Errorf("%w: opening_balance_required", ErrValidation)
	}
	if *opts.OpeningBalance < 0 {
		return 0, fmt.Errorf("%w: balance_negative", ErrValidation)
	}
	return deriveBalancesFromOpening(tx, *opts.OpeningBalance, txBuckets, occupied, recalcMonths)
}

func deriveBalancesFromRunningColumn(
	tx *sql.Tx,
	txBuckets map[string][]csvMappedRow,
	occupied map[string]struct{},
	recalcMonths map[domain.YearMonth]bool,
) (int, error) {
	inserted := 0
	for _, monthKey := range sortedMapKeys(txBuckets) {
		if _, ok := occupied[monthKey]; ok {
			continue
		}
		lastBal := ""
		for _, row := range txBuckets[monthKey] {
			if v := strings.TrimSpace(row.runningBalance); v != "" {
				lastBal = v
			}
		}
		if lastBal == "" {
			continue
		}
		cents, err := parseYuanToCents(lastBal)
		if err != nil {
			return inserted, err
		}
		if cents < 0 {
			return inserted, fmt.Errorf("%w: balance_negative", ErrValidation)
		}
		ym, err := parseYearMonthKey(monthKey)
		if err != nil {
			return inserted, err
		}
		b := pendingBalance{year: ym.Year, month: ym.Month, balance: cents}
		if err := insertMonthlyBalance(tx, b); err != nil {
			return inserted, err
		}
		occupied[monthKey] = struct{}{}
		inserted++
		recalcMonths[ym] = true
		recalcMonths[domain.NextMonth(ym)] = true
	}
	return inserted, nil
}

func deriveBalancesFromOpening(
	tx *sql.Tx,
	opening int64,
	txBuckets map[string][]csvMappedRow,
	occupied map[string]struct{},
	recalcMonths map[domain.YearMonth]bool,
) (int, error) {
	monthKeys := sortedMapKeys(txBuckets)
	if len(monthKeys) == 0 {
		return 0, nil
	}
	first, err := parseYearMonthKey(monthKeys[0])
	if err != nil {
		return 0, err
	}
	last, err := parseYearMonthKey(monthKeys[len(monthKeys)-1])
	if err != nil {
		return 0, err
	}

	inserted := 0
	prevYM := domain.PrevMonth(first)
	prevKey := formatCSVMonth(prevYM.Year, prevYM.Month)
	cur := opening
	if _, ok := occupied[prevKey]; !ok {
		if err := insertMonthlyBalance(tx, pendingBalance{year: prevYM.Year, month: prevYM.Month, balance: cur}); err != nil {
			return inserted, err
		}
		occupied[prevKey] = struct{}{}
		inserted++
		recalcMonths[prevYM] = true
		recalcMonths[domain.NextMonth(prevYM)] = true
	} else {
		// Use existing prev-month balance as roll start when already occupied
		var existing int64
		err := tx.QueryRow(`SELECT balance FROM monthly_balances WHERE year=? AND month=?`, prevYM.Year, prevYM.Month).Scan(&existing)
		if err == nil {
			cur = existing
		}
	}

	for ym := first; ; ym = domain.NextMonth(ym) {
		income, expense, err := sumMonthTxAmounts(tx, ym)
		if err != nil {
			return inserted, err
		}
		cur = cur + income - expense
		if cur < 0 {
			return inserted, fmt.Errorf("%w: balance_negative", ErrValidation)
		}
		key := formatCSVMonth(ym.Year, ym.Month)
		if _, ok := occupied[key]; !ok {
			if err := insertMonthlyBalance(tx, pendingBalance{year: ym.Year, month: ym.Month, balance: cur}); err != nil {
				return inserted, err
			}
			occupied[key] = struct{}{}
			inserted++
			recalcMonths[ym] = true
			recalcMonths[domain.NextMonth(ym)] = true
		} else {
			var existing int64
			if err := tx.QueryRow(`SELECT balance FROM monthly_balances WHERE year=? AND month=?`, ym.Year, ym.Month).Scan(&existing); err == nil {
				cur = existing
			}
		}
		if ym.Year == last.Year && ym.Month == last.Month {
			break
		}
	}
	return inserted, nil
}

func sumMonthTxAmounts(tx *sql.Tx, ym domain.YearMonth) (income, expense int64, err error) {
	start, end := monthRange(ym.Year, ym.Month)
	q := `
		SELECT t.type, COALESCE(SUM(t.amount), 0)
		FROM transactions t
		WHERE t.transaction_date >= ? AND t.transaction_date < ? AND t.is_system = 0
		  AND NOT EXISTS (
			SELECT 1 FROM transaction_tags tt
			JOIN tags g ON g.id = tt.tag_id
			WHERE tt.transaction_id = t.id AND g.preset_key = ?
		  )
		GROUP BY t.type`
	rows, err := tx.Query(q, start, end, domain.DailyExpensePresetKey)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var typ string
		var sum int64
		if err := rows.Scan(&typ, &sum); err != nil {
			return 0, 0, err
		}
		switch typ {
		case "income":
			income = sum
		case "expense":
			expense = sum
		}
	}
	return income, expense, rows.Err()
}

func decodeCSVText(b []byte) (string, error) {
	if len(b) >= 2 && b[0] == 0xFF && b[1] == 0xFE {
		n := (len(b) - 2) / 2
		u16 := make([]uint16, n)
		for i := 0; i < n; i++ {
			u16[i] = binary.LittleEndian.Uint16(b[2+i*2 : 4+i*2])
		}
		return string(utf16.Decode(u16)), nil
	}
	if len(b) >= 2 && b[0] == 0xFE && b[1] == 0xFF {
		n := (len(b) - 2) / 2
		u16 := make([]uint16, n)
		for i := 0; i < n; i++ {
			u16[i] = binary.BigEndian.Uint16(b[2+i*2 : 4+i*2])
		}
		return string(utf16.Decode(u16)), nil
	}
	s := string(b)
	return strings.TrimPrefix(s, utf8BOM), nil
}

func sniffCSVDelimiter(text string) rune {
	first := text
	if i := strings.IndexAny(text, "\r\n"); i >= 0 {
		first = text[:i]
	}
	tabs := strings.Count(first, "\t")
	commas := strings.Count(first, ",")
	semis := strings.Count(first, ";")
	switch {
	case tabs >= commas && tabs >= semis && tabs > 0:
		return '\t'
	case semis > commas && semis > tabs:
		return ';'
	default:
		return ','
	}
}

func txFingerprint(date string, amount int64, note string, tagNames []string) string {
	tags := append([]string(nil), tagNames...)
	for i := range tags {
		tags[i] = strings.TrimSpace(tags[i])
	}
	sort.Strings(tags)
	return date + "\x00" + strconv.FormatInt(amount, 10) + "\x00" + note + "\x00" + strings.Join(tags, "|")
}

func loadExistingTxFingerprints(tx *sql.Tx, meta *cache.LedgerMeta) (map[string]struct{}, error) {
	if err := meta.LoadTxTags(tx); err != nil {
		return nil, err
	}
	rows, err := tx.Query(`
		SELECT id, amount, transaction_date, note
		FROM transactions
		WHERE is_system = 0`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]struct{}{}
	for rows.Next() {
		var id, amount int64
		var date, note string
		if err := rows.Scan(&id, &amount, &date, &note); err != nil {
			return nil, err
		}
		fp := txFingerprint(formatCSVDate(date), amount, note, meta.TxTagNames(id))
		out[fp] = struct{}{}
	}
	return out, rows.Err()
}

func loadExistingBalanceMonths(tx *sql.Tx) (map[string]struct{}, error) {
	rows, err := tx.Query(`SELECT year, month FROM monthly_balances`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]struct{}{}
	for rows.Next() {
		var y, m int
		if err := rows.Scan(&y, &m); err != nil {
			return nil, err
		}
		out[formatCSVMonth(y, m)] = struct{}{}
	}
	return out, rows.Err()
}
