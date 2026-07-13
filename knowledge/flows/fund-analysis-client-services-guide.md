# fund-analysis + 三前端项目上下文指南

> 生成日期：2026-07-12  
> 用途：AI Agent 进入以下项目时的项目上下文 SOP。  
> 说明：本文档是对各项目已有代码、配置和约定的正式整理，不是新的设计决策。

---

## 1. 项目背景

### 1.1 整体架构

```
fund-analysis（后端 Node.js/Express 4）
├─ /api/statement/*  → 个税/社保/公积金/银行流水（核心业务 API）
├─ /api/fund/*       → 基金数据
├─ /api/index/*      → 指数数据
├─ /api/stock/*      → 股票数据
├─ /api/board/*      → 板块数据
├─ /api/backTest/*   → 回测
├─ /api/*            → 其他（用户/文章/交易/日报/缠论/地区等）
└─ AI LLM 链路      → 个税模板提取 / 社保基数推断 / 公司省份判断

  ├─ client-services（前端 Web）  → API: localhost:4000
  │   React 19 + Antd 5: 算税管理系统
  │   个税计算 / 公积金 / 在线客服 / 快捷消息 / 人事档案
  │
  ├─ tax-fe（移动端 H5） → API: 129.204.7.204:4000
  │   Vue 2 + Vant: 财务数据展示门户
  │   个税(iOS/Android) / 社保(多省) / 公积金 / 银行流水 / 工资单 / 征信/学信PDF
  │
  └─ tax-payment-record（移动端 V2） → API: localhost:4000 / www.expone.cn:4000
      Vue 2 (无router): 税单独立项目
      纳税记录(完税证明) / 公积金账户信息 / 交易明细(银行流水)
```

**项目路径**：

| 项目 | 路径 |
|------|------|
| `fund-analysis` | `E:\Program\fund-analysis` |
| `client-services` | `E:\Program\client-services` |
| `tax-fe` | `E:\Program\tax-fe` |
| `tax-payment-record` | `E:\Program\tax-payment-record` |

**tax-fe 与 tax-payment-record 的关系**：
- `tax-payment-record` 本是 `tax-fe` 中的税单模块，因历史原因独立出来
- `tax-fe` 中的 `P.vue`、`taxList.vue` 等是另一套税单实现
- 两者共存，代码独立演进，业务定位有重叠

---

### 1.2 fund-analysis（后端）

| 维度 | 说明 |
|------|------|
| **定位** | 金融数据分析 + 个税/社保/公积金管理的 Node.js 后端服务，为三个前端提供统一 API |
| **运行环境** | Node.js（建议 >=12），PM2 进程管理（应用名 `fund-be`） |
| **Web 框架** | Express ~4.16.1，CommonJS 模块系统 |
| **关系数据库** | MySQL — Sequelize 6 + `mysql2` 驱动 |
| **文档数据库** | MongoDB — 旧版 `mongodb` v2.x 驱动 + `peter`（Gitee ODM） |
| **缓存** | Redis — `ioredis` 封装为 `Cache` / `RedisCacheMan` |
| **AI/LLM** | OpenAI SDK（通过 OpenRouter 代理）— 个税模板提取、社保基数推断、公司省份判断 |
| **外部数据源** | 天天基金、蛋卷基金、东方财富、币安、微信公众平台 |
| **定时任务** | `node-schedule`（当前 `schedule.js` 为空） |
| **测试** | Mocha + assert + nyc（覆盖率） |
| **配置管理** | `node-config` 包（`config/` 目录），默认环境 `test` |
| **静态前端** | `public/`（React 构建产物）、`build/`、`scggfwApp/`、`xlcx/`、`static/` |

**启动方式**：
- `npm start` — 启动 HTTP（配置端口） + HTTPS（端口 4001）
- `npm test` — 运行测试
- 入口：`bin/www` → `app.js`

**目录分层职责**：
```
routes/   → 路由层（自动注册为 /api/<文件名>）
service/  → 业务逻辑层
dao/      → 数据访问层（Sequelize Model + CRUD，共 47 个 DAO）
common/   → 通用工具层（MySQL/MongoDB/Redis/Excel/日志等封装）
lib/      → 业务辅助工具（枚举、版本控制、AI模板配置等）
prompts/  → AI 提示词模板（新链路 + old/ 冻结旧版）
docs/     → 审计报告与治理文档（个税 AI 链路等）
```

