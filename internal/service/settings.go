package service

import (
	"database/sql"
	"fmt"
)

var (
	ErrInvalidAmountColorScheme = fmt.Errorf("%w: invalid amount_color_scheme", ErrValidation)
)

const (
	AmountColorSchemeRedUp   = "red_up"
	AmountColorSchemeGreenUp = "green_up"
)

type Settings struct {
	DefaultCurrency     string `json:"default_currency"`
	DefaultDateMode     string `json:"default_date_mode"`
	AmountColorScheme   string `json:"amount_color_scheme"`
}

type SettingsService struct{}

func defaultSettings() *Settings {
	return &Settings{
		DefaultCurrency:   "CNY",
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

func (s *SettingsService) Get(db *sql.DB) (*Settings, error) {
	var st Settings
	err := db.QueryRow(`SELECT default_currency, default_date_mode, amount_color_scheme FROM settings WHERE id=1`).
		Scan(&st.DefaultCurrency, &st.DefaultDateMode, &st.AmountColorScheme)
	if err == sql.ErrNoRows {
		return defaultSettings(), nil
	}
	if err != nil {
		return nil, err
	}
	if st.AmountColorScheme == "" {
		st.AmountColorScheme = AmountColorSchemeRedUp
	}
	return &st, nil
}

func (s *SettingsService) Update(db *sql.DB, st Settings) (*Settings, error) {
	if err := validateAmountColorScheme(st.AmountColorScheme); err != nil {
		return nil, err
	}
	_, err := db.Exec(`
		INSERT INTO settings (id, default_currency, default_date_mode, amount_color_scheme) VALUES (1,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			default_currency=excluded.default_currency,
			default_date_mode=excluded.default_date_mode,
			amount_color_scheme=excluded.amount_color_scheme`,
		st.DefaultCurrency, st.DefaultDateMode, st.AmountColorScheme)
	if err != nil {
		return nil, err
	}
	return s.Get(db)
}
