package service

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/minibill/minibill/internal/domain"
)

type StatsService struct {
	now func() time.Time
}

func NewStatsService() *StatsService {
	return &StatsService{now: time.Now}
}

func (s *StatsService) WithNow(fn func() time.Time) *StatsService {
	s.now = fn
	return s
}

func (s *StatsService) RecalcStatMonth(db *sql.DB, year, month int) error {
	return s.syncDailyExpenseForMonth(db, year, month)
}

func (s *StatsService) calcDailyExpense(db *sql.DB, year, month int, income, expense, currBalance int64) (*int64, error) {
	prev := domain.PrevMonth(domain.YearMonth{Year: year, Month: month})

	prevBalance, err := loadMonthlyBalance(db, prev.Year, prev.Month)
	if err != nil {
		return nil, err
	}
	if !prevBalance.Valid {
		return nil, nil
	}
	v := prevBalance.Int64 + income - expense - currBalance
	return &v, nil
}

func (s *StatsService) RecalcAfterTransaction(db *sql.DB, dates ...string) error {
	return s.syncAfterTransaction(db, dates...)
}

func (s *StatsService) RecalcAfterBalance(db *sql.DB, year, month int) error {
	return s.syncAfterBalance(db, year, month)
}

type MonthBillSummary struct {
	Year         int    `json:"year"`
	Month        int    `json:"month"`
	StartBalance *int64 `json:"start_balance"`
	EndBalance   *int64 `json:"end_balance"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	NetIncome    int64  `json:"net_income"`
}

type ThisMonthSummary struct {
	Year         int   `json:"year"`
	Month        int   `json:"month"`
	TotalIncome  int64 `json:"total_income"`
	TotalExpense int64 `json:"total_expense"`
}

type Dashboard struct {
	LastMonth MonthBillSummary `json:"last_month"`
	ThisMonth ThisMonthSummary `json:"this_month"`
}

// monthNetIncome：有月初、月末登记余额时用余额变动（= 收入 - 支出 - 日常支出），否则用流水扎差。
func monthNetIncome(totalIncome, totalExpense int64, startBalance, endBalance *int64) int64 {
	if startBalance != nil && endBalance != nil {
		return *endBalance - *startBalance
	}
	return totalIncome - totalExpense
}

func (s *StatsService) statMonthlyExists(db *sql.DB, year, month int) (bool, error) {
	var n int
	err := db.QueryRow(`SELECT COUNT(*) FROM stat_monthly WHERE year = ? AND month = ?`, year, month).Scan(&n)
	return n > 0, err
}

func (s *StatsService) ensureStatMonthIfMissing(db *sql.DB, year, month int) error {
	ok, err := s.statMonthlyExists(db, year, month)
	if err != nil || ok {
		return err
	}
	return s.RecalcStatMonth(db, year, month)
}

func (s *StatsService) monthBillSummary(db *sql.DB, year, month int) (MonthBillSummary, error) {
	if err := s.ensureStatMonthIfMissing(db, year, month); err != nil {
		return MonthBillSummary{}, err
	}
	item := MonthBillSummary{Year: year, Month: month}
	err := db.QueryRow(
		`SELECT total_income, total_expense FROM stat_monthly WHERE year = ? AND month = ?`,
		year, month,
	).Scan(&item.TotalIncome, &item.TotalExpense)
	if err != nil && err != sql.ErrNoRows {
		return MonthBillSummary{}, err
	}

	var endBal int64
	err = db.QueryRow(
		`SELECT balance FROM monthly_balances WHERE year = ? AND month = ?`,
		year, month,
	).Scan(&endBal)
	if err == nil {
		item.EndBalance = &endBal
	} else if err != sql.ErrNoRows {
		return MonthBillSummary{}, err
	}

	prev := domain.PrevMonth(domain.YearMonth{Year: year, Month: month})
	var startBal int64
	err = db.QueryRow(
		`SELECT balance FROM monthly_balances WHERE year = ? AND month = ?`,
		prev.Year, prev.Month,
	).Scan(&startBal)
	if err == nil {
		item.StartBalance = &startBal
	} else if err != sql.ErrNoRows {
		return MonthBillSummary{}, err
	}
	item.NetIncome = monthNetIncome(item.TotalIncome, item.TotalExpense, item.StartBalance, item.EndBalance)
	return item, nil
}

func (s *StatsService) Dashboard(db *sql.DB) (*Dashboard, error) {
	now := s.now()
	curr, prev := domain.EditableMonths(now)
	d := &Dashboard{}

	last, err := s.monthBillSummary(db, prev.Year, prev.Month)
	if err != nil {
		return nil, err
	}
	d.LastMonth = last

	p, err := s.computeMonthStat(db, curr, StatsFilter{})
	if err != nil {
		return nil, err
	}
	d.ThisMonth = ThisMonthSummary{
		Year: curr.Year, Month: curr.Month,
		TotalIncome: p.TotalIncome, TotalExpense: p.TotalExpense,
	}
	return d, nil
}

type MonthBillItem struct {
	Year         int    `json:"year"`
	Month        int    `json:"month"`
	IsCurrent    bool   `json:"is_current"`
	Balance      *int64 `json:"balance,omitempty"`
	NetIncome    *int64 `json:"net_income,omitempty"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	DailyExpense *int64 `json:"daily_expense,omitempty"`
}

