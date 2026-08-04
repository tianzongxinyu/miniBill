# 轻账单 部署指南

## 快速开始

```bash
cp .env.example .env
docker compose up -d --build
```

首次启动会在 `DATA_DIR` 下自动生成 `.jwt_secret`（JWT 签名密钥），无需手动配置。

访问 http://localhost:8080

## 构建并推送镜像

项目根目录已提供 `.dockerignore`，构建时不会把 `data/`、`.env`、`web/node_modules/` 等打进构建上下文。

**构建并打标签**（将 `yourname/minibill` 换成你的仓库地址）：

```bash
docker build -t yourname/minibill:latest .

# 国内拉基础镜像或 npm 慢时可加：
# docker build \
#   --build-arg IMAGE_PREFIX=docker.m.daocloud.io/library/ \
#   --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
#   -t yourname/minibill:latest .
```

**登录并推送**：

```bash
docker login
docker push yourname/minibill:latest
# 建议同时推送版本号 tag，便于回滚
# docker tag yourname/minibill:latest yourname/minibill:1.0.9
# docker push yourname/minibill:1.0.9
```

**多架构**（NAS / ARM 等）：

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t yourname/minibill:latest --push .
```

推送前可在本机试跑：

```bash
docker run --rm -p 8080:8080 -v "$(pwd)/data:/data" yourname/minibill:latest
```

## 从镜像仓库部署

不使用本地 `build`，改用 `docker-compose.prod.yml`：

```bash
cp .env.example .env
# 编辑 .env，取消注释并设置 MINIBILL_IMAGE=yourname/minibill:latest
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

镜像内已内置 `STATIC_DIR`、`MIGRATIONS_*` 等路径；运行时只需挂载 `./data:/data`，并按需调整 `ALLOW_REGISTRATION`、`BACKUP_DIR` 等环境变量。JWT 密钥仍在首次启动时写入数据目录，不会 bake 进镜像。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| ALLOW_REGISTRATION | 是否开放自助注册（false 时已有用户不可注册；零用户仍可注册首位管理员） | true |
| DATA_DIR | 数据目录（含自动生成的 `.jwt_secret`） | /data |
| PORT | 端口 | 8080 |
| JWT_EXPIRE_DAYS | JWT 有效期（天） | 30 |
| BACKUP_DIR | 定期备份输出目录（空则禁用） | 空 |
| STATIC_DIR | 前端静态资源目录 | ./web/out（Docker 内 /app/web/out） |
| MIGRATIONS_SYSTEM | 系统库迁移目录 | ./migrations/system |
| MIGRATIONS_LEDGER | 账本库迁移目录 | ./migrations/ledger |
| GIN_MODE | Gin 模式（`release` 关闭访问日志） | release |
| SECURE_COOKIES | 生产 HTTPS 反代时设为 `true`，Cookie 带 Secure 标志 | false |
| TZ | 时区 | Asia/Shanghai |

## 数据目录

```
/data/
├── .jwt_secret                   # 首次启动自动生成，权限 0600
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

首次部署可保持 `ALLOW_REGISTRATION=true`，或设为 `false` 后通过 Web 注册页 / `POST /api/auth/register` 创建首个用户（零用户时门禁仍开放）。系统已有用户后，将 `ALLOW_REGISTRATION=false` 并重启，则无法再自助注册。

飞牛安装/运行设置向导可配置「开放用户注册」（写入 `ALLOW_REGISTRATION`）。关闭后已有用户登录不受影响；忘记密码请用下方「重置用户密码」。管理员仍可通过管理接口添加用户。

## 重置用户密码

用户忘记密码时，由管理员在服务器上重置（无邮件找回）。重置后该用户已有登录态立即失效，需用新密码重新登录。

本地 / 源码：

```bash
go run ./cmd/reset-password -username alice -password newsecret
```

Docker：

```bash
docker compose exec minibill /app/reset-password -username alice -password newsecret
```

飞牛 NAS（fnOS）：SSH 登录后用封装脚本（自动找安装与数据目录）：

```bash
/volX/@appcenter/minibill/cmd/reset-user-password -username alice -password newsecret
# 卷号因安装盘而异，可先：ls -d /vol*/@appcenter/minibill
```

报「用户不存在」时看 stderr 的 `DATA_DIR`，并用该目录下 `system.db` 核对用户名是否完全一致：

```bash
sqlite3 /volX/@appdata/minibill/data/system.db 'SELECT id, username FROM users;'
```

## HTTPS

生产环境建议在前面加 Nginx/Caddy 反代并启用 HTTPS。

## 飞牛 NAS（fnOS）

在项目根目录构建**原生二进制** `.fpk` 安装包（飞牛直接运行进程，无需 Docker）。

**Linux / macOS：**

```bash
# x86 NAS（默认）
./scripts/build-fpk.sh 1.0.9

# ARM NAS
./scripts/build-fpk.sh 1.0.9 arm

# 同时构建 x86 与 ARM
./scripts/build-fpk.sh 1.0.9 all
```

**Windows：**

```bat
scripts\build-fpk.cmd 1.0.9 x86
scripts\build-fpk.cmd 1.0.9 arm
scripts\build-fpk.cmd 1.0.9 all
```

产物位于 `dist/minibill_<version>_<platform>.fpk`（由官方 `fnpack` 打包；Windows 首次构建会自动下载 `fnpack-*-windows-amd64`）。

安装步骤：

1. 登录 fnOS → **应用中心** → **手动安装**
2. 上传对应架构的 `.fpk` 文件
3. 安装向导中设置 **服务端口**（默认 `18080`）与备份目录（可选）
4. 数据目录选择数据盘（非系统盘）
5. 安装完成后从桌面图标或 `http://<NAS-IP>:<端口>` 访问（首次启动自动生成 JWT 密钥）

修改端口 / 备份目录：应用中心 → 轻账单 → **应用设置** → **运行设置** → **编辑** → 保存（保存后会自动重启应用）。桌面入口端口与安装/运行向导中的 `wizard_port` 绑定，保存后应从新端口打开；若仍打开旧端口，请升级到含该修复的 fpk。

**备份目录：**

- **飞牛**：在安装向导或运行设置中填写绝对路径（如 `/vol1/1000/backups`）；留空则不启用备份。
- **Docker / 自托管**：设置环境变量 `BACKUP_DIR`；留空则不启用备份。
- 配置后在 Web **我的 → 备份管理** 设置周期与保留份数；**我的 → 数据管理** 可从该目录选择 zip 恢复。

本包声明 `micro_app=true`，并申请 `trim.file.path` scope，用于备份路径的友好展示。

卸载时可选保留账本数据（`system.db` 与用户 `ledger.db` 在应用数据目录）。
