package service

import (
	"testing"

	"github.com/minibill/minibill/internal/testutil"
)

func TestUsageCountOnTransactionCRUD(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	txSvc := NewTransactionService(NewStatsService())
	tagSvc := &TagService{}
	contactSvc := &ContactService{}

	tagA := testutil.InsertTag(t, db, "少用的")
	tagB := testutil.InsertTag(t, db, "常用的")
	cRes, err := contactSvc.Create(db, Contact{Name: "少联系"})
	if err != nil {
		t.Fatal(err)
	}
	cRare := cRes.ID
	cRes, err = contactSvc.Create(db, Contact{Name: "常联系"})
	if err != nil {
		t.Fatal(err)
	}
	cOften := cRes.ID

	for i := 0; i < 3; i++ {
		_, err := txSvc.Create(db, CreateTransactionInput{
			Amount:          100,
			Type:            "expense",
			TransactionDate: "2026-06-01",
			Note:            "b",
			ContactID:       &cOften,
			TagIDs:          []int64{tagB},
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	_, err = txSvc.Create(db, CreateTransactionInput{
		Amount:          100,
		Type:            "expense",
		TransactionDate: "2026-06-02",
		Note:            "a",
		ContactID:       &cRare,
		TagIDs:          []int64{tagA},
	})
	if err != nil {
		t.Fatal(err)
	}

	tags, err := tagSvc.List(db, false)
	if err != nil {
		t.Fatal(err)
	}
	var gotA, gotB *Tag
	for i := range tags {
		switch tags[i].ID {
		case tagA:
			gotA = &tags[i]
		case tagB:
			gotB = &tags[i]
		}
	}
	if gotB == nil || gotB.UsageCount != 3 {
		t.Fatalf("tagB usage = %+v", gotB)
	}
	if gotA == nil || gotA.UsageCount != 1 {
		t.Fatalf("tagA usage = %+v", gotA)
	}
	idxA, idxB := -1, -1
	for i, tg := range tags {
		switch tg.ID {
		case tagA:
			idxA = i
		case tagB:
			idxB = i
		}
	}
	if idxB < 0 || idxA < 0 || idxB >= idxA {
		t.Fatalf("tags order: idxB=%d idxA=%d list=%+v", idxB, idxA, tags)
	}

	contacts, err := contactSvc.List(db, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(contacts) < 2 || contacts[0].ID != cOften || contacts[0].UsageCount != 3 {
		t.Fatalf("contacts order/count = %+v", contacts)
	}
}
