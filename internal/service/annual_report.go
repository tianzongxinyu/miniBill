package service

import (
	"database/sql"
	"math"
	"sort"

	"github.com/minibill/minibill/internal/domain"
)

const annualTopN = 5

type AnnualReportSummary struct {
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	NetIncome    int64  `json:"net_income"`
	DailyExpense *int64 `json:"daily_expense"`
	StartBalance *int64 `json:"start_balance"`
	EndBalance   *int64 `json:"end_balance"`
}

type AnnualReportTagStat struct {
	TagID        *int64 `json:"tag_id"`
	TagName      string `json:"tag_name"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	TxCount      int64  `json:"tx_count"`
}

type AnnualReportTagRankings struct {
	ExpenseByAmount []AnnualReportTagStat `json:"expense_by_amount"`
	ExpenseByCount  []AnnualReportTagStat `json:"expense_by_count"`
	IncomeByAmount  []AnnualReportTagStat `json:"income_by_amount"`
	IncomeByCount   []AnnualReportTagStat `json:"income_by_count"`
}

type AnnualReportTopTx struct {
	ID              int64                `json:"id"`
	Amount          int64                `json:"amount"`
	Type            string               `json:"type"`
	TransactionDate string               `json:"transaction_date"`
	Note            string               `json:"note"`
	ContactID       *int64               `json:"contact_id"`
	ContactName     string               `json:"contact_name"`
	Tags            []string             `json:"tags"`
	TagItems        []TransactionTagItem `json:"tag_items"`
}

type AnnualReportTxRankings struct {
	Expense []AnnualReportTopTx `json:"expense"`
	Income  []AnnualReportTopTx `json:"income"`
}

type AnnualReportContactStat struct {
	ContactID    int64  `json:"contact_id"`
	ContactName  string `json:"contact_name"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	NetIncome    int64  `json:"net_income"`
	TxCount      int64  `json:"tx_count"`
}

type AnnualReportContactRankings struct {
	ExpenseByAmount []AnnualReportContactStat `json:"expense_by_amount"`
	ExpenseByCount  []AnnualReportContactStat `json:"expense_by_count"`
	IncomeByAmount  []AnnualReportContactStat `json:"income_by_amount"`
	IncomeByCount   []AnnualReportContactStat `json:"income_by_count"`
}

type AnnualReportCompare struct {
	PrevYear     int                 `json:"prev_year"`
	Summary      AnnualReportSummary `json:"summary"`
	DeltaIncome  int64               `json:"delta_income"`
	DeltaExpense int64               `json:"delta_expense"`
	DeltaNet     int64               `json:"delta_net"`
	PctIncome    *float64            `json:"pct_income"`
	PctExpense   *float64            `json:"pct_expense"`
	PctNet       *float64            `json:"pct_net"`
}

type AnnualReportInsight struct {
	Key    string                 `json:"key"`
	Params map[string]interface{} `json:"params,omitempty"`
}

type AnnualReport struct {
	Year            int                         `json:"year"`
	Summary         AnnualReportSummary         `json:"summary"`
	ByTag           AnnualReportTagRankings     `json:"by_tag"`
	TopTransactions AnnualReportTxRankings      `json:"top_transactions"`
	TopContacts     AnnualReportContactRankings `json:"top_contacts"`
	Compare         *AnnualReportCompare        `json:"compare"`
	Insights        []AnnualReportInsight       `json:"insights"`
}

type annualTagAgg struct {
	TagID          int64
	TagName        string
	TotalIncome    int64
	TotalExpense   int64
	IncomeTxCount  int64
	ExpenseTxCount int64
}

type annualContactAgg struct {
	ContactID      int64
	ContactName    string
	TotalIncome    int64
	TotalExpense   int64
	IncomeTxCount  int64
	ExpenseTxCount int64
}

// DefaultAnnualReportYear returns the current calendar year.
func (s *StatsService) DefaultAnnualReportYear(db *sql.DB) (int, error) {
	_ = db
	return s.now().Year(), nil
}

func (s *StatsService) AnnualReport(db *sql.DB, year int) (*AnnualReport, error) {
	if year < 2000 || year > s.now().Year() {
		return nil, ErrValidation
	}

	summary, err := s.annualSummary(db, year)
	if err != nil {
		return nil, err
	}
	byTag, err := s.annualByTag(db, year)
	if err != nil {
		return nil, err
	}
	topTxs, err := s.annualTopTransactions(db, year)
	if err != nil {
		return nil, err
	}
	topContacts, err := s.annualTopContacts(db, year)
	if err != nil {
		return nil, err
	}
	compare, err := s.annualCompare(db, year, summary)
	if err != nil {
		return nil, err
	}

	report := &AnnualReport{
		Year:            year,
		Summary:         summary,
		ByTag:           byTag,
		TopTransactions: topTxs,
		TopContacts:     topContacts,
		Compare:         compare,
	}
	report.Insights = buildAnnualInsights(report)
	return report, nil
}

