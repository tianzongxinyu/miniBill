package service

import (
	"database/sql"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/testutil"
)

func TestDailyExpenseSystemTxOnBalanceUpsert(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	})
	bal := NewBalanceService(stats)

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-06-10')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (30000,'expense','2026-06-11')`)

	if _, err := bal.Upsert(db, 2026, 6, 80000, ""); err != nil {
		t.Fatal(err)
	}

	var txID int64
	var isSystem int
	err := db.QueryRow(`
		SELECT t.id, t.is_system FROM transactions t
		WHERE t.is_system = 1 AND t.transaction_date >= '2026-06-01' AND t.transaction_date < '2026-07-01'`,
	).Scan(&txID, &isSystem)
	if err != nil {
		t.Fatalf("system tx: %v", err)
	}
	if isSystem != 1 {
		t.Fatal("expected is_system=1")
	}

	var tagName string
	err = db.QueryRow(`
		SELECT g.name FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		WHERE tt.transaction_id = ?`, txID,
	).Scan(&tagName)
	if err != nil || tagName != domain.DailyExpenseTagName {
		t.Fatalf("tag = %q, err = %v", tagName, err)
	}

	var daily sql.NullInt64
	_ = db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&daily)
	if !daily.Valid || daily.Int64 != 40000 {
		t.Fatalf("daily_expense = %v, want 40000", daily)
	}
}

func TestTransactionUpdateRecalcsDailyWithoutChangingBalance(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService()
	txSvc := NewTransactionService(stats)

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,80000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (50000,'income','2026-06-10')`)
	res, _ := db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (30000,'expense','2026-06-11')`)
	expID, _ := res.LastInsertId()
	_ = stats.RecalcStatMonth(db, 2026, 6)

	var balBefore int64
	_ = db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=2026 AND month=6`).Scan(&balBefore)

	_, err := txSvc.Update(db, expID, CreateTransactionInput{
		Amount: 35000, Type: "expense", TransactionDate: "2026-06-11", Note: "",
	})
	if err != nil {
		t.Fatal(err)
	}

	var balAfter int64
	_ = db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=2026 AND month=6`).Scan(&balAfter)
	if balBefore != balAfter {
		t.Fatalf("balance changed: %d -> %d", balBefore, balAfter)
	}

	var daily sql.NullInt64
	_ = db.QueryRow(`SELECT daily_expense FROM stat_monthly WHERE year=2026 AND month=6`).Scan(&daily)
	if !daily.Valid || daily.Int64 != 35000 {
		t.Fatalf("daily_expense = %v, want 35000", daily)
	}
}

func TestRejectManualDailyExpenseTag(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())
	var tagID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE preset_key = ?`, domain.DailyExpensePresetKey).Scan(&tagID); err != nil {
		t.Fatal(err)
	}
	_, err := txSvc.Create(db, CreateTransactionInput{
		Amount: 1000, Type: "expense", TransactionDate: "2026-06-01",
		TagIDs: []int64{tagID},
	})
	if err == nil {
		t.Fatal("expected error for manual daily expense tag")
	}
}

func TestSystemTransactionCannotBeDeleted(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	})
	bal := NewBalanceService(stats)
	txSvc := NewTransactionService(stats)

	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,5,100000)`)
	if _, err := bal.Upsert(db, 2026, 6, 80000, ""); err != nil {
		t.Fatal(err)
	}
	var txID int64
	if err := db.QueryRow(`SELECT id FROM transactions WHERE is_system=1`).Scan(&txID); err != nil {
		t.Fatal(err)
	}
	if err := txSvc.Delete(db, txID); err != ErrSystemTransaction {
		t.Fatalf("Delete err = %v, want ErrSystemTransaction", err)
	}
}

func TestRecalcAfterTransactionDoesNotModifyMonthlyBalances(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	})
	_, _ = db.Exec(`INSERT INTO monthly_balances (year, month, balance) VALUES (2026,6,80000)`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date) VALUES (10000,'income','2026-06-01')`)

	var before int64
	_ = db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=2026 AND month=6`).Scan(&before)
	if err := stats.RecalcAfterTransaction(db, "2026-06-01"); err != nil {
		t.Fatal(err)
	}
	var after int64
	_ = db.QueryRow(`SELECT balance FROM monthly_balances WHERE year=2026 AND month=6`).Scan(&after)
	if before != after {
		t.Fatalf("balance changed: %d -> %d", before, after)
	}
}
