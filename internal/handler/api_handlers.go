package handler

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/middleware"
	"github.com/minibill/minibill/internal/service"
)

type credReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginReq struct {
	credReq
	Remember *bool `json:"remember"`
}

type transactionReq struct {
	Amount          int64   `json:"amount"`
	Type            string  `json:"type"`
	TransactionDate string  `json:"transaction_date"`
	Note            string  `json:"note"`
	ContactID       *int64  `json:"contact_id"`
	TagIDs          []int64 `json:"tag_ids"`
}

func (req transactionReq) toInput() service.CreateTransactionInput {
	return service.CreateTransactionInput{
		Amount:          req.Amount,
		Type:            req.Type,
		TransactionDate: req.TransactionDate,
		Note:            req.Note,
		ContactID:       req.ContactID,
		TagIDs:          req.TagIDs,
	}
}

type changePasswordReq struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

type tagCreateReq struct {
	Name string `json:"name"`
}

type tagUpdateReq struct {
	Enabled *bool   `json:"enabled"`
	ColorBg *string `json:"color_bg"`
	ColorFg *string `json:"color_fg"`
	Name    *string `json:"name"`
}

func (req tagUpdateReq) empty() bool {
	return req.Enabled == nil && req.ColorBg == nil && req.ColorFg == nil && req.Name == nil
}

type contactUpdateReq struct {
	Enabled       *bool   `json:"enabled"`
	Name          *string `json:"name"`
	Nickname      *string `json:"nickname"`
	RelationGroup *string `json:"relation_group"`
	Note          *string `json:"note"`
	Phone         *string `json:"phone"`
}

func (req contactUpdateReq) empty() bool {
	return req.Enabled == nil &&
		req.Name == nil &&
		req.Nickname == nil &&
		req.RelationGroup == nil &&
		req.Note == nil &&
		req.Phone == nil
}

type balanceReq struct {
	Balance int64  `json:"balance"`
	Note    string `json:"note"`
}

func mapProvisionError(err error) string {
	if err == nil {
		return ""
	}
	if strings.Contains(err.Error(), "username exists") {
		return "用户名已存在"
	}
	return err.Error()
}

func (s *Server) register(c *gin.Context) {
	if !s.cfg.AllowRegistration {
		JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(localeFromHeader(c), "error.registration_closed"))
		return
	}
	var req credReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	sys := &bootstrap.System{Store: s.system, Cfg: s.cfg, Factory: s.userFactory}
	user, err := bootstrap.ProvisionUser(sys, req.Username, req.Password)
	if err != nil {
		msg := mapProvisionError(err)
		if strings.Contains(err.Error(), "username exists") ||
			strings.Contains(msg, "须") ||
			strings.Contains(msg, "至少") ||
			strings.Contains(msg, "仅允许") {
			JSONValidation(c, msg)
			return
		}
		JSONInternal(c, err.Error())
		return
	}
	token, err := s.authSvc.Sign(user.ID, user.Username, user.TokenVersion)
	if err != nil {
		JSONInternal(c, "")
		return
	}
	setAuthCookie(c, token, true, s.cfg)
	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "username": user.Username},
	})
}

func (s *Server) login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	user, err := s.system.GetByUsername(req.Username)
	if err != nil || user == nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		JSONError(c, http.StatusUnauthorized, "UNAUTHORIZED", i18n.T(localeFromHeader(c), "error.invalid_credentials"))
		return
	}
	remember := req.Remember == nil || *req.Remember
	expire := s.cfg.JWTExpireDuration()
	if !remember {
		expire = 24 * time.Hour
	}
	token, err := s.authSvc.SignWithExpire(user.ID, user.Username, user.TokenVersion, expire)
	if err != nil {
		JSONInternal(c, "")
		return
	}
	setAuthCookie(c, token, remember, s.cfg)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "username": user.Username},
	})
}

func (s *Server) session(c *gin.Context) {
	token := middleware.GetAuthToken(c)
	if token == "" {
		JSONUnauthorized(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":       middleware.GetUserID(c),
			"username": middleware.GetUsername(c),
		},
	})
}

func (s *Server) logout(c *gin.Context) {
	clearAuthCookie(c, s.cfg)
	c.Status(http.StatusNoContent)
}

func (s *Server) changePassword(c *gin.Context) {
	var req changePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.invalid_body"))
		return
	}
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		JSONValidation(c, err.Error())
		return
	}
	userID := middleware.GetUserID(c)
	user, err := s.system.GetByID(userID)
	if err != nil || user == nil || !auth.CheckPassword(user.PasswordHash, req.OldPassword) {
		JSONError(c, http.StatusUnauthorized, "UNAUTHORIZED", i18n.T(localeFromHeader(c), "error.wrong_password"))
		return
	}
	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		JSONInternal(c, "")
		return
	}
	if err := s.system.UpdatePassword(userID, hash); err != nil {
		JSONInternal(c, "")
		return
	}
	clearAuthCookie(c, s.cfg)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Server) listTags(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		enabledOnly := c.Query("enabled") == "1"
		list, err := s.tagSvc.List(db, enabledOnly)
		if serviceErr(c, err) {
			return
		}
		jsonItems(c, localizeTags(list, localeFrom(c)))
	})
}

