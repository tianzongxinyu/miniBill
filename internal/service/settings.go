package service

import (
	"database/sql"
	"fmt"

	"github.com/minibill/minibill/internal/i18n"
)

var (
	ErrInvalidAmountColorScheme = fmt.Errorf("%w: invalid_amount_color_scheme", ErrValidation)
	ErrInvalidLocale            = fmt.Errorf("%w: invalid_locale", ErrValidation)
)

const (
	AmountColorSchemeRedUp   = "red_up"
	AmountColorSchemeGreenUp = "green_up"
)

type Settings struct {
	Locale            string `json:"locale"`
	DefaultDateMode   string `json:"default_date_mode"`
	AmountColorScheme string `json:"amount_color_scheme"`
}

type SettingsService struct{}

func defaultSettings() *Settings {
	return &Settings{
		Locale:            i18n.DefaultLocale,
		DefaultDateMode:   "today",
		AmountColorScheme: AmountColorSchemeRedUp,
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

func (s *SettingsService) Get(db *sql.DB) (*Settings, error) {
	var st Settings
	err := db.QueryRow(`SELECT locale, default_date_mode, amount_color_scheme FROM settings WHERE id=1`).
		Scan(&st.Locale, &st.DefaultDateMode, &st.AmountColorScheme)
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
	return &st, nil
}

func (s *SettingsService) Update(db *sql.DB, st Settings) (*Settings, error) {
	if err := validateLocale(st.Locale); err != nil {
		return nil, err
	}
	if err := validateAmountColorScheme(st.AmountColorScheme); err != nil {
		return nil, err
	}
	_, err := db.Exec(`
		INSERT INTO settings (id, locale, default_currency, default_date_mode, amount_color_scheme) VALUES (1,?, 'CNY', ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			locale=excluded.locale,
			default_date_mode=excluded.default_date_mode,
			amount_color_scheme=excluded.amount_color_scheme`,
		st.Locale, st.DefaultDateMode, st.AmountColorScheme)
	if err != nil {
		return nil, err
	}
	return s.Get(db)
}