**关键业务域**：
- **金融分析**：基金/指数/股票/板块行情数据、缠论模型（分型/笔/线段/中枢/买卖点）、回测
- **个税（核心）**：个税计算、AI 模板提取（自然语言 → 标准化 JSON）、批量创建纳税记录（`createMultipleTax`）、税单查询
- **社保/公积金**：基数补全（LLM 辅助）、参保证明 PDF 生成（多省格式）、公积金账户查询
- **银行流水**：多银行流水数据查询（`findStatement`）
- **微信公众号**：token 管理、菜单、素材、草稿接口
- **用户/文章/交易**：用户管理、文章内容、交易记录

---

### 1.3 client-services（前端 Web）

| 维度 | 说明 |
|------|------|
| **定位** | 算税管理系统（Web 端），面向企业管理场景 |
| **框架** | React 19 + React Router 6 + Ant Design 5 |
| **构建工具** | Vite 8（已从 CRA 迁移，`build/` 为遗留产物，当前输出在 `dist/`） |
| **HTTP 客户端** | Axios（统一封装在 `src/utils/request.js`，baseURL = `http://localhost:4000`） |
| **样式方案** | 全局 SCSS + SCSS Modules + CSS Modules 混用 |
| **认证** | `sessionStorage` 的 `isLogin` 标志 + `useAuthGuard` Hook，默认账号 `zhitou` / `0000` |

**启动方式**：
- `npm run dev` — 启动开发服务器（端口 3000）
- `npm run build` — Vite 生产构建

**页面路由**：

| 路由 | 页面 | 功能 |
|------|------|------|
| `/login` | 登录页 | 账号密码登录 |
| `/calculative` | 个税+公积金 | 工作经历管理、个税计算、公积金管理、数据导出 |
| `/onlineService` | 在线客服 | Wechaty 微信客服聊天、联系人列表、消息发送 |
| `/quickMessagePanel` | 快捷消息 | Tab-分类-按钮层级消息面板、编辑与复制 |
| `/hr/profile` | 人事档案 | 员工信息、头像上传 |

---

### 1.4 tax-fe（移动端 H5）

| 维度 | 说明 |
|------|------|
| **定位** | 财务数据展示门户（移动端 H5），展示个税/社保/公积金/银行流水等各类财务文档 |
| **框架** | Vue 2.6 + Vue Router 3 + Vuex |
| **UI 库** | Vant 2（移动端） + Element UI 2（官网模块） |
| **构建工具** | Webpack 4（自建配置，非 Vue CLI） |
| **HTTP 客户端** | Axios（封装在 `src/utils/axios.js`，baseURL = `http://129.204.7.204:4000`） |
| **样式** | Less |
| **认证** | Cookie 硬编码 JWT（`axios.js` 中静态设置） |
| **状态管理** | Vuex（仅 `axiosLoading` 全局状态） |

**启动方式**：
- `npm run dev` — 启动开发服务器（端口 8080）
- `npm run build` — 生产构建
- 依赖安装：`npx -y npm@8.19.4 install --legacy-peer-deps --registry=https://registry.npmjs.org`

**页面路由（~60 条）**，按业务域分组：

| 业务域 | 路由示例 | 功能 |
|--------|----------|------|
| **个税** | `/tax-ios`、`/tax`、`/tax-list`、`/detail`、`/and-detail` | iOS/Android 双版个税列表与详情 |
| **社保** | `/socialSecurity*`、`/endowment*`、`/*SbPDF`、`/*Pdf` | 多省社保（支付宝模拟 + PDF 渲染），涵盖广东/深圳/北京/上海/四川/合肥/江苏/浙江/湖北/陕西/南宁 |
| **公积金** | `/accumulation`、`/ZFGJJZHXX` | 公积金账户信息 |
| **银行流水** | `/salary`、`/jymx`、`/cpc-checking`、`/salaryAccount` | 招商/中国/大通/建行仿 App 截图 |
| **银行流水 PDF** | `/-pdf` 系列（ccb/abc/boc/icbc/cmb/citic/pab/psbc/hkb/lloyds） | 多银行流水 PDF 渲染 |
| **工资单** | `/salarySheet` | 仿 App 工资单视图 |
| **征信/学信** | `/credit`、`/chsi` | 个人征信报告、学信网 PDF |
| **官网门户** | `/`、`/company`、`/news`、`/product`、`/h5` | 公司官网内容（遗产业务） |

