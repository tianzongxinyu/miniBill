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
| GET | `/meta/editable-range` | 可编辑日期范围（`max_date` 为今天） |
| GET | `/meta/earliest-month` | 账本最早有数据的年月 |
| GET/POST/PUT/DELETE | `/tags` | 标签 CRUD |
| GET/POST/PUT/DELETE | `/contacts` | 联系人 |
| GET | `/contacts/:id` | 联系人详情+汇总 |
| GET/POST/PUT/DELETE | `/transactions` | 流水（游标分页，见下） |
| GET/PUT/DELETE | `/monthly-balances/:year/:month` | 月度余额 |
| GET | `/stats/dashboard` | 首页 |
| GET | `/stats/monthly?year=` | 按月统计（可选 `tag_ids` 多选，AND 匹配） |
| GET | `/stats/month-series` | 按月序列（默认最近 12 月；`cursor`/`after` 为 `YYYY-MM`；可选 `tag_ids`） |
| GET | `/stats/yearly` | 按年列表（可选 `tag_ids`） |
| GET | `/stats/year-series` | 按年序列（默认最近 10 年；`cursor`/`after` 为 `YYYY`；可选 `tag_ids`） |
| GET | `/stats/yearly/:year` | 单年 |
| GET/PUT | `/settings` | 设置 |

错误格式: `{ "error": "CODE", "message": "..." }`

常见错误码: `VALIDATION_ERROR`(400), `UNAUTHORIZED`(401)

### GET/PUT `/settings`

```json
{
  "default_currency": "CNY",
  "default_date_mode": "today",
  "amount_color_scheme": "red_up"
}
```

`amount_color_scheme`：`red_up`（收入红 / 支出绿，默认）或 `green_up`（收入绿 / 支出红）。

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
