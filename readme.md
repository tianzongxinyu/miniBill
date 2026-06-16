# 轻账单

轻量、自托管、多用户个人记账 Web 应用。

## 特性

- **自托管多用户**：数据保存在本机 SQLite，每用户独立账本；支持 Docker 部署与飞牛 NAS（fnOS）安装包
- **收支流水**：记录收入/支出，支持标签、联系人、备注、日期；按月浏览，游标分页与关键词搜索
- **月度余额**：登记每月实际账户余额，与流水汇总对照
- **日常支出**：按月估算未逐笔记账的日常开销，自动计入总支出
- **联系人**：关联任意流水，详情页汇总往来金额
- **统计分析**：月/年维度图表，按标签、联系人、备注筛选；支持全屏查看与数据表格
- **数据迁移**：账本 CSV 导出与导入，便于备份与迁移
- **个性化**：收支配色（红涨绿跌 / 绿涨红跌）可切换
- **移动友好**：响应式布局、底部导航、下拉刷新，可安装为 PWA

## 系统截图

### 首页 · 月度账单

<img src="docs/screenshots/home.png" alt="首页月度账单" width="50%" />

### 流水 · 按月浏览与搜索

<img src="docs/screenshots/transactions.png" alt="流水列表" width="50%" />

### 统计 · 图表与明细

<img src="docs/screenshots/stats.png" alt="统计分析" width="50%" />

### 统计 · 全屏横屏查看

<img src="docs/screenshots/stats-fullscreen.png" alt="统计全屏"  />

### 我的 · 标签 / 数据 / 备份

<img src="docs/screenshots/profile.png" alt="我的" width="50%" />

## 项目目录

```
MiniBill/
├── cmd/                          # Go 可执行程序入口
│   ├── server/                   # HTTP 服务（API + 前端静态资源）
│   ├── create-user/              # 命令行创建用户（关闭自助注册时使用）
│   └── seed-data/                # 开发用测试数据导入
├── internal/                     # 后端核心代码
│   ├── handler/                  # Gin 路由与 HTTP 处理
│   ├── service/                  # 业务逻辑（流水、统计、标签、联系人等）
│   ├── auth/                     # 注册、登录、JWT
│   ├── bootstrap/                # 启动初始化、系统库迁移、用户开通
│   ├── middleware/               # 鉴权中间件
│   ├── migrate/                  # 账本库 SQL 迁移执行
│   ├── systemdb/                 # 系统库（用户表）
│   ├── userdb/                   # 用户账本 SQLite 连接
│   ├── domain/                   # 领域类型（年月、日期范围等）
│   └── config/                   # 环境变量与配置
├── migrations/                   # 数据库结构迁移脚本
│   ├── system/                   # 系统库 schema
│   └── ledger/                   # 用户账本 schema
├── web/                          # Next.js 前端
│   ├── app/                      # App Router 页面
│   │   ├── page.tsx              # 首页（月度账单列表）
│   │   ├── add/                  # 记一笔
│   │   ├── transactions/         # 流水列表
│   │   ├── stats/                # 统计分析
│   │   ├── balance/              # 登记月度余额
│   │   ├── login/                # 登录
│   │   ├── register/             # 注册
│   │   └── profile/              # 我的
│   │       ├── settings/         # 设置（密码、配色）
│   │       ├── tags/             # 标签管理
│   │       ├── contacts/         # 联系人与人情统计
│   │       ├── balances/         # 月度余额列表
│   │       └── data/             # CSV 导入 / 导出
│   ├── components/               # React 组件
│   │   ├── layout/               # 侧栏、底栏等布局
│   │   ├── stats/                # 图表、图例、筛选
│   │   ├── transactions/         # 流水行、工具栏
│   │   └── ui/                   # 通用 UI 组件
│   ├── hooks/                    # 自定义 Hooks（分页、统计页等）
│   ├── lib/                      # API 客户端、格式化、图表数据
│   └── public/                   # 静态资源（图标等）
├── fnos/                         # 飞牛 NAS（fnOS）应用打包
│   ├── manifest                  # 应用清单
│   ├── cmd/                      # 安装 / 卸载 / 升级生命周期脚本
│   ├── wizard/                   # 安装向导配置
│   └── config/                   # 权限与资源声明
├── docs/                         # 项目文档
│   ├── api.md                    # REST API 说明
│   └── deploy.md                 # 部署指南
├── scripts/                      # 辅助脚本
│   ├── dev-backend.sh            # 本地启动后端
│   └── build-fpk.sh              # 构建 fnOS 安装包
├── docker-compose.yml            # Docker Compose 编排
├── Dockerfile                    # 容器镜像构建
├── go.mod                        # Go 模块声明
├── go.sum                        # 依赖校验和锁定
└── .env.example                  # 环境变量示例
```

