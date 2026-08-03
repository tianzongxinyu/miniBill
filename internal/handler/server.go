package handler

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/apierr"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/cache"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/i18n"
	"github.com/minibill/minibill/internal/middleware"
	"github.com/minibill/minibill/internal/service"
	"github.com/minibill/minibill/internal/systemdb"
	"github.com/minibill/minibill/internal/userdb"
)

type Server struct {
	cfg           config.Config
	version       string
	system        *systemdb.Store
	userFactory   *userdb.Factory
	authSvc       *auth.Service
	statsSvc      *service.StatsService
	txSvc         *service.TransactionService
	tagSvc        *service.TagService
	contactSvc    *service.ContactService
	balanceSvc    *service.BalanceService
	settingsSvc   *service.SettingsService
	ledgerCSVSvc  *service.LedgerCSVService
	backupSvc     *service.BackupService
	metaStore     *cache.LedgerMetaStore
	dataPathMu    sync.RWMutex
	dataPathCache map[int64]string
}

func NewServer(cfg config.Config, system *systemdb.Store, factory *userdb.Factory, authSvc *auth.Service) *Server {
	return NewServerWithVersion(cfg, system, factory, authSvc, "")
}

func NewServerWithVersion(cfg config.Config, system *systemdb.Store, factory *userdb.Factory, authSvc *auth.Service, version string) *Server {
	statsSvc := service.NewStatsService()
	txSvc := service.NewTransactionService(statsSvc)
	metaStore := cache.NewLedgerMetaStore(0)
	ledgerCSVSvc := service.NewLedgerCSVService(txSvc, statsSvc, metaStore)
	return &Server{
		cfg:           cfg,
		version:       version,
		system:        system,
		userFactory:   factory,
		authSvc:       authSvc,
		statsSvc:      statsSvc,
		txSvc:         txSvc,
		tagSvc:        &service.TagService{},
		contactSvc:    &service.ContactService{},
		balanceSvc:    service.NewBalanceService(statsSvc),
		settingsSvc:   &service.SettingsService{},
		ledgerCSVSvc:  ledgerCSVSvc,
		backupSvc:     service.NewBackupService(cfg.BackupDir, ledgerCSVSvc),
		metaStore:     metaStore,
		dataPathCache: make(map[int64]string),
	}
}

func (s *Server) BackupService() *service.BackupService {
	return s.backupSvc
}

func (s *Server) Router() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())
	if gin.Mode() != gin.ReleaseMode {
		r.Use(gin.Logger())
	}

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		body := gin.H{"status": "ok"}
		if s.version != "" {
			body["version"] = s.version
		}
		c.JSON(http.StatusOK, body)
	})

	authGroup := api.Group("/auth")
	authGroup.Use(middleware.AuthRateLimit())
	authGroup.GET("/registration", s.registrationStatus)
	authGroup.POST("/register", s.register)
	authGroup.POST("/login", s.login)
	authGroup.POST("/logout", s.logout)

	protected := api.Group("")
	protected.Use(middleware.Auth(s.authSvc, s.system.GetAuthGate))
	protected.GET("/auth/session", s.session)
	protected.PUT("/auth/password", s.changePassword)
	protected.GET("/ledgers", s.listLedgers)
	protected.GET("/users/directory", s.listUserDirectory)
	protected.GET("/ledger/grants", s.listLedgerGrants)
	protected.PUT("/ledger/grants", s.upsertLedgerGrant)
	protected.DELETE("/ledger/grants/:granteeUserId", s.deleteLedgerGrant)

	adminGroup := protected.Group("/admin")
	adminGroup.Use(middleware.RequireAdmin(s.lookupIsAdmin))
	adminGroup.GET("/users", s.adminListUsers)
	adminGroup.POST("/users", s.adminCreateUser)
	adminGroup.PUT("/users/:id", s.adminUpdateUser)
	adminGroup.POST("/users/:id/reset-password", s.adminResetPassword)
	adminGroup.DELETE("/users/:id", s.adminDeleteUser)

	protected.GET("/meta/editable-range", s.editableRange)
	protected.GET("/meta/earliest-month", s.earliestMonth)
	protected.GET("/meta/transaction-tags", s.transactionTags)
	protected.GET("/meta/transaction-contacts", s.transactionContacts)
	protected.GET("/tags", s.listTags)
	protected.POST("/tags", s.createTag)
	protected.GET("/tags/:id", s.getTag)
	protected.PUT("/tags/:id", s.updateTag)
	protected.DELETE("/tags/:id", s.deleteTag)
	protected.GET("/contacts", s.listContacts)
	protected.GET("/contacts/:id", s.getContact)
	protected.POST("/contacts", s.createContact)
	protected.PUT("/contacts/:id", s.updateContact)
	protected.DELETE("/contacts/:id", s.deleteContact)
	protected.GET("/transactions", s.listTransactions)
	protected.GET("/transactions/:id", s.getTransaction)
	protected.POST("/transactions", s.createTransaction)
	protected.PUT("/transactions/:id", s.updateTransaction)
	protected.DELETE("/transactions/:id", s.deleteTransaction)
	protected.GET("/monthly-balances", s.listBalances)
	protected.GET("/monthly-balances/:year/:month", s.getBalance)
	protected.PUT("/monthly-balances/:year/:month", s.upsertBalance)
	protected.DELETE("/monthly-balances/:year/:month", s.deleteBalance)
	protected.GET("/stats/dashboard", s.dashboard)
	protected.GET("/stats/month-bills", s.monthBills)
	protected.GET("/stats/month-bill", s.monthBill)
	protected.GET("/stats/monthly", s.monthlyStats)
	protected.GET("/stats/month-series", s.monthSeries)
	protected.GET("/stats/home-rankings", s.homeRankings)
	protected.GET("/stats/yearly", s.yearlyStats)
	protected.GET("/stats/year-series", s.yearSeries)
	protected.GET("/stats/yearly/:year", s.yearStat)
	protected.GET("/stats/annual-report", s.annualReport)
	protected.GET("/stats/annual-default-year", s.annualDefaultYear)
	protected.GET("/settings", s.getSettings)
	protected.PUT("/settings", s.updateSettings)
	protected.GET("/ledger/export", s.exportLedgerCSV)
	protected.POST("/ledger/import", s.importLedgerCSV)
	protected.GET("/backup", s.getBackup)
	protected.PUT("/backup", s.updateBackup)
	protected.POST("/backup/run", s.runBackup)
	protected.GET("/backup/files", s.listBackupFiles)
	protected.POST("/backup/restore", s.restoreBackup)

	return r
}

