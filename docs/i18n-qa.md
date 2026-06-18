# i18n 手动 QA 清单

发布前抽测（自动化 `npm run i18n:check` 与 `go test ./internal/i18n/...` 须已通过）。

## 自动化门禁

| 命令 | 说明 |
|------|------|
| `npm run i18n:check` | 结构校验 + 漏译/parity/空值审计 |
| `npm run build` | 含 i18n 前置检查 |
| `go test ./internal/i18n/...` | 后端 catalog 与非英文 CSV/标签断言 |

## 场景抽测

| 场景 | 建议 locale | 预期 |
|------|-------------|------|
| 登录页切换语言 → 登录 | ja, fr | 登录后首页与设置页语言一致 |
| 设置页切换 → 刷新 | de, ko | 刷新后仍为所选语言 |
| 首页 / 流水 / 记一笔 / 统计 | zh-Hant, ar | 文案为对应语言，无英文残留 |
| CSV 导出 | es, pt-BR | 表头与 UI 中 CSV 相关标签一致 |
| 触发 validation 错误 | en, zh-Hans | Toast/错误信息为当前语言 |

## 维护约定

1. 新增文案：先更新 `web/src/locales/en.json` 与 `web/src/locales/zh-Hans.json`，再同步 `internal/i18n/messages/` 对应 key。
2. 其他 locale：手补翻译后运行 `npm run i18n:check`；更新 zh-Hans 后可用 `npm run i18n:sync-zh-hant` 同步 zh-Hant。
3. 前后端共享术语见 `scripts/i18n/parity.json`；豁免项见 `scripts/i18n/allowlist.json`。

## 已知限制

- 阿拉伯语等 RTL 语言：`web/app/layout.tsx` 未设置 `dir="rtl"`，布局可能不理想（与翻译准确性分开跟踪）。
