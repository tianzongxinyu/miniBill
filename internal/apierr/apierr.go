package apierr

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Body struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func JSON(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, Body{Error: code, Message: message})
}

func Unauthorized(c *gin.Context) {
	JSON(c, http.StatusUnauthorized, "UNAUTHORIZED", "未授权")
}

func Validation(c *gin.Context, message string) {
	JSON(c, http.StatusBadRequest, "VALIDATION_ERROR", message)
}

func NotFound(c *gin.Context, message string) {
	JSON(c, http.StatusNotFound, "NOT_FOUND", message)
}