var errLedgerForbidden = errors.New("ledger forbidden")

func (s *Server) ledgerDB(c *gin.Context) (*sql.DB, func(), error) {
	callerID := middleware.GetUserID(c)
	ownerID := callerID
	if h := strings.TrimSpace(c.GetHeader("X-Ledger-Owner-Id")); h != "" {
		id, err := strconv.ParseInt(h, 10, 64)
		if err != nil || id <= 0 {
			return nil, nil, errLedgerForbidden
		}
		ownerID = id
	}

	owner, err := s.system.GetByID(ownerID)
	if err != nil {
		return nil, nil, err
	}
	if owner == nil {
		return nil, nil, errLedgerForbidden
	}
	if owner.Disabled {
		return nil, nil, errLedgerForbidden
	}

	perm := "owner"
	if ownerID != callerID {
		p, err := s.system.GetGrantPermission(ownerID, callerID)
		if err != nil {
			return nil, nil, err
		}
		if p == "" {
			return nil, nil, errLedgerForbidden
		}
		perm = p
	}

	c.Set(middleware.LedgerOwnerIDKey, ownerID)
	c.Set(middleware.LedgerPermissionKey, perm)

	dataPath, err := s.cachedDataPath(ownerID)
	if err != nil {
		return nil, nil, err
	}
	db, err := s.userFactory.Open(ownerID, dataPath)
	if err != nil {
		return nil, nil, err
	}
	return db, func() {}, nil
}

func (s *Server) lookupIsAdmin(userID int64) (bool, error) {
	u, err := s.system.GetByID(userID)
	if err != nil {
		return false, err
	}
	if u == nil {
		return false, nil
	}
	return u.IsAdmin && !u.Disabled, nil
}

func (s *Server) clearDataPathCache(userID int64) {
	s.dataPathMu.Lock()
	delete(s.dataPathCache, userID)
	s.dataPathMu.Unlock()
}

func (s *Server) cachedDataPath(userID int64) (string, error) {
	s.dataPathMu.RLock()
	if path, ok := s.dataPathCache[userID]; ok {
		s.dataPathMu.RUnlock()
		return path, nil
	}
	s.dataPathMu.RUnlock()

	user, err := s.system.GetByID(userID)
	if err != nil || user == nil {
		return "", sql.ErrNoRows
	}

	s.dataPathMu.Lock()
	s.dataPathCache[userID] = user.DataPath
	s.dataPathMu.Unlock()
	return user.DataPath, nil
}

func (s *Server) invalidateLedgerMeta(c *gin.Context) {
	ownerID := middleware.GetLedgerOwnerID(c)
	if ownerID == 0 {
		ownerID = middleware.GetUserID(c)
	}
	s.metaStore.Invalidate(ownerID)
}

func (s *Server) ledgerOwnerID(c *gin.Context) int64 {
	if id := middleware.GetLedgerOwnerID(c); id != 0 {
		return id
	}
	return middleware.GetUserID(c)
}

func (s *Server) editableRange(c *gin.Context) {
	min, max := domain.EditableDateRange(time.Now())
	c.JSON(http.StatusOK, gin.H{"min_date": min, "max_date": max})
}

