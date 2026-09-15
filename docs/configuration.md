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

## 运行日志

后端使用 Go `slog` 向标准错误输出 JSON 日志，可由 Docker 或 Kubernetes 直接采集。

- 启动：配置加载、PostgreSQL 连接、数据库迁移及耗时；端口绑定成功后记录启动完成，停止时记录关闭过程。
- RPC：记录 `request_id`、`procedure`、Connect 状态 `code` 和 `duration_ms`。正常请求为 INFO，参数或权限等错误为 WARN，内部错误和服务不可用为 ERROR。响应 `X-Request-ID` 可用于查询对应日志。
- 数据库：记录安全的 `error_type`，如 `dns_lookup_failed`、`connection_refused`、`timeout`、`postgres:28P01`（认证失败）、`postgres:3D000`（数据库不存在）。健康检查成功不记录日志，失败记录 WARN。
- 不记录完整数据库连接字符串、密码、Authorization/Cookie、请求正文或原始数据库错误详情。

```bash
# 本地 Compose
docker compose logs -f --tail=100 app

# Kubernetes
kubectl logs -n link-hub deployment/link-hub --tail=100 -f

# 排查启动后退出的容器
kubectl logs -n link-hub deployment/link-hub --previous --tail=100
```

## Entra 应用设置

沿用 `device-manager-v3` 的 SPA 与 API 应用。登录方式为 MSAL `loginRedirect`，PKCE 授权码流程。回调地址为当前页面的 `origin + '/'`。

1. SPA 应用需要登记当前页面地址，例如 `http://localhost:3180/`；正式部署使用实际 HTTPS 地址。
2. 前端应具备 API 的委托权限，例如 `api://<API 应用 ID>/dm.access`。
3. API 应签发 v2 access token，管理员用户应在该 API 应用的角色分配中获得 `dm.admin`（或配置的角色）。
4. 所有用户必须登录才能查看分类、卡片和链接。普通用户可维护自己的私有卡片；公开卡片及收到的分享只读。管理员可维护所有卡片；退出或身份失效后返回登录页。

项目不会自动修改 Entra 应用注册或角色分配。2026-09-15 用户已确认实际登录成功。

## 接口边界

所有 RPC 位于 `/linkhub.v1.HubService/`：

- 登录用户：`GetMe`、`ListMembers`、`ListCategories`、`ListCards`、`GetCard`；卡片查询按可见性过滤。
- 个人偏好：`GetCardPreferences`、`SetCardFavorite`、`SaveCardOrder`，仅能读写当前登录用户对可见卡片的收藏和顺序。
- 卡片写入：`CreateCard`、`UpdateCard`、`DeleteCard`；普通用户限自己的私有卡片，管理员可维护全部卡片。
- 未登录：所有业务 RPC 均返回 `unauthenticated`；仅登录页面静态资源、公开登录配置及健康探针可访问。
- 分类写入：仅管理员允许创建、修改和删除。
- 分享名单来自已登录过本站的 Entra 成员，使用 `GetMe` 记录用户信息，不需要 Microsoft Graph 权限或密钥。

服务端用固定租户的 Microsoft JWKS 验证 RS256 签名，并验证 issuer、audience、有效期、v2 token、租户、用户 ID、scope。管理员操作额外检查角色；浏览器是否显示编辑按钮不影响后端的判断。

卡片更新携带读取时的 `updated_at` 作为预期版本。版本冲突返回 `aborted`，抽屉保留输入；刷新页面会恢复草稿。可先复制需要保留的改动，关闭并重新打开该卡片获取新版本，再合并自己的修改。
