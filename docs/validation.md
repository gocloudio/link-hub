# 首期实现验证记录

日期：2026-09-15。

## 自动化

- `buf lint`、`buf build`：通过。
- `npm run build --prefix web`：TypeScript 与 Vite 生产构建通过。
- `npm test --prefix web`：React 交互测试覆盖登录门禁、普通用户只读、会话失效后隐藏数据、多分类去重、新标签页链接、Markdown 说明、必填校验、创建保存、分类改名与禁止删除、卡片删除确认、版本冲突草稿保留、HTML/图片/不安全链接过滤。
- `TEST_DATABASE_URL=… go test -race ./...`：使用独立 PostgreSQL 17 测试数据库通过；覆盖可重入迁移、事务回滚、最后一个分类的数据库约束、排序、并发版本冲突、ConnectRPC 权限及 CRUD。
- JWT 测试覆盖管理员和浏览角色、错误签名、过期、未来 token、错误租户/issuer/audience/scope、缺少用户 ID、v1 token。
- `go vet ./...`：通过。
- `docker compose up -d --build --wait`：单应用镜像构建成功，应用和 PostgreSQL 健康检查通过。

## 页面与登录

- 已检查桌面与 390px 手机视口，浅深色、说明弹窗、编辑抽屉、手机分类栏，无页面横向溢出。
- 管理页面视觉检查使用独立测试数据库和临时的界面测试身份；真实后端仍拒绝该身份的写请求。正式镜像不包含该测试入口。
- Microsoft 登录已跳转到正确的账户登录页；用户已确认真实账号登录成功。
- 测试示例没有写入正式应用数据库，正式初始化不包含示例内容。

截图保存在本机 `output/playwright/`（不纳入版本库）。后续更换域名、Entra 配置或用户角色时，应重新检查对应地址的登录回调及管理员维护权限。

## 镜像构建脚本

- 项目内 `scripts/build-image.sh`、`scripts/image-tag` 已通过 Bash 语法检查。
- 标签生成验证：显式版本、非法版本拒绝、无 Git 时自动生成 local 时间戳版本、分支、未提交修改及 Git tag。
- 构建参数验证：本地加载、显式推送、多架构导出约束、`--push` / `--load` 互斥。
- `make image TAG=v0.1.0` 实际构建并加载成功：`r.do-ny3.gocloudio.com/core/grpc-apis-link-hub:v0.1.0`，架构 `linux/amd64`，OCI 版本 `v0.1.0`，用户 `65532:65532`。
- 使用该镜像的 Go `healthcheck` 命令通过 Docker 网络检查运行中的网站，退出码为 0。
- 推送入口已预览验证；本次没有向远端仓库推送镜像。

## 强制登录访问验证

- 前端 13 项测试通过：未登录不请求数据、身份初始化门禁、普通用户只读、读取请求携带 Bearer token、会话失效后清除页面和忽略迟到响应、权限收回后降为只读、退出立即清除身份及草稿。
- `make test-integration` 通过，使用独立 PostgreSQL 并启用 Go race 检测；覆盖匿名/无效令牌不能读取、普通用户可读取但写入被拒绝，以及管理员 CRUD。测试数据库已清理。
- TypeScript 检查、Vite 构建、`go vet ./...` 通过。
- 已通过 `make compose-up` 更新本地服务；实测三个读取 RPC 的匿名请求均为 HTTP 401 / `unauthenticated`。
- Playwright 检查桌面 1440×1000 与手机 390×844 登录页；未登录时仅请求公开登录配置，没有卡片与分类 RPC 请求。
- 本轮未再次使用真实 Entra 账号完成登录回调；认证配置与 PKCE 登录流程沿用已验证实现。
