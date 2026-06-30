package service

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/testutil"
)

func TestDailyExpenseFormula(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()

	// prev month balance 100000, curr 80000, income 50000, expense 30000
	// daily = 100000 + 50000 - 30000 - 80000 = 40000
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,80000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-06-10')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (30000,'expense','2026-06-11')`)

	if err := stats.RecalcStatMonth(db, 2026, 6); err != nil {
		t.Fatal(err)
	}
	var daily sql.NullInt64
	if err := db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&daily); err != nil {
		t.Fatal(err)
	}
	if !daily.Valid || daily.Int64 != 40000 {
		t.Fatalf("daily_expense = %v, want 40000", daily)
	}
}

func TestDailyExpenseNullWithoutPrev(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,80000)`)
	if err := stats.RecalcStatMonth(db, 2026, 6); err != nil {
		t.Fatal(err)
	}
	var daily sql.NullInt64
	_ = db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&daily)
	if daily.Valid {
		t.Fatal("expected null daily_expense")
	}
}

func TestBalanceChangeRecalcNextMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()
	bal := NewBalanceService(stats)
	bal.now = func() time.Time {
		loc, _ := time.LoadLocation("Asia/Shanghai")
		return time.Date(2026, 7, 15, 0, 0, 0, 0, loc)
	}

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,90000)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,7,85000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-07-05')`)

	if _, err := bal.Upsert(db, 2026, 6, 85000, ""); err != nil {
		t.Fatal(err)
	}
	var julyDaily sql.NullInt64
	_ = db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=7`).Scan(&julyDaily)
	if !julyDaily.Valid {
		t.Fatal("july daily should be calculated after june balance update")
	}
}

func TestMonthBillDailyExpense(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,80000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-06-10')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (30000,'expense','2026-06-11')`)

	june, err := stats.MonthBill(db, 2026, 6)
	if err != nil {
		t.Fatal(err)
	}
	if june.DailyExpense == nil || *june.DailyExpense != 40000 {
		t.Fatalf("june daily_expense = %v, want 40000", june.DailyExpense)
	}

	may, err := stats.MonthBill(db, 2026, 5)
	if err != nil {
		t.Fatal(err)
	}
	if may.DailyExpense != nil {
		t.Fatalf("may daily_expense = %v, want nil without prev month balance", may.DailyExpense)
	}

	july, err := stats.MonthBill(db, 2026, 7)
	if err != nil {
		t.Fatal(err)
	}
	if !july.IsCurrent {
		t.Fatal("expected july to be current month")
	}
	if july.Balance != nil || july.DailyExpense != nil {
		t.Fatalf("current month without balance: balance=%v daily=%v", july.Balance, july.DailyExpense)
	}

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,7,85000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-07-05')`)
	if err := stats.RecalcStatMonth(db, 2026, 7); err != nil {
		t.Fatal(err)
	}
	july, err = stats.MonthBill(db, 2026, 7)
	if err != nil {
		t.Fatal(err)
	}
	if july.Balance == nil || *july.Balance != 85000 {
		t.Fatalf("july balance = %v, want 85000", july.Balance)
	}
	if july.DailyExpense == nil || *july.DailyExpense != 5000 {
		t.Fatalf("july daily_expense = %v, want 5000", july.DailyExpense)
	}
	wantNet := int64(5000) // 85000 - 80000
	if july.NetIncome == nil || *july.NetIncome != wantNet {
		t.Fatalf("july net_income = %v, want %d", july.NetIncome, wantNet)
	}
}

func TestMonthBillsFirstPage(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	for _, m := range []int{1, 2, 3, 4, 5, 6} {
		_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026, ?, ?)`, m, int64(m*100000))
		_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income',?)`, fmt.Sprintf("2026-%02d-10", m))
		_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (20000,'expense',?)`, fmt.Sprintf("2026-%02d-12", m))
	}

	page, err := stats.MonthBills(db, nil, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 5 {
		t.Fatalf("items = %d, want 5", len(page.Items))
	}
	if !page.Items[0].IsCurrent {
		t.Fatal("first item should be current month")
	}
	if page.Items[0].Balance == nil || *page.Items[0].Balance != 600000 {
		t.Fatalf("current month balance = %v, want 600000", page.Items[0].Balance)
	}
	if page.Items[0].NetIncome == nil {
		t.Fatal("current month should include net_income")
	}
	if *page.Items[0].NetIncome != 100000 {
		t.Fatalf("current month net_income = %d, want 100000", *page.Items[0].NetIncome)
	}
	if page.Items[1].NetIncome == nil {
		t.Fatal("past month should include net_income")
	}
	if !page.HasMore || page.NextCursor == nil {
		t.Fatal("expected has_more with next_cursor")
	}
}

func TestNetIncomeFromRegisteredBalances(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	// 流水扎差 +5170.59，但余额减少 5170.59 → 净收入应为负
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,4,61835440)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,61318381)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (649312,'income','2026-05-10')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (132253,'expense','2026-05-12')`)

	may, err := stats.MonthBill(db, 2026, 5)
	if err != nil {
		t.Fatal(err)
	}
	if may.NetIncome == nil {
		t.Fatal("expected net_income")
	}
	txNet := may.TotalIncome - may.TotalExpense
	if txNet != 517059 {
		t.Fatalf("transaction net = %d, want 517059", txNet)
	}
	if *may.NetIncome != -517059 {
		t.Fatalf("net_income = %d, want -517059 (balance change)", *may.NetIncome)
	}
}