func (s *Server) earliestMonth(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		ym, err := s.statsSvc.EarliestMonth(db)
		if serviceErr(c, err) {
			return
		}
		if ym == nil {
			c.JSON(http.StatusOK, gin.H{"year": nil, "month": nil})
			return
		}
		c.JSON(http.StatusOK, gin.H{"year": ym.Year, "month": ym.Month})
	})
}

func (s *Server) transactionTags(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		list, err := s.txSvc.ListUsedTags(db)
		if serviceErr(c, err) {
			return
		}
		jsonItems(c, list)
	})
}

func (s *Server) transactionContacts(c *gin.Context) {
	s.withLedger(c, func(db *sql.DB) {
		list, err := s.txSvc.ListUsedContacts(db)
		if serviceErr(c, err) {
			return
		}
		jsonItems(c, list)
	})
}

func serviceErr(c *gin.Context, err error) bool {
	if err == nil {
		return false
	}
	locale := localeFrom(c)
	if errors.Is(err, service.ErrValidation) {
		msg := err.Error()
		if idx := strings.Index(msg, ": "); idx >= 0 {
			key := msg[idx+2:]
			JSONValidation(c, translateValidation(locale, key))
			return true
		}
		JSONValidation(c, msg)
		return true
	}
	if err == sql.ErrNoRows {
		JSONNotFound(c, i18n.T(locale, "error.not_found"))
		return true
	}
	if errors.Is(err, service.ErrSystemTransaction) {
		JSONError(c, http.StatusForbidden, "FORBIDDEN", i18n.T(locale, "error.system_tx_forbidden"))
		return true
	}
	if err == service.ErrSystemTag {
		JSONValidation(c, i18n.T(locale, "error.system_tag_forbidden"))
		return true
	}
	if err == service.ErrTagInUse {
		JSONValidation(c, i18n.T(locale, "error.tag_in_use"))
		return true
	}
	if err == service.ErrContactInUse {
		JSONValidation(c, i18n.T(locale, "error.contact_in_use"))
		return true
	}
	log.Printf("internal error: %v", err)
	c.JSON(http.StatusInternalServerError, apierr.Body{Error: "INTERNAL", Message: i18n.T(locale, "error.internal")})
	return true
}

func parseID(c *gin.Context, key string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(key), 10, 64)
	if err != nil {
		JSONValidation(c, i18n.T(localeFrom(c), "error.invalid_id"))
		return 0, false
	}
	return id, true
}

func parseYearMonth(c *gin.Context) (int, int, bool) {
	y, err := strconv.Atoi(c.Param("year"))
	if err != nil {
		JSONValidation(c, i18n.T(localeFrom(c), "error.invalid_year"))
		return 0, 0, false
	}
	m, err := strconv.Atoi(c.Param("month"))
	if err != nil || m < 1 || m > 12 {
		JSONValidation(c, i18n.T(localeFrom(c), "error.invalid_month"))
		return 0, 0, false
	}
	return y, m, true
}

func parseTagIDs(c *gin.Context) []int64 {
	raw := c.QueryArray("tag_ids")
	var ids []int64
	for _, s := range raw {
		id, err := strconv.ParseInt(s, 10, 64)
		if err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func parseContactID(c *gin.Context) *int64 {
	s := strings.TrimSpace(c.Query("contact_id"))
	if s == "" {
		return nil
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return nil
	}
	return &id
}

func parseTagMatch(c *gin.Context) string {
	return service.NormalizeTagMatch(c.Query("tag_match"))
}

func parseStatsFilter(c *gin.Context) service.StatsFilter {
	return service.StatsFilter{
		TagIDs:    parseTagIDs(c),
		TagMatch:  parseTagMatch(c),
		ContactID: parseContactID(c),
		NoteQuery: strings.TrimSpace(c.Query("note")),
	}
}

func parseYearMonthQuery(raw string) (*domain.YearMonth, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	parts := strings.Split(raw, "-")
	if len(parts) != 2 {
		return nil, false
	}
	y, errY := strconv.Atoi(parts[0])
	m, errM := strconv.Atoi(parts[1])
	if errY != nil || errM != nil || m < 1 || m > 12 {
		return nil, false
	}
	ym := domain.YearMonth{Year: y, Month: m}
	return &ym, true
}

func rejectCursorAndAfter(c *gin.Context) bool {
	if c.Query("cursor") != "" && c.Query("after") != "" {
		JSONValidation(c, "cursor and after are mutually exclusive")
		return true
	}
	return false
}

func (s *Server) currentUser(c *gin.Context) (*systemdb.User, bool) {
	userID := middleware.GetUserID(c)
	user, err := s.system.GetByID(userID)
	if err != nil || user == nil {
		JSONUnauthorized(c)
		return nil, false
	}
	return user, true
}
