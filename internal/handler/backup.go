package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/fnosapi"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/service"
)

type backupUpdateReq struct {
	Enabled   bool   `json:"enabled"`
	Interval  string `json:"interval"`
	Hour      int    `json:"hour"`
	Minute    int    `json:"minute"`
	Weekday   int    `json:"weekday"`
	MonthDay  int    `json:"month_day"`
	KeepCount int    `json:"keep_count"`
}

func (s *Server) getBackup(c *gin.Context) {
	s.withLedgerOwner(c, func(db *sql.DB) {
		view, err := s.backupSvc.View(db)
		if serviceErr(c, err) {
			return
		}
		s.attachBackupSemanticPath(view, localeFromHeader(c))
		c.JSON(http.StatusOK, view)
	})
}

func (s *Server) updateBackup(c *gin.Context) {
	var req backupUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedgerOwner(c, func(db *sql.DB) {
		cfg, err := s.backupSvc.UpdateConfig(db, service.BackupConfig{
			Enabled:   req.Enabled,
			Interval:  req.Interval,
			Hour:      req.Hour,
			Minute:    req.Minute,
			Weekday:   req.Weekday,
			MonthDay:  req.MonthDay,
			KeepCount: req.KeepCount,
		})
		if serviceErr(c, err) {
			return
		}
		view := &service.BackupView{
			BackupConfig:  *cfg,
			DirConfigured: s.backupSvc.DirConfigured(),
			DirPath:       s.backupSvc.DirPath(),
		}
		s.attachBackupSemanticPath(view, localeFromHeader(c))
		c.JSON(http.StatusOK, view)
	})
}

func (s *Server) runBackup(c *gin.Context) {
	if !s.backupSvc.DirConfigured() {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.backup_dir_missing"))
		return
	}
	s.withLedgerOwner(c, func(db *sql.DB) {
		user, ok := s.ledgerOwnerUser(c)
		if !ok {
			return
		}
		filename, err := s.backupSvc.RunBackup(db, user.ID, user.Username)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, gin.H{"filename": filename})
	})
}

func (s *Server) listBackupFiles(c *gin.Context) {
	s.withLedgerOwner(c, func(db *sql.DB) {
		user, ok := s.ledgerOwnerUser(c)
		if !ok {
			return
		}
		page, err := s.backupSvc.ListBackupFiles(user.Username)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, page)
	})
}

type backupRestoreReq struct {
	Filename string `json:"filename"`
}

func (s *Server) restoreBackup(c *gin.Context) {
	if !s.backupSvc.DirConfigured() {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.backup_dir_missing"))
		return
	}
	var req backupRestoreReq
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Filename) == "" {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.backup_file_required"))
		return
	}
	s.withLedgerOwner(c, func(db *sql.DB) {
		user, ok := s.ledgerOwnerUser(c)
		if !ok {
			return
		}
		result, err := s.backupSvc.RestoreFromZip(db, user.ID, user.Username, req.Filename)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, result)
	})
}

func (s *Server) attachBackupSemanticPath(view *service.BackupView, locale string) {
	if view == nil || view.DirPath == "" || !fnosapi.Available() {
		return
	}
	lang := "zh-CN"
	switch {
	case strings.HasPrefix(locale, "zh-Hant"), strings.HasPrefix(locale, "zh-TW"), strings.HasPrefix(locale, "zh-HK"):
		lang = "zh-TW"
	case strings.HasPrefix(locale, "zh"):
		lang = "zh-CN"
	case strings.HasPrefix(locale, "en"):
		lang = "en-US"
	case locale != "":
		lang = locale
	}
	m, err := fnosapi.ConvertPath([]string{view.DirPath}, lang)
	if err != nil {
		return
	}
	if sem := m[view.DirPath]; sem != "" {
		view.SemanticPath = sem
	}
}
