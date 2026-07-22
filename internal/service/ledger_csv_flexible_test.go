package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/testutil"
)

func TestParseFlexibleDateSharkAndCommon(t *testing.T) {
	cases := map[string]string{
		"2019年01月22日":          "2019-01-22",
		"2019年1月2日":            "2019-01-02",
		"2019-01-22":           "2019-01-22",
		"2019/01/22":           "2019-01-22",
		"2019-01-22 15:04:05":  "2019-01-22",
		"2019/01/22 15:04":     "2019-01-22",
		"2019年01月22日 15:30:00": "2019-01-22",
	}
	for in, want := range cases {
		got, err := parseFlexibleDate(in)
		if err != nil {
			t.Fatalf("%q: %v", in, err)
		}
		if got != want {
			t.Fatalf("%q = %q, want %q", in, got, want)
		}
	}
}

func TestGuessCSVMappingSharkHeaders(t *testing.T) {
	headers := []string{"日期", "收支类型", "类别", "账户", "金额", "备注"}
	m := GuessCSVMapping(headers)
	if m.Date != "日期" || m.Flow != "收支类型" || m.Tags != "类别" || m.Amount != "金额" || m.Note != "备注" {
		t.Fatalf("mapping = %+v", m)
	}
	if m.Contact != "" {
		t.Fatalf("account must stay unmapped, got contact=%q", m.Contact)
	}
}

func TestImportSharkCSVFile(t *testing.T) {
	path := filepath.Join("..", "..", "鲨鱼记账明细.csv")
	f, err := os.Open(path)
	if err != nil {
		t.Skip(err)
	}
	defer f.Close()

	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	headers := []string{"日期", "收支类型", "类别", "账户", "金额", "备注"}
	result, err := svc.ImportCSV(db, testLedgerUserID, f, CSVImportOpts{
		Mapping:     GuessCSVMapping(headers),
		KeepHistory: false,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions < 7 {
		t.Fatalf("imported=%d want >= 7", result.ImportedTransactions)
	}

	var date string
	var amount int64
	err = db.QueryRow(`SELECT transaction_date, amount FROM transactions WHERE note='房租' ORDER BY transaction_date LIMIT 1`).Scan(&date, &amount)
	if err != nil {
		t.Fatal(err)
	}
	if date != "2019-01-22" {
		t.Fatalf("date=%s", date)
	}
	if amount != 120000 {
		t.Fatalf("amount=%d want 120000", amount)
	}
}

func TestImportSharkCSVAutoGuessWithoutMapping(t *testing.T) {
	path := filepath.Join("..", "..", "鲨鱼记账明细.csv")
	f, err := os.Open(path)
	if err != nil {
		t.Skip(err)
	}
	defer f.Close()

	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newLedgerCSVForTest(time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC))

	result, err := svc.ImportCSV(db, testLedgerUserID, f, CSVImportOpts{KeepHistory: false})
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions < 7 {
		t.Fatalf("imported=%d", result.ImportedTransactions)
	}
}

func TestImportCSVKeepHistoryDedup(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	now := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)
	svc := newLedgerCSVForTest(now)

	h := strings.Join(csvHeaders(i18n.DefaultLocale), ",")
	row := "2026-03-05," + i18n.T(i18n.DefaultLocale, "csv.flow.expense") + ",28.50,餐饮,,午饭"
	csvData := h + "\n" + row + "\n"

	r1, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{KeepHistory: false})
	if err != nil {
		t.Fatal(err)
	}
	if r1.ImportedTransactions != 1 {
		t.Fatalf("first import=%d", r1.ImportedTransactions)
	}

	r2, err := svc.ImportCSV(db, testLedgerUserID, strings.NewReader(csvData), CSVImportOpts{KeepHistory: true})
	if err != nil {
		t.Fatal(err)
	}
	if r2.ImportedTransactions != 0 || r2.SkippedDuplicates != 1 {
		t.Fatalf("second import=%+v", *r2)
	}

	var n int
	_ = db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE is_system=0`).Scan(&n)
	if n != 1 {
		t.Fatalf("count=%d", n)
	}
}

func TestDecodeCSVTextUTF16LE(t *testing.T) {
	// BOM + "日期\t金额"
	raw := []byte{0xFF, 0xFE, 0xE5, 0x65, 0x1F, 0x67, 0x09, 0x00, 0x91, 0xD1, 0x9D, 0x98}
	text, err := decodeCSVText(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(text, "日期") {
		t.Fatalf("text=%q", text)
	}
	if sniffCSVDelimiter(text) != '\t' {
		t.Fatalf("delimiter=%q", sniffCSVDelimiter(text))
	}
}