---

### 1.5 tax-payment-record（税单独立项目）

| 维度 | 说明 |
|------|------|
| **定位** | 税单（纳税记录/完税证明）PDF 渲染，本是 tax-fe 中的模块，因历史原因独立部署 |
| **框架** | Vue 2.6（无 vue-router、无 Vuex） |
| **构建工具** | Vue CLI 5 |
| **HTTP 客户端** | Axios（无统一封装，各组件直接调用，URL 硬编码） |
| **API 地址** | `localhost:4000`（主） + `www.expone.cn:4000`（公积金/流水） |

**启动方式**：
- `npm run serve` — 启动开发服务器
- `npm run build` — 生产构建

**业务模块**：

| 模块 | 文件 | 功能 | API |
|------|------|------|-----|
| **税单 PDF** | `src/pdf/P.vue` | 多点纳税人的多页完税证明 PDF 渲染，含圆形公章 | `findFinishTax`、`findCompanyProvince` |
| **公积金账户信息** | `src/components/ZFGJJZHXX.vue` | 移动端风格公积金详情（个人信息/中心信息/账户信息） | `findReserveFund` |
| **交易明细** | `src/jymx/index.vue` | 银行借记卡交易历史，按年月分组 | `findStatement` |
| **旧版税单** | `src/components/P.vue` | 硬编码数据的旧版税单组件（未使用） | — |

**与 tax-fe 的关系**：
- `tax-payment-record` 源自 `tax-fe` 中的税单模块
- `tax-fe` 中另有 `P.vue`、`taxList.vue` 等税单实现
- 两者并行存在，独立维护

---

## 2. 工作指南

### 2.1 目录分层与修改原则

**fund-analysis（后端）**：
- 严格遵守 `routes → service → dao/common` 分层，禁止绕过
- 路由层（`routes/*.js`）只做参数校验和响应格式化，不写业务逻辑
- 业务逻辑在 `service/*.js` 中实现
- 数据访问在 `dao/*.js` 中实现（Sequelize Model + 查询方法）
- 通用工具在 `common/*.js` 中实现
- DAO 导出模式：`initModel(sequelize, DataTypes)`
- 自动路由注册：`routes/*.js` 对外成为 `/api/<文件名>`
- 响应统一使用 `BaseResult.sendSuccess()` / `sendFail()`

**client-services（前端 Web）**：
- 页面级组件放在 `src/pages/<页面名>/`
- 可复用组件放在 `src/components/<功能模块>/`
- API 调用集中在 `src/api/<模块名>.js`
- 功能代码就近原则：辅助代码靠近使用它的页面或组件
- 路径别名：`@` → `src/`、`@components` → `src/components`

**tax-fe（移动端 H5）**：
- 页面级组件放在 `src/view/` 目录
- 共享组件放在 `src/components/` 目录
- API 调用在 `src/api/` 中定义
- 路由定义在 `src/router/index.js`（hash 模式）
- **注意**：`AGENTS.md` 中指定 `src/` 下的业务逻辑代码不应修改，除非用户明确要求

**tax-payment-record（税单独立项目）**：
- `App.vue` 直接渲染 `pdf/P.vue`，没有路由层
- 各组件独立调用 Axios，无统一 api 层
- 如需访问公积金（`ZFGJJZHXX.vue`）或交易明细（`jymx/index.vue`），需手动修改 `App.vue` 的 import

### 2.2 代码规范

