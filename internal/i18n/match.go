package i18n

import "strings"

var fallbacks = map[string][]string{
	"zh-HK": {"zh-Hant", "en"},
	"zh-TW": {"zh-Hant", "en"},
	"zh":    {"zh-Hans", "en"},
}

// NearestMatchedLanguage resolves locale to a catalog language.
func NearestMatchedLanguage(locale string) string {
	if locale == "" {
		return "en"
	}
	if hasCatalog(locale) {
		return locale
	}
	if chain, ok := fallbacks[locale]; ok {
		for _, fb := range chain {
			if hasCatalog(fb) {
				return fb
			}
		}
	}
	short := locale
	if i := strings.Index(locale, "-"); i > 0 {
		short = locale[:i]
	}
	if hasCatalog(short) {
		return short
	}
	for _, existing := range CatalogLocales() {
		if strings.HasPrefix(existing, short) {
			return existing
		}
	}
	return "en"
}

func hasCatalog(locale string) bool {
	loadCatalogs()
	_, ok := catalogs[locale]
	return ok
}
