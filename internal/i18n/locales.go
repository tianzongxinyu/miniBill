package i18n

const DefaultLocale = "zh-Hans"

// SupportedLocales are the 20 selectable UI/API languages (by popularity).
var SupportedLocales = []string{
	"zh-Hans", "zh-Hant", "en", "ja", "ko", "es", "fr", "de", "pt-BR", "ru",
	"ar", "hi", "id", "vi", "th", "tr", "it", "nl", "pl", "uk",
}

var localeSet map[string]struct{}

func init() {
	localeSet = make(map[string]struct{}, len(SupportedLocales))
	for _, l := range SupportedLocales {
		localeSet[l] = struct{}{}
	}
}

func IsValidLocale(locale string) bool {
	_, ok := localeSet[locale]
	return ok
}