| 维度 | 规范 |
|------|------|
| **后端模块系统** | CommonJS（`require` / `module.exports`），禁止迁移到 ESM |
| **前端 Web** | ES Module + JSX（React 19） |
| **移动端 H5** | ES Module + `.vue` SFC（Vue 2） |
| **命名：JSX 文件** | PascalCase（`AvatarPanel.jsx`） |
| **命名：Vue 文件** | PascalCase + kebab-case 混用（`socialSecurity.vue`、`ZFGJJZHXX.vue`） |
| **命名：目录** | kebab-case |
| **命名：API 函数** | camelCase |
| **命名：后端文件** | 驼峰风格（`fundService.js`、`stockDao.js`） |
| **UI 语言** | 中文 |
| **前端 Web 组件** | 函数式组件 + Hooks，不使用 Class Component |
| **样式** | Web：SCSS / CSS Modules 混用；移动端：Less |

### 2.3 开发流程

**本地启动顺序**：
1. 启动后端：在 `fund-analysis/` 下运行 `npm start`
2. 启动前端 Web：在 `client-services/` 下运行 `npm run dev`（端口 3000）
3. 启动移动端 H5：在 `tax-fe/` 下运行 `npm run dev`（端口 8080）
4. 启动税单：在 `tax-payment-record/` 下运行 `npm run serve`

**Git 分支**：
- 分支命名：`Feat_xxx` 风格
- 基线与推送：基于远程 master 创建，完成后合并

**PM2 管理**（fund-analysis）：
- 应用名：`fund-be`
- 配置文件：`ecosystem.config.js`
- 环境变量：`NODE_ENV=test`
- 自动 watch，排除 `excel/`、`upload/`、`template/`、`node_modules/`

**数据库操作安全规则**：
- 默认不连接生产数据库
- 只读操作优先
- DROP / TRUNCATE / DELETE / UPDATE / ALTER 等高风险操作必须经用户明确确认
- 敏感配置（数据库连接串、API Key）不复制到回复或文档中

### 2.4 AI 协作规则

- **默认计划模式**：进入项目后先分析再修改，复杂任务先输出计划等待确认
- **审计先行**：对已发现的问题进行审计分析后再实施修复
- **分层修改**：按照 routes → service → dao/common 顺序定位，不在错误层级修改
- **配置保护**：不暴露敏感配置，不在 AI 回复中输出生产环境密钥
- **正式产物**：审计、计划、实施结果必须落盘为仓库文件，不保留在聊天中
- **prompt 文件管理**：
  - 新版 prompt 在 `fund-analysis/prompts/` 目录
  - 旧版 prompt 在 `fund-analysis/prompts/old/`（已冻结，不修改）
  - 通过 `promptVersion` 参数切换（`latest/new` vs `old/master`）
- **只读约束**：`tax-fe` 的 `AGENTS.md` 明确指定 `src/` 业务逻辑代码默认不应修改

### 2.5 测试验证

**fund-analysis（后端）**：
- 测试框架：Mocha
- 运行：`npm test`
- 覆盖率：`npm run cov`（nyc）
- 测试文件：`test/`（AI 模板预解析器、LLM 版本选择、新版失败态治理）

**client-services（前端 Web）**：
- 当前无实际测试用例
- 验证：`npm run build` 确认构建无报错

**tax-fe（移动端 H5）**：
- 当前无实际测试用例
- 验证：`npm run build` 确认构建无报错

**tax-payment-record（税单）**：
- 当前无测试
- 验证：`npm run build` 确认构建无报错

---

## 3. 工作范围

### 3.1 后端 API 模块概览（fund-analysis）

