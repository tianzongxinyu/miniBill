package service

import (
	"testing"
	"time"

	"github.com/minibill/minibill/internal/testutil"
)

func TestHomeRankingsTopTagsAndContacts(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 12, 0, 0, 0, time.Local)
	})

	food := testutil.InsertTag(t, db, "餐饮")
	traffic := testutil.InsertTag(t, db, "交通")

	res, err := db.Exec(`INSERT INTO contacts (name) VALUES ('Alice')`)
	if err != nil {
		t.Fatal(err)
	}
	cAlice, _ := res.LastInsertId()
	res, err = db.Exec(`INSERT INTO contacts (name) VALUES ('Bob')`)
	if err != nil {
		t.Fatal(err)
	}
	cBob, _ := res.LastInsertId()

	insert := func(amount int64, typ, date string, tagID *int64, contactID *int64) {
		t.Helper()
		var cid interface{}
		if contactID != nil {
			cid = *contactID
		}
		r, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (?,?,?,?,?)`,
			amount, typ, date, "", cid,
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
	}

	// food used twice in window (Jan is outside 6mo window ending Jul → Feb–Jul)
	insert(50000, "expense", "2026-06-10", &food, nil)
	insert(10000, "income", "2026-06-11", &food, nil)
	insert(20000, "expense", "2026-07-01", &traffic, nil)
	insert(30000, "expense", "2026-05-01", nil, &cAlice)
	insert(5000, "income", "2026-05-02", nil, &cAlice)
	insert(10000, "expense", "2026-07-02", nil, &cBob)
	insert(999000, "expense", "2026-01-15", &food, &cAlice) // outside window

	r, err := stats.HomeRankings(db, 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Months) != 6 {
		t.Fatalf("months = %d, want 6", len(r.Months))
	}
	if r.Months[0].Year != 2026 || r.Months[0].Month != 2 {
		t.Fatalf("first month = %+v, want 2026-02", r.Months[0])
	}
	if r.Months[5].Month != 7 {
		t.Fatalf("last month = %+v, want July", r.Months[5])
	}
	if len(r.Tags) < 2 {
		t.Fatalf("tags = %+v, want at least 2", r.Tags)
	}
	if r.Tags[0].ID != food || r.Tags[0].UseCount != 2 {
		t.Fatalf("top tag = %+v, want food use_count=2", r.Tags[0])
	}
	if r.Tags[0].TotalIncome != 10000 || r.Tags[0].TotalExpense != 50000 {
		t.Fatalf("food totals = %+v, want income=10000 expense=50000", r.Tags[0])
	}
	if r.Tags[1].ID != traffic || r.Tags[1].UseCount != 1 {
		t.Fatalf("second tag = %+v, want traffic use_count=1", r.Tags[1])
	}
	if r.Tags[1].TotalExpense != 20000 || r.Tags[1].TotalIncome != 0 {
		t.Fatalf("traffic totals = %+v, want expense=20000", r.Tags[1])
	}
	if len(r.Contacts) < 2 || r.Contacts[0].ID != cAlice || r.Contacts[0].UseCount != 2 {
		t.Fatalf("contacts = %+v, want Alice use_count=2 first", r.Contacts)
	}
	if r.Contacts[1].ID != cBob || r.Contacts[1].UseCount != 1 {
		t.Fatalf("second contact = %+v, want Bob use_count=1", r.Contacts[1])
	}
	may := r.Contacts[0].Points[3] // Feb=0 → May=3
	if may.Month != 5 || may.TotalExpense != 30000 || may.TotalIncome != 5000 {
		t.Fatalf("may Alice = %+v", may)
	}
}

func TestHomeRankingsContactUseCountOrder(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 12, 0, 0, 0, time.Local)
	})

	insertContact := func(name string) int64 {
		t.Helper()
		res, err := db.Exec(`INSERT INTO contacts (name) VALUES (?)`, name)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := res.LastInsertId()
		return id
	}
	insertTx := func(amount int64, date string, contactID int64) {
		t.Helper()
		_, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (?,'expense',?,?,?)`,
			amount, date, "", contactID,
		)
		if err != nil {
			t.Fatal(err)
		}
	}

	rich := insertContact("Rich")   // 1 huge tx
	busy := insertContact("Busy")   // 4 small txs
	quiet := insertContact("Quiet") // 2 medium txs

	insertTx(1_000_000, "2026-06-01", rich)
	for i := 0; i < 4; i++ {
		insertTx(100, "2026-06-02", busy)
	}
	insertTx(50_000, "2026-06-03", quiet)
	insertTx(50_000, "2026-06-04", quiet)

	r, err := stats.HomeRankings(db, 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Contacts) != 3 {
		t.Fatalf("contacts = %+v", r.Contacts)
	}
	if r.Contacts[0].ID != busy || r.Contacts[0].UseCount != 4 {
		t.Fatalf("want Busy first: %+v", r.Contacts[0])
	}
	if r.Contacts[1].ID != quiet || r.Contacts[1].UseCount != 2 {
		t.Fatalf("want Quiet second: %+v", r.Contacts[1])
	}
	if r.Contacts[2].ID != rich || r.Contacts[2].UseCount != 1 {
		t.Fatalf("want Rich third: %+v", r.Contacts[2])
	}
}

func TestHomeRankingsTagUseCountOrder(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 15, 12, 0, 0, 0, time.Local)
	})

	a := testutil.InsertTag(t, db, "A标签")
	b := testutil.InsertTag(t, db, "B标签")
	c := testutil.InsertTag(t, db, "C标签")

	insertTagged := func(date string, tagID int64) {
		t.Helper()
		r, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (1,'expense',?,?)`,
			date, "",
		)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := r.LastInsertId()
		if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, id, tagID); err != nil {
			t.Fatal(err)
		}
	}

	for i := 0; i < 3; i++ {
		insertTagged("2026-06-01", b)
	}
	for i := 0; i < 5; i++ {
		insertTagged("2026-06-02", c)
	}
	insertTagged("2026-06-03", a)

	r, err := stats.HomeRankings(db, 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Tags) != 3 {
		t.Fatalf("tags = %+v", r.Tags)
	}
	if r.Tags[0].ID != c || r.Tags[0].UseCount != 5 {
		t.Fatalf("want C first: %+v", r.Tags[0])
	}
	if r.Tags[1].ID != b || r.Tags[1].UseCount != 3 {
		t.Fatalf("want B second: %+v", r.Tags[1])
	}
	if r.Tags[2].ID != a || r.Tags[2].UseCount != 1 {
		t.Fatalf("want A third: %+v", r.Tags[2])
	}
}

func TestHomeRankingsEmpty(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	stats := NewStatsService().WithNow(func() time.Time {
		return time.Date(2026, 7, 1, 0, 0, 0, 0, time.Local)
	})
	r, err := stats.HomeRankings(db, 6)
	if err != nil {
		t.Fatal(err)
	}
	if r.Months == nil || len(r.Months) != 6 {
		t.Fatalf("months = %+v", r.Months)
	}
	if r.Tags == nil || r.Contacts == nil {
		t.Fatalf("nil slices: %+v", r)
	}
	if len(r.Tags) != 0 || len(r.Contacts) != 0 {
		t.Fatalf("want empty, got %+v", r)
	}
}
