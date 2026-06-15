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

func TestLedgerMetaTxTagsForIDsAlwaysFresh(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	tagA := testutil.InsertTag(t, db, "餐饮")
	tagB := testutil.InsertTag(t, db, "交通")
	_, err := db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (1000,'expense','2026-03-01','t')`)
	if err != nil {
		t.Fatal(err)
	}
	var txID int64
	if err := db.QueryRow(`SELECT id FROM transactions WHERE note='t'`).Scan(&txID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tagA); err != nil {
		t.Fatal(err)
	}

	meta := cache.NewLedgerMetaStore(8).ForUser(1)
	m1, err := meta.TxTagsForIDs(db, []int64{txID})
	if err != nil {
		t.Fatal(err)
	}
	if len(m1[txID]) != 1 || m1[txID][0].Name != "餐饮" {
		t.Fatalf("first = %+v", m1[txID])
	}

	if _, err := db.Exec(`DELETE FROM transaction_tags WHERE transaction_id=?`, txID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, txID, tagB); err != nil {
		t.Fatal(err)
	}

	m2, err := meta.TxTagsForIDs(db, []int64{txID})
	if err != nil {
		t.Fatal(err)
	}
	if len(m2[txID]) != 1 || m2[txID][0].Name != "交通" {
		t.Fatalf("after update = %+v, want 交通", m2[txID])
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
