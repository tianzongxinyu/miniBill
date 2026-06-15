package domain

import (
	"fmt"
	"time"
)

type YearMonth struct {
	Year  int `json:"year"`
	Month int `json:"month"`
}

func (ym YearMonth) String() string {
	return fmt.Sprintf("%04d-%02d", ym.Year, ym.Month)
}

func EditableMonths(now time.Time) (curr, prev YearMonth) {
	loc := now.Location()
	t := now.In(loc)
	y, m, _ := t.Date()
	curr = YearMonth{Year: y, Month: int(m)}
	prevTime := time.Date(y, m, 1, 0, 0, 0, 0, loc).AddDate(0, -1, 0)
	py, pm, _ := prevTime.Date()
	prev = YearMonth{Year: py, Month: int(pm)}
	return
}

func MonthOfDate(date string) (YearMonth, error) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return YearMonth{}, fmt.Errorf("invalid date: %w", err)
	}
	y, m, _ := t.Date()
	return YearMonth{Year: y, Month: int(m)}, nil
}

func EditableDateRange(now time.Time) (min, max string) {
	loc := now.Location()
	return "", now.In(loc).Format("2006-01-02")
}

func IsDateNotAfterToday(date string, now time.Time) bool {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return false
	}
	loc := now.Location()
	today := now.In(loc)
	ty, tm, td := today.Date()
	todayStart := time.Date(ty, tm, td, 0, 0, 0, 0, loc)
	dy, dm, dd := t.In(loc).Date()
	d := time.Date(dy, dm, dd, 0, 0, 0, 0, loc)
	return !d.After(todayStart)
}

func PrevMonth(ym YearMonth) YearMonth {
	t := time.Date(ym.Year, time.Month(ym.Month), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -1, 0)
	y, m, _ := t.Date()
	return YearMonth{Year: y, Month: int(m)}
}

func NextMonth(ym YearMonth) YearMonth {
	t := time.Date(ym.Year, time.Month(ym.Month), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0)
	y, m, _ := t.Date()
	return YearMonth{Year: y, Month: int(m)}
}

const DailyExpenseTagName = "日常支出"

// 系统预设标签须与 userdb.PresetTags 保持一致。

func HasDailyExpenseTag(tagNames []string) bool {
	for _, n := range tagNames {
		if n == DailyExpenseTagName {
			return true
		}
	}
	return false
}

func IsSelectableTag(name string) bool {
	return name != DailyExpenseTagName
}

func LastDayOfMonth(year, month int) string {
	t := time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC)
	return t.Format("2006-01-02")
}
