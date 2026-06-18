#!/usr/bin/env bash
# Build miniBill native .fpk for fnOS (no Docker).
#
# Usage:
#   ./scripts/build-fpk.sh [version] [platform]
#
# platform: x86 (default) or arm

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FNOS_DIR="$ROOT/fnos"
DIST_DIR="$ROOT/dist"
FNPACK="${ROOT}/.fnos-shared/fnpack"
FNPACK_VERSION="1.2.1"

VERSION="${1:-1.0.0}"
PLATFORM_ARG="${2:-x86}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

platform_to_goarch() {
    case "$1" in
        x86|amd64) echo "amd64" ;;
        arm|arm64) echo "arm64" ;;
        *) error "Unknown platform: $1 (use x86 or arm)" ;;
    esac
}

manifest_arch() {
    case "$1" in
        x86|amd64) echo "x86_64" ;;
        arm|arm64) echo "aarch64" ;;
        *) error "Unknown platform: $1" ;;
    esac
}

manifest_platform() {
    case "$1" in
        x86|amd64) echo "x86" ;;
        arm|arm64) echo "arm" ;;
        *) error "Unknown platform: $1" ;;
    esac
}

ensure_fnpack() {
    if [ -x "$FNPACK" ]; then
        return
    fi
    mkdir -p "$(dirname "$FNPACK")"
    local os arch url
    case "$(uname -s)" in
        Darwin) os="darwin" ;;
        Linux) os="linux" ;;
        *) error "Unsupported OS for fnpack: $(uname -s)" ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch="amd64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) error "Unsupported arch for fnpack: $(uname -m)" ;;
    esac
    url="https://static2.fnnas.com/fnpack/fnpack-${FNPACK_VERSION}-${os}-${arch}"
    info "Downloading fnpack ..."
    curl -fsSL "$url" -o "$FNPACK"
    chmod +x "$FNPACK"
}

ensure_web_out() {
    if [ -d "$ROOT/web/out" ] && [ -f "$ROOT/web/out/index.html" ]; then
        return
    fi
    info "Building frontend (web/out) ..."
    (cd "$ROOT/web" && npm install && npm run build)
}

MANIFEST_BACKUP=""

update_manifest() {
    local version="$1"
    local platform="$2"
    local arch_label platform_label
    arch_label="$(manifest_arch "$platform")"
    platform_label="$(manifest_platform "$platform")"
    local manifest="${FNOS_DIR}/manifest"
    if [ -z "$MANIFEST_BACKUP" ]; then
        MANIFEST_BACKUP="$(mktemp)"
        cp "$manifest" "$MANIFEST_BACKUP"
    fi
    if [[ "$OSTYPE" == darwin* ]]; then
        sed -i '' "s/^version[[:space:]]*=.*/version               = ${version}/" "$manifest"
        sed -i '' "s/^arch[[:space:]]*=.*/arch                  = ${arch_label}/" "$manifest"
        sed -i '' "s/^platform[[:space:]]*=.*/platform              = ${platform_label}/" "$manifest"
    else
        sed -i "s/^version[[:space:]]*=.*/version               = ${version}/" "$manifest"
        sed -i "s/^arch[[:space:]]*=.*/arch                  = ${arch_label}/" "$manifest"
        sed -i "s/^platform[[:space:]]*=.*/platform              = ${platform_label}/" "$manifest"
    fi
}

restore_manifest() {
    if [ -n "$MANIFEST_BACKUP" ] && [ -f "$MANIFEST_BACKUP" ]; then
        cp "$MANIFEST_BACKUP" "${FNOS_DIR}/manifest"
        rm -f "$MANIFEST_BACKUP"
        MANIFEST_BACKUP=""
    fi
}

