## MiniBill 1.0.11

飞牛网关下 API 纯文本 `invalid token` 不再导致 JSON 解析报错；鉴权限流仅作用于账密登录/注册；统计分析少点贴边，月/年序列首屏补零到当前；修复飞牛打开后页面狂闪（同名免密与账密登录仍可用）。

### 修复
- 前端安全解析 API 响应；识别飞牛统一网关返回的纯文本 `invalid token`，按未授权清登录并跳转，不再展示 `Unexpected token 'i'...` 类 JSON 解析错误
- CSV 导入同样走安全解析，避免同类裸解析失败
- 鉴权限流仅挂在 `POST /auth/login`、`POST /auth/register`；`/auth/registration`、`/auth/logout`、`/auth/fnos` 不再占用限流桶（飞牛网关下共用 ClientIP 时不易误伤账密登录）
- 统计分析折线图点数不足一屏时填满横轴、去掉两侧留白
- 月/年序列首屏锚到当前月/年，空档以零值展示
- 飞牛 fpk：业务请求改用 Cookie 鉴权（不发 Bearer），避免网关误拦导致同名免密后整页狂闪；登出后本会话跳过自动免密以便账密登录，关窗再开仍可同名直登

### 升级说明
- **飞牛 NAS**：升级 fpk 后即可
- **Docker / 自托管**：升级镜像或二进制后即可
- **Windows 打包**：`scripts\build-fpk.cmd 1.0.11 x86|arm|all`

### Full Changelog
`v1.0.10...v1.0.11`
