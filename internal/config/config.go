package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	minJWTSecretLen = 32
)

type Config struct {
	JWTSecret         string
	DataDir           string
	BackupDir         string
	Port              string
	GatewaySocket     string // Unix socket for fnOS unified gateway (optional)
	GatewayPrefix     string // e.g. /app/minibill; stripped before routing
	AllowRegistration bool
	SecureCookies     bool
	JWTExpireDays     int
	StaticDir         string
	MigrationsSystem  string
	MigrationsLedger  string
}

func Load() Config {
	expireDays, _ := strconv.Atoi(getEnv("JWT_EXPIRE_DAYS", "30"))
	if expireDays <= 0 {
		expireDays = 30
	}
	allowReg := getEnv("ALLOW_REGISTRATION", "true") == "true"
	secureCookies := getEnv("SECURE_COOKIES", "false") == "true"
	return Config{
		DataDir:           getEnv("DATA_DIR", "./data"),
		BackupDir:         getEnv("BACKUP_DIR", ""),
		Port:              getEnv("PORT", "8080"),
		GatewaySocket:     strings.TrimSpace(os.Getenv("GATEWAY_SOCKET")),
		GatewayPrefix:     strings.TrimRight(strings.TrimSpace(getEnv("GATEWAY_PREFIX", "")), "/"),
		AllowRegistration: allowReg,
		SecureCookies:     secureCookies,
		JWTExpireDays:     expireDays,
		StaticDir:         getEnv("STATIC_DIR", "./web/out"),
		MigrationsSystem:  getEnv("MIGRATIONS_SYSTEM", "./migrations/system"),
		MigrationsLedger:  getEnv("MIGRATIONS_LEDGER", "./migrations/ledger"),
	}
}

// ResolvePaths fills DATA_DIR / migration dirs when defaults are missing.
// - DataDir: if no system.db, scan fnOS @appdata layouts
// - Migrations: from executable sibling app/migrations when missing
func (c *Config) ResolvePaths() {
	c.resolveDataDir(fnOSDataDirCandidates())
	exe, err := os.Executable()
	if err != nil {
		return
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return
	}
	c.resolvePathsFrom(filepath.Dir(exe))
}

func (c *Config) resolveDataDir(candidates []string) {
	if fileExists(filepath.Join(c.DataDir, "system.db")) {
		return
	}
	if found := firstDirWithSystemDB(candidates); found != "" {
		c.DataDir = found
	}
}

func (c *Config) resolvePathsFrom(exeDir string) {
	base := filepath.Join(exeDir, "..", "migrations")
	sys := filepath.Clean(filepath.Join(base, "system"))
	led := filepath.Clean(filepath.Join(base, "ledger"))
	if !dirExists(c.MigrationsSystem) && dirExists(sys) {
		c.MigrationsSystem = sys
	}
	if !dirExists(c.MigrationsLedger) && dirExists(led) {
		c.MigrationsLedger = led
	}
}

func fnOSDataDirCandidates() []string {
	var out []string
	for _, pattern := range []string{
		"/vol*/@appdata/minibill/data",
		"/usr/local/apps/@appdata/minibill/data",
	} {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			continue
		}
		out = append(out, matches...)
	}
	return out
}

func firstDirWithSystemDB(candidates []string) string {
	for _, dir := range candidates {
		if fileExists(filepath.Join(dir, "system.db")) {
			return dir
		}
	}
	return ""
}

func (c Config) JWTExpireDuration() time.Duration {
	return time.Duration(c.JWTExpireDays) * 24 * time.Hour
}

func (c Config) Validate() error {
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}