运行时数据目录（默认 `./data`，已在 `.gitignore` 中忽略）：

```
data/
├── .jwt_secret                   # 首次启动自动生成的 JWT 签名密钥（勿删）
├── system.db                     # 系统库
└── users/{id}/ledger.db          # 各用户账本
```

## 快速开始

```bash
cp .env.example .env
docker compose up -d --build
```

打开 [http://localhost:8080](http://localhost:8080) ，注册账号即可使用。

## 本地开发

**后端：**

```bash
export DATA_DIR=./data
export GOPROXY=https://goproxy.cn,direct
go mod download    # 先拉齐依赖（只需成功一次）
go run ./cmd/server

# 或使用脚本（已内置 GOPROXY）：
# ./scripts/dev-backend.sh
```

也可永久设置 Go 代理（本机一次即可）：

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

**前端：**

```bash
cd web && npm install && npm run dev
```

前端 dev server 会将 `/api` 代理到 `:8080`。

## 飞牛 NAS（fnOS）打包

轻账单可打包为 fnOS 原生 `.fpk` 安装包，在飞牛 NAS 上直接运行进程，无需 Docker。

### 构建要求

- Go 1.22+（交叉编译 `linux/amd64` 或 `linux/arm64`）
- Node.js + npm（若 `web/out` 不存在，脚本会自动执行 `npm run build`）
- `curl`（首次构建时自动下载官方 `fnpack` 到 `.fnos-shared/`）

### 构建安装包

在项目根目录执行：

```bash
# x86 NAS（默认）
./scripts/build-fpk.sh 1.0.3

# ARM NAS
./scripts/build-fpk.sh 1.0.3 arm

# 同时构建 x86 与 ARM
./scripts/build-fpk.sh 1.0.3 all
```

产物位于 `dist/minibill_<version>_<platform>.fpk`。

脚本会依次：编译 Linux 后端二进制 → 复制前端静态资源与数据库迁移 → 调用 `fnpack` 打包。

### 安装与配置

1. 登录 fnOS → **应用中心** → **手动安装**
2. 上传与 NAS 架构匹配的 `.fpk` 文件
3. 安装向导中设置 **服务端口**（默认 `18080`）及是否开放注册
4. 数据目录选择数据盘（勿选系统盘）
5. 安装完成后从桌面图标或 `http://<NAS-IP>:<端口>` 访问（首次启动自动生成 JWT 密钥）

修改端口 / 注册开关 / 备份目录：应用中心 → 轻账单 → **应用设置** → **运行设置** → **编辑** → 保存（保存后会自动重启应用）。

**备份目录：** 应用中心 → 轻账单 → **应用设置** → **运行设置** → **编辑**，填写绝对路径（如 `/vol1/1000/backups`）；留空则不启用备份。保存后会自动重启应用，随后在 Web **我的 → 备份管理** 配置定时备份。

卸载时可选保留账本数据（应用数据目录下的 `system.db` 与各用户 `ledger.db`）。

更多部署细节见 [部署指南](docs/deploy.md)。

## 文档

- [API](docs/api.md)
- [部署](docs/deploy.md)

## 技术栈

Go + Gin + SQLite | Next.js + Tailwind + Recharts | Docker