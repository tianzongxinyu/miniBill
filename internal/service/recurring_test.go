package service

import (
	"testing"
	"time"

	"github.com/minibill/minibill/internal/testutil"
)

func newRecurringTestSvc(fixed time.Time) (*RecurringService, *TransactionService) {
	txSvc := NewTransactionService(NewStatsService())
	txSvc.now = func() time.Time { return fixed }
	rec := NewRecurringService(txSvc)
	rec.now = func() time.Time { return fixed }
	return rec, txSvc
}

func TestProcessDueCreatesOncePerMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	fixed := time.Date(2026, 8, 15, 12, 0, 0, 0, time.Local)
	rec, _ := newRecurringTestSvc(fixed)

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     9900,
		Type:       "expense",
		DayOfMonth: 10,
		Note:       "rent",
		Enabled:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	// Backdate created_at so catch-up starts in August.
	_, _ = db.Exec(`UPDATE recurring_rules SET created_at='2026-08-01 00:00:00' WHERE id=?`, rule.ID)

	n, err := rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("created = %d, want 1", n)
	}
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE note='rent'`).Scan(&count)
	if count != 1 {
		t.Fatalf("tx count = %d, want 1", count)
	}
	var date string
	_ = db.QueryRow(`SELECT transaction_date FROM transactions WHERE note='rent'`).Scan(&date)
	if date != "2026-08-10" {
		t.Fatalf("date = %s, want 2026-08-10", date)
	}

	n, err = rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("second tick created = %d, want 0", n)
	}
}

func TestProcessDueCatchupMultipleMonths(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	fixed := time.Date(2026, 8, 20, 12, 0, 0, 0, time.Local)
	rec, _ := newRecurringTestSvc(fixed)

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     5000,
		Type:       "income",
		DayOfMonth: 5,
		Note:       "salary",
		Enabled:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`UPDATE recurring_rules SET created_at='2026-06-01 00:00:00', last_run_year_month=NULL WHERE id=?`, rule.ID)

	n, err := rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Fatalf("created = %d, want 3 (Jun–Aug)", n)
	}
	var count int
	_ = db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE note='salary'`).Scan(&count)
	if count != 3 {
		t.Fatalf("tx count = %d, want 3", count)
	}
}

func TestProcessDueDisabledSkipped(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	fixed := time.Date(2026, 8, 15, 12, 0, 0, 0, time.Local)
	rec, _ := newRecurringTestSvc(fixed)

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     1000,
		Type:       "expense",
		DayOfMonth: 1,
		Note:       "off",
		Enabled:    false,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`UPDATE recurring_rules SET created_at='2026-08-01 00:00:00' WHERE id=?`, rule.ID)

	n, err := rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("created = %d, want 0", n)
	}
}

func TestProcessDueNotYetThisMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	fixed := time.Date(2026, 8, 5, 12, 0, 0, 0, time.Local)
	rec, _ := newRecurringTestSvc(fixed)

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     1000,
		Type:       "expense",
		DayOfMonth: 20,
		Note:       "later",
		Enabled:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`UPDATE recurring_rules SET created_at='2026-08-01 00:00:00' WHERE id=?`, rule.ID)

	n, err := rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("created = %d, want 0", n)
	}
}

func TestProcessDueDay28(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	fixed := time.Date(2026, 2, 28, 12, 0, 0, 0, time.Local)
	rec, _ := newRecurringTestSvc(fixed)

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     2800,
		Type:       "expense",
		DayOfMonth: 28,
		Note:       "endish",
		Enabled:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	_, _ = db.Exec(`UPDATE recurring_rules SET created_at='2026-02-01 00:00:00' WHERE id=?`, rule.ID)

	n, err := rec.ProcessDue(db)
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("created = %d, want 1", n)
	}
	var date string
	_ = db.QueryRow(`SELECT transaction_date FROM transactions WHERE note='endish'`).Scan(&date)
	if date != "2026-02-28" {
		t.Fatalf("date = %s, want 2026-02-28", date)
	}
}

func TestRecurringCreateRejectsDailyExpenseTag(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	rec, _ := newRecurringTestSvc(time.Date(2026, 8, 15, 12, 0, 0, 0, time.Local))

	var sysID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE is_system = 1 LIMIT 1`).Scan(&sysID); err != nil {
		t.Fatal(err)
	}
	_, err := rec.Create(db, RecurringRuleInput{
		Amount:     100,
		Type:       "expense",
		DayOfMonth: 1,
		TagIDs:     []int64{sysID},
		Enabled:    true,
	})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestRecurringCRUD(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	rec, _ := newRecurringTestSvc(time.Date(2026, 8, 15, 12, 0, 0, 0, time.Local))
	tagID := testutil.InsertTag(t, db, "订阅")

	rule, err := rec.Create(db, RecurringRuleInput{
		Amount:     1500,
		Type:       "expense",
		DayOfMonth: 8,
		Note:       "netflix",
		TagIDs:     []int64{tagID},
		Enabled:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if rule.Amount != 1500 || rule.Note != "netflix" {
		t.Fatalf("unexpected create: %+v", rule)
	}
	if len(rule.TagIDs) != 1 || rule.TagIDs[0] != tagID {
		t.Fatalf("tags = %v", rule.TagIDs)
	}

	updated, err := rec.Update(db, rule.ID, RecurringRuleInput{
		Amount:     1600,
		Type:       "expense",
		DayOfMonth: 9,
		Note:       "netflix+",
		TagIDs:     []int64{tagID},
		Enabled:    false,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Amount != 1600 || updated.DayOfMonth != 9 || updated.Enabled || updated.Note != "netflix+" {
		t.Fatalf("unexpected update: %+v", updated)
	}

	list, err := rec.List(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Fatalf("list len = %d", len(list))
	}

	if err := rec.Delete(db, rule.ID); err != nil {
		t.Fatal(err)
	}
	list, err = rec.List(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("after delete len = %d", len(list))
	}
}