| 路由文件 | API 前缀 | 业务域 | 被哪些前端消费 |
|----------|----------|--------|----------------|
| `routes/statement.js` | `/api/statement` | 个税/社保/公积金/银行流水（含 AI 模板链路） | client-services、tax-fe、tax-payment-record |
| `routes/fund.js` | `/api/fund` | 基金数据（净值/估值/业绩/排名/经理/关键字） | — |
| `routes/index.js` | `/api/index` | 指数数据（信息/估值/PE/相关基金） | — |
| `routes/stock.js` | `/api/stock` | 股票数据（公司信息/30分K线） | — |
| `routes/board.js` | `/api/board` | 板块数据 | — |
| `routes/backTest.js` | `/api/backTest` | 策略回测 | — |
| `routes/fundCrawler.js` | `/api/fundCrawler` | 基金爬虫 | — |
| `routes/stockModel.js` | `/api/stockModel` | 缠论模型（分型/笔/线段/中枢/买卖点） | — |
| `routes/area.js` | `/api/area` | 地区数据 | — |
| `routes/article.js` | `/api/article` | 文章管理 | tax-fe（官网内容） |
| `routes/dailyReport.js` | `/api/dailyReport` | 日报 | tax-fe（每日估值） |
| `routes/historyDeal.js` | `/api/historyDeal` | 历史交易 | — |
| `routes/transaction.js` | `/api/transaction` | 交易 | — |
| `routes/user.js` | `/api/user` | 用户 | — |
| `routes/wxPublic.js` | `/api/wxPublic` | 微信公众号 | — |

**通用接口路由**（`interface/supportService.json` + `common/api.js`）：
- 通过 `conf.yaml` 中的 baseURL 映射到外部服务
- 动态调用，路由层不直接定义

**三个前端共同使用的核心 API（`/api/statement/*`）**：

| API 端点 | 用途 | 消费方 |
|----------|------|--------|
| `findTax` | 个税数据查询 | client-services、tax-fe |
| `findTaxList` | 分页个税列表 | tax-fe |
| `findFinishTax` | 完税记录（税单） | tax-payment-record |
| `findStatement` | 银行流水查询 | tax-fe、tax-payment-record |
| `findInsurance` | 社保数据查询 | tax-fe |
| `findReserveFund` | 公积金账户查询 | tax-fe、tax-payment-record |
| `findCompanyProvince` | 公司省份判断（LLM） | tax-payment-record |
| `aiTemplate` | 个税 AI 模板提取 | client-services |
| `createMultipleTax` | 批量创建纳税记录 | client-services |
| `uploadPdf` | PDF 上传 | tax-fe |

### 3.2 前端 Web 页面模块（client-services）

| 路由路径 | 页面文件 | API 模块 | 功能范围 |
|----------|----------|----------|----------|
| `/login` | `pages/login/` | — | 登录认证 |
| `/calculative` | `components/personalIncomeTax/` + `components/AccumulationFund/` | `api/statement.js` | 工作经历管理、个税计算、公积金管理、数据导出 |
| `/onlineService` | `pages/onlineService/` | `api/onlineService.js` | 联系人列表、聊天窗口、消息发送 |
| `/quickMessagePanel` | `pages/quickMessagePanel/` | `api/button.js` | Tab-分类-按钮层级、消息编辑与复制 |
| `/hr/profile` | `pages/hr/` | — | 员工档案信息、头像上传 |

### 3.3 移动端 H5 页面模块（tax-fe）

