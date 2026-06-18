package service

import (
	"database/sql"

	"github.com/minibill/minibill/internal/domain"
)

func (s *StatsService) sumRecordedRange(db *sql.DB, start, end string) (income, expense int64, err error) {
	return s.sumTransactionsRange(db, start, end, StatsFilter{})
}

func (s *StatsService) dailyExpenseTagID(db *sql.DB) (int64, error) {
	var id int64
	err := db.QueryRow(`SELECT id FROM tags WHERE preset_key = ?`, domain.DailyExpensePresetKey).Scan(&id)
	return id, err
}

func (s *StatsService) findSystemDailyTxID(db *sql.DB, year, month int) (int64, bool, error) {
	start, end := monthRange(year, month)
	var id int64
	err := db.QueryRow(`
		SELECT id FROM transactions
		WHERE is_system = 1 AND transaction_date >= ? AND transaction_date < ?
		LIMIT 1`, start, end,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	return id, true, nil
}

func (s *StatsService) deleteSystemDailyTx(db *sql.DB, year, month int) error {
	id, ok, err := s.findSystemDailyTxID(db, year, month)
	if err != nil || !ok {
		return err
	}
	tagID, err := s.dailyExpenseTagID(db)
	if err != nil {
		return err
	}
	if err := bumpTagUsage(db, tagID, -1); err != nil {
		return err
	}
	_, err = db.Exec(`DELETE FROM transactions WHERE id = ?`, id)
	return err
}

func (s *StatsService) upsertSystemDailyTx(db *sql.DB, year, month int, amount int64) error {
	if amount == 0 {
		return s.deleteSystemDailyTx(db, year, month)
	}
	tagID, err := s.dailyExpenseTagID(db)
	if err != nil {
		return err
	}
	date := domain.LastDayOfMonth(year, month)
	txType := "expense"
	txAmount := amount
	if amount < 0 {
		txType = "income"
		txAmount = -amount
	}
	id, ok, err := s.findSystemDailyTxID(db, year, month)
	if err != nil {
		return err
	}
	if ok {
		_, err = db.Exec(`
			UPDATE transactions SET amount=?, type=?, transaction_date=?, updated_at=datetime('now')
			WHERE id=?`, txAmount, txType, date, id)
		if err != nil {
			return err
		}
		_, _ = db.Exec(`DELETE FROM transaction_tags WHERE transaction_id=?`, id)
		_, err = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, id, tagID)
		return err
	}
	res, err := db.Exec(`
		INSERT INTO transactions (amount, type, transaction_date, note, is_system, updated_at)
		VALUES (?, ?, ?, '', 1, datetime('now'))`, txAmount, txType, date)
	if err != nil {
		return err
	}
	newID, _ := res.LastInsertId()
	_, err = db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, newID, tagID)
	if err != nil {
		return err
	}
	return bumpTagUsage(db, tagID, 1)
}

// syncDailyExpenseForMonth 在余额登记或流水变更后重算 stat_monthly，并维护 is_system=1 的日常支出系统流水（不可编辑/删除）。
func (s *StatsService) syncDailyExpenseForMonth(db *sql.DB, year, month int) error {
	start, end := monthRange(year, month)

	totalIncome, totalExpense, err := s.sumRecordedRange(db, start, end)
	if err != nil {
		return err
	}

	registeredBalance, err := loadMonthlyBalance(db, year, month)
	if err != nil {
		return err
	}

	var dailyExpense sql.NullInt64
	if registeredBalance.Valid {
		de, err := s.calcDailyExpense(db, year, month, totalIncome, totalExpense, registeredBalance.Int64)
		if err != nil {
			return err
		}
		if de != nil && *de != 0 {
			dailyExpense = sql.NullInt64{Int64: *de, Valid: true}
		}
	}

	if dailyExpense.Valid {
		if err := s.upsertSystemDailyTx(db, year, month, dailyExpense.Int64); err != nil {
			return err
		}
	} else if err := s.deleteSystemDailyTx(db, year, month); err != nil {
		return err
	}

	var regVal interface{}
	if registeredBalance.Valid {
		regVal = registeredBalance.Int64
	}

	_, err = db.Exec(`
		INSERT INTO stat_monthly (year, month, total_income, total_expense, registered_balance, daily_expense)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(year, month) DO UPDATE SET
			total_income=excluded.total_income,
			total_expense=excluded.total_expense,
			registered_balance=excluded.registered_balance,
			daily_expense=excluded.daily_expense`,
		year, month, totalIncome, totalExpense, regVal, dailyExpense,
	)
	return err
}

func (s *StatsService) syncAfterTransaction(db *sql.DB, dates ...string) error {
	seen := map[domain.YearMonth]bool{}
	for _, d := range dates {
		ym, err := domain.MonthOfDate(d)
		if err != nil {
			return err
		}
		if seen[ym] {
			continue
		}
		seen[ym] = true
		if err := s.syncDailyExpenseForMonth(db, ym.Year, ym.Month); err != nil {
			return err
		}
	}
	return nil
}

func (s *StatsService) syncAfterBalance(db *sql.DB, year, month int) error {
	current := s.currentYearMonth()
	ym := domain.YearMonth{Year: year, Month: month}
	if ym != current {
		if err := s.syncDailyExpenseForMonth(db, year, month); err != nil {
			return err
		}
	}
	next := domain.NextMonth(ym)
	if next != current {
		return s.syncDailyExpenseForMonth(db, next.Year, next.Month)
	}
	return nil
}
