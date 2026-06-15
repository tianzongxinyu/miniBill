package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	JWTSecret          string
	DataDir            string
	Port               string
	AllowRegistration  bool
	JWTExpireDays      int
	StaticDir          string
	MigrationsSystem   string
	MigrationsLedger   string
}

func Load() Config {
	expireDays, _ := strconv.Atoi(getEnv("JWT_EXPIRE_DAYS", "7"))
	if expireDays <= 0 {
		expireDays = 7
	}
	allowReg := getEnv("ALLOW_REGISTRATION", "true") == "true"
	return Config{
		JWTSecret:         getEnv("JWT_SECRET", "dev-secret-change-me"),
		DataDir:           getEnv("DATA_DIR", "./data"),
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

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
