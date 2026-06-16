package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultJWTSecret = "dev-secret-change-me"
	minJWTSecretLen  = 32
)

type Config struct {
	JWTSecret         string
	DataDir           string
	BackupDir         string
	Port              string
	AllowRegistration bool
	JWTExpireDays     int
	StaticDir         string
	MigrationsSystem  string
	MigrationsLedger  string
}

func Load() Config {
	expireDays, _ := strconv.Atoi(getEnv("JWT_EXPIRE_DAYS", "7"))
	if expireDays <= 0 {
		expireDays = 7
	}
	allowReg := getEnv("ALLOW_REGISTRATION", "true") == "true"
	return Config{
		JWTSecret:         getEnv("JWT_SECRET", defaultJWTSecret),
		DataDir:           getEnv("DATA_DIR", "./data"),
		BackupDir:         getEnv("BACKUP_DIR", ""),
		Port:              getEnv("PORT", "8080"),
		AllowRegistration: allowReg,
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
	secret := strings.TrimSpace(c.JWTSecret)
	if secret == "" {
		return errors.New("JWT_SECRET must be set to a secure random value")
	}
	if len(secret) < minJWTSecretLen {
		return errors.New("JWT_SECRET must be at least 32 characters")
	}
	lower := strings.ToLower(secret)
	if lower == defaultJWTSecret {
		return errors.New("JWT_SECRET must not use the default dev secret")
	}
	for _, blocked := range []string{
		"dev",
		"change-me-in-production",
		"change-me-to-a-long-random-string",
	} {
		if lower == blocked {
			return errors.New("JWT_SECRET must not use a placeholder value")
		}
	}
	if strings.HasPrefix(lower, "change-me") {
		return errors.New("JWT_SECRET must not use a placeholder value")
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
