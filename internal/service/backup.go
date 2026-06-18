package service

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/minibill/minibill/internal/i18n"
)

const (
	BackupIntervalDaily   = "daily"
	BackupIntervalWeekly  = "weekly"
	BackupIntervalMonthly = "monthly"

	BackupStatusOK      = "ok"
	BackupStatusError   = "error"
	BackupStatusSkipped = "skipped"

	backupNameMiddle = "轻账单_备份"
	defaultKeepCount = 30

	MaxBackupZipBytes = 50 << 20 // 50 MiB
)

var (
	ErrBackupDirNotConfigured = fmt.Errorf("%w: backup directory not configured", ErrValidation)
	ErrInvalidBackupInterval  = fmt.Errorf("%w: invalid backup interval", ErrValidation)
	ErrInvalidBackupHour      = fmt.Errorf("%w: backup hour must be 0-23", ErrValidation)
	ErrInvalidBackupMinute    = fmt.Errorf("%w: backup minute must be 0, 10, 20, 30, 40, or 50", ErrValidation)
	ErrInvalidBackupWeekday   = fmt.Errorf("%w: backup weekday must be 0-6", ErrValidation)
	ErrInvalidBackupMonthDay  = fmt.Errorf("%w: backup month day must be 1-28", ErrValidation)
	ErrInvalidKeepCount       = fmt.Errorf("%w: keep count must be at least 1", ErrValidation)

	invalidFilenameChars = regexp.MustCompile(`[/\\:*?"<>|]`)
)

type BackupConfig struct {
	Enabled    bool   `json:"enabled"`
	Interval   string `json:"interval"`
	Hour       int    `json:"hour"`
	Minute     int    `json:"minute"`
	Weekday    int    `json:"weekday"`
	MonthDay   int    `json:"month_day"`
	KeepCount  int    `json:"keep_count"`
	LastRunAt  string `json:"last_run_at,omitempty"`
	LastStatus string `json:"last_status,omitempty"`
	LastFile   string `json:"last_file,omitempty"`
	LastError  string `json:"last_error,omitempty"`
}

type BackupView struct {
	BackupConfig
	DirConfigured bool   `json:"dir_configured"`
	DirPath       string `json:"dir_path,omitempty"`
}

type BackupFileInfo struct {
	Filename   string `json:"filename"`
	Size       int64  `json:"size"`
	ModifiedAt string `json:"modified_at"`
}

type BackupFilesPage struct {
	DirConfigured bool             `json:"dir_configured"`
	DirPath       string           `json:"dir_path,omitempty"`
	UserDir       string           `json:"user_dir,omitempty"`
	Items         []BackupFileInfo `json:"items"`
}

type BackupService struct {
	backupDir string
	csvSvc    *LedgerCSVService
	now       func() time.Time
	loc       *time.Location
}

func NewBackupService(backupDir string, csvSvc *LedgerCSVService) *BackupService {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	return &BackupService{
		backupDir: strings.TrimSpace(backupDir),
		csvSvc:    csvSvc,
		now:       time.Now,
		loc:       loc,
	}
}

func (s *BackupService) DirConfigured() bool {
	return s.backupDir != ""
}

func (s *BackupService) DirPath() string {
	return s.backupDir
}

