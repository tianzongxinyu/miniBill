# 轻账单 API（MVP）

Base URL: `/api`  
鉴权: `Authorization: Bearer <token>` 或 HttpOnly Cookie `minibill_token`（登录/注册时自动设置）

## 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auth/registration` | 注册是否开放 `{ open: boolean }`（`ALLOW_REGISTRATION` 为 true，或系统尚无用户时为 true） |
| POST | `/auth/register` | 注册（同时 Set-Cookie；`open` 为 false 时 403） |
| POST | `/auth/login` | 登录（可选 `remember`，见下） |
| POST | `/auth/fnos` | 飞牛统一网关免密登录（仅 Unix 网关可信请求；同名已有账号才成功，否则 `NO_MATCHING_USER`） |
| GET | `/auth/session` | 当前会话（需登录，返回 `{ token, user }`） |
| POST | `/auth/logout` | 清除 Cookie（204） |
| PUT | `/auth/password` | 修改密码（需登录；成功后吊销旧 JWT 并清除 Cookie，需重新登录） |

`POST /auth/login` 请求体：`{ "username", "password", "remember"?: boolean }`。`remember` 省略或为 `true` 时签发 `JWT_EXPIRE_DAYS`（默认 30 天）令牌，写入 HttpOnly Cookie 与 `localStorage`；`remember: false` 时签发 24 小时令牌，Cookie 与 `sessionStorage` 有效期均为 24 小时。

认证响应中的 `user` 含 `{ id, username, is_admin }`。账号被作废（`disabled`）后无法登录；已签发 JWT 在鉴权时也会因 `disabled` 立即失效。

首个注册用户自动成为管理员。`ALLOW_REGISTRATION=false` 时，系统已有用户则禁止自助注册；零用户时仍允许注册首位管理员。管理员创建用户不受该开关限制。

前端请求需 `credentials: same-origin` 以携带 Cookie。WebView（如飞牛 App）在 localStorage 被清空时，可通过 Cookie 调用 `GET /auth/session` 恢复登录态；经统一网关访问时还可调用 `POST /auth/fnos`（依赖 `X-Trim-Username`）尝试同名免密。

账本数据接口可通过请求头 `X-Ledger-Owner-Id` 指定目标账本主人（缺省为当前登录用户）。需对该账本拥有 `owner` / `edit` / `read` 权限；主人被作废后授权失效。

## 管理员

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/users` | 用户列表（需管理员） |
| POST | `/admin/users` | 添加用户 `{ username, password }` |
| PUT | `/admin/users/:id` | 更新 `{ is_admin?, disabled? }`（不可操作自己；不可去掉最后一名活跃管理员） |
| POST | `/admin/users/:id/reset-password` | 重置密码 `{ password }` |
| DELETE | `/admin/users/:id` | 硬删除用户及账本目录 |

## 账本授权

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ledgers` | 可访问账本列表（自己 + 有效授权） |
| GET | `/users/directory` | 未禁用用户目录（不含自己） |
| GET | `/ledger/grants` | 我发出的授权 |
| PUT | `/ledger/grants` | upsert `{ grantee_user_id, permission: read\|edit }` |
| DELETE | `/ledger/grants/:granteeUserId` | 撤销授权 |

权限：`read` 可查看；`edit` 可改流水/标签/联系人/月度余额；`settings` 写入、CSV、备份仅主人。

## 业务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/meta/editable-range` | 可编辑日期范围（`max_date` 为今天） |
| GET | `/meta/earliest-month` | 账本最早有数据的年月 |
| GET | `/meta/transaction-tags` | 流水中使用过的标签 |
| GET | `/meta/transaction-contacts` | 流水中使用过的联系人 |
| GET/POST/PUT/DELETE | `/tags` | 标签 CRUD；列表项含 `usage_count`（合计）及 `expense_usage_count` / `income_usage_count`（按流水类型拆分的使用次数） |
| GET/POST/PUT/DELETE | `/contacts` | 联系人 |
| GET | `/contacts/:id` | 联系人详情+汇总 |
| GET/POST/PUT/DELETE | `/recurring-rules` | 按月任务（开启后到期自动建流水） |
| GET | `/recurring-rules/:id` | 单条周期规则 |
| GET/POST/PUT/DELETE | `/transactions` | 流水（游标分页，见下） |
| GET | `/transactions/:id` | 单条流水 |
| GET | `/monthly-balances` | 全部月度余额列表 |
| GET/PUT/DELETE | `/monthly-balances/:year/:month` | 单月余额 |
| GET | `/stats/dashboard` | 首页 |
| GET | `/stats/month-bills` | 首页月度账单卡片（游标分页） |
| GET | `/stats/month-bill` | 单月账单摘要 |
| GET | `/stats/monthly?year=` | 按月统计（可选 `note`/`tag_ids`/`contact_id`；`tag_match=all|any` 作用于全部条件，默认 all） |
| GET | `/stats/month-series` | 按月序列（无游标且无筛选时右端锚定最后有数据月，不超过今天；默认 12 点；`cursor`/`after` 为 `YYYY-MM`；可选 `tag_ids`、`tag_match`） |
| GET | `/stats/yearly` | 按年列表（可选 `tag_ids`、`tag_match`） |
| GET | `/stats/year-series` | 按年序列（无游标且无筛选时右端锚定最后有数据年，不超过今年；默认 10 点；`cursor`/`after` 为 `YYYY`；可选 `tag_ids`、`tag_match`） |
| GET | `/stats/yearly/:year` | 单年 |
| GET | `/stats/annual-report?year=` | 年报（见下） |
| GET | `/stats/annual-default-year` | 年报默认年份（当前日历年） |
| GET/PUT | `/settings` | 设置 |
| GET | `/ledger/export` | CSV 导出（`text/csv`，UTF-8 BOM，`Content-Disposition: attachment`） |
| POST | `/ledger/import` | CSV 覆盖导入（`multipart/form-data`，字段 `file`） |
| GET/PUT | `/backup` | 备份调度配置 |
| POST | `/backup/run` | 立即备份 |
| GET | `/backup/files` | 备份目录 zip 列表 |
| POST | `/backup/restore` | 从 zip 备份恢复 |

