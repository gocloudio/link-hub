# 配置与认证

## 环境变量

| 变量 | 用途 / 默认值 |
| --- | --- |
| `APP_PORT` | Compose 对外应用端口，默认 `3180`，仅监听本机 |
| `DB_PORT` | `compose.dev.yaml` 的数据库端口，默认 `55484` |
| `POSTGRES_PASSWORD` | 本项目数据库密码；初始化脚本生成随机值 |
| `DATABASE_URL` | Go 使用的 PostgreSQL 连接地址；Compose 自动组装，本地启动脚本自动读取 |
| `HTTP_ADDR` | Go 监听地址，容器 `:8080`，本地开发 `127.0.0.1:8180` |
| `WEB_DIR` | Go 托管的静态文件目录，容器 `/app/web` |
| `AUTH_MODE` / `VITE_AUTH_MODE` | 仅支持 `entra` |
| `ENTRA_TENANT_ID` / `VITE_ENTRA_TENANT_ID` | Entra 租户 ID |
| `ENTRA_CLIENT_ID` / `VITE_ENTRA_CLIENT_ID` | SPA 前端应用 ID |
| `ENTRA_AUDIENCE` | 受保护 API 应用 ID，必须匹配 access token 的 `aud` |
| `ENTRA_REQUIRED_SCOPE` | 后端要求的短 scope 名，默认 `dm.access` |
| `ENTRA_API_SCOPE` / `VITE_ENTRA_API_SCOPE` | 前端申请的完整 scope；缺省由 `api://{ENTRA_AUDIENCE}/{ENTRA_REQUIRED_SCOPE}` 生成 |
| `ENTRA_ADMIN_ROLE` | 允许维护卡片和分类的角色，默认 `dm.admin` |

Go 优先读取不带 `VITE_` 的同名配置。此处保留参考项目的环境变量兼容性，但实际前端通过 `/api/runtime-config` 读取配置，不把租户配置编译进产物。

`scripts/setup-env.py` 默认读取相邻 `device-manager-v3/.env`，仅导入白名单内的 Entra ID、scope 和角色变量，设置独立数据库密码。它不会复制 Graph client secret、旧项目的数据库连接或其他账号配置；输出不包含变量值，生成文件权限为 `0600`。

## Entra 应用设置

沿用 `device-manager-v3` 的 SPA 与 API 应用。登录方式为 MSAL `loginRedirect`，PKCE 授权码流程。回调地址为当前页面的 `origin + '/'`。

1. SPA 应用需要登记当前页面地址，例如 `http://localhost:3180/`；正式部署使用实际 HTTPS 地址。
2. 前端应具备 API 的委托权限，例如 `api://<API 应用 ID>/dm.access`。
3. API 应签发 v2 access token，管理员用户应在该 API 应用的角色分配中获得 `dm.admin`（或配置的角色）。
4. 浏览不要求登录。登录成功但缺少管理员角色时，页面保持浏览权限并显示提示。

项目不会自动修改 Entra 应用注册或角色分配。2026-09-15 用户已确认实际登录成功。

## 接口边界

所有 RPC 位于 `/linkhub.v1.HubService/`：

- 匿名：`ListCategories`、`ListCards`、`GetCard`。
- 登录用户：`GetMe`。
- 管理员：卡片、分类的所有创建、修改和删除方法。

服务端用固定租户的 Microsoft JWKS 验证 RS256 签名，并验证 issuer、audience、有效期、v2 token、租户、用户 ID、scope。管理员操作额外检查角色；浏览器是否显示编辑按钮不影响后端的判断。

卡片更新携带读取时的 `updated_at` 作为预期版本。版本冲突返回 `aborted`，抽屉保留输入；刷新页面会恢复草稿。可先复制需要保留的改动，关闭并重新打开该卡片获取新版本，再合并自己的修改。