type MonthBillsPage struct {
	Items      []MonthBillItem `json:"items"`
	NextCursor *string         `json:"next_cursor"`
	HasMore    bool            `json:"has_more"`
}

func (s *StatsService) EarliestMonth(db *sql.DB) (*domain.YearMonth, error) {
	var minYM sql.NullInt64
	err := db.QueryRow(`
		SELECT MIN(ym) FROM (
			SELECT year * 100 + month AS ym FROM stat_monthly
			UNION ALL SELECT year * 100 + month FROM monthly_balances
			UNION ALL SELECT CAST(strftime('%Y', transaction_date) AS INTEGER) * 100
			            + CAST(strftime('%m', transaction_date) AS INTEGER) FROM transactions
		)`).Scan(&minYM)
	if err != nil {
		return nil, err
	}
	if !minYM.Valid || minYM.Int64 <= 0 {
		return nil, nil
	}
	v := int(minYM.Int64)
	return &domain.YearMonth{Year: v / 100, Month: v % 100}, nil
}

func (s *StatsService) MonthBills(db *sql.DB, cursor *domain.YearMonth, limit int) (*MonthBillsPage, error) {
	if limit <= 0 {
		limit = 5
	}
	if limit > 12 {
		limit = 12
	}

	now := s.now()
	y, m, _ := now.Date()
	current := domain.YearMonth{Year: y, Month: int(m)}

	start := current
	if cursor != nil {
		start = domain.PrevMonth(*cursor)
	}

	earliest, err := s.EarliestMonth(db)
	if err != nil {
		return nil, err
	}

	page := &MonthBillsPage{Items: []MonthBillItem{}}
	ym := start
	for len(page.Items) < limit {
		if earliest != nil && compareYM(ym, *earliest) < 0 {
			break
		}
		item, err := s.buildMonthBillItem(db, ym.Year, ym.Month, ym == current)
		if err != nil {
			return nil, err
		}
		page.Items = append(page.Items, item)
		if earliest != nil && ym == *earliest {
			break
		}
		ym = domain.PrevMonth(ym)
	}

	if len(page.Items) == 0 {
		return page, nil
	}

	oldest := page.Items[len(page.Items)-1]
	oldestYM := domain.YearMonth{Year: oldest.Year, Month: oldest.Month}
	if earliest == nil || compareYM(*earliest, oldestYM) < 0 {
		page.HasMore = true
		c := fmt.Sprintf("%04d-%02d", oldest.Year, oldest.Month)
		page.NextCursor = &c
	}
	return page, nil
}

