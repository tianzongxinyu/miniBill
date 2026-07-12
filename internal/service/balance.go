package service

import (
	"database/sql"
)

type Balance struct {
	Year      int    `json:"year"`
	Month     int    `json:"month"`
	Balance   int64  `json:"balance"`
	Note      string `json:"note"`
	UpdatedAt string `json:"updated_at"`
}

type BalanceService struct {
	stats *StatsService
}

func NewBalanceService(stats *StatsService) *BalanceService {
	return &BalanceService{stats: stats}
}

func (s *BalanceService) List(db *sql.DB) ([]Balance, error) {
	rows, err := db.Query(`SELECT year, month, balance, note, updated_at FROM monthly_balances ORDER BY year DESC, month DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Balance
	for rows.Next() {
		var b Balance
		if err := rows.Scan(&b.Year, &b.Month, &b.Balance, &b.Note, &b.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (s *BalanceService) Get(db *sql.DB, year, month int) (*Balance, error) {
	var b Balance
	err := db.QueryRow(`SELECT year, month, balance, note, updated_at FROM monthly_balances WHERE year=? AND month=?`, year, month).
		Scan(&b.Year, &b.Month, &b.Balance, &b.Note, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *BalanceService) Upsert(db *sql.DB, year, month int, balance int64, note string) (*Balance, error) {
	if balance < 0 {
		return nil, ErrValidation
	}
	_, err := db.Exec(`
		INSERT INTO monthly_balances (year, month, balance, note, updated_at) VALUES (?,?,?,?,datetime('now'))
		ON CONFLICT(year, month) DO UPDATE SET balance=excluded.balance, note=excluded.note, updated_at=datetime('now')`,
		year, month, balance, note)
	if err != nil {
		return nil, err
	}
	if err := s.stats.RecalcAfterBalance(db, year, month); err != nil {
		return nil, err
	}
	return s.Get(db, year, month)
}

func (s *BalanceService) Delete(db *sql.DB, year, month int) error {
	_, err := db.Exec(`DELETE FROM monthly_balances WHERE year=? AND month=?`, year, month)
	if err != nil {
		return err
	}
	return s.stats.RecalcAfterBalance(db, year, month)
}
