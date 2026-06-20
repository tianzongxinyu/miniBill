package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/testutil"
)

func TestListByCursorOrderAndPages(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())
	fixed := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	txSvc.now = func() time.Time { return fixed }

	dates := []string{"2026-06-10", "2026-06-10", "2026-06-08", "2026-06-01", "2026-05-30"}
	for i, d := range dates {
		_, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (?, 'expense', ?, ?)`,
			(i+1)*100, d, fmt.Sprintf("tx-%d", i+1),
		)
		if err != nil {
			t.Fatal(err)
		}
	}

	first, err := txSvc.ListByCursorFiltered(db, ListFilter{Year: 2026, Month: 6}, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Items) != 3 {
		t.Fatalf("first page len = %d, want 3", len(first.Items))
	}
	if !first.HasMore || first.NextCursor == nil {
		t.Fatal("expected has_more on first page")
	}
	if first.Items[0].TransactionDate != "2026-06-10" || first.Items[1].TransactionDate != "2026-06-10" {
		t.Fatalf("unexpected order: %s, %s", first.Items[0].TransactionDate, first.Items[1].TransactionDate)
	}
	if first.Items[0].ID <= first.Items[1].ID {
		t.Fatal("same-day items should sort by id DESC")
	}

	second, err := txSvc.ListByCursorFiltered(db, ListFilter{
		Year: 2026, Month: 6, Cursor: *first.NextCursor,
	}, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) != 1 {
		t.Fatalf("second page len = %d, want 1", len(second.Items))
	}
	if second.HasMore {
		t.Fatal("expected no more items in June")
	}
	if second.Items[0].TransactionDate != "2026-06-01" {
		t.Fatalf("last item date = %s", second.Items[0].TransactionDate)
	}

	seen := map[int64]bool{}
	for _, tx := range first.Items {
		seen[tx.ID] = true
	}
	for _, tx := range second.Items {
		if seen[tx.ID] {
			t.Fatalf("duplicate id %d across pages", tx.ID)
		}
	}
}

func TestListByCursorRequiresYearMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())
	_, err := txSvc.ListByCursorFiltered(db, ListFilter{}, 20)
	if err == nil {
		t.Fatal("expected error without year/month")
	}
}

func TestEnrichContactName(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	res, err := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	if err != nil {
		t.Fatal(err)
	}
	contactID, _ := res.LastInsertId()
	tagID := testutil.InsertTag(t, db, "婚礼")

	res, err = db.Exec(
		`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (10000, 'expense', '2026-06-01', '礼金', ?)`,
		contactID,
	)
	if err != nil {
		t.Fatal(err)
	}
	txID, _ := res.LastInsertId()
	if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tagID); err != nil {
		t.Fatal(err)
	}

	tx, err := txSvc.Get(db, txID)
	if err != nil {
		t.Fatal(err)
	}
	if err := txSvc.Enrich(db, tx); err != nil {
		t.Fatal(err)
	}
	if tx.ContactName != "张三" {
		t.Fatalf("ContactName = %q, want 张三", tx.ContactName)
	}
	if len(tx.Tags) != 1 || tx.Tags[0] != "婚礼" {
		t.Fatalf("Tags = %v, want [婚礼]", tx.Tags)
	}
	if len(tx.TagItems) != 1 || tx.TagItems[0].ColorBg == "" {
		t.Fatalf("TagItems = %+v", tx.TagItems)
	}
}

func TestListByCursorFilteredByNote(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-05-01', '咖啡')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-06-01', '午餐')`)

	page, err := txSvc.ListByCursorFiltered(db, ListFilter{NoteQuery: "咖啡"}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Note != "咖啡" {
		t.Fatalf("items = %+v", page.Items)
	}
}

func TestListByCursorFilteredByTags(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	tagA := testutil.InsertTag(t, db, "标签A")
	tagB := testutil.InsertTag(t, db, "婚礼")

	res, _ := db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-06-01', 'a')`)
	id1, _ := res.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?), (?, ?)`, id1, tagA, id1, tagB)

	res, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-06-02', 'b')`)
	id2, _ := res.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, id2, tagA)

	page, err := txSvc.ListByCursorFiltered(db, ListFilter{TagIDs: []int64{tagA, tagB}}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != id1 {
		t.Fatalf("items = %+v, want only id %d", page.Items, id1)
	}
}

