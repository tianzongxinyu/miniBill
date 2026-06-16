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
	TokenCookieName = "minibill_token"
)

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

// Auth 校验 JWT（Authorization: Bearer 或 HttpOnly Cookie）。
func Auth(authSvc *auth.Service) gin.HandlerFunc {
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
		c.Set(UserIDKey, claims.UserID)
		c.Set(UsernameKey, claims.Username)
		c.Set(AuthTokenKey, tokenStr)
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