func (s *BackupService) CheckDirWritable() error {
	if !s.DirConfigured() {
		return ErrBackupDirNotConfigured
	}
	if err := os.MkdirAll(s.backupDir, 0o755); err != nil {
		return fmt.Errorf("backup dir create failed: %w", err)
	}
	info, err := os.Stat(s.backupDir)
	if err != nil {
		return fmt.Errorf("backup dir unavailable: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("backup dir is not a directory")
	}
	test := filepath.Join(s.backupDir, ".minibill-write-test")
	if err := os.WriteFile(test, []byte("ok"), 0o600); err != nil {
		return fmt.Errorf("backup dir not writable: %w", err)
	}
	_ = os.Remove(test)
	return nil
}

func defaultBackupConfig() BackupConfig {
	return BackupConfig{
		Interval:  BackupIntervalDaily,
		Hour:      3,
		Weekday:   0,
		MonthDay:  1,
		KeepCount: defaultKeepCount,
	}
}

func (s *BackupService) GetConfig(db *sql.DB) (*BackupConfig, error) {
	cfg := defaultBackupConfig()
	var enabled int
	var lastRunAt, lastStatus, lastFile, lastError sql.NullString
	err := db.QueryRow(`
		SELECT backup_enabled, backup_interval, backup_hour, backup_minute, backup_weekday, backup_month_day,
		       backup_keep_count, backup_last_run_at, backup_last_status, backup_last_file, backup_last_error
		FROM settings WHERE id=1`,
	).Scan(
		&enabled, &cfg.Interval, &cfg.Hour, &cfg.Minute, &cfg.Weekday, &cfg.MonthDay, &cfg.KeepCount,
		&lastRunAt, &lastStatus, &lastFile, &lastError,
	)
	if err == sql.ErrNoRows {
		return &cfg, nil
	}
	if err != nil {
		return nil, err
	}
	cfg.Enabled = enabled == 1
	if cfg.KeepCount <= 0 {
		cfg.KeepCount = defaultKeepCount
	}
	if lastRunAt.Valid {
		cfg.LastRunAt = lastRunAt.String
	}
	if lastStatus.Valid {
		cfg.LastStatus = lastStatus.String
	}
	if lastFile.Valid {
		cfg.LastFile = lastFile.String
	}
	if lastError.Valid {
		cfg.LastError = lastError.String
	}
	return &cfg, nil
}

func validateBackupConfig(cfg BackupConfig) error {
	switch cfg.Interval {
	case BackupIntervalDaily, BackupIntervalWeekly, BackupIntervalMonthly:
	default:
		return ErrInvalidBackupInterval
	}
	if cfg.Hour < 0 || cfg.Hour > 23 {
		return ErrInvalidBackupHour
	}
	if !validBackupMinute(cfg.Minute) {
		return ErrInvalidBackupMinute
	}
	if cfg.Interval == BackupIntervalWeekly && (cfg.Weekday < 0 || cfg.Weekday > 6) {
		return ErrInvalidBackupWeekday
	}
	if cfg.Interval == BackupIntervalMonthly && (cfg.MonthDay < 1 || cfg.MonthDay > 28) {
		return ErrInvalidBackupMonthDay
	}
	if cfg.KeepCount < 1 {
		return ErrInvalidKeepCount
	}
	return nil
}

func (s *BackupService) UpdateConfig(db *sql.DB, cfg BackupConfig) (*BackupConfig, error) {
	if err := validateBackupConfig(cfg); err != nil {
		return nil, err
	}
	enabled := 0
	if cfg.Enabled {
		enabled = 1
	}
	_, err := db.Exec(`
		INSERT INTO settings (
			id, backup_enabled, backup_interval, backup_hour, backup_minute, backup_weekday, backup_month_day, backup_keep_count
		) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			backup_enabled=excluded.backup_enabled,
			backup_interval=excluded.backup_interval,
			backup_hour=excluded.backup_hour,
			backup_minute=excluded.backup_minute,
			backup_weekday=excluded.backup_weekday,
			backup_month_day=excluded.backup_month_day,
			backup_keep_count=excluded.backup_keep_count`,
		enabled, cfg.Interval, cfg.Hour, cfg.Minute, cfg.Weekday, cfg.MonthDay, cfg.KeepCount,
	)
	if err != nil {
		return nil, err
	}
	return s.GetConfig(db)
}

func (s *BackupService) View(db *sql.DB) (*BackupView, error) {
	cfg, err := s.GetConfig(db)
	if err != nil {
		return nil, err
	}
	return &BackupView{
		BackupConfig:  *cfg,
		DirConfigured: s.DirConfigured(),
		DirPath:       s.backupDir,
	}, nil
}

func sanitizeBackupUsername(username string) string {
	safe := invalidFilenameChars.ReplaceAllString(strings.TrimSpace(username), "_")
	if safe == "" {
		return "user"
	}
	return safe
}

func backupBaseName(username string, at time.Time) string {
	return fmt.Sprintf("%s_%s_%s", sanitizeBackupUsername(username), backupNameMiddle, at.Format("20060102150405"))
}

func (s *BackupService) resolveZipPath(userDir, base string) (string, error) {
	candidate := filepath.Join(userDir, base+".zip")
	if _, err := os.Stat(candidate); os.IsNotExist(err) {
		return candidate, nil
	} else if err != nil {
		return "", err
	}
	for i := 2; i < 1000; i++ {
		candidate = filepath.Join(userDir, fmt.Sprintf("%s-%d.zip", base, i))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("too many backups for %s", base)
}

func (s *BackupService) userBackupDir(username string) string {
	return filepath.Join(s.backupDir, sanitizeBackupUsername(username))
}

func (s *BackupService) ExportToZip(db *sql.DB, userID int64, username string) (string, error) {
	if err := s.CheckDirWritable(); err != nil {
		return "", err
	}
	cfg, err := s.GetConfig(db)
	if err != nil {
		return "", err
	}

	now := s.now().In(s.loc)
	base := backupBaseName(username, now)
	csvName := base + ".csv"

	userDir := s.userBackupDir(username)
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", err
	}
	zipPath, err := s.resolveZipPath(userDir, base)
	if err != nil {
		return "", err
	}

	st, _ := (&SettingsService{}).Get(db)
	locale := i18n.DefaultLocale
	if st != nil && st.Locale != "" {
		locale = st.Locale
	}
	var csvBuf bytes.Buffer
	if err := s.csvSvc.Export(db, userID, locale, &csvBuf); err != nil {
		return "", err
	}

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return "", err
	}
	zw := zip.NewWriter(zipFile)
	w, err := zw.Create(csvName)
	if err != nil {
		_ = zw.Close()
		_ = zipFile.Close()
		_ = os.Remove(zipPath)
		return "", err
	}
	if _, err := io.Copy(w, &csvBuf); err != nil {
		_ = zw.Close()
		_ = zipFile.Close()
		_ = os.Remove(zipPath)
		return "", err
	}
	if err := zw.Close(); err != nil {
		_ = zipFile.Close()
		_ = os.Remove(zipPath)
		return "", err
	}
	if err := zipFile.Close(); err != nil {
		_ = os.Remove(zipPath)
		return "", err
	}

	filename := filepath.Base(zipPath)
	if err := s.PruneOldBackups(userDir, cfg.KeepCount); err != nil {
		return filename, err
	}
	return filename, nil
}

