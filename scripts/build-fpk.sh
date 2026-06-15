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

update_manifest() {
    local version="$1"
    local platform="$2"
    local arch_label
    arch_label="$(manifest_arch "$platform")"
    local manifest="${FNOS_DIR}/manifest"
    if [[ "$OSTYPE" == darwin* ]]; then
        sed -i '' "s/^version[[:space:]]*=.*/version               = ${version}/" "$manifest"
        sed -i '' "s/^arch[[:space:]]*=.*/arch                  = ${arch_label}/" "$manifest"
    else
        sed -i "s/^version[[:space:]]*=.*/version               = ${version}/" "$manifest"
        sed -i "s/^arch[[:space:]]*=.*/arch                  = ${arch_label}/" "$manifest"
    fi
}

build_one() {
    local version="$1"
    local platform="$2"
    local goarch
    goarch="$(platform_to_goarch "$platform")"

    update_manifest "$version" "$platform"
    ensure_web_out

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
}

main() {
    [ -d "$FNOS_DIR" ] || error "Missing fnos/"
    [ -f "$FNOS_DIR/config/resource" ] || error "Missing fnos/config/resource"
    command -v go >/dev/null 2>&1 || error "go is required"
    command -v curl >/dev/null 2>&1 || error "curl is required"

    if [ ! -f "$FNOS_DIR/ICON.PNG" ] || [ ! -f "$FNOS_DIR/ICON_256.PNG" ]; then
        python3 "$FNOS_DIR/generate-icons.py"
    fi

    case "$PLATFORM_ARG" in
        all)
            build_one "$VERSION" x86
            build_one "$VERSION" arm
            ;;
        *)
            build_one "$VERSION" "$PLATFORM_ARG"
            ;;
    esac

    info "Done. Upload dist/*.fpk to fnOS 应用中心 → 手动安装"
}

main
