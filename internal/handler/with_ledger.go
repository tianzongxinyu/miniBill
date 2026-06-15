package handler

import (
	"database/sql"

	"github.com/gin-gonic/gin"
)

func (s *Server) withLedger(c *gin.Context, fn func(db *sql.DB)) {
	db, closeFn, err := s.ledgerDB(c)
	if err != nil {
		JSONInternal(c, "无法打开账本")
		return
	}
	defer closeFn()
	fn(db)
}
