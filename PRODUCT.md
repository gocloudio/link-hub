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
- 提供分类筛选、个人收藏与拖拽排序，不提供卡片关键词搜索。
- 分类按名称排序；个人收藏置顶，其次按个人手动顺序，未排序卡片按创建时间倒序。
- 名称、链接和至少一个分类必填，描述可空；概览不展示描述摘要，分类右侧保留“查看说明”按钮。
- 支持浅深色主题切换，包括 Markdown 编辑与预览。
- 支持手机浏览和全部管理功能；手机端分类栏可收起，卡片单列。
- 描述支持 Markdown。
- 编辑器提供 Markdown 源码、实时预览和加粗、列表等格式工具按钮。
- 第一版 Markdown 支持文字、列表、链接和代码，不包含图片展示与上传。
- 卡片采用紧凑布局，包含名称、链接、分类、收藏按钮和拖拽手柄。
- 新增、编辑卡片使用右侧抽屉，保存成功后更新当前页面；Markdown 在说明弹窗查看，在编辑抽屉维护。
- 普通用户可创建内部公开或私有卡片，维护自己创建的卡片，私有卡片可指定已登录过本站的成员只读分享；管理员可以查看和维护全部公开与私有卡片。
- 管理员使用 Microsoft Entra 登录，实现和环境变量参考 `/Users/jizhiyonggan/Documents/Code/device-manager-v3`。
- 管理员可以新增、改名、删除分类，每张卡片必须至少选择一个分类。
- 仅可删除无卡片关联的分类；有关联时需先调整卡片分类，并确保每张卡片至少保留一个分类。
- 所有用户登录后才能查看；内部公开卡片对登录用户可见，普通用户对他人维护的公开卡片及收到的分享只读。每个人的收藏、排序独立存储在 PostgreSQL。
- 部署采用 Docker Compose，本机验证地址为 http://localhost:3180；团队访问域名及反向代理由实际部署环境配置。
- 已完成七轮需求访谈，需求整理在 `docs/requirements.md`。已制作 `prototype/` 下的 HTML、CSS、JavaScript 交互原型；现已实现正式 React 页面、Go/ConnectRPC、PostgreSQL、Entra 登录与单镜像部署。

## Evidence on Hand

- 工程参考：`/Users/jizhiyonggan/Documents/Code/rebalancer`。
- Entra 登录及环境变量参考：`/Users/jizhiyonggan/Documents/Code/device-manager-v3`。
- 前后端单镜像打包参考：`/Users/jizhiyonggan/Documents/Code/database-platform`。
- 详细需求与未决问题：`docs/requirements.md`。
