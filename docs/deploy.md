# 轻账单 部署指南

## 快速开始

```bash
cp .env.example .env
# 编辑 .env：JWT_SECRET 须为至少 32 字符的随机串（不可用占位符）
docker compose up -d --build
```

访问 http://localhost:8080

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| JWT_SECRET | JWT 密钥（至少 32 字符，不可用占位符） | 必填 |
| ALLOW_REGISTRATION | 是否开放注册 | true |
| DATA_DIR | 数据目录 | /data |
| PORT | 端口 | 8080 |
| JWT_EXPIRE_DAYS | JWT 有效期（天） | 7 |
| BACKUP_DIR | 定期备份输出目录（空则禁用） | 空 |
| STATIC_DIR | 前端静态资源目录 | ./web/out（Docker 内 /app/web/out） |
| MIGRATIONS_SYSTEM | 系统库迁移目录 | ./migrations/system |
| MIGRATIONS_LEDGER | 账本库迁移目录 | ./migrations/ledger |
| GIN_MODE | Gin 模式（`release` 关闭访问日志） | release |
| TZ | 时区 | Asia/Shanghai |

## 数据目录

```
/data/
├── system.db
└── users/
    └── {id}/
        └── ledger.db
```

手动备份：复制整个 `data/` 目录，或在 Web **我的 → 备份管理** 中配置定期导出（需设置 `BACKUP_DIR`）。

### 定期 CSV 备份

设置 `BACKUP_DIR` 为可写目录后，在 Web **我的 → 备份管理** 中启用定时任务。备份文件命名：`{用户名}_轻账单_备份_{yyyyMMddHHmmss}.zip`，内含同名 CSV。

Docker 示例：在 `.env` 中设置 `BACKUP_DIR=/data/backups` 并挂载该路径。

## 关闭自助注册

`.env` 中设置 `ALLOW_REGISTRATION=false`，然后：

```bash
go run ./cmd/create-user -username admin -password yourpass
```

（需设置与 server 相同的 `JWT_SECRET` 等环境变量。）

## HTTPS

生产环境建议在前面加 Nginx/Caddy 反代并启用 HTTPS。

## 飞牛 NAS（fnOS）

在项目根目录构建**原生二进制** `.fpk` 安装包（飞牛直接运行进程，无需 Docker）：

```bash
# x86 NAS（默认）
./scripts/build-fpk.sh 1.0.3

# ARM NAS
./scripts/build-fpk.sh 1.0.3 arm
```

产物位于 `dist/minibill_<version>_<platform>.fpk`（由官方 `fnpack` 打包）。

安装步骤：

1. 登录 fnOS → **应用中心** → **手动安装**
2. 上传对应架构的 `.fpk` 文件
3. 安装向导中设置 **JWT 密钥**、**服务端口**（默认 `18080`）和是否开放注册
4. 数据目录选择数据盘（非系统盘）
5. 安装完成后从桌面图标或 `http://<NAS-IP>:<端口>` 访问

修改端口：应用中心 → 轻账单 → **配置** → 修改服务端口 → 保存后重启应用。

**定期备份：** 应用中心 → 轻账单 → **设置** → 为「备份目录」选择文件夹并授予 **读写** 权限 → 保存并重启。随后在 Web **我的 → 备份管理** 配置周期与保留份数。

卸载时可选保留账本数据（`system.db` 与用户 `ledger.db` 在应用数据目录）。