| 业务域 | 页面文件（src/view/） | API 端点 | 功能范围 |
|--------|----------------------|----------|----------|
| **个税 iOS** | `tax-ios.vue`、`tax-ios-detail.vue`、`taxList.vue` | `findTax`、`findTaxList`、`findTaxById` | iOS 风格个税列表与详情，支持年度筛选 |
| **个税 Android** | `tax.vue`、`tax-and-detail.vue`、`taxListAndroid.vue` | 同上 | Android 风格个税列表与详情 |
| **社保（支付宝模拟）** | `socialSecurity.vue`、`socialSecurityDetaile.vue`、`socialSecuritySZ.vue`、`socialSecuritySichuan.vue`、`socialSecurityHefei.vue` 等 | `findInsurance` | 多省市社保信息展示 |
| **社保（PDF 渲染）** | `endowment.vue`、`endowmentBJ.vue`、`beijingSbPDF.vue`、`nanningSbPDF.vue`、`shaanxiSbPDF.vue`、`SZSocialSecurityPDF.vue`、`gdPdf.vue`、`hbPdf.vue`、`shanghaiPdf.vue`、`jiangsuPdf.vue`、`zheJiangPdf.vue`、`zhejiangLongpdf.vue`、`jiangsuSmartHumanResources.vue`、`zheJiangApp.vue`、`zhejiangName.vue`、`shanghaiEndowmentAppIos.vue` | `findInsurance` | 多省社保 PDF 像素级复刻 + 支付宝 App 模拟 |
| **公积金** | `accumulationFundIos.vue`、`ZFGJJZHXX.vue` | `findReserveFund` | 公积金账户信息展示 |
| **银行流水（仿 App）** | `salary2Android.vue`、`salaryDetail.vue`、`salaryAccount.vue`、`jymx.vue`、`cpcChecking.vue` | `findStatement` | 招商/中国/大通/建行流水仿 App 截图 |
| **银行流水（PDF）** | `abcPdf.vue`、`bocPdf.vue`、`ccbPdf.vue`、`newCcbPdf.vue`、`cmbPdf.vue`、`icbc.vue`、`citicPdf.vue`、`pabPDF.vue`、`psbcPdf.vue`、`hkbPdf.vue`、`lloydsPdf.vue` | `findStatement` | 多银行流水 PDF 渲染 |
| **工资单** | `salarySheet.vue` | `findStatement` | 仿 App 工资单视图 |
| **通用账单 PDF** | `wxBillPDF.vue` | — | 微信账单 PDF |
| **征信/学信 PDF** | `creditPDF.vue`、`chsiPDF.vue` | — | 个人征信、学信网 PDF 渲染 |
| **官网门户** | `home.vue`、`index.vue`、`company.vue`、`news.vue`、`newsInfo.vue`、`product.vue`、`h5.vue` | `getNavigate`、`getServerInfo`、`getEveryDay` | 公司官网内容（遗产业务模块） |
| **404** | `NotFound.vue`（components/） | — | 通配符回退到 `/` |

### 3.4 税单独立项目页面模块（tax-payment-record）

| 模块 | 组件文件 | API 端点 | 功能范围 |
|------|----------|----------|----------|
| **税单 PDF** | `src/pdf/P.vue` | `findFinishTax`（税单数据）、`findCompanyProvince`（公章名称/LLM） | 多点纳税人多页完税证明 PDF 渲染，含圆形公章 |
| **公积金账户信息** | `src/components/ZFGJJZHXX.vue` | `findReserveFund` | 移动端风格公积金详情：个人信息、中心信息、账户信息 |
| **交易明细** | `src/jymx/index.vue` | `findStatement`（`statementType: "招商银行"`） | 银行借记卡交易历史，按年月分组 |
| **旧版税单** | `src/components/P.vue` | —（硬编码数据） | 旧版税单组件（当前未使用） |

### 3.5 关键业务流

**个税 AI 模板流程**（client-services → fund-analysis）：
```
用户在前端输入自然语言个税描述
  → client-services API 调用 POST /api/statement/aiTemplate
  → fund-analysis routes/statement.js 接收
  → llmService.js 版本分流（promptVersion 参数）
  → 新版链路：
      aiTemplatePreParser.js 预解析（时间/收入/社保/银行等）
      → llmModernPrompts.js 构建 prompt（prompts/aiTemplatePrompt.md）
      → llmServiceModern.js 调用 LLM（标准 JSON 响应）
      → safeJsonParse → normalizeTaxConfigList
      → applyAiTemplateHints → validateResult
  → 返回标准化税务配置 JSON → 前端渲染
```

**税单 PDF 渲染流程**（tax-payment-record → fund-analysis）：
```
用户打开税单页面
  → pdf/P.vue mounted() 发起 API 调用
  → POST /api/statement/findFinishTax（获取纳税记录数据）
  → POST /api/statement/findCompanyProvince（LLM 推断公司省份，获取公章名称）
  → 渲染多页 A4 税单（2482x3511），含纳税人信息、缴税明细、分页导航、圆形公章
```

**社保/公积金/银行流水查询流程**（tax-fe → fund-analysis）：
```
用户在移动端选择社保/公积金/流水入口
  → 对应 .vue 组件 mounted() 调用 API
  → POST /api/statement/findInsurance / findReserveFund / findStatement
  → 根据数据渲染支付宝模拟截图 或 PDF 风格页面
```

### 3.6 修改边界

**默认修改范围**：