func TestNegativeNetIncome(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-05-01')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'expense','2026-05-15')`)

	may, err := stats.MonthBill(db, 2026, 5)
	if err != nil {
		t.Fatal(err)
	}
	if may.NetIncome == nil {
		t.Fatal("expected net_income")
	}
	if *may.NetIncome != -40000 {
		t.Fatalf("net_income = %d, want -40000", *may.NetIncome)
	}
}

func TestMonthBillsCursorPage(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	for m := 1; m <= 6; m++ {
		_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income',?)`, fmt.Sprintf("2026-%02d-01", m))
	}

	first, err := stats.MonthBills(db, nil, 5)
	if err != nil {
		t.Fatal(err)
	}
	if first.NextCursor == nil {
		t.Fatal("need cursor")
	}
	parts := strings.Split(*first.NextCursor, "-")
	y, _ := strconv.Atoi(parts[0])
	mo, _ := strconv.Atoi(parts[1])
	cursor := domain.YearMonth{Year: y, Month: mo}

	second, err := stats.MonthBills(db, &cursor, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) == 0 {
		t.Fatal("expected more items")
	}
	if second.Items[0].Month != 1 || second.Items[0].Year != 2026 {
		t.Fatalf("cursor page should start at 2026-01, got %d-%d", second.Items[0].Year, second.Items[0].Month)
	}
}

func TestMonthBillsHasMoreBoundary(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC)
	})
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-01-05')`)

	page, err := stats.MonthBills(db, nil, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 3 {
		t.Fatalf("items = %d, want 3 (Mar..Jan)", len(page.Items))
	}
	if page.HasMore {
		t.Fatal("should not have more before earliest month")
	}
}

func TestMonthlyStatsTagFilter(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()

	var foodID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE name='餐饮'`).Scan(&foodID); err != nil {
		foodID = testutil.InsertTag(t, db, "餐饮")
	}

	res, err := db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (5000,'expense','2026-06-10')`)
	if err != nil {
		t.Fatal(err)
	}
	txID, _ := res.LastInsertId()
	if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, txID, foodID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (8000,'expense','2026-06-12')`); err != nil {
		t.Fatal(err)
	}

	items, err := stats.MonthlyStats(db, 2026, StatsFilter{TagIDs: []int64{foodID}})
	if err != nil {
		t.Fatal(err)
	}
	if items[5].TotalExpense != 5000 {
		t.Fatalf("june filtered expense = %d, want 5000", items[5].TotalExpense)
	}
	if items[5].RegisteredBalance != nil || items[5].DailyExpense != nil {
		t.Fatal("filtered stats should not include balance or daily expense")
	}
}

func TestMonthSeriesInitial(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	for m := 1; m <= 6; m++ {
		_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income',?)`, fmt.Sprintf("2026-%02d-05", m))
	}
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2025-06-01')`)

	page, err := stats.MonthSeries(db, nil, nil, 12, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 12 {
		t.Fatalf("items = %d, want 12", len(page.Items))
	}
	if page.Items[0].Year != 2025 || page.Items[0].Month != 7 {
		t.Fatalf("oldest = %d-%d, want 2025-7", page.Items[0].Year, page.Items[0].Month)
	}
	if page.Items[11].Year != 2026 || page.Items[11].Month != 6 {
		t.Fatalf("newest = %d-%d, want 2026-6", page.Items[11].Year, page.Items[11].Month)
	}
	if page.HasMoreNewer {
		t.Fatal("should not have more newer at current month")
	}
}

