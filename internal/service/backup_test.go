package service

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/minibill/minibill/internal/testutil"
)

func newBackupForTest(t *testing.T, dir string, now time.Time) *BackupService {
	t.Helper()
	stats := NewStatsService().WithNow(func() time.Time { return now })
	txSvc := NewTransactionService(stats)
	csvSvc := NewLedgerCSVService(txSvc, stats, nil)
	svc := NewBackupService(dir, csvSvc)
	svc.now = func() time.Time { return now }
	svc.loc = time.FixedZone("CST", 8*3600)
	return svc
}

func TestBackupExportZipFilename(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
	db := testutil.OpenLedgerDB(t)
	defer db.Close()

	svc := newBackupForTest(t, dir, now)
	filename, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}
	want := "alice_轻账单_备份_20250615100000.zip"
	if filename != want {
		t.Fatalf("filename = %q, want %q", filename, want)
	}

	zipPath := filepath.Join(dir, "alice", want)
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if len(r.File) != 1 {
		t.Fatalf("zip entries = %d, want 1", len(r.File))
	}
	if r.File[0].Name != "alice_轻账单_备份_20250615100000.csv" {
		t.Fatalf("csv name = %q", r.File[0].Name)
	}
	rc, err := r.File[0].Open()
	if err != nil {
		t.Fatal(err)
	}
	defer rc.Close()
	body, _ := io.ReadAll(rc)
	if !strings.HasPrefix(string(body), utf8BOM) {
		t.Fatal("csv missing BOM")
	}
	if !strings.Contains(string(body), ledgerCSVHeader0) {
		t.Fatal("csv missing header")
	}
}

func TestBackupSameDaySequence(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, dir, now)

	first, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}
	if first != "alice_轻账单_备份_20250615100000.zip" {
		t.Fatalf("first = %q", first)
	}
	if second != "alice_轻账单_备份_20250615100000-2.zip" {
		t.Fatalf("second = %q", second)
	}
}

func TestBackupPruneOldBackups(t *testing.T) {
	dir := t.TempDir()
	userDir := filepath.Join(dir, "alice")
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		t.Fatal(err)
	}
	base := time.Now()
	names := []string{
		"alice_轻账单_备份_20250601.zip",
		"alice_轻账单_备份_20250602.zip",
		"alice_轻账单_备份_20250603.zip",
		"alice_轻账单_备份_20250604.zip",
		"alice_轻账单_备份_20250605.zip",
	}
	for i, name := range names {
		path := filepath.Join(userDir, name)
		if err := os.WriteFile(path, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
		mod := base.Add(time.Duration(i) * time.Minute)
		_ = os.Chtimes(path, mod, mod)
	}
	svc := newBackupForTest(t, dir, base)
	if err := svc.PruneOldBackups(userDir, 3); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(userDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 {
		t.Fatalf("remaining = %d, want 3", len(entries))
	}
}

func TestBackupIsDue(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2025, 6, 15, 3, 0, 0, 0, loc)
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{
		Enabled:  true,
		Interval: BackupIntervalDaily,
		Hour:     3,
	}
	if !svc.IsDue(cfg, "") {
		t.Fatal("expected due at scheduled hour")
	}
	cfg.LastRunAt = now.Format(time.RFC3339)
	cfg.LastStatus = BackupStatusOK
	if svc.IsDue(cfg, cfg.LastRunAt) {
		t.Fatal("expected not due after success at scheduled slot")
	}
}

func TestBackupIsDueLaterSameDay(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2025, 6, 15, 15, 0, 0, 0, loc)
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{Enabled: true, Interval: BackupIntervalDaily, Hour: 3}
	if !svc.IsDue(cfg, "") {
		t.Fatal("expected due after scheduled hour on same day")
	}
}

func TestBackupIsDueNotDueBeforeHour(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2025, 6, 15, 2, 59, 0, 0, loc)
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{Enabled: true, Interval: BackupIntervalDaily, Hour: 3}
	if svc.IsDue(cfg, "") {
		t.Fatal("expected not due before scheduled hour")
	}
}

