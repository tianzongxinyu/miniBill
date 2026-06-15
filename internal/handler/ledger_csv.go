package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/middleware"
)

func (s *Server) exportLedgerCSV(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		userID := middleware.GetUserID(c)
		filename := fmt.Sprintf("minibill-ledger-%s.csv", time.Now().Format("20060102"))
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		c.Header("Cache-Control", "no-cache")
		c.Status(http.StatusOK)
		if f, ok := c.Writer.(http.Flusher); ok {
			f.Flush()
		}
		if serviceErr(c, s.ledgerCSVSvc.Export(db, userID, c.Writer)) {
			return
		}
	})
}

func (s *Server) importLedgerCSV(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		JSONValidation(c, "请上传 CSV 文件")
		return
	}
	f, err := file.Open()
	if err != nil {
		JSONInternal(c, "无法读取文件")
		return
	}
	defer f.Close()

	s.withLedger(c, func(db *sql.DB) {
		userID := middleware.GetUserID(c)
		result, err := s.ledgerCSVSvc.ImportReplace(db, userID, f)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, result)
	})
}
