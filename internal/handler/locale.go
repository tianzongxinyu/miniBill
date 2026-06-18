package handler

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/service"
)

const localeContextKey = "locale"

func localeFrom(c *gin.Context) string {
	if v, ok := c.Get(localeContextKey); ok {
		if s, ok := v.(string); ok && s != "" {
			return s
		}
	}
	return localeFromHeader(c)
}

func localeFromHeader(c *gin.Context) string {
	h := strings.TrimSpace(c.GetHeader("Accept-Language"))
	if h == "" {
		return i18n.DefaultLocale
	}
	part := strings.Split(h, ",")[0]
	part = strings.TrimSpace(strings.Split(part, ";")[0])
	if i18n.IsValidLocale(part) {
		return part
	}
	return i18n.NearestMatchedLanguage(part)
}

func (s *Server) resolveLocale(c *gin.Context, db *sql.DB) string {
	if c.GetHeader("Accept-Language") != "" {
		return localeFromHeader(c)
	}
	st, err := s.settingsSvc.Get(db)
	if err == nil && st.Locale != "" {
		return st.Locale
	}
	return i18n.DefaultLocale
}

func (s *Server) withLedger(c *gin.Context, fn func(db *sql.DB)) {
	db, closeFn, err := s.ledgerDB(c)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			JSONUnauthorized(c)
			return
		}
		JSONInternal(c, i18n.T(localeFromHeader(c), "error.open_ledger"))
		return
	}
	defer closeFn()
	c.Set(localeContextKey, s.resolveLocale(c, db))
	fn(db)
}

func translateValidation(locale, key string) string {
	if msg := i18n.T(locale, "validation."+key); msg != "validation."+key {
		return msg
	}
	return key
}

func localizeTags(list []service.Tag, locale string) []service.Tag {
	out := make([]service.Tag, len(list))
	copy(out, list)
	for i := range out {
		if out[i].PresetKey != nil && *out[i].PresetKey != "" {
			out[i].Name = i18n.T(locale, "tag."+*out[i].PresetKey)
		}
	}
	return out
}

func buildTagPresetMap(db *sql.DB) (map[int64]string, error) {
	rows, err := db.Query(`SELECT id, preset_key FROM tags WHERE preset_key IS NOT NULL AND preset_key != ''`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := map[int64]string{}
	for rows.Next() {
		var id int64
		var pk string
		if err := rows.Scan(&id, &pk); err != nil {
			return nil, err
		}
		m[id] = pk
	}
	return m, rows.Err()
}

func localizeTxList(db *sql.DB, items []service.Transaction, locale string) error {
	preset, err := buildTagPresetMap(db)
	if err != nil {
		return err
	}
	for i := range items {
		for j := range items[i].TagItems {
			if pk, ok := preset[items[i].TagItems[j].ID]; ok {
				name := i18n.T(locale, "tag."+pk)
				items[i].TagItems[j].Name = name
				if j < len(items[i].Tags) {
					items[i].Tags[j] = name
				}
			}
		}
	}
	return nil
}

func localizeTx(db *sql.DB, tx *service.Transaction, locale string) error {
	if tx == nil {
		return nil
	}
	return localizeTxList(db, []service.Transaction{*tx}, locale)
}
