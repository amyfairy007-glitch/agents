# CB AI Shop Guide

> 适用项目：`E:\program\Dujiao-Next`
>
> 生成日期：2026-10-01
>
> 依据：项目当前 `README.md`、目录和入口配置

## 使用场景

当前任务涉及以下内容时读取本 Guide：

- `Dujiao-Next`、`AI Shop` 或 `ai-shop`；
- 数字商品、订单、支付、卡密发放或履约；
- 用户商城、管理后台或商城后端；
- AI Shop 与 AI Redeem 的职责和数据边界。

## 项目定位与关系

- AI Shop 是私有数字商品商城。
- 本项目包含用户商城、管理后台和后端服务。
- 本项目负责商品、订单、支付和卡密发放等购买侧能力。
- AI Redeem 是独立的 CDK 卡密兑换网站。
- 两个应用独立维护，但共同组成：购买商品 → 获取 CDK 卡密 → 在 AI Redeem 完成兑换。

## 已确认技术入口

- 后端入口：`cmd/server/`。
- 后端：Go、Gin、GORM，支持 SQLite / PostgreSQL。
- 配置：Viper，示例文件为 `config.yml.example`。
- 用户端：`frontend/user/`，开发端口 `5173`。
- 管理端：`frontend/admin/`，开发端口 `5174`。
- 后端开发端口：`8080`。
- 前端使用 Vue 3、Vite、TypeScript、Tailwind CSS 和 pnpm。
- 完整发布构建会先构建两个前端，再通过 `fullstack` build tag 嵌入 Go 二进制。

## 架构边界

- 后端是模块化单体，业务模块位于 `internal/modules/`。
- 模块按 `domain`、`application`、`infrastructure`、`transport`、`contract` 分层。
- 跨模块依赖通过 `contract/`，装配位于 `internal/bootstrap/`。
- `internal/architecture/` 中的测试负责验证依赖边界。
- 新增管理端路由时需要同步检查 Casbin 内置角色权限和 RBAC coverage 测试。
- `/api`、`/uploads`、`/health` 是前端 SPA 路由的保留前缀。

## 开发与验证

后端开发：

```bash
go mod tidy && go run ./cmd/server
```

用户端和管理端分别进入对应目录，使用 pnpm 启动或构建。

按改动范围选择验证：

- 后端完整测试：`go test ./...`
- 架构边界：`go test ./internal/architecture/...`
- 单模块：`go test ./internal/modules/<module>/...`
- 用户端：在 `frontend/user` 执行 `pnpm run build`
- 管理端：在 `frontend/admin` 执行 `pnpm run build`

## 重要约束

- `config.yml`、凭据、Token、数据库、日志和上传文件属于敏感或运行时数据，不复制到 Guide、回复或提交中。
- 管理端路径由运行时 `web.admin_path` 决定；原生链接使用 `adminUrl()`，Vue Router 导航不要重复添加管理端前缀。
- 用户可见文案必须遵守项目 i18n 机制，不直接硬编码。
- SQLite 当前使用单连接；事务内部查询必须使用事务句柄，避免回到全局数据库连接造成死锁。
- 修改 `internal/web/` 或完整发布链路时，需要验证带 `release,fullstack` tags 的构建。

## 当前 Context 状态

- 当前未发现项目级 `AGENTS.md`、`PROJECT_MAP.md` 或 `.ai/`。
- 缺少这些文件时直接依据代码、README 和当前任务工作，不自动创建。
- 本 Guide 只保存稳定入口和长期边界，不记录临时任务状态。
