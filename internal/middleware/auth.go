package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/apierr"
	"github.com/minibill/minibill/internal/auth"
)

const (
	UserIDKey       = "user_id"
	UsernameKey     = "username"
	AuthTokenKey    = "auth_token"
	IsAdminKey      = "is_admin"
	TokenCookieName = "minibill_token"

	LedgerOwnerIDKey    = "ledger_owner_id"
	LedgerPermissionKey = "ledger_permission"
)

// AuthGateLookup returns token_version and disabled for a user.
type AuthGateLookup func(userID int64) (tokenVersion int64, disabled bool, err error)

// AdminLookup returns whether the user is an active admin.
type AdminLookup func(userID int64) (isAdmin bool, err error)

func bearerToken(header string) string {
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(header, "Bearer ")
}

func tokenFromRequest(c *gin.Context) string {
	if t := bearerToken(c.GetHeader("Authorization")); t != "" {
		return t
	}
	if t, err := c.Cookie(TokenCookieName); err == nil && t != "" {
		return t
	}
	return ""
}

// Auth 校验 JWT（Authorization: Bearer 或 HttpOnly Cookie），并核对 token_version / disabled。
func Auth(authSvc *auth.Service, lookup AuthGateLookup) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := tokenFromRequest(c)
		if tokenStr == "" {
			apierr.Unauthorized(c)
			return
		}
		claims, err := authSvc.Parse(tokenStr)
		if err != nil {
			apierr.Unauthorized(c)
			return
		}
		if lookup != nil {
			ver, disabled, err := lookup(claims.UserID)
			if err != nil || disabled || ver != claims.TokenVersion {
				apierr.Unauthorized(c)
				return
			}
		}
		c.Set(UserIDKey, claims.UserID)
		c.Set(UsernameKey, claims.Username)
		c.Set(AuthTokenKey, tokenStr)
		c.Next()
	}
}

// RequireAdmin ensures the authenticated user is an admin.
func RequireAdmin(lookup AdminLookup) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := GetUserID(c)
		ok, err := lookup(uid)
		if err != nil || !ok {
			apierr.JSON(c, 403, "FORBIDDEN", "需要管理员权限")
			return
		}
		c.Set(IsAdminKey, true)
		c.Next()
	}
}

func GetUserID(c *gin.Context) int64 {
	v, _ := c.Get(UserIDKey)
	id, _ := v.(int64)
	return id
}

func GetUsername(c *gin.Context) string {
	v, _ := c.Get(UsernameKey)
	name, _ := v.(string)
	return name
}

func GetAuthToken(c *gin.Context) string {
	v, _ := c.Get(AuthTokenKey)
	token, _ := v.(string)
	return token
}

func GetLedgerOwnerID(c *gin.Context) int64 {
	v, _ := c.Get(LedgerOwnerIDKey)
	id, _ := v.(int64)
	return id
}

func GetLedgerPermission(c *gin.Context) string {
	v, _ := c.Get(LedgerPermissionKey)
	p, _ := v.(string)
	return p
}