sync_wizard_config() {
    # 每项独立 step，飞牛应用设置编辑弹窗会竖向排布（同 step 内多字段会并排）
    FNOS_DIR="$FNOS_DIR" python3 - <<'PY'
import json
import os
from pathlib import Path

root = Path(os.environ["FNOS_DIR"])
config_path = root / "wizard" / "config"
config_path.write_text(
    json.dumps(
        [
            {
                "stepTitle": "服务端口",
                "items": [
                    {
                        "type": "text",
                        "field": "wizard_port",
                        "label": "服务端口",
                        "initValue": "18080",
                    }
                ],
            },
            {
                "stepTitle": "备份目录",
                "items": [
                    {
                        "type": "text",
                        "field": "wizard_backup_dir",
                        "label": "备份目录（绝对路径，留空表示不启用备份）",
                        "initValue": "",
                    }
                ],
            },
            {
                "stepTitle": "自助注册",
                "items": [
                    {
                        "type": "radio",
                        "field": "wizard_allow_registration",
                        "label": "是否开放自助注册",
                        "initValue": "true",
                        "options": [
                            {"label": "开放注册", "value": "true"},
                            {"label": "关闭注册", "value": "false"},
                        ],
                    }
                ],
            },
        ],
        ensure_ascii=False,
        indent=4,
    )
    + "\n",
    encoding="utf-8",
)
PY
}

sync_fnos_icons() {
    info "Syncing fnOS icons from web/public/icon.png ..."
    python3 "${FNOS_DIR}/generate-icons.py"
    if [ -d "$ROOT/web/out" ]; then
        cp -f "$ROOT/web/public/icon.png" "$ROOT/web/out/icon.png"
    fi
}

build_one() {
    local version="$1"
    local platform="$2"
    local goarch
    goarch="$(platform_to_goarch "$platform")"

    update_manifest "$version" "$platform"
    sync_wizard_config
    ensure_web_out
    sync_fnos_icons

    info "Building linux/${goarch} binary ..."
    mkdir -p "${FNOS_DIR}/app/bin" "${FNOS_DIR}/app/web" "${FNOS_DIR}/app/migrations"
    (
        cd "$ROOT"
        GOOS=linux GOARCH="$goarch" CGO_ENABLED=0 go build -o "${FNOS_DIR}/app/bin/minibill" ./cmd/server
    )

    rm -rf "${FNOS_DIR}/app/web/out" "${FNOS_DIR}/app/migrations/system" "${FNOS_DIR}/app/migrations/ledger"
    cp -a "$ROOT/web/out" "${FNOS_DIR}/app/web/out"
    cp -a "$ROOT/migrations/system" "${FNOS_DIR}/app/migrations/system"
    cp -a "$ROOT/migrations/ledger" "${FNOS_DIR}/app/migrations/ledger"

    chmod +x "${FNOS_DIR}/app/bin/minibill" "${FNOS_DIR}"/cmd/*
    ensure_fnpack

    info "Packing with fnpack ..."
    rm -f "${FNOS_DIR}/minibill.fpk"
    (cd "$FNOS_DIR" && "$FNPACK" build -d .)

    local fpk_src="${FNOS_DIR}/minibill.fpk"
    [ -f "$fpk_src" ] || error "fnpack did not produce minibill.fpk"

    mkdir -p "$DIST_DIR"
    local fpk_dst="${DIST_DIR}/minibill_${version}_${platform}.fpk"
    mv -f "$fpk_src" "$fpk_dst"

    if [ -f "${FNOS_DIR}/MiniBill.sc" ]; then
        local repack
        repack="$(mktemp -d)"
        tar -xzf "$fpk_dst" -C "$repack"
        cp "${FNOS_DIR}/MiniBill.sc" "$repack/"
        (cd "$repack" && tar -czf "$fpk_dst" *)
        rm -rf "$repack"
    fi

    info "Built: $fpk_dst ($(du -h "$fpk_dst" | awk '{print $1}'))"
    restore_manifest
}

main() {
    [ -d "$FNOS_DIR" ] || error "Missing fnos/"
    [ -f "$FNOS_DIR/config/resource" ] || error "Missing fnos/config/resource"
    command -v go >/dev/null 2>&1 || error "go is required"
    command -v curl >/dev/null 2>&1 || error "curl is required"
    [ -f "$ROOT/web/public/icon.png" ] || error "Missing web/public/icon.png"

    case "$PLATFORM_ARG" in
        all)
            build_one "$VERSION" x86
            build_one "$VERSION" arm
            ;;
        *)
            build_one "$VERSION" "$PLATFORM_ARG"
            ;;
    esac

    restore_manifest
    info "Done. Upload dist/*.fpk to fnOS 应用中心 → 手动安装"
}

main
