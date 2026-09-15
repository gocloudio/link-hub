# 团队导航 · Link Hub

供团队共享常用系统、工具和文档的单页导航。免登录浏览，Microsoft Entra 管理员维护内容。

## 本地启动

已按当前机器的参考项目导入 Entra 配置，应用地址：**http://localhost:3180**。

```sh
cd /Users/jizhiyonggan/Documents/Code/link-hub
# 首次配置：仅复制指定的 Entra 变量，并生成本项目的数据库密码
make setup
# 构建单个应用镜像，启动应用与 PostgreSQL
make compose-up
```

其他机器可从 `.env.example` 创建 `.env`，填写 Entra 租户、前端应用、API 应用和数据库密码。已有配置不会被脚本覆盖；也可传入参考项目的配置路径：

```sh
python3 scripts/setup-env.py --source /path/to/device-manager-v3/.env
```

正式数据库初始为空。管理员登录后先添加分类，再添加卡片。`prototype/` 的示例数据不会导入数据库。

## Make 命令

Makefile 参考 `rebalancer` 的命令命名与镜像发布方式，默认执行 `make help`。常用命令：

| 命令 | 用途 |
| --- | --- |
| `make compose-up` | 构建并启动网站和 PostgreSQL，等待健康检查 |
| `make compose-ps` | 查看状态与端口 |
| `make compose-logs` | 应用日志；数据库日志用 `SERVICE=postgres` |
| `make compose-down` | 停止服务，保留数据库卷 |
| `make db-up` / `make db-shell` | 单独启动数据库 / 进入 psql |
| `make deps` | 安装 npm 依赖与下载 Go modules |
| `make api` / `make web` | 分别运行本地后端 / Vite 前端 |
| `make proto` | 同步生成 Go、ConnectRPC 和 TypeScript 协议代码 |
| `make build` / `make webbuild` | 后端编译 / 前端生产构建 |
| `make check` | 协议校验、Go 单测、React 测试、类型检查与 go vet |
| `make test-integration` | 启动隔离测试数据库并运行 Go 集成测试 |
| `make test-db-down` | 清理临时测试数据库 |
| `make image` | Buildx 构建带版本的单应用镜像并加载到本地 |

`compose-*` 和 `db-*` 默认组合 `compose.yaml`、`compose.dev.yaml`，本机可访问网站 `3180` 和数据库 `55484`（可在 `.env` 修改）。只使用基础部署文件时执行 `make compose-up COMPOSE_FILES='-f compose.yaml'`。

### 发布镜像

项目内的 [scripts/build-image.sh](scripts/build-image.sh) 和 [scripts/image-tag](scripts/image-tag) 参考 `rebalancer` 使用的共享脚本，沿用 Buildx、`linux/amd64` 默认平台、仓库与镜像命名规则。只构建一个前后端合并镜像：`r.do-ny3.gocloudio.com/core/grpc-apis-link-hub:<tag>`。

```sh
# 打印镜像名
make image-tags
# 本地构建并加载镜像
make image
# 预览发布命令
DRY_RUN=1 make image-push
# 构建并推送；make image-push 是同一个发布入口
make link-hub
# 脚本也可独立运行；默认构建并加载本地镜像
./scripts/build-image.sh
```

可覆盖 `REPO`、`APP`、`PLATFORM`、`BUILD_IMAGE_SH`、`IMAGE_TAG_SH` 和 `EXTRA_BUILD_ARGS`。Docker 参数通过 `--` 传递，详见 `scripts/build-image.sh --help`。多架构发布可用 `make image-push PLATFORM=linux/amd64,linux/arm64`（需要支持这些平台的 Buildx builder）。

默认由 `scripts/image-tag` 自动生成：有 Git tag 时使用 `标签-时间`，其他 Git 提交使用 `分支-提交[-wip]-时间`；目录尚无 Git 提交时使用 `local-YYYYMMDDHHMMSS`。只有需要固定版本时才手动覆盖，例如 `make image TAG=v0.1.0`。推送前需登录目标仓库。`make compose-up` 继续构建本机平台的 `link-hub-app`，版本镜像构建与推送使用上述命令。

