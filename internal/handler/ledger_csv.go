package handler

import (
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/middleware"
	"github.com/minibill/minibill/internal/service"
)

func (s *Server) exportLedgerCSV(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		userID := middleware.GetUserID(c)
		var buf bytes.Buffer
		if err := s.ledgerCSVSvc.Export(db, userID, &buf); err != nil {
			serviceErr(c, err)
			return
		}
		filename := fmt.Sprintf("minibill-ledger-%s.csv", time.Now().Format("20060102"))
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
	})
}

func (s *Server) importLedgerCSV(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		JSONValidation(c, "请上传 CSV 文件")
		return
	}
	if file.Size > service.MaxLedgerCSVImportBytes {
		JSONValidation(c, "CSV 文件过大")
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
		limited := io.LimitReader(f, service.MaxLedgerCSVImportBytes)
		result, err := s.ledgerCSVSvc.ImportReplace(db, userID, limited)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, result)
	})
}
