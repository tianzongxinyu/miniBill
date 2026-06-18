package i18n

import (
	"strings"
	"testing"
	"unicode"
)

func TestCatalogLocalesMatchSupported(t *testing.T) {
	catalogs := CatalogLocales()
	if len(catalogs) != len(SupportedLocales) {
		t.Fatalf("catalog count = %d, want %d", len(catalogs), len(SupportedLocales))
	}
	for _, locale := range SupportedLocales {
		if !hasCatalog(locale) {
			t.Fatalf("missing catalog for %q", locale)
		}
	}
}

func TestTAllSupportedLocales(t *testing.T) {
	keys := []string{
		"csv.header.date",
		"tag.daily_expense",
		"error.unauthorized",
	}
	for _, locale := range SupportedLocales {
		for _, key := range keys {
			msg := T(locale, key)
			if msg == key {
				t.Fatalf("T(%q, %q) returned raw key", locale, key)
			}
		}
	}
}

func TestTNonEnglishCatalogStrings(t *testing.T) {
	enDaily := T("en", "tag.daily_expense")
	enIncome := T("en", "csv.flow.income")
	enExpense := T("en", "csv.flow.expense")
	enFlow := T("en", "csv.header.flow")

	for _, locale := range SupportedLocales {
		if locale == "en" {
			continue
		}
		if got := T(locale, "tag.daily_expense"); got == enDaily {
			t.Fatalf("T(%q, tag.daily_expense) still English %q", locale, got)
		}
		if got := T(locale, "csv.flow.income"); got == enIncome {
			t.Fatalf("T(%q, csv.flow.income) still English %q", locale, got)
		}
		if got := T(locale, "csv.flow.expense"); got == enExpense {
			t.Fatalf("T(%q, csv.flow.expense) still English %q", locale, got)
		}
		if got := T(locale, "csv.header.flow"); got == enFlow {
			t.Fatalf("T(%q, csv.header.flow) still English %q", locale, got)
		}
	}
}

func TestTRTLCatalogHasNonASCII(t *testing.T) {
	for _, locale := range []string{"ar", "hi", "th", "ja", "ko", "ru", "uk"} {
		msg := T(locale, "tag.daily_expense")
		if !strings.ContainsFunc(msg, func(r rune) bool { return r > unicode.MaxASCII }) {
			t.Fatalf("T(%q, tag.daily_expense) = %q, expected non-ASCII script", locale, msg)
		}
	}
}

func TestNearestMatchedLanguage(t *testing.T) {
	cases := map[string]string{
		"ja":    "ja",
		"ja-JP": "ja",
		"sv":    "en",
		"zh-TW": "zh-Hant",
		"zh":    "zh-Hans",
	}
	for input, want := range cases {
		if got := NearestMatchedLanguage(input); got != want {
			t.Fatalf("NearestMatchedLanguage(%q) = %q, want %q", input, got, want)
		}
	}
}
