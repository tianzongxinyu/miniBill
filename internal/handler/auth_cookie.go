package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/middleware"
)

func authCookieMaxAge(remember bool, cfg config.Config) int {
	if remember {
		return cfg.JWTExpireDays * 86400
	}
	return int((24 * time.Hour).Seconds())
}

func setAuthCookie(c *gin.Context, token string, remember bool, cfg config.Config) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		middleware.TokenCookieName,
		token,
		authCookieMaxAge(remember, cfg),
		"/",
		"",
		false,
		true,
	)
}

func clearAuthCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(middleware.TokenCookieName, "", -1, "/", "", false, true)
}