func (s *Server) createTag(c *gin.Context) {
	var req tagCreateReq
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.tag_name_required"))
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		tag, err := s.tagSvc.Create(db, req.Name)
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		tags := localizeTags([]service.Tag{*tag}, localeFrom(c))
		c.JSON(http.StatusCreated, tags[0])
	})
}

func (s *Server) getTag(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		sum, err := s.tagSvc.Get(db, id)
		if serviceErr(c, err) {
			return
		}
		localized := localizeTags([]service.Tag{sum.Tag}, localeFrom(c))
		sum.Tag = localized[0]
		c.JSON(http.StatusOK, sum)
	})
}

func (s *Server) updateTag(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var req tagUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil || req.empty() {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		tag, err := s.tagSvc.Update(db, id, service.TagUpdateInput{
			Enabled: req.Enabled,
			ColorBg: req.ColorBg,
			ColorFg: req.ColorFg,
			Name:    req.Name,
		})
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		tags := localizeTags([]service.Tag{*tag}, localeFrom(c))
		c.JSON(http.StatusOK, tags[0])
	})
}

func (s *Server) deleteTag(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		if serviceErr(c, s.tagSvc.Delete(db, id)) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.Status(http.StatusNoContent)
	})
}

func (s *Server) listContacts(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		enabledOnly := c.Query("enabled") == "1"
		list, err := s.contactSvc.List(db, enabledOnly)
		if serviceErr(c, err) {
			return
		}
		jsonItems(c, list)
	})
}

func (s *Server) getContact(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		sum, err := s.contactSvc.Get(db, id)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, sum)
	})
}

func (s *Server) createContact(c *gin.Context) {
	var req service.Contact
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		JSONValidation(c, i18n.T(localeFromHeader(c), "error.contact_name_required"))
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		contact, err := s.contactSvc.Create(db, req)
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.JSON(http.StatusCreated, contact)
	})
}

func (s *Server) updateContact(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var req contactUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil || req.empty() {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		contact, err := s.contactSvc.Update(db, id, service.ContactUpdateInput{
			Enabled:       req.Enabled,
			Name:          req.Name,
			Nickname:      req.Nickname,
			RelationGroup: req.RelationGroup,
			Note:          req.Note,
			Phone:         req.Phone,
		})
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.JSON(http.StatusOK, contact)
	})
}

func (s *Server) deleteContact(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		if serviceErr(c, s.contactSvc.Delete(db, id)) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.Status(http.StatusNoContent)
	})
}

func (s *Server) listTransactions(c *gin.Context) {
	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))
	s.withLedger(c, func(db *sql.DB) {
		filter := service.ListFilter{
			Year:      year,
			Month:     month,
			Type:      c.Query("type"),
			TagIDs:    parseTagIDs(c),
			TagMatch:  parseTagMatch(c),
			ContactID: parseContactID(c),
			NoteQuery: strings.TrimSpace(c.Query("note")),
			Cursor:    c.Query("cursor"),
		}
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		page, err := s.txSvc.ListByCursorFiltered(db, filter, limit)
		if serviceErr(c, err) {
			return
		}
		userID := middleware.GetUserID(c)
		meta := s.metaStore.ForUser(userID)
		_ = meta.EnsureWarm(db)
		if err := s.txSvc.EnrichBatchWithMeta(db, meta, page.Items); err != nil {
			_ = s.txSvc.EnrichBatch(db, page.Items)
		}
		_ = localizeTxList(db, page.Items, localeFrom(c))
		c.JSON(http.StatusOK, gin.H{
			"items":       orEmptySlice(page.Items),
			"next_cursor": page.NextCursor,
			"has_more":    page.HasMore,
		})
	})
}

func (s *Server) getTransaction(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		tx, err := s.txSvc.Get(db, id)
		if serviceErr(c, err) {
			return
		}
		_ = s.txSvc.Enrich(db, tx)
		_ = localizeTx(db, tx, localeFrom(c))
		c.JSON(http.StatusOK, tx)
	})
}

func (s *Server) createTransaction(c *gin.Context) {
	var req transactionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		tx, err := s.txSvc.Create(db, req.toInput())
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.JSON(http.StatusCreated, tx)
	})
}

func (s *Server) updateTransaction(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	var req transactionReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		tx, err := s.txSvc.Update(db, id, req.toInput())
		if serviceErr(c, err) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.JSON(http.StatusOK, tx)
	})
}

func (s *Server) deleteTransaction(c *gin.Context) {
	id, ok := parseID(c, "id")
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		if serviceErr(c, s.txSvc.Delete(db, id)) {
			return
		}
		s.invalidateLedgerMeta(c)
		c.Status(http.StatusNoContent)
	})
}

func (s *Server) listBalances(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		list, err := s.balanceSvc.List(db)
		if serviceErr(c, err) {
			return
		}
		jsonItems(c, list)
	})
}

func (s *Server) getBalance(c *gin.Context) {
	y, m, ok := parseYearMonth(c)
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		b, err := s.balanceSvc.Get(db, y, m)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, b)
	})
}

