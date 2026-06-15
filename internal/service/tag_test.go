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
}
