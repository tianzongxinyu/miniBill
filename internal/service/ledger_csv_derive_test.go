package service

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/testutil"
)

func TestDeriveBalancesFromOpening(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	h := strings.Join(csvHeaders(i18n.DefaultLocale), ",")
	exp := i18n.T(i18n.DefaultLocale, "csv.flow.expense")
	inc := i18n.T(i18n.DefaultLocale, "csv.flow.income")
	csvData := h + "\n" +
		"2026-03-05," + exp + ",100.00,餐饮,,午饭\n" +
		"2026-04-10," + inc + ",50.00,兼职,,工资\n"

	opening := int64(100000) // 1000.00
	result, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{
		KeepHistory:    false,
		DeriveBalances: true,
		OpeningBalance: &opening,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions != 2 {
		t.Fatalf("tx=%d", result.ImportedTransactions)
	}
	// PrevMonth(Mar)=Feb opening; Mar = 1000-100=900; Apr = 900+50=950
	if result.DerivedBalances != 3 {
		t.Fatalf("derived=%d want 3", result.DerivedBalances)
	}

	assertBalance(t, db, 2026, 2, 100000)
	assertBalance(t, db, 2026, 3, 90000)
	assertBalance(t, db, 2026, 4, 95000)

	var daily sql.NullInt64
	err = db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=3`).Scan(&daily)
	if err != nil {
		t.Fatal(err)
	}
	// Zero residual is stored as NULL (no daily-expense system tx).
	if daily.Valid && daily.Int64 != 0 {
		t.Fatalf("daily_expense Mar = %+v want null or 0", daily)
	}
}

func TestDeriveBalancesFromRunningColumn(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newLedgerCSVForTest(time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC))

	csvData := "日期,收支类型,金额,类别,结余,备注\n" +
		"2026-03-01,支出,50,餐饮,950,a\n" +
		"2026-03-15,支出,30,交通,920,b\n" +
		"2026-04-02,收入,100,兼职,1020,c\n"

	result, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{
		Mapping: CSVImportMapping{
			Date: "日期", Flow: "收支类型", Amount: "金额", Tags: "类别", Note: "备注", Balance: "结余",
		},
		KeepHistory:    false,
		DeriveBalances: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.DerivedBalances != 2 {
		t.Fatalf("derived=%d want 2", result.DerivedBalances)
	}
	assertBalance(t, db, 2026, 3, 92000)  // last of March
	assertBalance(t, db, 2026, 4, 102000) // last of April
}

func TestDeriveBalancesDoesNotOverwriteExisting(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newLedgerCSVForTest(time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC))

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026, 3, 77700)`)

	h := strings.Join(csvHeaders(i18n.DefaultLocale), ",")
	exp := i18n.T(i18n.DefaultLocale, "csv.flow.expense")
	csvData := h + "\n" + "2026-03-05," + exp + ",10.00,餐饮,,x\n"

	opening := int64(100000)
	result, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{
		KeepHistory:    true,
		DeriveBalances: true,
		OpeningBalance: &opening,
	})
	if err != nil {
		t.Fatal(err)
	}
	assertBalance(t, db, 2026, 3, 77700) // not overwritten
	if result.DerivedBalances < 1 {
		t.Fatalf("expected at least Feb opening derived, got %d", result.DerivedBalances)
	}
}

func TestDeriveBalancesRequiresOpeningWithoutRunningCol(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newLedgerCSVForTest(time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC))

	h := strings.Join(csvHeaders(i18n.DefaultLocale), ",")
	exp := i18n.T(i18n.DefaultLocale, "csv.flow.expense")
	csvData := h + "\n" + "2026-03-05," + exp + ",10.00,餐饮,,x\n"

	_, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{
		DeriveBalances: true,
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "opening_balance_required") {
		t.Fatalf("err=%v", err)
	}
}

func TestGuessCSVMappingBalanceColumn(t *testing.T) {
	m := GuessCSVMapping([]string{"日期", "收支类型", "金额", "结余", "备注"})
	if m.Amount != "金额" || m.Balance != "结余" {
		t.Fatalf("mapping=%+v", m)
	}
}

func assertBalance(t *testing.T, db *sql.DB, year, month int, want int64) {
	t.Helper()
	var got int64
	err := db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=? AND month=?`, year, month).Scan(&got)
	if err != nil {
		t.Fatalf("balance %d-%02d: %v", year, month, err)
	}
	if got != want {
		t.Fatalf("balance %d-%02d = %d want %d", year, month, got, want)
	}
}
