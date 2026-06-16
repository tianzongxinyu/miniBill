#!/usr/bin/env sh
# 本地启动后端（已配置国内 Go 模块镜像）
set -e
cd "$(dirname "$0")/.."
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export JWT_SECRET="${JWT_SECRET:-local-dev-jwt-secret-not-for-production-use}"
export DATA_DIR="${DATA_DIR:-./data}"
export BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
export PORT="${PORT:-8080}"

echo "GOPROXY=$GOPROXY"
go mod download
exec go run ./cmd/server
