[English](en.md) · [简体中文](../../README.md) · [日本語](ja.md)

# MiniBill

A lightweight, self-hosted, multi-user personal finance web app.

## Features

- **Self-hosted multi-user**: Data stored in local SQLite with a separate ledger per user; supports Docker deployment and FygoOS install packages
- **Income & expense transactions**: Record income/expense with tags, contacts, notes, and dates; browse by month with cursor pagination and keyword search
- **Monthly balance**: Record actual account balance each month and compare against transaction totals
- **Daily expenses**: Estimate monthly everyday spending not tracked transaction-by-transaction; automatically included in total expenses
- **Contacts**: Link to any transaction; detail page summarizes amounts exchanged
- **Statistics**: Monthly/yearly charts with filtering by tag, contact, and note; fullscreen view and data table supported
- **Data migration**: Ledger CSV export and import for backup and migration
- **Multilingual**: Multilingual UI (20 languages, fully translated)
- **Personalization**: Toggle income/expense color scheme (red-up green-down / green-up red-down)
- **Mobile-friendly**: Responsive layout, bottom navigation, pull-to-refresh, installable as PWA

## Screenshots

### Home · Monthly Bills

<img src="../screenshots/home.png" alt="Home monthly bills" width="50%" />

### Transactions · Browse by Month & Search

<img src="../screenshots/transactions.png" alt="Transaction list" width="50%" />

### Statistics · Charts & Details

<img src="../screenshots/stats.png" alt="Statistics analysis" width="50%" />

### Statistics · Fullscreen Landscape View

<img src="../screenshots/stats-fullscreen.png" alt="Statistics fullscreen"  />

### Profile · Tags / Data / Backup

<img src="../screenshots/profile.png" alt="Profile" width="50%" />

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Open [http://localhost:8080](http://localhost:8080) and register an account to get started.

## Local Development

**Backend:**

```bash
export DATA_DIR=./data
export GOPROXY=https://goproxy.cn,direct
go mod download    # Fetch dependencies first (only needed once)
go run ./cmd/server

# Or use the script (GOPROXY built in):
# ./scripts/dev-backend.sh
```

You can also set the Go proxy permanently (once per machine):

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

**Frontend:**

```bash
cd web && npm install && npm run dev
```

The frontend dev server proxies `/api` to `:8080`.

## FygoOS Packaging

MiniBill can be packaged as a native FygoOS `.fpk` install package, running directly on FygoOS without Docker.

### Build Requirements

- Go 1.22+ (cross-compile `linux/amd64` or `linux/arm64`)
- Node.js + npm (script runs `npm run build` automatically if `web/out` is missing)
- `curl` (downloads official `fnpack` to `.fnos-shared/` on first build)

### Build Install Package

Run from the project root:

```bash
# x86 NAS (default)
./scripts/build-fpk.sh 1.0.3

# ARM NAS
./scripts/build-fpk.sh 1.0.3 arm

# Build both x86 and ARM
./scripts/build-fpk.sh 1.0.3 all
```

Output is at `dist/minibill_<version>_<platform>.fpk`.

The script: compiles Linux backend binary → copies frontend static assets and DB migrations → invokes `fnpack` to package.

### Install & Configure

1. Log in to FygoOS → **App Center** → **Manual Install**
2. Upload the `.fpk` file matching your NAS architecture
3. In the install wizard, set **service port** (default `18080`) and whether registration is open
4. Choose a data disk for the data directory (not the system disk)
5. After install, access via desktop icon or `http://<NAS-IP>:<port>` (JWT key auto-generated on first start)

To change port / registration toggle / backup directory: App Center → MiniBill → **App Settings** → **Runtime Settings** → **Edit** → Save (app restarts automatically after save).

**Backup directory:** App Center → MiniBill → **App Settings** → **Runtime Settings** → **Edit**, enter an absolute path (e.g. `/vol1/1000/backups`); leave empty to disable backup. App restarts after save; then configure scheduled backup in the web app under **Profile → Backup Management**.

Uninstall optionally preserves ledger data (`system.db` and per-user `ledger.db` in the app data directory).

See the [Deployment Guide](../deploy.md) for more details.

## Documentation

- [API](../api.md)
- [Deployment](../deploy.md)

## Tech Stack

Go + Gin + SQLite | Next.js + Tailwind + Recharts | Docker
