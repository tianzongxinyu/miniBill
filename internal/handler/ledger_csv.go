package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/service"
	"github.com/minibill/minibill/internal/systemdb"
)

func (s *Server) ledgerOwnerUser(c *gin.Context) (*systemdb.User, bool) {
	ownerID := s.ledgerOwnerID(c)
	user, err := s.system.GetByID(ownerID)
	if err != nil || user == nil {
		JSONUnauthorized(c)
		return nil, false
	}
	return user, true
}

func (s *Server) exportLedgerCSV(c *gin.Context) {
	s.withLedgerOwner(c, func(db *sql.DB) {
		ownerID := s.ledgerOwnerID(c)
		var buf bytes.Buffer
		if err := s.ledgerCSVSvc.Export(db, ownerID, localeFrom(c), &buf); err != nil {
			serviceErr(c, err)
			return
		}
		filename := fmt.Sprintf("minibill-ledger-%s.csv", time.Now().Format("20060102"))
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf(
			`attachment; filename="%s"; filename*=UTF-8''%s`,
			filename,
			url.PathEscape(filename),
		))
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
	})
}

func (s *Server) importLedgerCSV(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.csv_upload_required"))
		return
	}
	if file.Size > service.MaxLedgerCSVImportBytes {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.csv_too_large"))
		return
	}
	f, err := file.Open()
	if err != nil {
		JSONInternal(c, i18n.T(localeFromHeader(c), "error.csv_read_failed"))
		return
	}
	defer f.Close()

	opts := service.CSVImportOpts{}
	if v := strings.TrimSpace(c.PostForm("keep_history")); v == "1" || strings.EqualFold(v, "true") {
		opts.KeepHistory = true
	}
	if v := strings.TrimSpace(c.PostForm("derive_balances")); v == "1" || strings.EqualFold(v, "true") {
		opts.DeriveBalances = true
	}
	if raw := strings.TrimSpace(c.PostForm("mapping")); raw != "" {
		if err := json.Unmarshal([]byte(raw), &opts.Mapping); err != nil {
			JSONValidation(c, i18n.T(localeFromHeader(c), "error.csv_mapping_invalid"))
			return
		}
	}
	if opts.DeriveBalances {
		if ob := strings.TrimSpace(c.PostForm("opening_balance")); ob != "" {
			cents, err := service.ParseYuanToCents(ob)
			if err != nil {
				JSONValidation(c, i18n.T(localeFromHeader(c), "validation.invalid_amount"))
				return
			}
			opts.OpeningBalance = &cents
		}
	}

	s.withLedgerOwner(c, func(db *sql.DB) {
		ownerID := s.ledgerOwnerID(c)
		limited := io.LimitReader(f, service.MaxLedgerCSVImportBytes)
		result, err := s.ledgerCSVSvc.ImportCSV(db, ownerID, limited, opts)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, result)
	})
}