func (s *StatsService) buildMonthBillItem(db *sql.DB, year, month int, isCurrent bool) (MonthBillItem, error) {
	item := MonthBillItem{Year: year, Month: month, IsCurrent: isCurrent}
	if isCurrent {
		p, err := s.computeMonthStat(db, domain.YearMonth{Year: year, Month: month}, StatsFilter{})
		if err != nil {
			return MonthBillItem{}, err
		}
		item.TotalIncome, item.TotalExpense = p.TotalIncome, p.TotalExpense
		item.Balance = p.RegisteredBalance
		item.DailyExpense = p.DailyExpense
		net := monthNetIncome(item.TotalIncome, item.TotalExpense, p.StartBalance, item.Balance)
		item.NetIncome = &net
		return item, nil
	}
	if err := s.ensureStatMonthIfMissing(db, year, month); err != nil {
		return MonthBillItem{}, err
	}
	var daily sql.NullInt64
	err := db.QueryRow(
		`SELECT total_income, total_expense, daily_expense FROM stat_monthly WHERE year = ? AND month = ?`,
		year, month,
	).Scan(&item.TotalIncome, &item.TotalExpense, &daily)
	if err != nil && err != sql.ErrNoRows {
		return MonthBillItem{}, err
	}
	if !isCurrent {
		var bal int64
		err = db.QueryRow(
			`SELECT balance FROM monthly_balances WHERE year = ? AND month = ?`,
			year, month,
		).Scan(&bal)
		if err == nil {
			item.Balance = &bal
		} else if err != sql.ErrNoRows {
			return MonthBillItem{}, err
		}
		if daily.Valid {
			item.DailyExpense = &daily.Int64
		}
	}
	var startBal *int64
	if item.Balance != nil {
		prev := domain.PrevMonth(domain.YearMonth{Year: year, Month: month})
		var sb int64
		err = db.QueryRow(
			`SELECT balance FROM monthly_balances WHERE year = ? AND month = ?`,
			prev.Year, prev.Month,
		).Scan(&sb)
		if err == nil {
			startBal = &sb
		} else if err != sql.ErrNoRows {
			return MonthBillItem{}, err
		}
	}
	net := monthNetIncome(item.TotalIncome, item.TotalExpense, startBal, item.Balance)
	item.NetIncome = &net
	return item, nil
}

func (s *StatsService) MonthBill(db *sql.DB, year, month int) (MonthBillItem, error) {
	now := s.now()
	y, m, _ := now.Date()
	current := domain.YearMonth{Year: y, Month: int(m)}
	isCurrent := year == current.Year && month == current.Month
	return s.buildMonthBillItem(db, year, month, isCurrent)
}

func compareYM(a, b domain.YearMonth) int {
	if a.Year != b.Year {
		return a.Year - b.Year
	}
	return a.Month - b.Month
}

type MonthlyStatItem struct {
	Month             int    `json:"month"`
	TotalIncome       int64  `json:"total_income"`
	TotalExpense      int64  `json:"total_expense"`
	DailyExpense      *int64 `json:"daily_expense"`
	RegisteredBalance *int64 `json:"registered_balance"`
}

type StatsFilter struct {
	TagIDs    []int64
	ContactID *int64
	NoteQuery string
}

func (f StatsFilter) HasFilter() bool {
	if strings.TrimSpace(f.NoteQuery) != "" || f.ContactID != nil {
		return true
	}
	return len(f.TagIDs) > 0
}

func statsFilterSQL(filter StatsFilter) (string, []interface{}) {
	return noteTagContactFilterSQL(filter.NoteQuery, filter.TagIDs, filter.ContactID)
}

func (s *StatsService) sumTransactionsRange(db *sql.DB, start, end string, filter StatsFilter) (income, expense int64, err error) {
	q := `
		SELECT COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		WHERE t.transaction_date >= ? AND t.transaction_date < ?`
	args := []interface{}{start, end}
	if filter.HasFilter() {
		where, filterArgs := statsFilterSQL(filter)
		if where != "" {
			q += " AND " + where
			args = append(args, filterArgs...)
		}
	} else {
		q += " AND " + excludeDailyExpenseTagSQL("t")
		args = append(args, domain.DailyExpensePresetKey)
	}
	err = db.QueryRow(q, args...).Scan(&income, &expense)
	return income, expense, err
}

func (s *StatsService) computeMonthStat(db *sql.DB, ym domain.YearMonth, filter StatsFilter) (MonthlyStatPoint, error) {
	item := MonthlyStatPoint{Year: ym.Year, Month: ym.Month}
	start, end := monthRange(ym.Year, ym.Month)
	ti, te, err := s.sumTransactionsRange(db, start, end, filter)
	if err != nil {
		return item, err
	}
	item.TotalIncome, item.TotalExpense = ti, te
	if filter.HasFilter() {
		return item, nil
	}
	registeredBalance, err := loadMonthlyBalance(db, ym.Year, ym.Month)
	if err != nil {
		return item, err
	}
	if registeredBalance.Valid {
		item.RegisteredBalance = &registeredBalance.Int64
		de, err := s.calcDailyExpense(db, ym.Year, ym.Month, ti, te, registeredBalance.Int64)
		if err != nil {
			return item, err
		}
		if de != nil {
			item.DailyExpense = de
		}
	}
	startBal, err := loadPrevMonthBalance(db, ym)
	if err != nil {
		return item, err
	}
	item.StartBalance = startBal
	return item, nil
}

