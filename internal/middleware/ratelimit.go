package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/apierr"
	"github.com/minibill/minibill/internal/i18n"
)

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	limit    int
	window   time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		attempts: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (r *rateLimiter) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-r.window)

	r.mu.Lock()
	defer r.mu.Unlock()

	times := r.attempts[key]
	filtered := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	if len(filtered) >= r.limit {
		r.attempts[key] = filtered
		return false
	}
	r.attempts[key] = append(filtered, now)
	return true
}

// AuthRateLimit limits login/register attempts per client IP.
func AuthRateLimit() gin.HandlerFunc {
	limiter := newRateLimiter(20, time.Minute)
	return func(c *gin.Context) {
		key := c.ClientIP()
		if !limiter.allow(key) {
			locale := c.GetHeader("Accept-Language")
			if locale == "" {
				locale = "zh-Hans"
			}
			apierr.JSON(c, http.StatusTooManyRequests, "RATE_LIMITED", i18n.T(locale, "error.rate_limited"))
			return
		}
		c.Next()
	}
}
