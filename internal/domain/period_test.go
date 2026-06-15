package domain

import (
	"testing"
	"time"
)

func TestEditableDateRange(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 6, 12, 10, 0, 0, 0, loc)
	min, max := EditableDateRange(now)
	if min != "" {
		t.Fatalf("min = %q, want empty", min)
	}
	if max != "2026-06-12" {
		t.Fatalf("max = %q, want 2026-06-12", max)
	}
}

func TestIsDateNotAfterToday(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 6, 12, 10, 0, 0, 0, loc)
	if !IsDateNotAfterToday("2026-06-12", now) {
		t.Error("today should be allowed")
	}
	if !IsDateNotAfterToday("2020-01-01", now) {
		t.Error("past date should be allowed")
	}
	if IsDateNotAfterToday("2026-06-13", now) {
		t.Error("future date should be rejected")
	}
}

func TestEditableMonthsJanuary(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	now := time.Date(2026, 1, 15, 0, 0, 0, 0, loc)
	curr, prev := EditableMonths(now)
	if curr.Year != 2026 || curr.Month != 1 {
		t.Fatalf("curr = %+v", curr)
	}
	if prev.Year != 2025 || prev.Month != 12 {
		t.Fatalf("prev = %+v", prev)
	}
}

func TestPrevMonth(t *testing.T) {
	if ym := PrevMonth(YearMonth{2026, 6}); ym.Year != 2026 || ym.Month != 5 {
		t.Fatalf("got %+v", ym)
	}
	if ym := PrevMonth(YearMonth{2026, 1}); ym.Year != 2025 || ym.Month != 12 {
		t.Fatalf("got %+v", ym)
	}
}
