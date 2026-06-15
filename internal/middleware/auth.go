package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/apierr"
	"github.com/minibill/minibill/internal/auth"
)

const UserIDKey = "user_id"
const UsernameKey = "username"

// Auth 校验 JWT（Authorization: Bearer <token>），无服务端 session / cookie。
func Auth(authSvc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			apierr.Unauthorized(c)
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := authSvc.Parse(tokenStr)
		if err != nil {
			apierr.Unauthorized(c)
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Set(UsernameKey, claims.Username)
		c.Next()
	}
}

func GetUserID(c *gin.Context) int64 {
	v, _ := c.Get(UserIDKey)
	id, _ := v.(int64)
	return id
}
