SHELL := /bin/sh
.DEFAULT_GOAL := help

# 将 rebalancer 的共享脚本约定落到项目内，仍可覆盖为外部脚本。
BUILD_IMAGE_SH ?= $(CURDIR)/scripts/build-image.sh
IMAGE_TAG_SH ?= $(dir $(BUILD_IMAGE_SH))image-tag
REPO ?= r.do-ny3.gocloudio.com/core
APP ?= link-hub
PLATFORM ?= linux/amd64
IMAGE_PREFIX := $(REPO)/grpc-apis-

# 默认同时开放应用端口与 PostgreSQL 本机端口；变量由 Compose 读取 .env。
# 不在 Makefile 中 include .env，避免将配置内容作为 Make 表达式执行。
COMPOSE_FILES ?= -f compose.yaml -f compose.dev.yaml
COMPOSE = docker compose $(COMPOSE_FILES)
TEST_COMPOSE = docker compose -f compose.test.yaml
TEST_DATABASE_URL ?= postgres://linkhub_test:local-test-only@127.0.0.1:55485/linkhub_test?sslmode=disable
SERVICE ?= app

.PHONY: help setup deps check-node proto proto-ts proto-lint build test api web
.PHONY: typecheck webbuild webtest check compose-up compose-down compose-ps compose-logs
.PHONY: db-up db-shell test-db-up test-db-down test-integration
.PHONY: image image-tags image-push link-hub check-image-tools

help: ## 显示可用命令
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## 导入参考项目的 Entra 配置，生成独立数据库密码
	python3 scripts/setup-env.py

check-node:
	@node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("需要 Node.js 24 或更高版本，请先运行 nvm use。"); process.exit(1); }'

deps: check-node ## 安装前端依赖并下载 Go modules
	npm ci --prefix web
	cd backend && go mod download

proto: check-node ## 从本项目 proto 生成 Go / ConnectRPC / TypeScript 代码
	buf generate

proto-ts: proto ## 兼容命令：同步生成两端协议代码

proto-lint: ## 校验 protobuf 定义
	buf lint
	buf build

build: ## 编译后端
	cd backend && go build ./...

test: ## Go 单测（数据库集成测试使用 test-integration）
	cd backend && go test ./... -timeout 60s

api: ## 本地运行 Go 后端（127.0.0.1:8180，读取 .env）
	python3 scripts/run-backend.py

web: check-node ## 本地运行 Vite 前端（127.0.0.1:5175）
	npm run dev --prefix web

typecheck: check-node ## 前端 TypeScript 类型检查
	npm run typecheck --prefix web

webbuild: check-node ## 前端生产构建
	npm run build --prefix web

webtest: check-node ## React 交互测试
	npm test --prefix web

check: proto-lint test webtest typecheck ## 协议、单测、前端测试、类型检查和 go vet
	cd backend && go vet ./...

compose-up: ## 构建单应用镜像，启动网站和本地数据库并等待健康
	$(COMPOSE) up -d --build --wait

compose-down: ## 停止网站和数据库，保留数据库卷
	$(COMPOSE) down

compose-ps: ## 查看网站和数据库状态、端口
	$(COMPOSE) ps

compose-logs: ## 跟踪日志（SERVICE=app 或 postgres）
	$(COMPOSE) logs --tail=100 -f $(SERVICE)

db-up: ## 仅启动本地 PostgreSQL（默认 127.0.0.1:55484）
	$(COMPOSE) up -d --wait postgres

db-shell: ## 进入本项目 PostgreSQL 的 psql
	$(COMPOSE) exec postgres psql -U linkhub -d linkhub

test-db-up: ## 启动独立测试数据库（127.0.0.1:55485）
	$(TEST_COMPOSE) up -d --wait

test-db-down: ## 停止并移除临时测试数据库
	$(TEST_COMPOSE) down

test-integration: test-db-up ## 启动测试数据库并运行 Go 集成测试及竞争检测
	@cd backend && TEST_DATABASE_URL='$(TEST_DATABASE_URL)' go test -race ./... -timeout 120s

image: check-image-tools ## 用 Buildx 构建带版本的单应用镜像并加载到本地
	@$(resolve_image_tag); \
	REPO="$(REPO)" TAG="$$tag" APP="$(APP)" PLATFORM="$(PLATFORM)" IMAGE_TAG_SH="$(IMAGE_TAG_SH)" "$(BUILD_IMAGE_SH)" -- \
	-f "$(CURDIR)/Dockerfile" \
	--load $(EXTRA_BUILD_ARGS) \
	"$(CURDIR)"

# 只在镜像相关目标执行时解析标签，普通开发命令不依赖 Git。
define resolve_image_tag
tag=$$(TAG="$(TAG)" GIT_REPO="$(CURDIR)" "$(IMAGE_TAG_SH)") || exit $$?
endef

image-tags: ## 显示自动生成的镜像标签（TAG 可手动覆盖）
	@$(resolve_image_tag); \
	printf '%s\n' "$(IMAGE_PREFIX)$(APP):$$tag"

check-image-tools:
	@test -x "$(BUILD_IMAGE_SH)" || { printf '%s\n' '缺少镜像构建脚本，请配置 BUILD_IMAGE_SH。' >&2; exit 1; }
	@test -x "$(IMAGE_TAG_SH)" || { printf '%s\n' '缺少标签脚本，请配置 IMAGE_TAG_SH。' >&2; exit 1; }

image-push: check-image-tools ## 构建并推送单镜像（需要镜像仓库权限）
	@$(resolve_image_tag); \
	REPO="$(REPO)" TAG="$$tag" APP="$(APP)" PLATFORM="$(PLATFORM)" IMAGE_TAG_SH="$(IMAGE_TAG_SH)" "$(BUILD_IMAGE_SH)" -- \
	-f "$(CURDIR)/Dockerfile" \
	--push $(EXTRA_BUILD_ARGS) \
	"$(CURDIR)"

link-hub: image-push ## 与 rebalancer 同风格的项目发布入口：构建并推送
