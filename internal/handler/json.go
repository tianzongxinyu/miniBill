package handler

import (
	"github.com/gin-gonic/gin"
)

// jsonItems 避免 Go nil slice 序列化为 items:null
func jsonItems(c *gin.Context, items any) {
	c.JSON(200, gin.H{"items": orEmptySlice(items)})
}

func orEmptySlice(v any) any {
	if v == nil {
		return []any{}
	}
	return v
}
