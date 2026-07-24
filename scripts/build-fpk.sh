#!/usr/bin/env bash
# Build miniBill native .fpk for fnOS (no Docker).
#
# Usage:
#   ./scripts/build-fpk.sh [version] [platform]
#
# platform: all (default, x86+arm in parallel), x86, or arm

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FNOS_DIR="$ROOT/fnos"
DIST_DIR="$ROOT/dist"
FNPACK="${ROOT}/.fnos-shared/fnpack"
FNPACK_VERSION="1.2.1"

VERSION="${1:-}"
if [ -z "$VERSION" ] && [ -f "$ROOT/VERSION" ]; then
    VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"
fi
VERSION="${VERSION:-1.0.0}"
PLATFORM_ARG="${2:-all}"

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
    if [ -d "$ROOT/web/out" ]; then
        info "Removing existing web/out ..."
        rm -rf "$ROOT/web/out"
    fi
    info "Building frontend (web/out) ..."
    (cd "$ROOT/web" && npm install && npm run build)
}

MANIFEST_BACKUP=""

update_manifest() {
    local version="$1"
    local platform="$2"
    local work_dir="${3:-$FNOS_DIR}"
    local arch_label platform_label
    arch_label="$(manifest_arch "$platform")"
    platform_label="$(manifest_platform "$platform")"
    local manifest="${work_dir}/manifest"
    if [ "$work_dir" = "$FNOS_DIR" ] && [ -z "$MANIFEST_BACKUP" ]; then
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

prepare_shared() {
    sync_wizard_config
    ensure_web_out
    sync_fnos_icons
    ensure_fnpack
}

setup_staging() {
    local staging="$1"
    rsync -a \
        --exclude 'app/' \
        --exclude 'minibill.fpk' \
        --exclude '.DS_Store' \
        "$FNOS_DIR/" "$staging/"
    mkdir -p "$staging/app/bin" "$staging/app/web" "$staging/app/migrations"
    cp -a "$FNOS_DIR/app/ui" "$staging/app/ui"
}

stage_binary() {
    local version="$1"
    local platform="$2"
    local work_dir="$3"
    local goarch
    goarch="$(platform_to_goarch "$platform")"

    update_manifest "$version" "$platform" "$work_dir"

    info "[$platform] Building linux/${goarch} binary ..."
    mkdir -p "${work_dir}/app/bin" "${work_dir}/app/web" "${work_dir}/app/migrations"
    (
        cd "$ROOT"
        GOOS=linux GOARCH="$goarch" CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${version}" -o "${work_dir}/app/bin/minibill" ./cmd/server
        GOOS=linux GOARCH="$goarch" CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "${work_dir}/app/bin/create-user" ./cmd/create-user
        GOOS=linux GOARCH="$goarch" CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "${work_dir}/app/bin/reset-password" ./cmd/reset-password
    )

    rm -rf "${work_dir}/app/web/out" "${work_dir}/app/migrations/system" "${work_dir}/app/migrations/ledger"
    cp -a "$ROOT/web/out" "${work_dir}/app/web/out"
    cp -a "$ROOT/migrations/system" "${work_dir}/app/migrations/system"
    cp -a "$ROOT/migrations/ledger" "${work_dir}/app/migrations/ledger"

    chmod +x "${work_dir}/app/bin/minibill" "${work_dir}/app/bin/create-user" "${work_dir}/app/bin/reset-password" "${work_dir}"/cmd/*
}

pack_fpk() {
    local version="$1"
    local platform="$2"
    local work_dir="$3"

    info "[$platform] Packing with fnpack ..."
    rm -f "${work_dir}/minibill.fpk"
    (cd "$work_dir" && "$FNPACK" build -d .)

    local fpk_src="${work_dir}/minibill.fpk"
    [ -f "$fpk_src" ] || error "[$platform] fnpack did not produce minibill.fpk"

    mkdir -p "$DIST_DIR"
    local fpk_dst="${DIST_DIR}/minibill_${version}_${platform}.fpk"
    mv -f "$fpk_src" "$fpk_dst"

    if [ -f "${work_dir}/MiniBill.sc" ]; then
        local repack
        repack="$(mktemp -d)"
        tar -xzf "$fpk_dst" -C "$repack"
        cp "${work_dir}/MiniBill.sc" "$repack/"
        (cd "$repack" && tar -czf "$fpk_dst" *)
        rm -rf "$repack"
    fi

    info "[$platform] Built: $fpk_dst ($(du -h "$fpk_dst" | awk '{print $1}'))"
}

build_one() {
    local version="$1"
    local platform="$2"
    local work_dir="${3:-$FNOS_DIR}"

    stage_binary "$version" "$platform" "$work_dir"
    pack_fpk "$version" "$platform" "$work_dir"

    if [ "$work_dir" = "$FNOS_DIR" ]; then
        restore_manifest
    fi
}

build_all_parallel() {
    local version="$1"
    local tmpdir staging_x86 staging_arm
    tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/minibill-fpk.XXXXXX")"
    staging_x86="${tmpdir}/x86"
    staging_arm="${tmpdir}/arm"
    setup_staging "$staging_x86"
    setup_staging "$staging_arm"

    stage_binary "$version" x86 "$staging_x86" &
    local pid_x86=$!
    stage_binary "$version" arm "$staging_arm" &
    local pid_arm=$!

    local status_x86=0 status_arm=0
    wait "$pid_x86" || status_x86=$?
    wait "$pid_arm" || status_arm=$?
    if [ "$status_x86" -ne 0 ] || [ "$status_arm" -ne 0 ]; then
        rm -rf "$tmpdir"
        error "Parallel compile failed (x86=${status_x86}, arm=${status_arm})"
    fi

    # fnpack is not safe to run in parallel (shared temp state).
    pack_fpk "$version" x86 "$staging_x86"
    pack_fpk "$version" arm "$staging_arm"
    rm -rf "$tmpdir"
}

main() {
    [ -d "$FNOS_DIR" ] || error "Missing fnos/"
    [ -f "$FNOS_DIR/config/resource" ] || error "Missing fnos/config/resource"
    command -v go >/dev/null 2>&1 || error "go is required"
    command -v curl >/dev/null 2>&1 || error "curl is required"
    [ -f "$ROOT/web/public/icon.png" ] || error "Missing web/public/icon.png"
    [ -f "$FNOS_DIR/app/ui/config" ] || error "Missing fnos/app/ui/config — restore with: git restore fnos/app/ui/config"

    prepare_shared

    case "$PLATFORM_ARG" in
        all)
            build_all_parallel "$VERSION"
            ;;
        *)
            build_one "$VERSION" "$PLATFORM_ARG"
            ;;
    esac

    restore_manifest
    info "Done. Upload dist/*.fpk to fnOS 应用中心 → 手动安装"
}

main
