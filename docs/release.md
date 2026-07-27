# MiniBill 发版清单

版本号以根目录 [`VERSION`](../VERSION) 与 [`fnos/manifest`](../fnos/manifest) 为准。

## 发版前

1. 确认 `VERSION` 与 `fnos/manifest` 版本一致
2. 更新 `fnos/manifest` 的 `changelog`（应用中心「新功能」展示此字段；文案可参考 [`docs/releases/`](releases/)）
3. 运行测试与构建：
   ```bash
   go test ./...
   cd web && npm run i18n:check && npx tsc --noEmit && npm run build
   ```
4. 国际化 QA：见 [i18n-qa.md](i18n-qa.md)
5. 打包 fnOS（可选）：
   ```bash
   ./scripts/build-fpk.sh
   ```
   产出：`dist/minibill_<version>_x86.fpk`、`dist/minibill_<version>_arm.fpk`

## Git 与 Tag

```bash
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin main
git push origin vX.Y.Z
```

## 发版后

- 飞牛 NAS 安装 fpk 冒烟：文案、图标、统计图、余额日常支出
- 飞牛应用商店：同步 `fnos/manifest` 的 `desc`（应用介绍）与 `changelog`（新功能）；若后台另有「版本说明」表单，建议与 `changelog` 保持一致（参考 [`docs/releases/`](releases/)）
- Docker 用户：`docker build` / 更新镜像 tag
- 论坛/GitHub Release 说明变更摘要

## 备份说明

- **定时备份**：Web「我的 → 备份管理」生成的是 **CSV zip**（单用户账本导出）
- **灾难恢复**：复制整个 `data/` 目录（含 `system.db` 与各用户 `ledger.db`）
