package service

import (
	"database/sql"
	"errors"
	"testing"

	"github.com/minibill/minibill/internal/i18n"
	_ "modernc.org/sqlite"
)

func TestSettingsAmountColorScheme(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.Exec(`
		CREATE TABLE settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			locale TEXT NOT NULL DEFAULT 'zh-Hans',
			default_currency TEXT NOT NULL DEFAULT 'CNY',
			default_date_mode TEXT NOT NULL DEFAULT 'today',
			amount_color_scheme TEXT NOT NULL DEFAULT 'red_up'
				CHECK (amount_color_scheme IN ('red_up', 'green_up')),
			theme TEXT NOT NULL DEFAULT 'light'
				CHECK (theme IN ('light', 'dark', 'system'))
		)`); err != nil {
		t.Fatal(err)
	}

	svc := &SettingsService{}

	st, err := svc.Get(db)
	if err != nil {
		t.Fatal(err)
	}
	if st.AmountColorScheme != AmountColorSchemeRedUp {
		t.Fatalf("default scheme = %q, want red_up", st.AmountColorScheme)
	}
	if st.Locale != i18n.DefaultLocale {
		t.Fatalf("default locale = %q, want %s", st.Locale, i18n.DefaultLocale)
	}
	if st.Theme != ThemeLight {
		t.Fatalf("default theme = %q, want light", st.Theme)
	}

	updated, err := svc.Update(db, Settings{
		Locale:            "en",
		DefaultDateMode:   "today",
		AmountColorScheme: AmountColorSchemeGreenUp,
		Theme:             ThemeDark,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.AmountColorScheme != AmountColorSchemeGreenUp {
		t.Fatalf("updated scheme = %q, want green_up", updated.AmountColorScheme)
	}
	if updated.Locale != "en" {
		t.Fatalf("updated locale = %q, want en", updated.Locale)
	}
	if updated.Theme != ThemeDark {
		t.Fatalf("updated theme = %q, want dark", updated.Theme)
	}

	_, err = svc.Update(db, Settings{
		Locale:            "zh-Hans",
		DefaultDateMode:   "today",
		AmountColorScheme: "invalid",
		Theme:             ThemeLight,
	})
	if !errors.Is(err, ErrInvalidAmountColorScheme) {
		t.Fatalf("expected ErrInvalidAmountColorScheme, got %v", err)
	}

	_, err = svc.Update(db, Settings{
		Locale:            "invalid-locale",
		DefaultDateMode:   "today",
		AmountColorScheme: AmountColorSchemeRedUp,
		Theme:             ThemeLight,
	})
	if !errors.Is(err, ErrInvalidLocale) {
		t.Fatalf("expected ErrInvalidLocale, got %v", err)
	}

	_, err = svc.Update(db, Settings{
		Locale:            "zh-Hans",
		DefaultDateMode:   "today",
		AmountColorScheme: AmountColorSchemeRedUp,
		Theme:             "neon",
	})
	if !errors.Is(err, ErrInvalidTheme) {
		t.Fatalf("expected ErrInvalidTheme, got %v", err)
	}
}