错误格式: `{ "error": "CODE", "message": "..." }`

常见错误码: `VALIDATION_ERROR`(400), `UNAUTHORIZED`(401), `FORBIDDEN`(403), `NOT_FOUND`(404), `INTERNAL`(500)

### GET/PUT `/settings`

```json
{
  "locale": "zh-Hans",
  "default_date_mode": "today",
  "amount_color_scheme": "red_up"
}
```

`locale`：界面语言，支持 20 种 locale ID（如 `zh-Hans`、`en`、`ja`），默认 `zh-Hans`。

`amount_color_scheme`：`red_up`（收入红 / 支出绿，默认）或 `green_up`（收入绿 / 支出红）。

### GET `/stats/annual-report?year=`

年报汇总。`year` 为 `YYYY`（2000–当前年）。响应字段：

| 字段 | 说明 |
|------|------|
| `summary` | 年总收入/支出/净收入、日常支出、年初/年末余额（分） |
| `by_tag` | 标签榜：`expense_by_amount` / `expense_by_count` / `income_by_amount` / `income_by_count`，各最多 5 条 |
| `top_transactions` | 大额流水：`expense` / `income`，各最多 5 条 |
| `top_contacts` | 联系人榜：同标签四分法，各最多 5 条 |
| `compare` | 与上年对比（无上年活动则为 `null`） |
| `insights` | 文案洞察键与参数 |

标签/联系人行含 `total_income`、`total_expense`、`tx_count`（`tx_count` 为**当前榜对应收支类型**的笔数）。排除系统流水与日常支出预设标签。

### GET `/stats/annual-default-year`

`{ "year": <当前日历年> }`

### GET/PUT `/backup`

```json
{
  "enabled": true,
  "interval": "daily",
  "hour": 3,
  "minute": 0,
  "weekday": 0,
  "month_day": 1,
  "keep_count": 30,
  "last_run_at": "2025-06-15T03:00:00+08:00",
  "last_status": "ok",
  "last_file": "alice_轻账单_备份_20250615103000.zip",
  "last_error": "",
  "dir_configured": true,
  "dir_path": "/vol1/1000/backups"
}
```

`interval`：`daily` / `weekly` / `monthly`。`hour` 0–23，`minute` 0 / 10 / 20 / 30 / 40 / 50。`weekday` 0–6（周日=0），`month_day` 1–28。`dir_path` 由服务端 `BACKUP_DIR` 决定，客户端不可修改。

### POST `/backup/run`

成功：`{ "filename": "alice_轻账单_备份_20250615103000.zip" }`

### GET `/backup/files`

列出当前用户在备份目录下的 zip 备份（`{BACKUP_DIR}/{用户名}/`）。

响应示例：

```json
{
  "dir_configured": true,
  "dir_path": "/vol1/1000/backups",
  "user_dir": "/vol1/1000/backups/alice",
  "items": [
    {
      "filename": "alice_轻账单_备份_20250615103000.zip",
      "size": 12345,
      "modified_at": "2025-06-15T10:30:00+08:00"
    }
  ]
}
```

### POST `/backup/restore`

从备份 zip 覆盖恢复账本（等同 CSV 覆盖导入；**不删除**已有标签/联系人定义，仅覆盖流水与余额）。请求体：`{ "filename": "alice_轻账单_备份_20250615103000.zip" }`

常见错误：备份目录未配置、文件不存在、zip 无效、zip 过大、路径非法。

### POST `/ledger/import`

`multipart/form-data`，字段名 `file`。成功响应：

```json
{
  "imported_transactions": 100,
  "imported_balances": 12,
  "skipped_daily_expense": 0,
  "created_tags": 2,
  "created_contacts": 1
}
```

单文件上限 50 MiB，最多 10 万行数据。

### GET `/transactions`

游标分页列表。响应：`{ items, next_cursor, has_more }`。

| 参数 | 说明 |
|------|------|
| `year`, `month` | 按月浏览时必填（搜索模式下忽略） |
| `limit` | 每页条数，默认 10，最大 50 |
| `cursor` | 上一页返回的 `next_cursor` |
| `note` | 备注模糊搜索（`LIKE %…%`，无前缀索引） |
| `tag_ids` | 标签 ID，多选（可重复传参） |
| `tag_match` | `all`（默认）备注、各标签、联系人全部满足；`any` 任一条件命中即可（多标签在 `any` 下为「含任一所选标签」） |
| `contact_id` | 联系人 ID |
| `type` | `income` 或 `expense` |

金额单位为**分**；日期 `YYYY-MM-DD`。
