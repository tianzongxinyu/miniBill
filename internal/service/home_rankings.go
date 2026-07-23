package service

import (
	"database/sql"
	"fmt"

	"github.com/minibill/minibill/internal/domain"
)

type HomeRankingMonth struct {
	Year  int `json:"year"`
	Month int `json:"month"`
}

type HomeRankingPoint struct {
	Year         int   `json:"year"`
	Month        int   `json:"month"`
	TotalIncome  int64 `json:"total_income"`
	TotalExpense int64 `json:"total_expense"`
}

type HomeRankingTag struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	ColorBg      string `json:"color_bg"`
	UseCount     int64  `json:"use_count"`
	TotalIncome  int64  `json:"total_income"`
	TotalExpense int64  `json:"total_expense"`
}

type HomeRankingContact struct {
	ID       int64              `json:"id"`
	Name     string             `json:"name"`
	UseCount int64              `json:"use_count"`
	Points   []HomeRankingPoint `json:"points"`
}

type HomeRankings struct {
	Months   []HomeRankingMonth   `json:"months"`
	Tags     []HomeRankingTag     `json:"tags"`
	Contacts []HomeRankingContact `json:"contacts"`
}

type rankingSeed struct {
	ID           int64
	Name         string
	ColorBg      string
	UseCount     int64
	TotalIncome  int64
	TotalExpense int64
}

// rollingWindowMonths returns the last `months` calendar months including current, oldest first.
func (s *StatsService) rollingWindowMonths(months int) []HomeRankingMonth {
	if months < 1 {
		months = 6
	}
	if months > 24 {
		months = 24
	}
	now := s.now()
	curr := domain.YearMonth{Year: now.Year(), Month: int(now.Month())}
	out := make([]HomeRankingMonth, months)
	ym := curr
	for i := months - 1; i >= 0; i-- {
		out[i] = HomeRankingMonth{Year: ym.Year, Month: ym.Month}
		ym = domain.PrevMonth(ym)
	}
	return out
}

func (s *StatsService) rollingWindowRange(months int) (start, end string) {
	ms := s.rollingWindowMonths(months)
	if len(ms) == 0 {
		return s.rollingWindowRange(6)
	}
	start, _ = monthRange(ms[0].Year, ms[0].Month)
	last := ms[len(ms)-1]
	_, end = monthRange(last.Year, last.Month)
	return start, end
}

func zeroPoints(months []HomeRankingMonth) []HomeRankingPoint {
	pts := make([]HomeRankingPoint, len(months))
	for i, m := range months {
		pts[i] = HomeRankingPoint{Year: m.Year, Month: m.Month}
	}
	return pts
}

func (s *StatsService) HomeRankings(db *sql.DB, months int) (*HomeRankings, error) {
	monthList := s.rollingWindowMonths(months)
	start, end := s.rollingWindowRange(months)

	tagSeeds, err := s.homeTopTagSeeds(db, start, end, 5)
	if err != nil {
		return nil, err
	}
	contactSeeds, err := s.homeTopContactSeeds(db, start, end, 5)
	if err != nil {
		return nil, err
	}

	tags := make([]HomeRankingTag, 0, len(tagSeeds))
	for _, seed := range tagSeeds {
		tags = append(tags, HomeRankingTag{
			ID: seed.ID, Name: seed.Name, ColorBg: seed.ColorBg, UseCount: seed.UseCount,
			TotalIncome: seed.TotalIncome, TotalExpense: seed.TotalExpense,
		})
	}

	contacts := make([]HomeRankingContact, 0, len(contactSeeds))
	for _, seed := range contactSeeds {
		pts, err := s.homeContactMonthPoints(db, seed.ID, start, end, monthList)
		if err != nil {
			return nil, err
		}
		contacts = append(contacts, HomeRankingContact{
			ID: seed.ID, Name: seed.Name, UseCount: seed.UseCount, Points: pts,
		})
	}

	return &HomeRankings{
		Months:   monthList,
		Tags:     tags,
		Contacts: contacts,
	}, nil
}

func (s *StatsService) homeTopTagSeeds(db *sql.DB, start, end string, limit int) ([]rankingSeed, error) {
	rows, err := db.Query(`
		SELECT g.id, g.name, g.color_bg, COUNT(*) AS use_count,
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		JOIN transaction_tags tt ON tt.transaction_id = t.id
		JOIN tags g ON g.id = tt.tag_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		  AND (g.preset_key IS NULL OR g.preset_key != ?)
		GROUP BY g.id
		HAVING COUNT(*) > 0
		ORDER BY use_count DESC, g.name ASC
		LIMIT ?`,
		start, end, domain.DailyExpensePresetKey, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]rankingSeed, 0, limit)
	for rows.Next() {
		var item rankingSeed
		if err := rows.Scan(
			&item.ID, &item.Name, &item.ColorBg, &item.UseCount,
			&item.TotalIncome, &item.TotalExpense,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *StatsService) homeTopContactSeeds(db *sql.DB, start, end string, limit int) ([]rankingSeed, error) {
	rows, err := db.Query(`
		SELECT c.id, c.name, COUNT(*) AS use_count
		FROM transactions t
		JOIN contacts c ON c.id = t.contact_id
		WHERE t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		GROUP BY c.id
		HAVING COUNT(*) > 0
		ORDER BY use_count DESC, c.name ASC
		LIMIT ?`,
		start, end, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]rankingSeed, 0, limit)
	for rows.Next() {
		var item rankingSeed
		if err := rows.Scan(&item.ID, &item.Name, &item.UseCount); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (s *StatsService) homeContactMonthPoints(
	db *sql.DB, contactID int64, start, end string, months []HomeRankingMonth,
) ([]HomeRankingPoint, error) {
	rows, err := db.Query(`
		SELECT CAST(strftime('%Y', t.transaction_date) AS INTEGER),
		       CAST(strftime('%m', t.transaction_date) AS INTEGER),
		       COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0)
		FROM transactions t
		WHERE t.contact_id = ?
		  AND t.transaction_date >= ? AND t.transaction_date < ?
		  AND t.is_system = 0
		GROUP BY 1, 2`,
		contactID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return fillMonthPoints(rows, months)
}

func fillMonthPoints(rows *sql.Rows, months []HomeRankingMonth) ([]HomeRankingPoint, error) {
	byKey := make(map[string]HomeRankingPoint)
	for rows.Next() {
		var p HomeRankingPoint
		if err := rows.Scan(&p.Year, &p.Month, &p.TotalIncome, &p.TotalExpense); err != nil {
			return nil, err
		}
		byKey[fmt.Sprintf("%04d-%02d", p.Year, p.Month)] = p
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := zeroPoints(months)
	for i, m := range months {
		key := fmt.Sprintf("%04d-%02d", m.Year, m.Month)
		if p, ok := byKey[key]; ok {
			out[i] = p
		}
	}
	return out, nil
}
