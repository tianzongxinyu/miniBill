package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/apierr"
)

func JSONError(c *gin.Context, status int, code, message string) {
	apierr.JSON(c, status, code, message)
}

func JSONValidation(c *gin.Context, message string) {
	apierr.Validation(c, message)
}

func JSONUnauthorized(c *gin.Context) {
	apierr.Unauthorized(c)
}

func JSONNotFound(c *gin.Context, message string) {
	apierr.NotFound(c, message)
}

func JSONInternal(c *gin.Context, message string) {
	apierr.JSON(c, 500, "INTERNAL", message)
}