func (s *Server) upsertBalance(c *gin.Context) {
	y, m, ok := parseYearMonth(c)
	if !ok {
		return
	}
	var req balanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		b, err := s.balanceSvc.Upsert(db, y, m, req.Balance, req.Note)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, b)
	})
}

func (s *Server) deleteBalance(c *gin.Context) {
	y, m, ok := parseYearMonth(c)
	if !ok {
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		if serviceErr(c, s.balanceSvc.Delete(db, y, m)) {
			return
		}
		c.Status(http.StatusNoContent)
	})
}

func (s *Server) dashboard(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		d, err := s.statsSvc.Dashboard(db)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, d)
	})
}

func (s *Server) monthBills(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))
	cursor, ok := parseYearMonthQuery(c.Query("cursor"))
	if !ok {
		JSONValidation(c, "cursor must be YYYY-MM")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		page, err := s.statsSvc.MonthBills(db, cursor, limit)
		if serviceErr(c, err) {
			return
		}
		if page.Items == nil {
			page.Items = []service.MonthBillItem{}
		}
		c.JSON(http.StatusOK, page)
	})
}

func (s *Server) monthBill(c *gin.Context) {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		JSONValidation(c, "year required")
		return
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		JSONValidation(c, "month required")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		item, err := s.statsSvc.MonthBill(db, year, month)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, item)
	})
}

func (s *Server) monthlyStats(c *gin.Context) {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil {
		JSONValidation(c, "year required")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		items, err := s.statsSvc.MonthlyStats(db, year, parseStatsFilter(c))
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, gin.H{"year": year, "granularity": "month", "items": orEmptySlice(items)})
	})
}

func (s *Server) monthSeries(c *gin.Context) {
	if rejectCursorAndAfter(c) {
		return
	}
	cursor, ok := parseYearMonthQuery(c.Query("cursor"))
	if !ok {
		JSONValidation(c, "cursor must be YYYY-MM")
		return
	}
	after, ok := parseYearMonthQuery(c.Query("after"))
	if !ok {
		JSONValidation(c, "after must be YYYY-MM")
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))
	s.withLedger(c, func(db *sql.DB) {
		page, err := s.statsSvc.MonthSeries(db, cursor, after, limit, parseStatsFilter(c))
		if serviceErr(c, err) {
			return
		}
		if page.Items == nil {
			page.Items = []service.MonthlyStatPoint{}
		}
		c.JSON(http.StatusOK, page)
	})
}

func (s *Server) homeRankings(c *gin.Context) {
	months, _ := strconv.Atoi(c.DefaultQuery("months", "6"))
	s.withLedger(c, func(db *sql.DB) {
		r, err := s.statsSvc.HomeRankings(db, months)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, r)
	})
}

func (s *Server) yearlyStats(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		items, err := s.statsSvc.YearlyStats(db, parseStatsFilter(c))
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, gin.H{"granularity": "year", "items": orEmptySlice(items)})
	})
}

func (s *Server) yearSeries(c *gin.Context) {
	if rejectCursorAndAfter(c) {
		return
	}
	var cursor, after *int
	if raw := strings.TrimSpace(c.Query("cursor")); raw != "" {
		y, err := strconv.Atoi(raw)
		if err != nil {
			JSONValidation(c, "cursor must be YYYY")
			return
		}
		cursor = &y
	}
	if raw := strings.TrimSpace(c.Query("after")); raw != "" {
		y, err := strconv.Atoi(raw)
		if err != nil {
			JSONValidation(c, "after must be YYYY")
			return
		}
		after = &y
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	s.withLedger(c, func(db *sql.DB) {
		page, err := s.statsSvc.YearSeries(db, cursor, after, limit, parseStatsFilter(c))
		if serviceErr(c, err) {
			return
		}
		if page.Items == nil {
			page.Items = []service.YearlyStatItem{}
		}
		c.JSON(http.StatusOK, page)
	})
}

func (s *Server) yearStat(c *gin.Context) {
	year, err := strconv.Atoi(c.Param("year"))
	if err != nil {
		JSONValidation(c, "invalid year")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		item, err := s.statsSvc.YearStat(db, year, parseStatsFilter(c))
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, item)
	})
}

func (s *Server) annualReport(c *gin.Context) {
	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 || year > 2100 {
		JSONValidation(c, "year must be YYYY between 2000 and 2100")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		report, err := s.statsSvc.AnnualReport(db, year)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, report)
	})
}

func (s *Server) annualDefaultYear(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		year, err := s.statsSvc.DefaultAnnualReportYear(db)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, gin.H{"year": year})
	})
}

func (s *Server) getSettings(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		st, err := s.settingsSvc.Get(db)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, st)
	})
}

func (s *Server) updateSettings(c *gin.Context) {
	var req service.Settings
	if err := c.ShouldBindJSON(&req); err != nil {
		JSONValidation(c, "invalid body")
		return
	}
	s.withLedger(c, func(db *sql.DB) {
		st, err := s.settingsSvc.Update(db, req)
		if serviceErr(c, err) {
			return
		}
		c.JSON(http.StatusOK, st)
	})
}