func (s *StatsService) MonthlyStats(db *sql.DB, year int, filter StatsFilter) ([]MonthlyStatItem, error) {
	items := make([]MonthlyStatItem, 12)
	filtered := filter.HasFilter()
	if filtered {
		for m := 1; m <= 12; m++ {
			item := MonthlyStatItem{Month: m}
			start, end := monthRange(year, m)
			ti, te, err := s.sumTransactionsRange(db, start, end, filter)
			if err != nil {
				return nil, err
			}
			item.TotalIncome, item.TotalExpense = ti, te
			items[m-1] = item
		}
		return items, nil
	}

	rows, err := db.Query(`
		SELECT month, total_income, total_expense, registered_balance, daily_expense
		FROM stat_monthly WHERE year = ? ORDER BY month`, year)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var m int
		var ti, te int64
		var reg, daily sql.NullInt64
		if err := rows.Scan(&m, &ti, &te, &reg, &daily); err != nil {
			return nil, err
		}
		if m < 1 || m > 12 {
			continue
		}
		item := MonthlyStatItem{Month: m, TotalIncome: ti, TotalExpense: te}
		if reg.Valid {
			item.RegisteredBalance = &reg.Int64
		}
		if daily.Valid {
			item.DailyExpense = &daily.Int64
		}
		items[m-1] = item
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

type YearlyStatItem struct {
	Year         int    `json:"year"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
	DailyExpense *int64 `json:"daily_expense"`
	StartBalance *int64 `json:"start_balance,omitempty"`
	EndBalance   *int64 `json:"end_balance"`
}

func (s *StatsService) YearlyStats(db *sql.DB, filter StatsFilter) ([]YearlyStatItem, error) {
	if filter.HasFilter() {
		where, filterArgs := statsFilterSQL(filter)
		rows, err := db.Query(fmt.Sprintf(`
			SELECT CAST(strftime('%%Y', t.transaction_date) AS INTEGER),
			       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
			       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0)
			FROM transactions t WHERE %s
			GROUP BY 1 ORDER BY 1`, where), filterArgs...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var items []YearlyStatItem
		for rows.Next() {
			var item YearlyStatItem
			if err := rows.Scan(&item.Year, &item.TotalIncome, &item.TotalExpense); err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		return items, nil
	}

	rows, err := db.Query(`SELECT DISTINCT year FROM stat_monthly UNION SELECT DISTINCT year FROM monthly_balances ORDER BY year`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var years []int
	for rows.Next() {
		var y int
		if err := rows.Scan(&y); err != nil {
			return nil, err
		}
		years = append(years, y)
	}
	var items []YearlyStatItem
	for _, y := range years {
		item, err := s.YearStat(db, y, filter)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, nil
}

func (s *StatsService) YearStat(db *sql.DB, year int, filter StatsFilter) (*YearlyStatItem, error) {
	if filter.HasFilter() {
		start, end := yearRange(year)
		item := &YearlyStatItem{Year: year}
		ti, te, err := s.sumTransactionsRange(db, start, end, filter)
		if err != nil {
			return nil, err
		}
		item.TotalIncome, item.TotalExpense = ti, te
		return item, nil
	}

	if year == s.currentYearMonth().Year {
		start, end := yearRange(year)
		item := &YearlyStatItem{Year: year}
		ti, te, err := s.sumTransactionsRange(db, start, end, StatsFilter{})
		if err != nil {
			return nil, err
		}
		item.TotalIncome, item.TotalExpense = ti, te
		startBal, err := loadPriorDecemberBalance(db, year)
		if err != nil {
			return nil, err
		}
		item.StartBalance = startBal
		var endBal int64
		err = db.QueryRow(
			`SELECT balance FROM monthly_balances WHERE year = ? ORDER BY month DESC LIMIT 1`, year,
		).Scan(&endBal)
		if err == nil {
			item.EndBalance = &endBal
		} else if err != sql.ErrNoRows {
			return nil, err
		}
		return item, nil
	}

	item := &YearlyStatItem{Year: year}
	var dailySum sql.NullInt64
	err := db.QueryRow(`
		SELECT COALESCE(SUM(total_income),0), COALESCE(SUM(total_expense),0),
		       SUM(daily_expense)
		FROM stat_monthly WHERE year = ?`, year,
	).Scan(&item.TotalIncome, &item.TotalExpense, &dailySum)
	if err != nil {
		return nil, err
	}
	if dailySum.Valid {
		item.DailyExpense = &dailySum.Int64
	}
	var endBal int64
	err = db.QueryRow(
		`SELECT balance FROM monthly_balances WHERE year = ? ORDER BY month DESC LIMIT 1`, year,
	).Scan(&endBal)
	if err == nil {
		item.EndBalance = &endBal
	} else if err != sql.ErrNoRows {
		return nil, err
	}
	return item, nil
}

type MonthlyStatPoint struct {
	Year              int    `json:"year"`
	Month             int    `json:"month"`
	TotalIncome       int64  `json:"total_income"`
	TotalExpense      int64  `json:"total_expense"`
	DailyExpense      *int64 `json:"daily_expense,omitempty"`
	StartBalance      *int64 `json:"start_balance,omitempty"`
	RegisteredBalance *int64 `json:"registered_balance,omitempty"`
}

type MonthSeriesPage struct {
	Items        []MonthlyStatPoint `json:"items"`
	OlderCursor  *string            `json:"older_cursor,omitempty"`
	HasMoreOlder bool               `json:"has_more_older"`
	HasMoreNewer bool               `json:"has_more_newer"`
}

type YearSeriesPage struct {
	Items        []YearlyStatItem `json:"items"`
	OlderCursor  *string          `json:"older_cursor,omitempty"`
	HasMoreOlder bool             `json:"has_more_older"`
	HasMoreNewer bool             `json:"has_more_newer"`
}

func (s *StatsService) currentYearMonth() domain.YearMonth {
	y, m, _ := s.now().Date()
	return domain.YearMonth{Year: y, Month: int(m)}
}

func (s *StatsService) earliestYear(db *sql.DB) (int, error) {
	earliest, err := s.EarliestMonth(db)
	if err != nil {
		return 0, err
	}
	if earliest == nil {
		return 0, nil
	}
	return earliest.Year, nil
}

func reverseMonthlyPoints(items []MonthlyStatPoint) []MonthlyStatPoint {
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
	return items
}

func (s *StatsService) statForMonth(db *sql.DB, ym domain.YearMonth, filter StatsFilter) (MonthlyStatPoint, error) {
	current := s.currentYearMonth()
	if filter.HasFilter() || ym == current {
		return s.computeMonthStat(db, ym, filter)
	}
	if err := s.ensureStatMonthIfMissing(db, ym.Year, ym.Month); err != nil {
		return MonthlyStatPoint{}, err
	}
	item := MonthlyStatPoint{Year: ym.Year, Month: ym.Month}
	var daily, reg sql.NullInt64
	var ti, te int64
	err := db.QueryRow(`
		SELECT total_income, total_expense, registered_balance, daily_expense
		FROM stat_monthly WHERE year = ? AND month = ?`, ym.Year, ym.Month,
	).Scan(&ti, &te, &reg, &daily)
	if err != nil && err != sql.ErrNoRows {
		return item, err
	}
	item.TotalIncome, item.TotalExpense = ti, te
	if reg.Valid {
		item.RegisteredBalance = &reg.Int64
	}
	if daily.Valid {
		item.DailyExpense = &daily.Int64
	}
	return item, nil
}

func (s *StatsService) collectMonthsBackward(
	db *sql.DB,
	start domain.YearMonth,
	limit int,
	earliest *domain.YearMonth,
	filter StatsFilter,
) ([]MonthlyStatPoint, error) {
	desc := make([]MonthlyStatPoint, 0, limit)
	ym := start
	for len(desc) < limit {
		if earliest != nil && compareYM(ym, *earliest) < 0 {
			break
		}
		p, err := s.statForMonth(db, ym, filter)
		if err != nil {
			return nil, err
		}
		desc = append(desc, p)
		if earliest != nil && ym == *earliest {
			break
		}
		ym = domain.PrevMonth(ym)
	}
	return reverseMonthlyPoints(desc), nil
}

func (s *StatsService) collectMonthsForward(
	db *sql.DB,
	start, end domain.YearMonth,
	limit int,
	filter StatsFilter,
) ([]MonthlyStatPoint, error) {
	items := make([]MonthlyStatPoint, 0, limit)
	ym := start
	for len(items) < limit && compareYM(ym, end) <= 0 {
		p, err := s.statForMonth(db, ym, filter)
		if err != nil {
			return nil, err
		}
		items = append(items, p)
		ym = domain.NextMonth(ym)
	}
	return items, nil
}

func (s *StatsService) finishMonthSeriesPage(
	page *MonthSeriesPage,
	earliest *domain.YearMonth,
	current domain.YearMonth,
) {
	if len(page.Items) == 0 {
		return
	}
	oldest := page.Items[0]
	oldestYM := domain.YearMonth{Year: oldest.Year, Month: oldest.Month}
	if earliest == nil || compareYM(*earliest, oldestYM) < 0 {
		page.HasMoreOlder = true
		c := oldestYM.String()
		page.OlderCursor = &c
	}
	newest := page.Items[len(page.Items)-1]
	newestYM := domain.YearMonth{Year: newest.Year, Month: newest.Month}
	page.HasMoreNewer = compareYM(newestYM, current) < 0
}

func (s *StatsService) MonthSeries(
	db *sql.DB,
	cursor, after *domain.YearMonth,
	limit int,
	filter StatsFilter,
) (*MonthSeriesPage, error) {
	if limit <= 0 {
		limit = 12
	}
	if limit > 24 {
		limit = 24
	}

	current := s.currentYearMonth()
	earliest, err := s.EarliestMonth(db)
	if err != nil {
		return nil, err
	}

	page := &MonthSeriesPage{Items: []MonthlyStatPoint{}}

	if after != nil {
		start := domain.NextMonth(*after)
		if compareYM(start, current) > 0 {
			return page, nil
		}
		items, err := s.collectMonthsForward(db, start, current, limit, filter)
		if err != nil {
			return nil, err
		}
		page.Items = items
		s.finishMonthSeriesPage(page, earliest, current)
		return page, nil
	}

	start := current
	if cursor != nil {
		start = domain.PrevMonth(*cursor)
	}
	items, err := s.collectMonthsBackward(db, start, limit, earliest, filter)
	if err != nil {
		return nil, err
	}
	page.Items = items
	s.finishMonthSeriesPage(page, earliest, current)
	return page, nil
}

func reverseYearlyItems(items []YearlyStatItem) []YearlyStatItem {
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
	return items
}

func (s *StatsService) collectYearsBackward(
	db *sql.DB,
	startYear, limit, earliestYear int,
	filter StatsFilter,
) ([]YearlyStatItem, error) {
	desc := make([]YearlyStatItem, 0, limit)
	y := startYear
	for len(desc) < limit {
		if earliestYear > 0 && y < earliestYear {
			break
		}
		item, err := s.YearStat(db, y, filter)
		if err != nil {
			return nil, err
		}
		desc = append(desc, *item)
		if earliestYear > 0 && y == earliestYear {
			break
		}
		y--
	}
	return reverseYearlyItems(desc), nil
}

func (s *StatsService) collectYearsForward(
	db *sql.DB,
	startYear, endYear, limit int,
	filter StatsFilter,
) ([]YearlyStatItem, error) {
	items := make([]YearlyStatItem, 0, limit)
	for y := startYear; y <= endYear && len(items) < limit; y++ {
		item, err := s.YearStat(db, y, filter)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, nil
}

func (s *StatsService) finishYearSeriesPage(page *YearSeriesPage, earliestYear, currentYear int) {
	if len(page.Items) == 0 {
		return
	}
	oldest := page.Items[0].Year
	if earliestYear == 0 || oldest > earliestYear {
		page.HasMoreOlder = true
		c := fmt.Sprintf("%04d", oldest)
		page.OlderCursor = &c
	}
	newest := page.Items[len(page.Items)-1].Year
	page.HasMoreNewer = newest < currentYear
}

func (s *StatsService) YearSeries(
	db *sql.DB,
	cursor, after *int,
	limit int,
	filter StatsFilter,
) (*YearSeriesPage, error) {
	if limit <= 0 {
		limit = 10
	}
	if limit > 20 {
		limit = 20
	}

	currentYear := s.currentYearMonth().Year
	earliestYear, err := s.earliestYear(db)
	if err != nil {
		return nil, err
	}

	page := &YearSeriesPage{Items: []YearlyStatItem{}}

	if after != nil {
		start := *after + 1
		if start > currentYear {
			return page, nil
		}
		items, err := s.collectYearsForward(db, start, currentYear, limit, filter)
		if err != nil {
			return nil, err
		}
		page.Items = items
		s.finishYearSeriesPage(page, earliestYear, currentYear)
		return page, nil
	}

	startYear := currentYear
	if cursor != nil {
		startYear = *cursor - 1
	}
	items, err := s.collectYearsBackward(db, startYear, limit, earliestYear, filter)
	if err != nil {
		return nil, err
	}
	page.Items = items
	s.finishYearSeriesPage(page, earliestYear, currentYear)
	return page, nil
}