func TestBackupIsDueManualBeforeScheduled(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2025, 6, 15, 16, 0, 0, 0, loc)
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{
		Enabled:    true,
		Interval:   BackupIntervalDaily,
		Hour:       15,
		LastRunAt:  time.Date(2025, 6, 15, 10, 0, 0, 0, loc).Format(time.RFC3339),
		LastStatus: BackupStatusOK,
	}
	if !svc.IsDue(cfg, cfg.LastRunAt) {
		t.Fatal("expected due when manual backup was before scheduled slot")
	}
}

func TestBackupIsDueNotDueBeforeMinute(t *testing.T) {
	loc := time.FixedZone("CST", 8*3600)
	now := time.Date(2025, 6, 15, 3, 29, 0, 0, loc)
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{Enabled: true, Interval: BackupIntervalDaily, Hour: 3, Minute: 30}
	if svc.IsDue(cfg, "") {
		t.Fatal("expected not due before scheduled minute")
	}
	now = time.Date(2025, 6, 15, 3, 30, 0, 0, loc)
	svc.now = func() time.Time { return now }
	if !svc.IsDue(cfg, "") {
		t.Fatal("expected due at scheduled minute")
	}
}

func TestBackupUpdateConfigValidation(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	if _, err := svc.UpdateConfig(db, BackupConfig{
		Enabled:   true,
		Interval:  "yearly",
		Hour:      3,
		KeepCount: 10,
	}); err == nil {
		t.Fatal("expected validation error")
	}
	if _, err := svc.UpdateConfig(db, BackupConfig{
		Enabled:   true,
		Interval:  BackupIntervalDaily,
		Hour:      3,
		Minute:    15,
		KeepCount: 10,
	}); err == nil {
		t.Fatal("expected validation error for invalid minute")
	}
}

func TestBackupRecordRun(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	if err := svc.RecordRun(db, "alice_轻账单_备份_20250615100000.zip", BackupStatusOK, ""); err != nil {
		t.Fatal(err)
	}
	cfg, err := svc.GetConfig(db)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.LastFile != "alice_轻账单_备份_20250615100000.zip" {
		t.Fatalf("last_file = %q", cfg.LastFile)
	}
	if cfg.LastStatus != BackupStatusOK {
		t.Fatalf("last_status = %q", cfg.LastStatus)
	}
}

func TestBackupDirNotConfigured(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, "", time.Now())
	if _, err := svc.ExportToZip(db, 1, "alice"); err == nil {
		t.Fatal("expected error")
	}
	if svc.DirConfigured() {
		t.Fatal("expected dir not configured")
	}
}

func TestSanitizeBackupUsername(t *testing.T) {
	if got := sanitizeBackupUsername("a/b"); got != "a_b" {
		t.Fatalf("got %q", got)
	}
}

func TestBackupCheckDirWritable(t *testing.T) {
	dir := t.TempDir()
	svc := newBackupForTest(t, dir, time.Now())
	if err := svc.CheckDirWritable(); err != nil {
		t.Fatal(err)
	}
}

func TestBackupAutoCreatesBackupDir(t *testing.T) {
	parent := t.TempDir()
	dir := filepath.Join(parent, "backups", "nested")
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, dir, time.Now())
	_, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(dir); err != nil {
		t.Fatal("expected backup root dir to be created")
	}
}

func TestBackupExportCreatesUserSubdir(t *testing.T) {
	dir := t.TempDir()
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, dir, time.Now())
	_, err := svc.ExportToZip(db, 1, "bob")
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(dir, "bob"))
	if err != nil || !info.IsDir() {
		t.Fatal("expected user subdir")
	}
}

