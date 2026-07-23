package service

import (
	"testing"

	"github.com/minibill/minibill/internal/testutil"
)

func TestContactEnabledListAndCreateFallback(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := &ContactService{}
	created, err := svc.Create(db, Contact{Name: "张三"})
	if err != nil {
		t.Fatal(err)
	}
	if !created.Enabled {
		t.Fatal("expected enabled on create")
	}

	off := false
	updated, err := svc.Update(db, created.ID, ContactUpdateInput{Enabled: &off})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Enabled {
		t.Fatal("expected disabled")
	}

	enabledOnly, err := svc.List(db, true)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range enabledOnly {
		if c.ID == created.ID {
			t.Fatal("disabled contact should not appear in enabled-only list")
		}
	}

	all, err := svc.List(db, false)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range all {
		if c.ID == created.ID {
			found = true
			if c.Enabled {
				t.Fatal("expected disabled in full list")
			}
		}
	}
	if !found {
		t.Fatal("disabled contact missing from full list")
	}

	again, err := svc.Create(db, Contact{Name: "张三"})
	if err != nil {
		t.Fatal(err)
	}
	if again.ID != created.ID {
		t.Fatalf("create fallback id = %d want %d", again.ID, created.ID)
	}
	if again.Enabled {
		t.Fatal("create fallback should keep disabled")
	}

	againCase, err := svc.Create(db, Contact{Name: "张三"})
	if err != nil {
		t.Fatal(err)
	}
	if againCase.ID != created.ID {
		t.Fatalf("case-insensitive fallback id = %d", againCase.ID)
	}
}
