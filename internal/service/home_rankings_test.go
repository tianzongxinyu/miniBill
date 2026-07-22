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

	insert(50000, "expense", "2026-06-10", &food, nil)
	insert(10000, "income", "2026-06-11", &food, nil)
	insert(20000, "expense", "2026-07-01", &traffic, nil)
	insert(30000, "expense", "2026-05-01", nil, &cAlice)
	insert(5000, "income", "2026-05-02", nil, &cAlice)
	insert(10000, "expense", "2026-07-02", nil, &cBob)
	insert(999000, "expense", "2026-01-15", &food, &cAlice)

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
	if r.Tags[0].ID != food {
		t.Fatalf("top tag = %+v, want food", r.Tags[0])
	}
	if len(r.Tags[0].Points) != 6 {
		t.Fatalf("food points len = %d", len(r.Tags[0].Points))
	}
	// June index = 4 (Feb=0 ... Jun=4)
	jun := r.Tags[0].Points[4]
	if jun.Month != 6 || jun.TotalExpense != 50000 || jun.TotalIncome != 10000 {
		t.Fatalf("june food = %+v", jun)
	}
	if len(r.Contacts) < 2 || r.Contacts[0].ID != cAlice {
		t.Fatalf("contacts = %+v", r.Contacts)
	}
	may := r.Contacts[0].Points[3] // Feb=0 → May=3
	if may.Month != 5 || may.TotalExpense != 30000 || may.TotalIncome != 5000 {
		t.Fatalf("may Alice = %+v", may)
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
