package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const jwtSecretFile = ".jwt_secret"

// EnsureJWTSecret 读取或生成 JWT 签名密钥，持久化在 dataDir/.jwt_secret（权限 0600）。
// 若文件不存在且环境变量 JWT_SECRET 已设置（旧部署），会写入文件以便后续不再依赖 env。
func EnsureJWTSecret(dataDir string) (string, error) {
	if strings.TrimSpace(dataDir) == "" {
		return "", fmt.Errorf("DATA_DIR is required for JWT secret storage")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return "", fmt.Errorf("create data dir: %w", err)
	}

	path := filepath.Join(dataDir, jwtSecretFile)
	if secret, err := readJWTSecretFile(path); err != nil {
		return "", err
	} else if secret != "" {
		return secret, nil
	}

	if legacy := strings.TrimSpace(os.Getenv("JWT_SECRET")); legacy != "" {
		if len(legacy) < minJWTSecretLen {
			return "", fmt.Errorf("JWT_SECRET env is too short (min %d chars)", minJWTSecretLen)
		}
		if err := writeJWTSecretFile(path, legacy); err != nil {
			return "", err
		}
		return legacy, nil
	}

	secret, err := generateJWTSecret()
	if err != nil {
		return "", err
	}
	if err := writeJWTSecretFile(path, secret); err != nil {
		return "", err
	}
	return secret, nil
}

func readJWTSecretFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", fmt.Errorf("read jwt secret: %w", err)
	}
	secret := strings.TrimSpace(string(b))
	if secret == "" {
		return "", fmt.Errorf("jwt secret file %s is empty", path)
	}
	if len(secret) < minJWTSecretLen {
		return "", fmt.Errorf("jwt secret in %s is too short", path)
	}
	return secret, nil
}

func writeJWTSecretFile(path, secret string) error {
	if err := os.WriteFile(path, []byte(secret+"\n"), 0o600); err != nil {
		return fmt.Errorf("write jwt secret: %w", err)
	}
	return nil
}

func generateJWTSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate jwt secret: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
