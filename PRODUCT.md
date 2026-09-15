# 产品背景

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- 前端：Vite + React + shadcn/ui + Tailwind CSS。
- 后端：Go + ConnectRPC，RPC 名称按用户表述及参考项目理解。
- 数据库：PostgreSQL。
- 部署：前后端合并为同一个应用镜像，由 Go 托管前端静态页面与 RPC 接口；Docker Compose 启动应用和独立的 PostgreSQL 服务。参考 `database-platform`。
- 描述使用 Markdown，编辑器选用 `@uiw/react-md-editor`，通过 npm 安装。

## Users

内部团队成员。

## Product Purpose

产品页面名为“团队导航”，项目目录为 `link-hub`。将团队常用系统和工具集中在一个导航页面中，通过点击卡片访问对应页面。

卡片目标系统在新标签页打开，原导航页保留，便于继续查找其他入口。

## Capabilities and Constraints

- 单个导航页面容纳多张卡片。
- 卡片包含名称、描述、分类、链接；分类示例为开发工具、运营系统、常用文档。
- 一张卡片支持关联多个分类。
- 预计内容规模为几十张卡片以内。
- 左侧分类栏、右侧卡片区，默认显示全部卡片；通过分类筛选，多分类卡片在全部视图中不重复。
- 第一版只提供分类筛选，不提供关键词搜索或管理员手动排序。
- 分类按名称排序，卡片按创建时间倒序；编辑不改变创建时间或默认排列位置。
- 名称、链接和至少一个分类必填，描述可空；卡片预览从描述自动生成。
- 支持浅深色主题切换，包括 Markdown 编辑与说明展示。
- 支持手机浏览和全部管理功能；手机端分类栏可收起，卡片单列。
- 描述支持 Markdown。
- 编辑器提供 Markdown 源码、实时预览和加粗、列表等格式工具按钮。
- 第一版 Markdown 支持文字、列表、链接和代码，不包含图片展示与上传。
- 卡片显示简短描述预览，独立的“查看说明”入口展示完整 Markdown。
- 完整说明用弹窗展示；管理员新增、编辑卡片使用右侧抽屉，保存成功后更新当前页面。
- 管理员登录后新增、修改、删除卡片，其他人只浏览。
- 管理员使用 Microsoft Entra 登录，实现和环境变量参考 `/Users/jizhiyonggan/Documents/Code/device-manager-v3`。
- 管理员可以新增、改名、删除分类，每张卡片必须至少选择一个分类。
- 仅可删除无卡片关联的分类；有关联时需先调整卡片分类，并确保每张卡片至少保留一个分类。
- 普通浏览者不需要登录，只有管理操作需要管理员登录。
- 部署采用 Docker Compose，本机验证地址为 http://localhost:3180；团队访问域名及反向代理由实际部署环境配置。
- 已完成七轮需求访谈，需求整理在 `docs/requirements.md`。已制作 `prototype/` 下的 HTML、CSS、JavaScript 交互原型；现已实现正式 React 页面、Go/ConnectRPC、PostgreSQL、Entra 登录与单镜像部署。

## Evidence on Hand

- 工程参考：`/Users/jizhiyonggan/Documents/Code/rebalancer`。
- Entra 登录及环境变量参考：`/Users/jizhiyonggan/Documents/Code/device-manager-v3`。
- 前后端单镜像打包参考：`/Users/jizhiyonggan/Documents/Code/database-platform`。
- 详细需求与未决问题：`docs/requirements.md`。
