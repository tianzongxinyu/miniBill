package cache_test

import (
	"testing"

	"github.com/minibill/minibill/internal/cache"
	"github.com/minibill/minibill/internal/testutil"
)

func TestLedgerMetaStoreResolveTagFromCache(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	store := cache.NewLedgerMetaStore(8)
	meta := store.ForUser(1)
	if err := meta.WarmTagsAndContacts(db); err != nil {
		t.Fatal(err)
	}

	created := 0
	id1, err := meta.ResolveTagID(db, "餐饮", &created)
	if err != nil {
		t.Fatal(err)
	}
	id2, err := meta.ResolveTagID(db, "餐饮", &created)
	if err != nil {
		t.Fatal(err)
	}
	if id1 != id2 || created != 1 {
		t.Fatalf("id1=%d id2=%d created=%d", id1, id2, created)
	}
}

func TestLedgerMetaStoreInvalidate(t *testing.T) {
	store := cache.NewLedgerMetaStore(8)
	_ = store.ForUser(1)
	store.Invalidate(1)
	meta := store.ForUser(1)
	if meta == nil {
		t.Fatal("expected new meta after invalidate")
	}
}
