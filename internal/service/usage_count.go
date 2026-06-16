package service

import (
	"database/sql"
)

type sqlExec interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

func bumpTagUsage(db sqlExec, tagID int64, delta int) error {
	if tagID <= 0 || delta == 0 {
		return nil
	}
	_, err := db.Exec(`
		UPDATE tags SET usage_count = CASE
			WHEN usage_count + ? < 0 THEN 0
			ELSE usage_count + ?
		END WHERE id = ?`, delta, delta, tagID)
	return err
}

func bumpContactUsage(db sqlExec, contactID int64, delta int) error {
	if contactID <= 0 || delta == 0 {
		return nil
	}
	_, err := db.Exec(`
		UPDATE contacts SET usage_count = CASE
			WHEN usage_count + ? < 0 THEN 0
			ELSE usage_count + ?
		END WHERE id = ?`, delta, delta, contactID)
	return err
}

func bumpTagsUsage(db sqlExec, tagIDs []int64, delta int) error {
	for _, id := range tagIDs {
		if err := bumpTagUsage(db, id, delta); err != nil {
			return err
		}
	}
	return nil
}

func adjustContactUsage(db sqlExec, oldID, newID *int64) error {
	if oldID != nil && (newID == nil || *oldID != *newID) {
		if err := bumpContactUsage(db, *oldID, -1); err != nil {
			return err
		}
	}
	if newID != nil && (oldID == nil || *oldID != *newID) {
		if err := bumpContactUsage(db, *newID, 1); err != nil {
			return err
		}
	}
	return nil
}

func adjustTagsUsage(db sqlExec, oldIDs, newIDs []int64) error {
	oldSet := map[int64]int{}
	for _, id := range oldIDs {
		oldSet[id]++
	}
	newSet := map[int64]int{}
	for _, id := range newIDs {
		newSet[id]++
	}
	seen := map[int64]bool{}
	for id, oldN := range oldSet {
		seen[id] = true
		delta := newSet[id] - oldN
		if delta != 0 {
			if err := bumpTagUsage(db, id, delta); err != nil {
				return err
			}
		}
	}
	for id, newN := range newSet {
		if seen[id] {
			continue
		}
		if err := bumpTagUsage(db, id, newN); err != nil {
			return err
		}
	}
	return nil
}

func rebuildAllUsageCounts(db sqlExec) error {
	if _, err := db.Exec(`UPDATE tags SET usage_count = (
		SELECT COUNT(*) FROM transaction_tags tt WHERE tt.tag_id = tags.id
	)`); err != nil {
		return err
	}
	_, err := db.Exec(`UPDATE contacts SET usage_count = (
		SELECT COUNT(*) FROM transactions t WHERE t.contact_id = contacts.id
	)`)
	return err
}
