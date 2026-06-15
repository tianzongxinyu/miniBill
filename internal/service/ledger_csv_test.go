package service

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"strings"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/testutil"
)

const testLedgerUserID int64 = 1

func newLedgerCSVForTest(now time.Time) *LedgerCSVService {
	stats := NewStatsService().WithNow(func() time.Time { return now })
	txSvc := NewTransactionService(stats)
	svc := NewLedgerCSVService(txSvc, stats, nil)
	svc.now = func() time.Time { return now }
	return svc
}

func TestLedgerCSVExportIncludesDailyExpenseAndBalance(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	stats := NewStatsService().WithNow(func() time.Time { return now })
	bal := NewBalanceService(stats)

	tagID := testutil.InsertTag(t, db, "餐饮")
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (2850,'expense','2026-03-05','午饭')`)
	var txID int64
	_ = db.QueryRow(`SELECT id FROM transactions WHERE note='午饭'`).Scan(&txID)
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tagID)

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,2,100000)`)
	if _, err := bal.Upsert(db, 2026, 3, 350000, ""); err != nil {
		t.Fatal(err)
	}

	svc := newLedgerCSVForTest(now)
	var buf bytes.Buffer
	if err := svc.Export(db, testLedgerUserID, &buf); err != nil {
		t.Fatal(err)
	}

	records, err := csv.NewReader(strings.NewReader(strings.TrimPrefix(buf.String(), utf8BOM))).ReadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(records) < 4 {
		t.Fatalf("records = %d, want >= 4", len(records))
	}
	if records[0][0] != ledgerCSVHeader0 {
		t.Fatalf("header = %v", records[0])
	}

	var hasLunch, hasDaily, hasBalance bool
	for _, row := range records[1:] {
		if len(row) < 6 {
			continue
		}
		if row[0] == "2026-03-05" && row[3] == "餐饮" && row[2] == "28.50" {
			hasLunch = true
		}
		if strings.Contains(row[3], domain.DailyExpenseTagName) {
			hasDaily = true
		}
		if row[5] == balanceNoteMarker && row[0] == "2026-03" {
			hasBalance = true
		}
	}
	if !hasLunch {
		t.Fatal("missing lunch row")
	}
	if !hasDaily {
		t.Fatal("missing daily expense row in export")
	}
	if !hasBalance {
		t.Fatal("missing balance row")
	}
}

func TestLedgerCSVExportBalanceAfterMonthTransactions(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	stats := NewStatsService().WithNow(func() time.Time { return now })
	bal := NewBalanceService(stats)

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (2850,'expense','2026-03-05','午饭')`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,2,100000)`)
	if _, err := bal.Upsert(db, 2026, 3, 350000, ""); err != nil {
		t.Fatal(err)
	}

	svc := newLedgerCSVForTest(now)
	var buf bytes.Buffer
	if err := svc.Export(db, testLedgerUserID, &buf); err != nil {
		t.Fatal(err)
	}

	records, err := csv.NewReader(strings.NewReader(strings.TrimPrefix(buf.String(), utf8BOM))).ReadAll()
	if err != nil {
		t.Fatal(err)
	}

	var febBalanceIdx, marLunchIdx, marDailyIdx, marBalanceIdx = -1, -1, -1, -1
	for i, row := range records[1:] {
		if len(row) < 6 {
			continue
		}
		switch {
		case row[0] == "2026-02" && row[5] == balanceNoteMarker:
			febBalanceIdx = i
		case row[0] == "2026-03-05" && row[3] != domain.DailyExpenseTagName:
			marLunchIdx = i
		case strings.Contains(row[3], domain.DailyExpenseTagName):
			marDailyIdx = i
		case row[0] == "2026-03" && row[5] == balanceNoteMarker:
			marBalanceIdx = i
		}
	}
	if marLunchIdx < 0 || marDailyIdx < 0 || marBalanceIdx < 0 {
		t.Fatalf("indexes lunch=%d daily=%d balance=%d", marLunchIdx, marDailyIdx, marBalanceIdx)
	}
	if !(marLunchIdx < marDailyIdx && marDailyIdx < marBalanceIdx) {
		t.Fatalf("march order wrong: lunch=%d daily=%d balance=%d", marLunchIdx, marDailyIdx, marBalanceIdx)
	}
	if febBalanceIdx >= 0 && febBalanceIdx > marBalanceIdx {
		t.Fatalf("february balance should appear before march block: feb=%d marBal=%d", febBalanceIdx, marBalanceIdx)
	}
}