func (s *BackupService) PruneOldBackups(dir string, keepCount int) error {
	if keepCount < 1 {
		return nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	type zipFile struct {
		path string
		mod  time.Time
	}
	var zips []zipFile
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		zips = append(zips, zipFile{path: filepath.Join(dir, e.Name()), mod: info.ModTime()})
	}
	if len(zips) <= keepCount {
		return nil
	}
	sort.Slice(zips, func(i, j int) bool {
		return zips[i].mod.After(zips[j].mod)
	})
	for _, z := range zips[keepCount:] {
		_ = os.Remove(z.path)
	}
	return nil
}

func (s *BackupService) RecordRun(db *sql.DB, filename, status, errMsg string) error {
	now := s.now().In(s.loc).Format(time.RFC3339)
	var lastFile, lastError sql.NullString
	if filename != "" {
		lastFile = sql.NullString{String: filename, Valid: true}
	}
	if errMsg != "" {
		lastError = sql.NullString{String: errMsg, Valid: true}
	}
	_, err := db.Exec(`
		UPDATE settings SET
			backup_last_run_at=?,
			backup_last_status=?,
			backup_last_file=?,
			backup_last_error=?
		WHERE id=1`,
		now, status, lastFile, lastError,
	)
	return err
}

func (s *BackupService) RunBackup(db *sql.DB, userID int64, username string) (string, error) {
	filename, err := s.ExportToZip(db, userID, username)
	if err != nil {
		_ = s.RecordRun(db, "", BackupStatusError, err.Error())
		return "", err
	}
	if err := s.RecordRun(db, filename, BackupStatusOK, ""); err != nil {
		return filename, err
	}
	return filename, nil
}

func safeBackupZipName(filename string) (string, error) {
	name := filepath.Base(strings.TrimSpace(filename))
	if name == "" || name == "." || strings.Contains(name, "..") {
		return "", fmt.Errorf("%w: invalid backup filename", ErrValidation)
	}
	if !strings.HasSuffix(strings.ToLower(name), ".zip") {
		return "", fmt.Errorf("%w: backup file must be a .zip", ErrValidation)
	}
	return name, nil
}

func (s *BackupService) resolveUserZipPath(username, filename string) (string, error) {
	safe, err := safeBackupZipName(filename)
	if err != nil {
		return "", err
	}
	userDir, err := filepath.Abs(s.userBackupDir(username))
	if err != nil {
		return "", err
	}
	zipPath, err := filepath.Abs(filepath.Join(userDir, safe))
	if err != nil {
		return "", err
	}
	if zipPath != userDir && !strings.HasPrefix(zipPath, userDir+string(os.PathSeparator)) {
		return "", fmt.Errorf("%w: invalid backup file path", ErrValidation)
	}
	info, err := os.Stat(zipPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("%w: 备份文件不存在", ErrValidation)
		}
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("%w: not a backup file", ErrValidation)
	}
	if info.Size() > MaxBackupZipBytes {
		return "", fmt.Errorf("%w: 备份文件过大", ErrValidation)
	}
	return zipPath, nil
}

