# AI_START

> Personal AI Global Router

本文件是 Codex 的个人 AI 全局轻量路由入口。

- 全局工作规则来源：`AGENTS.md`
- 项目、Personal Skill、Guide 和上下文均按需加载
- 不在启动阶段批量读取项目、Skill、Guide、`.ai/` 或历史资料

## Project Registry

用于根据用户提到的项目名称、别名或描述定位本机项目。

### ai-ui-agentic

- aliases：个人AI工具库、AI工具库、AI START、AI_START
- path：`E:\program\ai-ui-agentic`
- description：个人 AI 全局规则、Guide、Personal Skill 路由和工具能力的正式 Git 仓库。

### fund-analysis

- aliases：量化系统、基金分析、股票分析、回测系统
- path：`E:\program\fund-analysis`
- description：个人量化分析、行情数据、策略和回测项目。

### client-services

- aliases：client services、前端项目
- path：`E:\program\client-services`
- description：前端项目。

### tax-fe

- aliases：Tax 前端、Tax FE
- path：`E:\program\tax-fe`
- description：Tax 前端项目。

### ai-redeem
- aliases：AI 兑换、CDK 兑换、卡密兑换、ai redeem
- path：`E:\program\ai-redeem`
- description：用户输入 CDK 卡密并完成兑换的网站项目。

### Dujiao-Next
- aliases：AI Shop、ai-shop、Dujiao Next、独角数卡、购买网站、发卡网站
- path：`E:\program\Dujiao-Next`
- description：包含商品、订单、支付、卡密发放、用户商城和管理后台的数字商品商城项目。

## Personal Skill Registry

- 这里只登记用户自己编写和维护的 Personal Skill。
- 第三方 Skill、系统 Skill、MCP、Plugin、Connector 不登记。
- 用户任务语义明确匹配时，自动读取对应 `SKILL.md` 并执行。
- 不要求用户再次指定 Skill 名称。
- 只加载当前步骤真正需要的 Skill。

当前 Registry：空。

## Guide Router

### Market Localchange

- 触发：市场 Localchange、市场与 core/common 差异分析、Journey 市场迁移任务。
- path：`knowledge\flows\market-localchange-task-guide.md`

### Fund Analysis + Client Services

- 触发：任务涉及 fund-analysis、client-services、tax-fe 等关联项目，并需要理解跨项目关系。
- path：`knowledge\flows\fund-analysis-client-services-guide.md`

### CB AI Redeem
- 触发：任务涉及 ai-redeem、CDK 卡密兑换，或兑换站与购买站之间的业务边界。
- path：`knowledge\flows\cb-ai-redeem.md`

### CB AI Shop
- 触发：任务涉及 Dujiao-Next、AI Shop、商品购买、订单支付、卡密发放，或商城与兑换站之间的业务边界。
- path：`knowledge\flows\cb-ai-shop.md`

### React Frontend Structure
- 触发：新建或整理 React 前端项目、React 页面、Journey、页面组件、API 配置或前端目录结构。
- path：`knowledge\flows\react-frontend-structure-guide.md`

## Context Routing

- 需要项目结构、入口或核心模块：按需读取 `PROJECT_MAP.md`。
- 需要以前明确保存的项目上下文或决策：按需读取 `.ai/`。
- 需要历史分析或设计：按需搜索 `knowledge/traces/`。
- 对应文件不存在：正常工作，不自动创建。

## Fallback

- 没有匹配 Project：优先根据当前工作目录或用户提供路径判断，仍无法定位再询问用户。
- 没有匹配 Personal Skill：使用 Codex 正常能力。
- 没有匹配 Guide：正常工作。
- 没有 `PROJECT_MAP.md` 或 `.ai/`：正常工作。

AI_START 是增强层，不是任务执行的阻塞层。

## Maintenance

`E:\program\ai-ui-agentic` 是个人 AI 长期规则、Guide、SOP 和 Personal Skill 注册信息的正式来源。

默认不修改知识、Memory、Guide、`PROJECT_MAP.md`、handoff、trace 等内容；只有用户明确要求时才写入。
