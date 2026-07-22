package service

import (
	"database/sql"
	"math"

	"github.com/minibill/minibill/internal/domain"
)

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

type AnnualReportTopTx struct {
	ID              int64    `json:"id"`
	Amount          int64    `json:"amount"`
	Type            string   `json:"type"`
	TransactionDate string   `json:"transaction_date"`
	Note            string   `json:"note"`
	Tags            []string `json:"tags"`
}

type AnnualReportContactStat struct {
	ContactID    int64  `json:"contact_id"`
	ContactName  string `json:"contact_name"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	NetIncome    int64  `json:"net_income"`
	TxCount      int64  `json:"tx_count"`
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
	Year            int                       `json:"year"`
	Summary         AnnualReportSummary       `json:"summary"`
	ByTag           []AnnualReportTagStat     `json:"by_tag"`
	TopTransactions []AnnualReportTopTx       `json:"top_transactions"`
	TopContacts     []AnnualReportContactStat `json:"top_contacts"`
	Compare         *AnnualReportCompare      `json:"compare"`
	Insights        []AnnualReportInsight     `json:"insights"`
}

// DefaultAnnualReportYear returns the previous calendar year, or the current year
// when all 12 months have a registered monthly balance.
func (s *StatsService) DefaultAnnualReportYear(db *sql.DB) (int, error) {
	y := s.now().Year()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM monthly_balances WHERE year = ?`, y).Scan(&n); err != nil {
		return 0, err
	}
	if n >= 12 {
		return y, nil
	}
	return y - 1, nil
}

func (s *StatsService) AnnualReport(db *sql.DB, year int) (*AnnualReport, error) {
	if year < 2000 || year > 2100 {
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

func (s *StatsService) annualByTag(db *sql.DB, year int) ([]AnnualReportTagStat, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT g.id, g.name,
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COUNT(DISTINCT t.id)
		FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		JOIN tags g ON g.id = tt.tag_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		  AND (g.preset_key IS NULL OR g.preset_key != ?)
		GROUP BY g.id
		ORDER BY 5 DESC, g.name ASC`,
		start, end, domain.DailyExpensePresetKey,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AnnualReportTagStat, 0)
	for rows.Next() {
		var item AnnualReportTagStat
		var id int64
		if err := rows.Scan(&id, &item.TagName, &item.TotalIncome, &item.TotalExpense, &item.TxCount); err != nil {
			return nil, err
		}
		item.TagID = &id
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *StatsService) annualTopTransactions(db *sql.DB, year int) ([]AnnualReportTopTx, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT t.id, t.amount, t.type, t.transaction_date, t.note
		FROM transactions t
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		ORDER BY t.amount DESC, t.transaction_date DESC, t.id DESC
		LIMIT 5`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AnnualReportTopTx, 0, 5)
	ids := make([]int64, 0, 5)
	for rows.Next() {
		var item AnnualReportTopTx
		if err := rows.Scan(&item.ID, &item.Amount, &item.Type, &item.TransactionDate, &item.Note); err != nil {
			return nil, err
		}
		item.Tags = []string{}
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
			out[i].Tags = append(out[i].Tags, tag.Name)
		}
	}
	return out, nil
}

func (s *StatsService) annualTopContacts(db *sql.DB, year int) ([]AnnualReportContactStat, error) {
	start, end := yearRange(year)
	rows, err := db.Query(`
		SELECT c.id, c.name,
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0),
		       COUNT(*)
		FROM transactions t
		JOIN contacts c ON c.id = t.contact_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		GROUP BY c.id
		ORDER BY (COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0)
		        + COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0)) DESC,
		         c.name ASC
		LIMIT 5`, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]AnnualReportContactStat, 0, 5)
	for rows.Next() {
		var item AnnualReportContactStat
		if err := rows.Scan(&item.ContactID, &item.ContactName, &item.TotalIncome, &item.TotalExpense, &item.TxCount); err != nil {
			return nil, err
		}
		item.NetIncome = item.TotalIncome - item.TotalExpense
		out = append(out, item)
	}
	return out, rows.Err()
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
	var topTag *AnnualReportTagStat
	for i := range r.ByTag {
		if r.ByTag[i].TotalExpense <= 0 {
			continue
		}
		if topTag == nil || r.ByTag[i].TotalExpense > topTag.TotalExpense {
			topTag = &r.ByTag[i]
		}
	}
	if topTag != nil && topTag.TagName != "" {
		out = append(out, AnnualReportInsight{
			Key: "top_expense_tag",
			Params: map[string]interface{}{
				"tag":    topTag.TagName,
				"amount": topTag.TotalExpense,
			},
		})
	}
	if len(r.TopTransactions) > 0 {
		tx := r.TopTransactions[0]
		out = append(out, AnnualReportInsight{
			Key: "largest_tx",
			Params: map[string]interface{}{
				"amount": tx.Amount,
				"date":   tx.TransactionDate,
			},
		})
	}
	if r.Summary.TotalExpense > r.Summary.TotalIncome {
		out = append(out, AnnualReportInsight{Key: "expense_over_income"})
	}
	return out
}