func (s *StatsService) annualSummary(db *sql.DB, year int) (AnnualReportSummary, error) {
	start, end := yearRange(year)
	income, expense, err := s.sumTransactionsRange(db, start, end, StatsFilter{})
	if err != nil {
		return AnnualReportSummary{}, err
	}
	sum := AnnualReportSummary{
		TotalIncome:  income,
		TotalExpense: expense,
	}
	startBal, err := loadPriorDecemberBalance(db, year)
	if err != nil {
		return AnnualReportSummary{}, err
	}
	sum.StartBalance = startBal

	var endBal int64
	err = db.QueryRow(
		`SELECT balance FROM monthly_balances WHERE year = ? ORDER BY month DESC LIMIT 1`, year,
	).Scan(&endBal)
	if err == nil {
		sum.EndBalance = &endBal
	} else if err != sql.ErrNoRows {
		return AnnualReportSummary{}, err
	}

	var dailySum sql.NullInt64
	if err := db.QueryRow(
		`SELECT SUM(daily_expense) FROM stat_monthly WHERE year = ?`, year,
	).Scan(&dailySum); err != nil {
		return AnnualReportSummary{}, err
	}
	if dailySum.Valid {
		sum.DailyExpense = &dailySum.Int64
	}

	sum.NetIncome = monthNetIncome(sum.TotalIncome, sum.TotalExpense, sum.StartBalance, sum.EndBalance)
	return sum, nil
}

