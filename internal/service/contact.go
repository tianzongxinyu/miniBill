package service

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var ErrContactInUse = errors.New("contact in use")

type Contact struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	Nickname      string `json:"nickname"`
	RelationGroup string `json:"relation_group"`
	Note          string `json:"note"`
	Phone         string `json:"phone"`
	Enabled       bool   `json:"enabled"`
	UsageCount    int64  `json:"usage_count"`
}

type ContactSummary struct {
	Contact
	SocialExpense   int64 `json:"social_expense"`
	SocialIncome    int64 `json:"social_income"`
	NetAmount       int64 `json:"net_amount"`
	LastTransaction *struct {
		ID              int64  `json:"id"`
		Amount          int64  `json:"amount"`
		Type            string `json:"type"`
		TransactionDate string `json:"transaction_date"`
	} `json:"last_transaction"`
}

type ContactUpdateInput struct {
	Enabled       *bool
	Name          *string
	Nickname      *string
	RelationGroup *string
	Note          *string
	Phone         *string
}

type ContactService struct{}

const contactSelectCols = `id, name, nickname, relation_group, note, phone, enabled, usage_count`

func scanContact(scanner interface {
	Scan(dest ...interface{}) error
}) (Contact, error) {
	var c Contact
	var en int
	err := scanner.Scan(&c.ID, &c.Name, &c.Nickname, &c.RelationGroup, &c.Note, &c.Phone, &en, &c.UsageCount)
	if err != nil {
		return Contact{}, err
	}
	c.Enabled = en == 1
	return c, nil
}

func (s *ContactService) List(db *sql.DB, enabledOnly bool) ([]Contact, error) {
	q := `SELECT ` + contactSelectCols + ` FROM contacts`
	if enabledOnly {
		q += ` WHERE enabled = 1`
	}
	q += ` ORDER BY usage_count DESC, name ASC`
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Contact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *ContactService) Get(db *sql.DB, id int64) (*ContactSummary, error) {
	c, err := scanContact(db.QueryRow(`SELECT `+contactSelectCols+` FROM contacts WHERE id=?`, id))
	if err != nil {
		return nil, err
	}
	sum := &ContactSummary{Contact: c}
	_ = db.QueryRow(`
		SELECT COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		WHERE t.contact_id = ?`,
		id,
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

func (s *ContactService) findByName(db *sql.DB, name string) (*Contact, error) {
	c, err := scanContact(db.QueryRow(
		`SELECT `+contactSelectCols+` FROM contacts WHERE LOWER(name) = LOWER(?) ORDER BY id ASC LIMIT 1`,
		name,
	))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *ContactService) Create(db *sql.DB, c Contact) (*Contact, error) {
	name := strings.TrimSpace(c.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: contact_name_required", ErrValidation)
	}
	existing, err := s.findByName(db, name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	res, err := db.Exec(
		`INSERT INTO contacts (name, nickname, relation_group, note, phone, enabled) VALUES (?,?,?,?,?,1)`,
		name, c.Nickname, c.RelationGroup, c.Note, c.Phone,
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &Contact{
		ID:            id,
		Name:          name,
		Nickname:      c.Nickname,
		RelationGroup: c.RelationGroup,
		Note:          c.Note,
		Phone:         c.Phone,
		Enabled:       true,
		UsageCount:    0,
	}, nil
}

func (s *ContactService) Update(db *sql.DB, id int64, in ContactUpdateInput) (*Contact, error) {
	if in.Enabled == nil && in.Name == nil && in.Nickname == nil && in.RelationGroup == nil && in.Note == nil && in.Phone == nil {
		return nil, fmt.Errorf("%w: no_update_fields", ErrValidation)
	}
	c, err := scanContact(db.QueryRow(`SELECT `+contactSelectCols+` FROM contacts WHERE id=?`, id))
	if err != nil {
		return nil, err
	}
	if in.Name != nil {
		c.Name = strings.TrimSpace(*in.Name)
	}
	if in.Nickname != nil {
		c.Nickname = *in.Nickname
	}
	if in.RelationGroup != nil {
		c.RelationGroup = *in.RelationGroup
	}
	if in.Note != nil {
		c.Note = *in.Note
	}
	if in.Phone != nil {
		c.Phone = *in.Phone
	}
	en := 0
	if c.Enabled {
		en = 1
	}
	if in.Enabled != nil {
		en = 0
		if *in.Enabled {
			en = 1
		}
		c.Enabled = *in.Enabled
	}
	_, err = db.Exec(
		`UPDATE contacts SET name=?, nickname=?, relation_group=?, note=?, phone=?, enabled=? WHERE id=?`,
		c.Name, c.Nickname, c.RelationGroup, c.Note, c.Phone, en, id,
	)
	if err != nil {
		return nil, err
	}
	c.Enabled = en == 1
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