func TestBackupCSVBufferNonEmpty(t *testing.T) {
	dir := t.TempDir()
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	_, _ = db.Exec(`INSERT INTO transactions (amount, type, transaction_date, note) VALUES (100,'expense','2025-06-01','t')`)
	svc := newBackupForTest(t, dir, time.Now())
	filename, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}
	zipPath := filepath.Join(dir, "alice", filename)
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	rc, _ := r.File[0].Open()
	body, _ := io.ReadAll(rc)
	_ = rc.Close()
	if len(body) < 10 {
		t.Fatal("csv too small")
	}
}

func TestBackupGetConfigDefaults(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	cfg, err := svc.GetConfig(db)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Interval != BackupIntervalDaily || cfg.KeepCount != defaultKeepCount {
		t.Fatalf("defaults wrong: %+v", cfg)
	}
}

func TestBackupView(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, "/tmp/backups", time.Now())
	view, err := svc.View(db)
	if err != nil {
		t.Fatal(err)
	}
	if !view.DirConfigured || view.DirPath != "/tmp/backups" {
		t.Fatalf("view = %+v", view)
	}
}

func TestBackupNullLastRun(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	_, _ = db.Exec(`UPDATE settings SET backup_last_run_at=NULL, backup_last_status=NULL WHERE id=1`)
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	cfg, err := svc.GetConfig(db)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.LastRunAt != "" {
		t.Fatalf("last_run_at = %q", cfg.LastRunAt)
	}
}

func TestBackupEnabledFlag(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	updated, err := svc.UpdateConfig(db, BackupConfig{
		Enabled:   true,
		Interval:  BackupIntervalWeekly,
		Hour:      8,
		Weekday:   1,
		MonthDay:  1,
		KeepCount: 5,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !updated.Enabled || updated.KeepCount != 5 {
		t.Fatalf("updated = %+v", updated)
	}
}

func TestBackupWeeklyNotDueWrongWeekday(t *testing.T) {
	now := time.Date(2025, 6, 15, 3, 0, 0, 0, time.FixedZone("CST", 8*3600)) // Sunday
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{Enabled: true, Interval: BackupIntervalWeekly, Hour: 3, Weekday: 1}
	if svc.IsDue(cfg, "") {
		t.Fatal("Sunday should not match Monday")
	}
}

func TestBackupMonthlyNotDueWrongDay(t *testing.T) {
	now := time.Date(2025, 6, 15, 3, 0, 0, 0, time.FixedZone("CST", 8*3600))
	svc := newBackupForTest(t, t.TempDir(), now)
	cfg := BackupConfig{Enabled: true, Interval: BackupIntervalMonthly, Hour: 3, MonthDay: 1}
	if svc.IsDue(cfg, "") {
		t.Fatal("day 15 should not match month day 1")
	}
}

func TestBackupInvalidHour(t *testing.T) {
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, t.TempDir(), time.Now())
	err := validateBackupConfig(BackupConfig{Interval: BackupIntervalDaily, Hour: 25, KeepCount: 1})
	if err == nil {
		t.Fatal("expected error")
	}
	_ = svc
}

func TestBackupListAndRestoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2025, 6, 15, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
	db := testutil.OpenLedgerDB(t)
	defer db.Close()
	svc := newBackupForTest(t, dir, now)

	filename, err := svc.ExportToZip(db, 1, "alice")
	if err != nil {
		t.Fatal(err)
	}

	page, err := svc.ListBackupFiles("alice")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].Filename != filename {
		t.Fatalf("items = %+v, want %q", page.Items, filename)
	}
	if page.UserDir != filepath.Join(dir, "alice") {
		t.Fatalf("user_dir = %q", page.UserDir)
	}

	_, err = svc.RestoreFromZip(db, 1, "alice", "../../../etc/passwd")
	if err == nil {
		t.Fatal("expected path traversal rejection")
	}

	result, err := svc.RestoreFromZip(db, 1, "alice", filename)
	if err != nil {
		t.Fatal(err)
	}
	if result.ImportedTransactions < 0 {
		t.Fatal("expected import result")
	}
}
