package config

import (
	"os"
	"strconv"
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
		AllowRegistration: allowReg,
		SecureCookies:     secureCookies,
		JWTExpireDays:     expireDays,
		StaticDir:         getEnv("STATIC_DIR", "./web/out"),
		MigrationsSystem:  getEnv("MIGRATIONS_SYSTEM", "./migrations/system"),
		MigrationsLedger:  getEnv("MIGRATIONS_LEDGER", "./migrations/ledger"),
	}
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
