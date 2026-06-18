package i18n

import (
	"embed"
	"encoding/json"
	"io/fs"
	"sort"
	"strings"
	"sync"
)

//go:embed messages/*.json
var messagesFS embed.FS

var (
	catalogs       map[string]map[string]string
	catalogsOnce   sync.Once
	catalogLocales []string
)

func loadCatalogs() {
	catalogsOnce.Do(func() {
		catalogs = map[string]map[string]string{}
		entries, err := fs.ReadDir(messagesFS, "messages")
		if err != nil {
			panic("i18n: read messages dir: " + err.Error())
		}
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			locale := strings.TrimSuffix(e.Name(), ".json")
			raw, err := messagesFS.ReadFile("messages/" + e.Name())
			if err != nil {
				panic("i18n: read " + e.Name() + ": " + err.Error())
			}
			m := map[string]string{}
			if err := json.Unmarshal(raw, &m); err != nil {
				panic("i18n: parse " + e.Name() + ": " + err.Error())
			}
			catalogs[locale] = m
		}
		var locales []string
		for locale := range catalogs {
			if IsValidLocale(locale) {
				locales = append(locales, locale)
			}
		}
		sort.Strings(locales)
		catalogLocales = locales
	})
}

// CatalogLocales returns supported locales that have embedded message catalogs.
func CatalogLocales() []string {
	loadCatalogs()
	return append([]string(nil), catalogLocales...)
}

// T returns a translated string for locale and key. Falls back to en, then key.
func T(locale, key string) string {
	loadCatalogs()
	lang := NearestMatchedLanguage(locale)
	if msg, ok := catalogs[lang][key]; ok {
		return msg
	}
	if lang != "en" {
		if msg, ok := catalogs["en"][key]; ok {
			return msg
		}
	}
	return key
}

// TReplace substitutes {{name}} placeholders in translated strings.
func TReplace(locale, key string, vars map[string]string) string {
	s := T(locale, key)
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}
