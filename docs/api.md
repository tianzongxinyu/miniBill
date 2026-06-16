# 轻账单 API（MVP）

Base URL: `/api`  
鉴权: `Authorization: Bearer <token>`

## 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册 |
| POST | `/auth/login` | 登录 |
| PUT | `/auth/password` | 修改密码（需登录） |

## 业务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/meta/editable-range` | 可编辑日期范围（`max_date` 为今天） |
| GET | `/meta/earliest-month` | 账本最早有数据的年月 |
| GET | `/meta/transaction-tags` | 流水中使用过的标签 |
| GET | `/meta/transaction-contacts` | 流水中使用过的联系人 |
| GET/POST/PUT/DELETE | `/tags` | 标签 CRUD |
| GET/POST/PUT/DELETE | `/contacts` | 联系人 |
| GET | `/contacts/:id` | 联系人详情+汇总 |
| GET/POST/PUT/DELETE | `/transactions` | 流水（游标分页，见下） |
| GET | `/transactions/:id` | 单条流水 |
| GET | `/monthly-balances` | 全部月度余额列表 |
| GET/PUT/DELETE | `/monthly-balances/:year/:month` | 单月余额 |
| GET | `/stats/dashboard` | 首页 |
| GET | `/stats/month-bills` | 首页月度账单卡片（游标分页） |
| GET | `/stats/month-bill` | 单月账单摘要 |
| GET | `/stats/monthly?year=` | 按月统计（可选 `tag_ids` 多选，AND 匹配） |
| GET | `/stats/month-series` | 按月序列（默认最近 12 月；`cursor`/`after` 为 `YYYY-MM`；可选 `tag_ids`） |
| GET | `/stats/yearly` | 按年列表（可选 `tag_ids`） |
| GET | `/stats/year-series` | 按年序列（默认最近 10 年；`cursor`/`after` 为 `YYYY`；可选 `tag_ids`） |
| GET | `/stats/yearly/:year` | 单年 |
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
  "default_currency": "CNY",
  "default_date_mode": "today",
  "amount_color_scheme": "red_up"
}
```

`amount_color_scheme`：`red_up`（收入红 / 支出绿，默认）或 `green_up`（收入绿 / 支出红）。

### GET/PUT `/backup`

```json
{
  "enabled": true,
  "interval": "daily",
  "hour": 3,
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

`interval`：`daily` / `weekly` / `monthly`。`weekday` 0–6（周日=0），`month_day` 1–28。`dir_path` 由服务端 `BACKUP_DIR` 决定，客户端不可修改。

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
| `note` | 备注模糊搜索 |
| `tag_ids` | 标签 ID，多选 AND 匹配（可重复传参） |
| `contact_id` | 联系人 ID |
| `type` | `income` 或 `expense` |

金额单位为**分**；日期 `YYYY-MM-DD`。