func TestLedgerCSVImportReplaceRoundTrip(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	stats := NewStatsService().WithNow(func() time.Time { return now })
	txSvc := NewTransactionService(stats)
	bal := NewBalanceService(stats)
	svc := newLedgerCSVForTest(now)

	tagID := testutil.InsertTag(t, db, "餐饮")
	contactRes, _ := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	contactID, _ := contactRes.LastInsertId()

	_, err := txSvc.Create(db, CreateTransactionInput{
		Amount: 2850, Type: "expense", TransactionDate: "2026-03-05", Note: "午饭",
		TagIDs: []int64{tagID},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,2,100000)`)
	if _, err := bal.Upsert(db, 2026, 3, 350000, ""); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	if err := svc.Export(db, testLedgerUserID, &buf); err != nil {
		t.Fatal(err)
	}

	result, err := svc.ImportReplace(db, testLedgerUserID, bytes.NewReader(buf.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions != 1 {
		t.Fatalf("imported tx = %d, want 1 (lunch only; daily skipped)", result.ImportedTransactions)
	}
	if result.SkippedDailyExpense != 1 {
		t.Fatalf("skipped daily = %d, want 1", result.SkippedDailyExpense)
	}
	if result.ImportedBalances != 2 {
		t.Fatalf("imported balances = %d, want 2", result.ImportedBalances)
	}

	var lunchCount int
	_ = db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE is_system=0 AND note='午饭'`).Scan(&lunchCount)
	if lunchCount != 1 {
		t.Fatalf("lunch count = %d", lunchCount)
	}

	var balCents int64
	_ = db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=2026 AND month=3`).Scan(&balCents)
	if balCents != 350000 {
		t.Fatalf("balance = %d", balCents)
	}

	var systemDaily int64
	err = db.QueryRow(`
		SELECT t.amount FROM transactions t
		WHERE t.is_system=1 AND t.transaction_date >= '2026-03-01' AND t.transaction_date < '2026-04-01'`,
	).Scan(&systemDaily)
	if err != nil {
		t.Fatalf("system daily: %v", err)
	}
	if systemDaily == 0 {
		t.Fatal("expected recalculated daily expense")
	}

	_ = contactID
}

func TestLedgerCSVImportCreatesTagsAndContacts(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	csvData := strings.Join([]string{
		strings.Join(ledgerCSVHeader, ","),
		"2026-04-01,支出,10.00,新标签,新联系人,测试",
		"2026-04,,100.00,,,月度余额",
	}, "\n")

	result, err := svc.ImportReplace(db, testLedgerUserID, strings.NewReader(csvData))
	if err != nil {
		t.Fatal(err)
	}
	if result.CreatedTags != 1 || result.CreatedContacts != 1 {
		t.Fatalf("created tags=%d contacts=%d", result.CreatedTags, result.CreatedContacts)
	}

	var tagCount, contactCount int
	_ = db.QueryRow(`SELECT COUNT(*) FROM tags WHERE name='新标签'`).Scan(&tagCount)
	_ = db.QueryRow(`SELECT COUNT(*) FROM contacts WHERE name='新联系人'`).Scan(&contactCount)
	if tagCount != 1 || contactCount != 1 {
		t.Fatalf("tag=%d contact=%d", tagCount, contactCount)
	}
}

func TestLedgerCSVImportSkipsTamperedDailyExpense(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	csvData := strings.Join([]string{
		strings.Join(ledgerCSVHeader, ","),
		"2026-05-01,支出,50.00,餐饮,,午饭",
		"2026-05-31,支出,999.00,日常支出,,",
		"2026-05,,200.00,,,月度余额",
		"2026-04,,100.00,,,月度余额",
	}, "\n")

	result, err := svc.ImportReplace(db, testLedgerUserID, strings.NewReader(csvData))
	if err != nil {
		t.Fatal(err)
	}
	if result.SkippedDailyExpense != 1 {
		t.Fatalf("skipped = %d", result.SkippedDailyExpense)
	}

	var dailyAmount int64
	err = db.QueryRow(`
		SELECT t.amount FROM transactions t
		WHERE t.is_system=1 AND t.transaction_date >= '2026-05-01' AND t.transaction_date < '2026-06-01'`,
	).Scan(&dailyAmount)
	if err != nil {
		t.Fatalf("daily: %v", err)
	}
	if dailyAmount == 99900 {
		t.Fatal("tampered daily expense amount was imported")
	}
}

func TestLedgerCSVImportValidationRollback(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100,'expense','2026-01-01','keep')`)

	csvData := strings.Join([]string{
		strings.Join(ledgerCSVHeader, ","),
		"2026-04-01,无效,10.00,餐饮,,",
	}, "\n")

	_, err := svc.ImportReplace(db, testLedgerUserID, strings.NewReader(csvData))
	if err == nil {
		t.Fatal("expected validation error")
	}

	var cnt int
	_ = db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE note='keep'`).Scan(&cnt)
	if cnt != 1 {
		t.Fatalf("rollback failed, count=%d", cnt)
	}
}

func TestLedgerCSVImportWithContact(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	csvData := strings.Join([]string{
		strings.Join(ledgerCSVHeader, ","),
		"2026-04-01,收入,10.00,婚礼,李四,红包",
	}, "\n")

	result, err := svc.ImportReplace(db, testLedgerUserID, strings.NewReader(csvData))
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions != 1 {
		t.Fatalf("imported = %d", result.ImportedTransactions)
	}
	if result.CreatedContacts != 1 {
		t.Fatalf("created contacts = %d", result.CreatedContacts)
	}

	var cid sql.NullInt64
	_ = db.QueryRow(`SELECT contact_id FROM transactions WHERE note='红包'`).Scan(&cid)
	if !cid.Valid {
		t.Fatal("expected contact linked")
	}
}