Dockerfile 使用本机平台执行 npm 构建和 Go 交叉编译，最终运行层匹配目标平台，并记录 OCI 版本标签。依赖下载/编译使用 BuildKit 缓存；Entra 配置仍由运行时环境变量提供。

## 功能

- 左侧分类筛选，卡片支持多分类；分类按名称排序，卡片按创建时间倒序。
- 点击卡片在新标签页打开；完整 Markdown 说明用弹窗显示。
- 右侧抽屉编辑；Markdown 源码、实时预览和中文工具栏；首期不显示图片或执行 HTML。
- 管理员可维护分类；有关联卡片时禁止删除分类，卡片始终至少保留一个分类。
- 浅深色切换、手机单列卡片与可收起分类栏。
- 编辑草稿保存在当前标签页的 sessionStorage，登录过期或刷新后可恢复；保存和放弃编辑后清除。
- 后端验证 Entra 签名、签发者、受众、有效期、租户、scope 和管理员角色；并发编辑校验修改时间，防止静默覆盖。

## 工程结构

```text
web/                      Vite + React + TypeScript + shadcn/ui + Tailwind CSS
  src/gen/                从 protobuf 生成的类型与服务描述
  src/components/         导航、Markdown、表单和 Radix/shadcn 基础组件
backend/                  Go + ConnectRPC + pgx + Entra JWT 验证
  gen/                    生成的 Go 消息与服务绑定
  internal/store/         PostgreSQL 事务、查询和嵌入式 SQL 迁移
proto/linkhub/v1/          单一接口定义
scripts/                  安全导入配置、本地后端启动
prototype/                已确认的 HTML/CSS/JS 交互原型
```

## 开发

需要 Node.js 24、Go 1.25、Docker Compose；修改 proto 时需要 Buf。`.nvmrc` 已指定 Node 版本。

```sh
nvm use
make deps
# 仅开放本项目开发数据库端口 55484
make db-up
# 终端一：后端 http://127.0.0.1:8180
make api
# 终端二：前端 http://127.0.0.1:5175，代理 RPC 与配置请求到后端
make web
```

开发地址也需要在 Entra 的 SPA 重定向 URI 中注册。使用已注册地址或通过同源代理访问。

```sh
# 修改 proto 后更新两端代码；生成器版本在 Go module / npm lock 中固定
make proto-lint proto
# 前端类型检查与生产构建
make webbuild
# 后端检查
make check
```

## 测试

```sh
# React 交互测试：匿名浏览、管理员表单、删除限制、冲突草稿、Markdown 安全渲染
make webtest
# 独立测试 PostgreSQL，不使用应用数据库
make test-integration
# 测试后清理；不会操作应用数据库
make test-db-down
```

Go 集成测试会创建并清理独立 schema；未设置 `TEST_DATABASE_URL` 时明确跳过数据库相关测试。JWT 测试使用本地 RSA 签名，HTTP 权限测试仅在测试代码中注入验证器，正式服务不提供模拟管理员入口。

## 部署与维护

- Docker 多阶段构建，最终**一个应用镜像**包含 Go 二进制和前端静态文件。PostgreSQL 是独立服务，数据保存在 `link-hub_postgres` 卷。
- 应用启动时自动执行数据库迁移；当前只有初始建表迁移。
- `GET /api/healthz` 检查数据库连接；`GET /api/runtime-config` 只返回前端需要的公开 Entra 参数。
- 默认应用端口仅绑定 `127.0.0.1:3180`。团队部署使用 HTTPS 反向代理转发到此端口，并在 Entra 注册实际页面根地址作为 SPA 回调。
- Entra 参数由 Go 在运行时提供；更换环境无需重新构建前端。不要将 `.env` 提交到版本库。
- 更新：`make compose-up`。停止：`make compose-down`；不要使用 `down -v`，它会删除数据库卷。
- 日志：`make compose-logs`。
- 数据库备份：`docker compose exec -T postgres pg_dump -U linkhub -d linkhub > backup.sql`。备份应存到项目之外。

更多细节见 [环境变量](docs/configuration.md)、[验证记录](docs/validation.md)、[需求说明](docs/requirements.md)、[访谈记录](docs/interview-record.md)。
