package service

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/testutil"
)

func TestLedgerCSVImportGeneratedLedgerFile(t *testing.T) {
	root := filepath.Join("..", "..")
	csvPath := filepath.Join(root, "ledger-import.csv")
	f, err := os.Open(csvPath)
	if err != nil {
		t.Skipf("ledger-import.csv not generated yet: %v", err)
	}
	defer f.Close()

	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	result, err := svc.ImportReplace(db, testLedgerUserID, f)
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions == 0 {
		t.Fatal("expected imported transactions")
	}
	if result.ImportedBalances == 0 {
		t.Fatal("expected imported balances")
	}
	t.Logf("imported tx=%d balances=%d skipped_daily=%d created_tags=%d created_contacts=%d",
		result.ImportedTransactions,
		result.ImportedBalances,
		result.SkippedDailyExpense,
		result.CreatedTags,
		result.CreatedContacts,
	)
}