func openCSVFromZip(zipPath string) (io.ReadCloser, error) {
	zipInfo, err := os.Stat(zipPath)
	if err != nil {
		return nil, err
	}
	if zipInfo.Size() > MaxBackupZipBytes {
		return nil, fmt.Errorf("%w: 备份 zip 过大", ErrValidation)
	}
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid zip file", ErrValidation)
	}
	var csvEntry *zip.File
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name := strings.ToLower(filepath.Base(f.Name))
		if !strings.HasSuffix(name, ".csv") {
			continue
		}
		if csvEntry != nil {
			_ = r.Close()
			return nil, fmt.Errorf("%w: backup zip must contain a single csv file", ErrValidation)
		}
		csvEntry = f
	}
	if csvEntry == nil {
		_ = r.Close()
		return nil, fmt.Errorf("%w: backup zip has no csv file", ErrValidation)
	}
	if csvEntry.UncompressedSize64 > uint64(MaxLedgerCSVImportBytes) {
		_ = r.Close()
		return nil, fmt.Errorf("%w: 备份 CSV 过大", ErrValidation)
	}
	rc, err := csvEntry.Open()
	if err != nil {
		_ = r.Close()
		return nil, err
	}
	return &zipCSVReader{reader: r, csv: rc}, nil
}

type zipCSVReader struct {
	reader *zip.ReadCloser
	csv    io.ReadCloser
}

func (z *zipCSVReader) Read(p []byte) (int, error) {
	return z.csv.Read(p)
}

func (z *zipCSVReader) Close() error {
	err := z.csv.Close()
	if closeErr := z.reader.Close(); err == nil {
		err = closeErr
	}
	return err
}

func (s *BackupService) ListBackupFiles(username string) (*BackupFilesPage, error) {
	page := &BackupFilesPage{
		DirConfigured: s.DirConfigured(),
		DirPath:       s.DirPath(),
		Items:         []BackupFileInfo{},
	}
	if !s.DirConfigured() {
		return page, nil
	}
	userDir := s.userBackupDir(username)
	page.UserDir = userDir
	entries, err := os.ReadDir(userDir)
	if err != nil {
		if os.IsNotExist(err) {
			return page, nil
		}
		return nil, err
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".zip") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		page.Items = append(page.Items, BackupFileInfo{
			Filename:   e.Name(),
			Size:       info.Size(),
			ModifiedAt: info.ModTime().In(s.loc).Format(time.RFC3339),
		})
	}
	sort.Slice(page.Items, func(i, j int) bool {
		return page.Items[i].ModifiedAt > page.Items[j].ModifiedAt
	})
	return page, nil
}

func (s *BackupService) RestoreFromZip(db *sql.DB, userID int64, username, filename string) (*ImportResult, error) {
	if !s.DirConfigured() {
		return nil, ErrBackupDirNotConfigured
	}
	zipPath, err := s.resolveUserZipPath(username, filename)
	if err != nil {
		return nil, err
	}
	rc, err := openCSVFromZip(zipPath)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return s.csvSvc.ImportReplace(db, userID, rc)
}

// scheduleSlotStart 返回当前周期内计划执行时刻（本地时区）；若今天/本周/本月不是计划日则 ok=false。
func (s *BackupService) scheduleSlotStart(cfg BackupConfig, now time.Time) (time.Time, bool) {
	y, m, d := now.Date()
	switch cfg.Interval {
	case BackupIntervalDaily:
	case BackupIntervalWeekly:
		if int(now.Weekday()) != cfg.Weekday {
			return time.Time{}, false
		}
	case BackupIntervalMonthly:
		if now.Day() != cfg.MonthDay {
			return time.Time{}, false
		}
	default:
		return time.Time{}, false
	}
	return time.Date(y, m, d, cfg.Hour, cfg.Minute, 0, 0, s.loc), true
}

func validBackupMinute(m int) bool {
	switch m {
	case 0, 10, 20, 30, 40, 50:
		return true
	default:
		return false
	}
}

func (s *BackupService) IsDue(cfg BackupConfig, lastRunAt string) bool {
	if !cfg.Enabled {
		return false
	}
	now := s.now().In(s.loc)
	slotStart, ok := s.scheduleSlotStart(cfg, now)
	if !ok || now.Before(slotStart) {
		return false
	}
	if lastRunAt == "" {
		return true
	}
	t, err := time.Parse(time.RFC3339, lastRunAt)
	if err != nil {
		return true
	}
	lt := t.In(s.loc)
	if cfg.LastStatus == BackupStatusOK && !lt.Before(slotStart) {
		return false
	}
	return true
}
