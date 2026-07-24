package service

import (
	"testing"

	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/testutil"
)

func TestTagUpdateColors(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := &TagService{}
	created, err := svc.Create(db, "测试色")
	if err != nil {
		t.Fatal(err)
	}
	if created.ColorFg != domain.TagTextColor {
		t.Fatalf("create fg = %s", created.ColorFg)
	}

	bg := "#FCE8EC"
	updated, err := svc.Update(db, created.ID, TagUpdateInput{ColorBg: &bg})
	if err != nil {
		t.Fatal(err)
	}
	if updated.ColorBg != bg || updated.ColorFg != domain.TagTextColor {
		t.Fatalf("colors = %s / %s", updated.ColorBg, updated.ColorFg)
	}

	fg := "#BE3A5A"
	if _, err := svc.Update(db, created.ID, TagUpdateInput{ColorFg: &fg}); err == nil {
		t.Fatal("expected error when only color_fg provided")
	}
}

func TestTagUpdateEnabled(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := &TagService{}
	created, err := svc.Create(db, "开关")
	if err != nil {
		t.Fatal(err)
	}
	off := false
	updated, err := svc.Update(db, created.ID, TagUpdateInput{Enabled: &off})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Enabled {
		t.Fatal("expected disabled")
	}

	again, err := svc.Create(db, "开关")
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != created.ID {
		t.Fatalf("create fallback id = %d want %d", again.ID, created.ID)
	}
	if again.Enabled {
		t.Fatal("create fallback should keep disabled")
	}
}

func TestTagRename(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := &TagService{}
	a, err := svc.Create(db, "标签甲")
	if err != nil {
		t.Fatal(err)
	}
	b, err := svc.Create(db, "标签乙")
	if err != nil {
		t.Fatal(err)
	}

	newName := "标签甲改"
	updated, err := svc.Update(db, a.ID, TagUpdateInput{Name: &newName})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != newName {
		t.Fatalf("name = %q", updated.Name)
	}

	empty := " "
	if _, err := svc.Update(db, a.ID, TagUpdateInput{Name: &empty}); err == nil {
		t.Fatal("expected empty name error")
	}

	taken := "标签乙"
	if _, err := svc.Update(db, a.ID, TagUpdateInput{Name: &taken}); err == nil {
		t.Fatal("expected duplicate name error")
	}

	var sysID int64
	if err := db.QueryRow(`SELECT id FROM tags WHERE is_system = 1 LIMIT 1`).Scan(&sysID); err != nil {
		t.Fatal(err)
	}
	sysName := "改系统"
	if _, err := svc.Update(db, sysID, TagUpdateInput{Name: &sysName}); err != ErrSystemTag {
		t.Fatalf("system rename err = %v", err)
	}

	asciiA, err := svc.Create(db, "Food")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Create(db, "Drink"); err != nil {
		t.Fatal(err)
	}
	takenCase := "drink"
	if _, err := svc.Update(db, asciiA.ID, TagUpdateInput{Name: &takenCase}); err == nil {
		t.Fatal("expected case-insensitive duplicate name error")
	}
	_ = b
}

func TestTagGetSummary(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := &TagService{}
	tag, err := svc.Create(db, "汇总测")
	if err != nil {
		t.Fatal(err)
	}

	insert := func(amount int64, typ, date string) {
		t.Helper()
		r, err := db.Exec(
			`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (?,?,?,?)`,
			amount, typ, date, "",
		)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := r.LastInsertId()
		if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?,?)`, id, tag.ID); err != nil {
			t.Fatal(err)
		}
	}
	insert(30000, "expense", "2026-06-01")
	insert(10000, "income", "2026-06-02")

	sum, err := svc.Get(db, tag.ID)
	if err != nil {
		t.Fatal(err)
	}
	if sum.TotalExpense != 30000 || sum.TotalIncome != 10000 || sum.NetAmount != -20000 {
		t.Fatalf("totals = %+v", sum)
	}
	if sum.LastTransaction == nil || sum.LastTransaction.Type != "income" {
		t.Fatalf("last = %+v", sum.LastTransaction)
	}

	unused, err := svc.Create(db, "未用")
	if err != nil {
		t.Fatal(err)
	}
	empty, err := svc.Get(db, unused.ID)
	if err != nil {
		t.Fatal(err)
	}
	if empty.LastTransaction != nil || empty.TotalExpense != 0 || empty.TotalIncome != 0 {
		t.Fatalf("unused = %+v", empty)
	}
}