func TestListByCursorFilteredCombined(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	res, _ := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	cid, _ := res.LastInsertId()
	tagID := testutil.InsertTag(t, db, "婚礼")

	res, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (100, 'expense', '2026-06-01', '礼金', ?)`, cid)
	matchID, _ := res.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, matchID, tagID)

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (100, 'expense', '2026-06-02', '礼金', ?)`, cid)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-05-01', '礼金')`)

	page, err := txSvc.ListByCursorFiltered(db, ListFilter{
		NoteQuery: "礼金",
		TagIDs:    []int64{tagID},
		ContactID: &cid,
	}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != matchID {
		t.Fatalf("items = %+v, want id %d", page.Items, matchID)
	}
}

func TestListByCursorFilteredIgnoresMonth(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100, 'expense', '2026-05-01', '搜索')`)

	page, err := txSvc.ListByCursorFiltered(db, ListFilter{Year: 2026, Month: 6, NoteQuery: "搜索"}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].TransactionDate != "2026-05-01" {
		t.Fatalf("items = %+v", page.Items)
	}
}

func TestListByCursorFilteredByType(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (300, 'expense', '2026-06-05', '午饭')`)
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (500, 'income', '2026-06-10', '工资')`)

	expensePage, err := txSvc.ListByCursorFiltered(db, ListFilter{Year: 2026, Month: 6, Type: "expense"}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(expensePage.Items) != 1 || expensePage.Items[0].Type != "expense" {
		t.Fatalf("expense items = %+v", expensePage.Items)
	}

	incomePage, err := txSvc.ListByCursorFiltered(db, ListFilter{Year: 2026, Month: 6, Type: "income"}, 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(incomePage.Items) != 1 || incomePage.Items[0].Type != "income" {
		t.Fatalf("income items = %+v", incomePage.Items)
	}
}

func TestListUsedTagsAndContacts(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	tagID := testutil.InsertTag(t, db, "餐饮")
	res, _ := db.Exec(`INSERT INTO contacts (name) VALUES ('李四')`)
	cid, _ := res.LastInsertId()
	res, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (100, 'expense', '2026-06-01', 'x', ?)`, cid)
	txID, _ := res.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tagID)

	tags, err := txSvc.ListUsedTags(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(tags) != 1 || tags[0].Name != "餐饮" {
		t.Fatalf("tags = %+v", tags)
	}

	contacts, err := txSvc.ListUsedContacts(db)
	if err != nil {
		t.Fatal(err)
	}
	if len(contacts) != 1 || contacts[0].Name != "李四" {
		t.Fatalf("contacts = %+v", contacts)
	}
}

func TestEnrichBatch(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	txSvc := NewTransactionService(NewStatsService())

	tagID := testutil.InsertTag(t, db, "餐饮")
	cRes, _ := db.Exec(`INSERT INTO contacts (name) VALUES ('张三')`)
	cid, _ := cRes.LastInsertId()

	res1, _ := db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (100,'expense','2026-01-01','a',?)`, cid)
	id1, _ := res1.LastInsertId()
	_, _ = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, id1, tagID)

	res2, _ := db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (200,'income','2026-01-02','b')`)
	id2, _ := res2.LastInsertId()

	items := []Transaction{
		{ID: id1, ContactID: &cid},
		{ID: id2},
	}
	if err := txSvc.EnrichBatch(db, items); err != nil {
		t.Fatal(err)
	}
	if len(items[0].Tags) != 1 || items[0].Tags[0] != "餐饮" || items[0].ContactName != "张三" {
		t.Fatalf("tx1 = %+v", items[0])
	}
	if len(items[0].TagItems) != 1 {
		t.Fatalf("tx1 tag_items = %+v", items[0].TagItems)
	}
	if len(items[1].Tags) != 0 {
		t.Fatalf("tx2 = %+v", items[1])
	}
}
