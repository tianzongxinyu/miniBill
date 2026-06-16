#!/usr/bin/env bash
# 本地启动后端（已配置国内 Go 模块镜像）
set -euo pipefail
cd "$(dirname "$0")/.."
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export DATA_DIR="${DATA_DIR:-./data}"
export PORT="${PORT:-8080}"
export ALLOW_REGISTRATION="${ALLOW_REGISTRATION:-true}"
exec go run ./cmd/server
