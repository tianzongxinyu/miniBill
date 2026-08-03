package handler

import (
	"database/sql"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/middleware"
	"github.com/minibill/minibill/internal/systemdb"
)

func (s *Server) adminListUsers(c *gin.Context) {
	list, err := s.system.ListUsers()
	if err != nil {
		JSONInternal(c, "")
		return
	}
	items := make([]gin.H, 0, len(list))
	for _, u := range list {
		items = append(items, gin.H{
			"id":         u.ID,
			"username":   u.Username,
			"is_admin":   u.IsAdmin,
			"disabled":   u.Disabled,
			"created_at": u.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Server) adminCreateUser(c *gin.Context) {
	var req credReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	sys := &bootstrap.System{Store: s.system, Cfg: s.cfg, Factory: s.userFactory}
	user, err := bootstrap.ProvisionUser(sys, req.Username, req.Password)
	if err != nil {
		msg := mapProvisionError(err)
		if strings.Contains(err.Error(), "username exists") ||
			strings.Contains(msg, "须") ||
			strings.Contains(msg, "至少") ||
			strings.Contains(msg, "仅允许") ||
			strings.Contains(msg, "must") {
			JSONValidation(c, msg)
			return
		}
		JSONInternal(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"is_admin":   user.IsAdmin,
		"disabled":   user.Disabled,
		"created_at": user.CreatedAt,
	})
}

type adminUpdateUserReq struct {
	IsAdmin  *bool `json:"is_admin"`
	Disabled *bool `json:"disabled"`
}

func (s *Server) adminUpdateUser(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var req adminUpdateUserReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	if req.IsAdmin == nil && req.Disabled == nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "validation.no_update_fields"))
		return
	}
	actorID := middleware.GetUserID(c)
	err := s.system.UpdateUserFlags(actorID, id, req.IsAdmin, req.Disabled)
	if errors.Is(err, systemdb.ErrSelfForbidden) {
		JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(localeFromHeader(c), "error.admin_self_forbidden"))
		return
	}
	if errors.Is(err, systemdb.ErrLastAdmin) {
		JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(localeFromHeader(c), "error.last_admin"))
		return
	}
	if err == sql.ErrNoRows {
		JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
		return
	}
	if err != nil {
		JSONInternal(c, "")
		return
	}
	user, err := s.system.GetByID(id)
	if err != nil || user == nil {
		JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID,
		"username":   user.Username,
		"is_admin":   user.IsAdmin,
		"disabled":   user.Disabled,
		"created_at": user.CreatedAt,
	})
}

type adminResetPasswordReq struct {
	Password string `json:"password"`
}

func (s *Server) adminResetPassword(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var req adminResetPasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		JSONValidation(c, err.Error())
		return
	}
	user, err := s.system.GetByID(id)
	if err != nil || user == nil {
		JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		JSONInternal(c, "")
		return
	}
	if err := s.system.UpdatePassword(id, hash); err != nil {
		JSONInternal(c, "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) adminDeleteUser(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	actorID := middleware.GetUserID(c)
	target, err := s.system.GetByID(id)
	if err != nil || target == nil {
		JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
		return
	}
	s.userFactory.CloseUser(id)
	s.clearDataPathCache(id)
	s.metaStore.Invalidate(id)
	if err := s.system.DeleteUser(actorID, id); err != nil {
		if errors.Is(err, systemdb.ErrSelfForbidden) {
			JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(localeFromHeader(c), "error.admin_self_forbidden"))
			return
		}
		if errors.Is(err, systemdb.ErrLastAdmin) {
			JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(localeFromHeader(c), "error.last_admin"))
			return
		}
		if err == sql.ErrNoRows {
			JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
			return
		}
		JSONInternal(c, "")
		return
	}
	_ = target
	userDir := filepath.Join(s.cfg.DataDir, "users", strconv.FormatInt(id, 10))
	_ = os.RemoveAll(userDir)
	c.Status(http.StatusNoContent)
}
