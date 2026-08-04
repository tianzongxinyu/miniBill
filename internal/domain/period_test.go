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

func TestMaxRegisterableBalanceMonth(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")

	before := time.Date(2026, 8, 24, 23, 0, 0, 0, loc)
	maxBefore := MaxRegisterableBalanceMonth(before)
	if maxBefore.Year != 2026 || maxBefore.Month != 7 {
		t.Fatalf("day 24: max = %+v, want 2026-07", maxBefore)
	}

	open := time.Date(2026, 8, 25, 0, 0, 0, 0, loc)
	maxOpen := MaxRegisterableBalanceMonth(open)
	if maxOpen.Year != 2026 || maxOpen.Month != 8 {
		t.Fatalf("day 25: max = %+v, want 2026-08", maxOpen)
	}

	janEarly := time.Date(2026, 1, 10, 12, 0, 0, 0, loc)
	maxJan := MaxRegisterableBalanceMonth(janEarly)
	if maxJan.Year != 2025 || maxJan.Month != 12 {
		t.Fatalf("Jan 10: max = %+v, want 2025-12", maxJan)
	}
}

func TestCanRegisterBalanceMonth(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	day24 := time.Date(2026, 8, 24, 12, 0, 0, 0, loc)
	if CanRegisterBalanceMonth(2026, 8, day24) {
		t.Error("current month should be closed on day 24")
	}
	if !CanRegisterBalanceMonth(2026, 7, day24) {
		t.Error("previous month should be open on day 24")
	}
	if !CanRegisterBalanceMonth(2026, 6, day24) {
		t.Error("older months should remain open")
	}

	day25 := time.Date(2026, 8, 25, 12, 0, 0, 0, loc)
	if !CanRegisterBalanceMonth(2026, 8, day25) {
		t.Error("current month should be open on day 25")
	}
	if CanRegisterBalanceMonth(2026, 9, day25) {
		t.Error("future month should be rejected")
	}
}
