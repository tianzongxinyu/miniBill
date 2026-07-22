package service

import (
	"testing"
	"time"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/testutil"
)

func TestAnnualReportSummaryAndTop(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)
	})

	foodID := testutil.InsertTag(t, db, "餐饮")
	shopID := testutil.InsertTag(t, db, "购物")

	res, _ := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	cid, _ := res.LastInsertId()

	tx := func(amount int64, typ, date string, tagID *int64, contactID *int64) int64 {
		r, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (?,?,?,?,?)`,
			amount, typ, date, "n", contactID,
		)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := r.LastInsertId()
		if tagID != nil {
			if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, id, *tagID); err != nil {
				t.Fatal(err)
			}
		}
		return id
	}

	tx(50000, "income", "2026-01-10", nil, nil)
	tx(30000, "expense", "2026-02-10", &foodID, &cid)
	tx(20000, "expense", "2026-03-10", &shopID, &cid)
	tx(8000, "expense", "2026-04-10", nil, nil)
	tx(90000, "expense", "2026-05-10", &foodID, nil) // top amount

	report, err := stats.AnnualReport(db, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.TotalIncome != 50000 || report.Summary.TotalExpense != 148000 {
		t.Fatalf("summary = %+v", report.Summary)
	}
	if report.Summary.NetIncome != 50000-148000 {
		t.Fatalf("net = %d", report.Summary.NetIncome)
	}
	if len(report.TopTransactions) == 0 || report.TopTransactions[0].Amount != 90000 {
		t.Fatalf("top txs = %+v", report.TopTransactions)
	}
	if len(report.TopContacts) != 1 || report.TopContacts[0].ContactName != "张三" {
		t.Fatalf("top contacts = %+v", report.TopContacts)
	}
	if report.TopContacts[0].NetIncome != 0-50000 {
		t.Fatalf("contact net = %d", report.TopContacts[0].NetIncome)
	}
	if report.Compare != nil {
		t.Fatal("expected no compare without prior year")
	}

	var foundFood bool
	for _, tag := range report.ByTag {
		if tag.TagName == "餐饮" && tag.TotalExpense == 120000 {
			foundFood = true
		}
	}
	if !foundFood {
		t.Fatalf("by_tag = %+v", report.ByTag)
	}
}

func TestAnnualReportCompareAndExcludeSystem(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)
	})

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (100000,'income','2025-06-01')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (40000,'expense','2025-07-01')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (120000,'income','2026-06-01')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'expense','2026-07-01')`)

	var dailyTagID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE preset_key=?`, domain.DailyExpensePresetKey).Scan(&dailyTagID); err != nil {
		t.Fatal(err)
	}
	res, err := db.Exec(
		`INSERT INTO transactions (amount, type, transaction_date, is_system) VALUES (99999,'expense','2026-08-01',1)`,
	)
	if err != nil {
		t.Fatal(err)
	}
	sysID, _ := res.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, sysID, dailyTagID)

	report, err := stats.AnnualReport(db, 2026)
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.TotalExpense != 50000 {
		t.Fatalf("expense should exclude system tx, got %d", report.Summary.TotalExpense)
	}
	if report.Compare == nil || report.Compare.PrevYear != 2025 {
		t.Fatalf("compare = %+v", report.Compare)
	}
	if report.Compare.DeltaIncome != 20000 {
		t.Fatalf("delta income = %d", report.Compare.DeltaIncome)
	}
	if len(report.Insights) == 0 {
		t.Fatal("expected insights")
	}
}

func TestAnnualReportInvalidYear(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()
	if _, err := stats.AnnualReport(db, 1999); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestDefaultAnnualReportYear(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 8, 15, 0, 0, 0, 0, time.UTC)
	})

	y, err := stats.DefaultAnnualReportYear(db)
	if err != nil {
		t.Fatal(err)
	}
	if y != 2025 {
		t.Fatalf("expected previous year, got %d", y)
	}

	for m := 1; m <= 11; m++ {
		_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026, ?, ?)`, m, int64(m*1000))
	}
	y, err = stats.DefaultAnnualReportYear(db)
	if err != nil {
		t.Fatal(err)
	}
	if y != 2025 {
		t.Fatalf("expected previous year with 11 months, got %d", y)
	}

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026, 12, 12000)`)
	y, err = stats.DefaultAnnualReportYear(db)
	if err != nil {
		t.Fatal(err)
	}
	if y != 2026 {
		t.Fatalf("expected current year with 12 months, got %d", y)
	}
}