func (s *StatsService) annualByTag(db *sql.DB, year int) (AnnualReportTagRankings, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT g.id, g.name,
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COUNT(DISTINCT CASE WHEN t.type='income' THEN t.id END),
		       COUNT(DISTINCT CASE WHEN t.type='expense' THEN t.id END)
		FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		JOIN tags g ON g.id = tt.tag_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		  AND (g.preset_key IS NULL OR g.preset_key != ?)
		GROUP BY g.id`,
		start, end, domain.DailyExpensePresetKey,
	)
	if err != nil {
		return AnnualReportTagRankings{}, err
	}
	defer rows.Close()

	aggs := make([]annualTagAgg, 0)
	for rows.Next() {
		var a annualTagAgg
		if err := rows.Scan(
			&a.TagID, &a.TagName, &a.TotalIncome, &a.TotalExpense,
			&a.IncomeTxCount, &a.ExpenseTxCount,
		); err != nil {
			return AnnualReportTagRankings{}, err
		}
		aggs = append(aggs, a)
	}
	if err := rows.Err(); err != nil {
		return AnnualReportTagRankings{}, err
	}

	return AnnualReportTagRankings{
		ExpenseByAmount: topTagStats(aggs, true, true),
		ExpenseByCount:  topTagStats(aggs, true, false),
		IncomeByAmount:  topTagStats(aggs, false, true),
		IncomeByCount:   topTagStats(aggs, false, false),
	}, nil
}

func topTagStats(aggs []annualTagAgg, expense bool, byAmount bool) []AnnualReportTagStat {
	filtered := make([]annualTagAgg, 0, len(aggs))
	for _, a := range aggs {
		if expense {
			if a.TotalExpense <= 0 && a.ExpenseTxCount <= 0 {
				continue
			}
		} else if a.TotalIncome <= 0 && a.IncomeTxCount <= 0 {
			continue
		}
		filtered = append(filtered, a)
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		ai, aj := filtered[i], filtered[j]
		var vi, vj int64
		if expense {
			if byAmount {
				vi, vj = ai.TotalExpense, aj.TotalExpense
			} else {
				vi, vj = ai.ExpenseTxCount, aj.ExpenseTxCount
			}
		} else {
			if byAmount {
				vi, vj = ai.TotalIncome, aj.TotalIncome
			} else {
				vi, vj = ai.IncomeTxCount, aj.IncomeTxCount
			}
		}
		if vi != vj {
			return vi > vj
		}
		return ai.TagName < aj.TagName
	})
	if len(filtered) > annualTopN {
		filtered = filtered[:annualTopN]
	}
	out := make([]AnnualReportTagStat, 0, len(filtered))
	for _, a := range filtered {
		id := a.TagID
		item := AnnualReportTagStat{
			TagID:        &id,
			TagName:      a.TagName,
			TotalIncome:  a.TotalIncome,
			TotalExpense: a.TotalExpense,
		}
		if expense {
			item.TxCount = a.ExpenseTxCount
		} else {
			item.TxCount = a.IncomeTxCount
		}
		out = append(out, item)
	}
	return out
}

func (s *StatsService) annualTopTransactions(db *sql.DB, year int) (AnnualReportTxRankings, error) {
	expense, err := s.annualTopTransactionsByType(db, year, "expense")
	if err != nil {
		return AnnualReportTxRankings{}, err
	}
	income, err := s.annualTopTransactionsByType(db, year, "income")
	if err != nil {
		return AnnualReportTxRankings{}, err
	}
	return AnnualReportTxRankings{Expense: expense, Income: income}, nil
}

func (s *StatsService) annualTopTransactionsByType(db *sql.DB, year int, typ string) ([]AnnualReportTopTx, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT t.id, t.amount, t.type, t.transaction_date, t.note, t.contact_id, COALESCE(c.name, '')
		FROM transactions t
		LEFT JOIN contacts c ON c.id = t.contact_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		  AND t.type = ?
		ORDER BY t.amount DESC, t.transaction_date DESC, t.id DESC
		LIMIT ?`, start, end, typ, annualTopN)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AnnualReportTopTx, 0, annualTopN)
	ids := make([]int64, 0, annualTopN)
	for rows.Next() {
		var item AnnualReportTopTx
		var contactID sql.NullInt64
		if err := rows.Scan(&item.ID, &item.Amount, &item.Type, &item.TransactionDate, &item.Note, &contactID, &item.ContactName); err != nil {
			return nil, err
		}
		if contactID.Valid && contactID.Int64 > 0 {
			id := contactID.Int64
			item.ContactID = &id
		}
		item.Tags = []string{}
		item.TagItems = []TransactionTagItem{}
		out = append(out, item)
		ids = append(ids, item.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	tagMap, err := loadTagsForTxIDs(db, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		for _, tag := range tagMap[out[i].ID] {
			out[i].TagItems = append(out[i].TagItems, tag)
			out[i].Tags = append(out[i].Tags, tag.Name)
		}
	}
	return out, nil
}

func (s *StatsService) annualTopContacts(db *sql.DB, year int) (AnnualReportContactRankings, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT c.id, c.name,
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='income' THEN 1 ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN 1 ELSE 0 END), 0)
		FROM transactions t
		JOIN contacts c ON c.id = t.contact_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		GROUP BY c.id`, start, end)
	if err != nil {
		return AnnualReportContactRankings{}, err
	}
	defer rows.Close()

	aggs := make([]annualContactAgg, 0)
	for rows.Next() {
		var a annualContactAgg
		if err := rows.Scan(
			&a.ContactID, &a.ContactName, &a.TotalIncome, &a.TotalExpense,
			&a.IncomeTxCount, &a.ExpenseTxCount,
		); err != nil {
			return AnnualReportContactRankings{}, err
		}
		aggs = append(aggs, a)
	}
	if err := rows.Err(); err != nil {
		return AnnualReportContactRankings{}, err
	}

	return AnnualReportContactRankings{
		ExpenseByAmount: topContactStats(aggs, true, true),
		ExpenseByCount:  topContactStats(aggs, true, false),
		IncomeByAmount:  topContactStats(aggs, false, true),
		IncomeByCount:   topContactStats(aggs, false, false),
	}, nil
}

func topContactStats(aggs []annualContactAgg, expense bool, byAmount bool) []AnnualReportContactStat {
	filtered := make([]annualContactAgg, 0, len(aggs))
	for _, a := range aggs {
		if expense {
			if a.TotalExpense <= 0 && a.ExpenseTxCount <= 0 {
				continue
			}
		} else if a.TotalIncome <= 0 && a.IncomeTxCount <= 0 {
			continue
		}
		filtered = append(filtered, a)
	}
	sort.SliceStable(filtered, func(i, j int) bool {
		ai, aj := filtered[i], filtered[j]
		var vi, vj int64
		if expense {
			if byAmount {
				vi, vj = ai.TotalExpense, aj.TotalExpense
			} else {
				vi, vj = ai.ExpenseTxCount, aj.ExpenseTxCount
			}
		} else {
			if byAmount {
				vi, vj = ai.TotalIncome, aj.TotalIncome
			} else {
				vi, vj = ai.IncomeTxCount, aj.IncomeTxCount
			}
		}
		if vi != vj {
			return vi > vj
		}
		return ai.ContactName < aj.ContactName
	})
	if len(filtered) > annualTopN {
		filtered = filtered[:annualTopN]
	}
	out := make([]AnnualReportContactStat, 0, len(filtered))
	for _, a := range filtered {
		item := AnnualReportContactStat{
			ContactID:    a.ContactID,
			ContactName:  a.ContactName,
			TotalIncome:  a.TotalIncome,
			TotalExpense: a.TotalExpense,
			NetIncome:    a.TotalIncome - a.TotalExpense,
		}
		if expense {
			item.TxCount = a.ExpenseTxCount
		} else {
			item.TxCount = a.IncomeTxCount
		}
		out = append(out, item)
	}
	return out
}

func (s *StatsService) annualCompare(db *sql.DB, year int, curr AnnualReportSummary) (*AnnualReportCompare, error) {
	prevYear := year - 1
	ok, err := s.yearHasActivity(db, prevYear)
	if err != nil || !ok {
		return nil, err
	}
	prev, err := s.annualSummary(db, prevYear)
	if err != nil {
		return nil, err
	}
	return &AnnualReportCompare{
		PrevYear:     prevYear,
		Summary:      prev,
		DeltaIncome:  curr.TotalIncome - prev.TotalIncome,
		DeltaExpense: curr.TotalExpense - prev.TotalExpense,
		DeltaNet:     curr.NetIncome - prev.NetIncome,
		PctIncome:    pctChange(curr.TotalIncome, prev.TotalIncome),
		PctExpense:   pctChange(curr.TotalExpense, prev.TotalExpense),
		PctNet:       pctChange(curr.NetIncome, prev.NetIncome),
	}, nil
}

func (s *StatsService) yearHasActivity(db *sql.DB, year int) (bool, error) {
	start, end := yearRange(year)
	var n int
	if err := db.QueryRow(`
		SELECT COUNT(*) FROM transactions
		WHERE transaction_date >= ? AND transaction_date < ? AND is_system = 0`,
		start, end,
	).Scan(&n); err != nil {
		return false, err
	}
	if n > 0 {
		return true, nil
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM stat_monthly WHERE year = ?`, year).Scan(&n); err != nil {
		return false, err
	}
	if n > 0 {
		return true, nil
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM monthly_balances WHERE year = ?`, year).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

func pctChange(curr, prev int64) *float64 {
	if prev == 0 {
		return nil
	}
	v := float64(curr-prev) / float64(prev) * 100
	v = math.Round(v*10) / 10
	return &v
}

func buildAnnualInsights(r *AnnualReport) []AnnualReportInsight {
	out := make([]AnnualReportInsight, 0, 5)
	if r.Summary.NetIncome >= 0 {
		out = append(out, AnnualReportInsight{
			Key:    "net_positive",
			Params: map[string]interface{}{"amount": r.Summary.NetIncome},
		})
	} else {
		out = append(out, AnnualReportInsight{
			Key:    "net_negative",
			Params: map[string]interface{}{"amount": r.Summary.NetIncome},
		})
	}
	if r.Compare != nil && r.Compare.DeltaIncome != 0 {
		pct := 0.0
		if r.Compare.PctIncome != nil {
			pct = math.Abs(*r.Compare.PctIncome)
		}
		key := "yoy_income_up"
		if r.Compare.DeltaIncome < 0 {
			key = "yoy_income_down"
		}
		out = append(out, AnnualReportInsight{
			Key: key,
			Params: map[string]interface{}{
				"pct":       pct,
				"prev_year": r.Compare.PrevYear,
			},
		})
	}
	if len(r.ByTag.ExpenseByAmount) > 0 {
		topTag := r.ByTag.ExpenseByAmount[0]
		if topTag.TagName != "" {
			out = append(out, AnnualReportInsight{
				Key: "top_expense_tag",
				Params: map[string]interface{}{
					"tag":    topTag.TagName,
					"amount": topTag.TotalExpense,
				},
			})
		}
	}
	var largest *AnnualReportTopTx
	if len(r.TopTransactions.Expense) > 0 {
		largest = &r.TopTransactions.Expense[0]
	}
	if len(r.TopTransactions.Income) > 0 {
		inc := &r.TopTransactions.Income[0]
		if largest == nil || inc.Amount > largest.Amount {
			largest = inc
		}
	}
	if largest != nil {
		out = append(out, AnnualReportInsight{
			Key: "largest_tx",
			Params: map[string]interface{}{
				"amount": largest.Amount,
				"date":   largest.TransactionDate,
			},
		})
	}
	if r.Summary.TotalExpense > r.Summary.TotalIncome {
		out = append(out, AnnualReportInsight{Key: "expense_over_income"})
	}
	return out
}
