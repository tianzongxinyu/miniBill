package handler

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
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