func TestMonthSeriesCursorAndAfter(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	cursor := domain.YearMonth{Year: 2025, Month: 7}
	older, err := stats.MonthSeries(db, &cursor, nil, 3, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(older.Items) != 3 || older.Items[2].Year != 2025 || older.Items[2].Month != 6 {
		t.Fatalf("older page = %+v", older.Items)
	}

	after := domain.YearMonth{Year: 2025, Month: 10}
	newer, err := stats.MonthSeries(db, nil, &after, 2, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(newer.Items) != 2 || newer.Items[0].Year != 2025 || newer.Items[0].Month != 11 {
		t.Fatalf("newer page start = %+v", newer.Items)
	}
	if !newer.HasMoreNewer {
		t.Fatal("expected has_more_newer before current month")
	}
}

func TestYearSeriesInitial(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2024-03-01')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2016-01-01')`)

	page, err := stats.YearSeries(db, nil, nil, 10, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 10 {
		t.Fatalf("items = %d, want 10", len(page.Items))
	}
	if page.Items[0].Year != 2017 || page.Items[9].Year != 2026 {
		t.Fatalf("years = %d..%d, want 2017..2026", page.Items[0].Year, page.Items[9].Year)
	}
	if page.HasMoreNewer {
		t.Fatal("should not have more newer at current year")
	}
}

func TestStatForMonthCurrentLive(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	page, err := stats.MonthSeries(db, nil, nil, 1, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].TotalIncome != 0 {
		t.Fatalf("initial = %+v", page.Items)
	}

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-06-10')`)

	page, err = stats.MonthSeries(db, nil, nil, 1, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if page.Items[0].TotalIncome != 50000 {
		t.Fatalf("live income = %d, want 50000", page.Items[0].TotalIncome)
	}

	var cached int64
	err = db.QueryRow(`SELECT total_income FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&cached)
	if err != sql.ErrNoRows {
		if err == nil && cached == 50000 {
			t.Fatal("current month should not be persisted to stat_monthly")
		}
		if err != nil && err != sql.ErrNoRows {
			t.Fatal(err)
		}
	}
}

func TestMonthSeriesNoteFilter(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (5000,'expense','2026-06-05','咖啡')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (8000,'expense','2026-06-12','午餐')`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,100000)`)

	page, err := stats.MonthSeries(db, nil, nil, 1, StatsFilter{NoteQuery: "咖啡"})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(page.Items))
	}
	if page.Items[0].TotalExpense != 5000 {
		t.Fatalf("filtered expense = %d, want 5000", page.Items[0].TotalExpense)
	}
	if page.Items[0].RegisteredBalance != nil || page.Items[0].DailyExpense != nil {
		t.Fatal("note-filtered stats should not include balance or daily expense")
	}
}

func TestMonthSeriesContactFilter(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	res, err := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	if err != nil {
		t.Fatal(err)
	}
	cid, _ := res.LastInsertId()

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, contact_id) VALUES (5000,'expense','2026-06-05',?)`, cid)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (8000,'expense','2026-06-12')`)

	page, err := stats.MonthSeries(db, nil, nil, 1, StatsFilter{ContactID: &cid})
	if err != nil {
		t.Fatal(err)
	}
	if page.Items[0].TotalExpense != 5000 {
		t.Fatalf("filtered expense = %d, want 5000", page.Items[0].TotalExpense)
	}
	if page.Items[0].RegisteredBalance != nil {
		t.Fatal("contact-filtered stats should not include balance")
	}
}

func TestYearStatCurrentLive(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	page, err := stats.YearSeries(db, nil, nil, 1, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if page.Items[0].TotalIncome != 0 {
		t.Fatalf("initial income = %d", page.Items[0].TotalIncome)
	}

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (80000,'income','2026-03-01')`)

	page, err = stats.YearSeries(db, nil, nil, 1, StatsFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if page.Items[0].TotalIncome != 80000 {
		t.Fatalf("live year income = %d, want 80000", page.Items[0].TotalIncome)
	}
}

func TestRecalcAfterTransactionIncludesCurrentMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-06-01')`)
	if err := stats.RecalcAfterTransaction(db, "2026-06-01"); err != nil {
		t.Fatal(err)
	}
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("RecalcAfterTransaction should write current month to stat_monthly")
	}

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-05-01')`)
	if err := stats.RecalcAfterTransaction(db, "2026-05-01"); err != nil {
		t.Fatal(err)
	}
	err = db.QueryRow(`SELECT COUNT(*) FROM stat_monthly WHERE year=2026 AND month=5`).Scan(&n)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatal("historical month should still be written to stat_monthly")
	}
}

func TestStatsReadUsesCachedStatMonthly(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-05-10')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (30000,'expense','2026-05-11')`)
	if err := stats.RecalcStatMonth(db, 2026, 5); err != nil {
		t.Fatal(err)
	}

	may, err := stats.MonthBill(db, 2026, 5)
	if err != nil {
		t.Fatal(err)
	}
	if may.TotalIncome != 50000 || may.TotalExpense != 30000 {
		t.Fatalf("may = %+v", may)
	}

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (99999,'income','2026-05-12')`)
	may2, err := stats.MonthBill(db, 2026, 5)
	if err != nil {
		t.Fatal(err)
	}
	if may2.TotalIncome != 50000 {
		t.Fatalf("read should use stat_monthly without rewrite, got income=%d", may2.TotalIncome)
	}
}
