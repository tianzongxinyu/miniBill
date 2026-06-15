# 轻账单 部署指南

## 快速开始

```bash
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET
docker compose up -d --build
```

访问 http://localhost:8080

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| JWT_SECRET | JWT 密钥 | 必填 |
| ALLOW_REGISTRATION | 是否开放注册 | true |
| DATA_DIR | 数据目录 | /data |
| PORT | 端口 | 8080 |
| TZ | 时区 | Asia/Shanghai |

## 数据目录

```
/data/
├── system.db
└── users/
    └── {id}/
        └── ledger.db
```

手动备份：复制整个 `data/` 目录。

## 关闭自助注册

`.env` 中设置 `ALLOW_REGISTRATION=false`，然后：

```bash
go run ./cmd/create-user -username admin -password yourpass
```

或 `scripts/create-user.sh`（需临时开放注册或直接用 CLI）。

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

卸载时可选保留账本数据（`system.db` 与用户 `ledger.db` 在应用数据目录）。
