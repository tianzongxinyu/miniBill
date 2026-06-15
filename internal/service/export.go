package service

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
)

type ExportService struct{}

func (s *ExportService) Export(db *sql.DB, exportType string, w io.Writer) error {
	switch exportType {
	case "transactions":
		return s.exportTransactions(db, w)
	case "contacts":
		return s.exportContacts(db, w)
	case "balances":
		return s.exportBalances(db, w)
	case "tags":
		return s.exportTags(db, w)
	default:
		return fmt.Errorf("%w: unknown export type", ErrValidation)
	}
}

func (s *ExportService) exportTransactions(db *sql.DB, w io.Writer) error {
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "amount", "type", "transaction_date", "note", "contact_id", "tags"})
	rows, err := db.Query(`SELECT id, amount, type, transaction_date, note, contact_id FROM transactions ORDER BY transaction_date`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id, amount int64
		var typ, date, note string
		var cid sql.NullInt64
		if err := rows.Scan(&id, &amount, &typ, &date, &note, &cid); err != nil {
			return err
		}
		tags, _ := loadTagNames(db, id)
		cidStr := ""
		if cid.Valid {
			cidStr = strconv.FormatInt(cid.Int64, 10)
		}
		_ = cw.Write([]string{
			strconv.FormatInt(id, 10),
			strconv.FormatInt(amount, 10),
			typ, date, note, cidStr,
			joinTags(tags),
		})
	}
	cw.Flush()
	return cw.Error()
}

func (s *ExportService) exportContacts(db *sql.DB, w io.Writer) error {
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "name", "nickname", "relation_group", "note", "phone"})
	rows, err := db.Query(`SELECT id, name, nickname, relation_group, note, phone FROM contacts`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name, nick, grp, note, phone string
		if err := rows.Scan(&id, &name, &nick, &grp, &note, &phone); err != nil {
			return err
		}
		_ = cw.Write([]string{strconv.FormatInt(id, 10), name, nick, grp, note, phone})
	}
	cw.Flush()
	return cw.Error()
}

func (s *ExportService) exportBalances(db *sql.DB, w io.Writer) error {
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"year", "month", "balance", "note"})
	rows, err := db.Query(`SELECT year, month, balance, note FROM monthly_balances ORDER BY year, month`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var y, m int
		var bal int64
		var note string
		if err := rows.Scan(&y, &m, &bal, &note); err != nil {
			return err
		}
		_ = cw.Write([]string{strconv.Itoa(y), strconv.Itoa(m), strconv.FormatInt(bal, 10), note})
	}
	cw.Flush()
	return cw.Error()
}

func (s *ExportService) exportTags(db *sql.DB, w io.Writer) error {
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "name", "is_system", "enabled"})
	rows, err := db.Query(`SELECT id, name, is_system, enabled FROM tags`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		var sys, en int
		if err := rows.Scan(&id, &name, &sys, &en); err != nil {
			return err
		}
		_ = cw.Write([]string{strconv.FormatInt(id, 10), name, strconv.Itoa(sys), strconv.Itoa(en)})
	}
	cw.Flush()
	return cw.Error()
}

func joinTags(tags []string) string {
	if len(tags) == 0 {
		return ""
	}
	s := tags[0]
	for i := 1; i < len(tags); i++ {
		s += "|" + tags[i]
	}
	return s
}
