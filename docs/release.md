# MiniBill 发版清单

版本号以根目录 [`VERSION`](../VERSION) 与 [`fnos/manifest`](../fnos/manifest) 为准。

## 发版前

1. 确认 `VERSION` 与 `fnos/manifest` 版本一致
2. 运行测试与构建：
   ```bash
   go test ./...
   cd web && npm run i18n:check && npx tsc --noEmit && npm run build
   ```
3. 国际化 QA：见 [i18n-qa.md](i18n-qa.md)
4. 打包 fnOS（可选）：
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
- Docker 用户：`docker build` / 更新镜像 tag
- 论坛/GitHub Release 说明变更摘要

## 备份说明

- **定时备份**：Web「我的 → 备份管理」生成的是 **CSV zip**（单用户账本导出）
- **灾难恢复**：复制整个 `data/` 目录（含 `system.db` 与各用户 `ledger.db`）
