package service

import (
	"database/sql"
	"errors"

	"github.com/minibill/minibill/internal/domain"
)

var ErrContactInUse = errors.New("contact in use")

type Contact struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Nickname      string `json:"nickname"`
	RelationGroup string `json:"relation_group"`
	Note          string `json:"note"`
	Phone         string `json:"phone"`
}

type ContactSummary struct {
	Contact
	SocialExpense int64       `json:"social_expense"`
	SocialIncome  int64       `json:"social_income"`
	NetAmount     int64       `json:"net_amount"`
	LastTransaction *struct {
		ID              int64  `json:"id"`
		Amount          int64  `json:"amount"`
		Type            string `json:"type"`
		TransactionDate string `json:"transaction_date"`
	} `json:"last_transaction"`
}

type ContactService struct{}

func (s *ContactService) List(db *sql.DB) ([]Contact, error) {
	rows, err := db.Query(`SELECT id, name, nickname, relation_group, note, phone FROM contacts ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Contact
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Nickname, &c.RelationGroup, &c.Note, &c.Phone); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *ContactService) Get(db *sql.DB, id int64) (*ContactSummary, error) {
	var c Contact
	err := db.QueryRow(`SELECT id, name, nickname, relation_group, note, phone FROM contacts WHERE id=?`, id).
		Scan(&c.ID, &c.Name, &c.Nickname, &c.RelationGroup, &c.Note, &c.Phone)
	if err != nil {
		return nil, err
	}
	sum := &ContactSummary{Contact: c}
	_ = db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		WHERE t.contact_id = ?
		  AND `+socialTagExistsSQL("t"),
		id, domain.SocialTagName,
	).Scan(&sum.SocialExpense, &sum.SocialIncome)
	sum.NetAmount = sum.SocialIncome - sum.SocialExpense

	var txID int64
	var amount int64
	var txType, txDate string
	err = db.QueryRow(`
		SELECT t.id, t.amount, t.type, t.transaction_date FROM transactions t
		WHERE t.contact_id=? ORDER BY t.transaction_date DESC, t.id DESC LIMIT 1`, id,
	).Scan(&txID, &amount, &txType, &txDate)
	if err == nil {
		sum.LastTransaction = &struct {
			ID              int64  `json:"id"`
			Amount          int64  `json:"amount"`
			Type            string `json:"type"`
			TransactionDate string `json:"transaction_date"`
		}{txID, amount, txType, txDate}
	}
	return sum, nil
}

func (s *ContactService) Create(db *sql.DB, c Contact) (*Contact, error) {
	res, err := db.Exec(`INSERT INTO contacts (name, nickname, relation_group, note, phone) VALUES (?,?,?,?,?)`,
		c.Name, c.Nickname, c.RelationGroup, c.Note, c.Phone)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	c.ID = id
	return &c, nil
}

func (s *ContactService) Update(db *sql.DB, id int64, c Contact) (*Contact, error) {
	_, err := db.Exec(`UPDATE contacts SET name=?, nickname=?, relation_group=?, note=?, phone=? WHERE id=?`,
		c.Name, c.Nickname, c.RelationGroup, c.Note, c.Phone, id)
	if err != nil {
		return nil, err
	}
	c.ID = id
	return &c, nil
}

func (s *ContactService) Delete(db *sql.DB, id int64) error {
	var cnt int
	if err := db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE contact_id=?`, id).Scan(&cnt); err != nil {
		return err
	}
	if cnt > 0 {
		return ErrContactInUse
	}
	_, err := db.Exec(`DELETE FROM contacts WHERE id=?`, id)
	return err
}
