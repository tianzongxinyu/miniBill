package service

import (
	"database/sql"
	"fmt"

	"github.com/minibill/minibill/internal/i18n"
)

var (
	ErrInvalidAmountColorScheme = fmt.Errorf("%w: invalid_amount_color_scheme", ErrValidation)
	ErrInvalidLocale            = fmt.Errorf("%w: invalid_locale", ErrValidation)
	ErrInvalidTheme             = fmt.Errorf("%w: invalid_theme", ErrValidation)
)

const (
	AmountColorSchemeRedUp   = "red_up"
	AmountColorSchemeGreenUp = "green_up"

	ThemeLight  = "light"
	ThemeDark   = "dark"
	ThemeSystem = "system"
)

type Settings struct {
	Locale            string `json:"locale"`
	DefaultDateMode   string `json:"default_date_mode"`
	AmountColorScheme string `json:"amount_color_scheme"`
	Theme             string `json:"theme"`
}

type SettingsService struct{}

func defaultSettings() *Settings {
	return &Settings{
		Locale:            i18n.DefaultLocale,
		DefaultDateMode:   "today",
		AmountColorScheme: AmountColorSchemeRedUp,
		Theme:             ThemeLight,
	}
}

func validateAmountColorScheme(scheme string) error {
	if scheme != AmountColorSchemeRedUp && scheme != AmountColorSchemeGreenUp {
		return ErrInvalidAmountColorScheme
	}
	return nil
}

func validateLocale(locale string) error {
	if !i18n.IsValidLocale(locale) {
		return ErrInvalidLocale
	}
	return nil
}

func validateTheme(theme string) error {
	if theme != ThemeLight && theme != ThemeDark && theme != ThemeSystem {
		return ErrInvalidTheme
	}
	return nil
}

func (s *SettingsService) Get(db *sql.DB) (*Settings, error) {
	var st Settings
	err := db.QueryRow(`SELECT locale, default_date_mode, amount_color_scheme, theme FROM settings WHERE id=1`).
		Scan(&st.Locale, &st.DefaultDateMode, &st.AmountColorScheme, &st.Theme)
	if err == sql.ErrNoRows {
		return defaultSettings(), nil
	}
	if err != nil {
		return nil, err
	}
	if st.Locale == "" {
		st.Locale = i18n.DefaultLocale
	}
	if st.AmountColorScheme == "" {
		st.AmountColorScheme = AmountColorSchemeRedUp
	}
	if st.Theme == "" {
		st.Theme = ThemeLight
	}
	return &st, nil
}

func (s *SettingsService) Update(db *sql.DB, st Settings) (*Settings, error) {
	if err := validateLocale(st.Locale); err != nil {
		return nil, err
	}
	if err := validateAmountColorScheme(st.AmountColorScheme); err != nil {
		return nil, err
	}
	if err := validateTheme(st.Theme); err != nil {
		return nil, err
	}
	_, err := db.Exec(`
		INSERT INTO settings (id, locale, default_currency, default_date_mode, amount_color_scheme, theme) VALUES (1,?, 'CNY', ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			locale=excluded.locale,
			default_date_mode=excluded.default_date_mode,
			amount_color_scheme=excluded.amount_color_scheme,
			theme=excluded.theme`,
		st.Locale, st.DefaultDateMode, st.AmountColorScheme, st.Theme)
	if err != nil {
		return nil, err
	}
	return s.Get(db)
}