| 项目 | 可修改目录 | 备注 |
|------|-----------|------|
| `fund-analysis` | `routes/`、`service/`、`dao/`、`common/`、`lib/`、`prompts/`（新链路） |  |
| `client-services` | `src/pages/`、`src/components/`、`src/api/`、`src/utils/` |  |
| `tax-fe` | 默认只读（`AGENTS.md` 约束），用户明确要求时可修改 `src/view/`、`src/api/`、`src/router/` | 构建配置在 `build/`、`config/` |
| `tax-payment-record` | `src/pdf/`、`src/components/`、`src/jymx/`、`App.vue` |  |

**不默认修改（需明确确认）**：
- `fund-analysis/prompts/old/`（旧版 prompt 已冻结，只读参考）
- `client-services/build/`（CRA 遗留产物）
- `tax-fe/src/` 下的业务逻辑代码（除非用户明确要求）
- 所有项目的 `node_modules/`
- 生产数据库配置、HTTPS 证书、敏感密钥

**需要谨慎处理的模块**：
- AI 双链路切换逻辑（`fund-analysis/service/llmService.js` 的分流机制）
- `response_format` 降级重试逻辑（新版链路失败态治理，已知 P1 问题）
- 数据库 DDL/DML 操作（必须确认环境，禁止在生产库执行）
- `tax-fe` 的官网门户页面（`home.vue`、`index.vue`、`company.vue` 等 — 遗产业务，修改风险待评估）

### 3.7 已知风险与注意事项

| 风险项 | 项目 | 说明 | 建议 |
|--------|------|------|------|
| `lodash/cloneDeep` 隐式依赖 | client-services | 代码中使用但未在 `package.json` 声明 | 确认 lodash 是否为传递依赖，必要时显式声明 |
| API 地址硬编码 | client-services | `baseURL=http://localhost:4000` 写死 | 后续可提取到 `.env` 或配置文件 |
| API 地址分散硬编码 | tax-payment-record | `localhost:4000` 和 `www.expone.cn:4000` 在各组件中分别写死，无统一配置 | 建议统一到配置文件 |
| Cookie 凭据硬编码 | tax-fe | `axios.js` 中 JWT 令牌静态写入 Cookie | 存在安全隐患，后续可改为动态登录 |
| API 地址指向生产 | tax-fe | `baseURL=http://129.204.7.204:4000` 硬编码指向生产环境 | 开发环境改为 `localhost:4000` 或通过 `.env` 切换 |
| README 过时 | client-services | 仍描述 CRA 命令，与当前 Vite 构建不一致 | 更新为 Vite 命令 |
| 遗留文件 | client-services | 旧版菜单 `pages/menu.jsx` 与新版 `pages/menu/menu.jsx` 并存；`pages/accumulation-fund/` 未使用 | 清理无引用文件 |
| 无 router | tax-payment-record | `App.vue` 直接渲染 `pdf/P.vue`，访问公积金或流水需要手动改 import | 如需多模块访问可引入 vue-router |
| 数据解构无安全处理 | tax-payment-record | `data.data.data` 多层取值无空值检查 | 后端异常时前端可能崩溃 |
| 测试覆盖不足 | 全部前端 | 三个前端项目均无实际测试用例 | 按需补充 |
| 个税 AI 链路 P1 问题 | fund-analysis | `generateTaxConfig()` 失败后 API 仍返回 200；`response_format` 降级重试无错误分类 | 待治理 |
| `.ai/` 项目记忆未初始化 | 全部项目 | 四个项目均未初始化 `.ai/` 项目记忆 | 首次进入时可运行 `init-project-memory` 初始化 |
| tax-fe 官网模块为遗产业务 | tax-fe | 公司官网页面（home/index/company/news/product）与核心财务数据展示无关 | 修改时确认是否涉及官网模块 |

---

## 4. 补充说明

### 4.1 文档维护

- 本文档作为 `ai-ui-agentic` 能力库中的项目参考，存储在 `knowledge/flows/`
- 当任一项目发生重大架构变化时，应同步更新本文档
- 本文档不替代项目内的 `AGENTS.md`，而是作为外部 AI 进入时的快速上下文

### 4.2 适用目标

- Codex
- Claude Code
- OpenCode
- 其他进入以上项目的 AI Agent
