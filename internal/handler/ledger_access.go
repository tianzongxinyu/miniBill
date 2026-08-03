package handler

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/middleware"
)

func (s *Server) listLedgers(c *gin.Context) {
	list, err := s.system.ListAccessibleLedgers(middleware.GetUserID(c))
	if err != nil {
		JSONInternal(c, "")
		return
	}
	items := make([]gin.H, 0, len(list))
	for _, a := range list {
		items = append(items, gin.H{
			"owner_id":   a.OwnerUserID,
			"username":   a.Username,
			"permission": a.Permission,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Server) listUserDirectory(c *gin.Context) {
	list, err := s.system.ListDirectory(middleware.GetUserID(c))
	if err != nil {
		JSONInternal(c, "")
		return
	}
	items := make([]gin.H, 0, len(list))
	for _, u := range list {
		items = append(items, gin.H{
			"id":       u.ID,
			"username": u.Username,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (s *Server) listLedgerGrants(c *gin.Context) {
	list, err := s.system.ListGrantsByOwner(middleware.GetUserID(c))
	if err != nil {
		JSONInternal(c, "")
		return
	}
	items := make([]gin.H, 0, len(list))
	for _, g := range list {
		items = append(items, gin.H{
			"id":               g.ID,
			"grantee_user_id":  g.GranteeUserID,
			"grantee_username": g.GranteeUsername,
			"permission":       g.Permission,
			"created_at":       g.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

type upsertGrantReq struct {
	GranteeUserID int64  `json:"grantee_user_id"`
	Permission    string `json:"permission"`
}

func (s *Server) upsertLedgerGrant(c *gin.Context) {
	var req upsertGrantReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	ownerID := middleware.GetUserID(c)
	if err := s.system.UpsertGrant(ownerID, req.GranteeUserID, req.Permission); err != nil {
		if err == sql.ErrNoRows {
			JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
			return
		}
		if err.Error() == "cannot grant to self" || err.Error() == "invalid permission" {
			JSONValidation(c, err.Error())
			return
		}
		JSONInternal(c, "")
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) deleteLedgerGrant(c *gin.Context) {
	raw := c.Param("granteeUserId")
	granteeID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || granteeID <= 0 {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_id"))
		return
	}
	ownerID := middleware.GetUserID(c)
	if err := s.system.DeleteGrant(ownerID, granteeID); err != nil {
		if err == sql.ErrNoRows {
			JSONNotFound(c, i18n.T(localeFromHeader(c), "error.not_found"))
			return
		}
		JSONInternal(c, "")
		return
	}
	c.Status(http.StatusNoContent)
}
