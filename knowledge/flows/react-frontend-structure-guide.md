# React Frontend Structure Guide

> 适用范围：新建或整理 React 前端项目
>
> 版本：V1
>
> 目标：为 React 项目提供固定、轻量、可复用的前端目录规范。

## 触发条件

当前任务涉及以下内容时读取本 Guide：

- 新建 React 前端项目；
- 创建 React 页面、Journey 或页面组件；
- 规划 React 前端目录；
- 调整 React 项目中的页面、请求、配置或假数据结构。

## 技术约定

- React + Vite；
- JavaScript，不使用 TypeScript；
- 页面流程使用 Journey 表达；
- `server/` 与 `client/` 同级，服务端目录暂时只预留，不提前设计。

## 固定目录

```text
AGENTS.md
README.md
src/
├── client/
│   ├── config/
│   │   ├── DEV/
│   │   │   ├── index.js
│   │   │   └── RedeemJourney.js
│   │   └── UAT/
│   │       ├── index.js
│   │       └── RedeemJourney.js
│   ├── data/
│   │   └── routes.js
│   ├── views/
│   │   ├── components/
│   │   │   └── RedeemJourney/
│   │   │       ├── SectionA.jsx
│   │   │       └── SectionB.jsx
│   │   ├── journey/
│   │   │   └── RedeemJourney/
│   │   │       ├── index.jsx
│   │   │       ├── init.js
│   │   │       ├── constants.js
│   │   │       ├── buildrequest.js
│   │   │       └── utils.js
│   │   └── nls/
│   ├── stub/
│   ├── util/
│   ├── lib/
│   │   └── api/
│   │       └── index.js
│   ├── styles/
│   ├── App.jsx
│   └── main.jsx
└── server/
```

示例中的 `RedeemJourney` 代表具体业务 Journey；新业务使用自己的 Journey 名称替换，不复制无关目录。

## 项目地图：根目录 `AGENTS.md`

每个新建或接管的项目，根目录默认应有一个项目专属 `AGENTS.md`。它的定位是“项目地图”，让 AI 进入项目后先知道项目是什么、去哪里找资料、哪些目录负责什么。

项目专属 `AGENTS.md` 至少说明：

- 项目名称、路径和一句话定位；
- 项目负责的业务范围；
- 关联项目及职责边界；
- AI 查找 README、PROJECT_MAP、`.ai/`、Guide 和代码的顺序；
- 当前已确认的入口、目录和项目状态；
- 未确认内容不能猜测的约束；
- 敏感信息和不可执行操作的边界；
- 当前项目应读取的全局 Guide 路径。

`AGENTS.md` 不替代全局 `AGENTS.md`，也不保存完整技术文档、任务历史、Token、Session、密码或临时状态。它只提供项目地图和进入项目所需的路由信息。

当项目还没有 `AGENTS.md` 时，生成 React 前端结构前应先根据实际项目情况创建项目地图；如果用户明确要求只读盘点或暂不创建文件，则只提出建议，不擅自写入。

## 目录与文件职责

### 文件归属规则

生成或修改文件前，先按下表确定归属。一个文件只放在一个职责目录中，不因为方便而跨目录复制。

| 文件或目录 | 必须放置位置 | 负责内容 | 不应放置 |
|---|---|---|---|
| `App.jsx` | `client/` | 客户端应用根入口、全局 Journey 装配 | 具体页面 UI、接口参数细节 |
| 项目地图 | 项目根目录 `AGENTS.md` | 项目定位、查找顺序、目录入口、项目边界 | 业务实现、完整技术文档、敏感信息、临时任务状态 |
| `main.jsx` | `client/` | React 启动、根节点挂载、全局初始化 | 业务流程、页面请求 |
| 页面组件 | `client/views/components/<Journey>/` | JSX、布局、表单、按钮、交互展示 | API 请求、环境判断、跨页面流程 |
| Journey 入口 | `client/views/journey/<Journey>/index.jsx` | Journey 请求调用、状态管理、页面组件组装、流程切换 | 大段页面 UI、环境 API 地址 |
| Journey 初始化 | `client/views/journey/<Journey>/init.js` | 默认状态、初始数据、初始化函数 | 请求调用、页面 JSX |
| Journey 常量 | `client/views/journey/<Journey>/constants.js` | 状态值、事件名、稳定业务常量 | DEV/UAT 地址、运行时状态 |
| Journey 请求构造 | `client/views/journey/<Journey>/buildrequest.js` | 将当前状态转换为 API Payload、路径参数和查询参数 | `fetch`、页面 JSX、全局配置 |
| Journey 工具 | `client/views/journey/<Journey>/utils.js` | 只服务当前 Journey 的格式化、校验和状态转换 | 通用全局工具、API 地址 |
| 环境公共配置 | `client/config/<ENV>/index.js` | 当前环境的公共配置，例如 `apiBaseUrl` | 页面状态、业务请求 Payload |
| Journey API 配置 | `client/config/<ENV>/<Journey>.js` | 当前环境和 Journey 的接口路径、方法及请求配置 | React 状态、UI 文案、Session 数据 |
| 路由导航 | `client/data/routes.js` | 页面路径、导航标题、Journey 映射 | API 地址、请求参数 |
| 全局请求封装 | `client/lib/api/index.js` | HTTP 执行、请求头、JSON 解析、超时和统一错误处理 | 某个 Journey 的业务参数组装 |
| 全局工具 | `client/util/` | 两个或以上 Journey 复用的无业务工具 | 单个 Journey 专用逻辑 |
| 假数据 | `client/stub/` | 假 CDK、假 Session、假任务和模拟响应 | 真实 Token、真实订单和生产数据 |
| 多语言资源 | `client/views/nls/` | 页面文案和语言资源 | 业务判断、API 配置 |
| 全局样式 | `client/styles/` | 全局 CSS、主题和基础样式 | 单个组件的业务逻辑 |

### 文件放置优先级

遇到新逻辑时按以下顺序判断：

1. 只负责显示或交互：放入 `views/components/<Journey>/`；
2. 负责当前流程、请求调用或状态：放入 `views/journey/<Journey>/index.jsx`；
3. 负责当前流程的参数组装：放入 `buildrequest.js`；
4. 只服务当前流程的常量或工具：放入当前 Journey 的 `constants.js` 或 `utils.js`；
5. 两个以上 Journey 复用：才放入 `util/` 或 `lib/`；
6. API 地址或环境差异：放入 `config/DEV/` 或 `config/UAT/`；
7. 页面路径和导航：放入 `data/routes.js`；
8. 假数据和模拟接口结果：放入 `stub/`。

### `client/config/`

保存 API 请求地址和环境配置。

- `DEV/`：开发环境；
- `UAT/`：UAT 环境；
- 每个环境可按 Journey 增加配置文件，例如 `RedeemJourney.js`；
- 当前运行环境只读取对应环境目录，不跨环境混用。

当前运行环境选择规则：

```text
DEV → client/config/DEV/index.js + client/config/DEV/<Journey>.js
UAT → client/config/UAT/index.js + client/config/UAT/<Journey>.js
```

### `client/data/routes.js`

保存页面路由和导航关系，例如页面路径、标题和对应 Journey。它不保存 API 地址。

### `client/views/components/`

保存页面表现组件，按 Journey 分组。组件负责 UI 和交互表现，不负责全局请求和业务流程编排。

例如：

```text
client/views/components/RedeemJourney/SectionA.jsx
client/views/components/RedeemJourney/SectionB.jsx
```

组件可以接收 `props`、触发回调和展示校验状态，但请求和状态来源由 Journey 入口提供。

### `client/views/journey/`

保存完整页面流程的编排代码。每个 Journey 至少包含：

- `index.jsx`：Journey 入口、请求调用、状态管理和组件组装；
- `init.js`：初始状态和初始化数据；
- `constants.js`：当前 Journey 的稳定常量；
- `buildrequest.js`：当前 Journey 的 API 请求参数组装；
- `utils.js`：当前 Journey 专用工具函数。

`index.jsx` 可以使用少量 JSX 组装组件，但不承担具体页面 UI 实现。

例如：

```text
client/views/journey/RedeemJourney/index.jsx
client/views/journey/RedeemJourney/init.js
client/views/journey/RedeemJourney/constants.js
client/views/journey/RedeemJourney/buildrequest.js
client/views/journey/RedeemJourney/utils.js
```

推荐调用关系：

```text
index.jsx
  ├── init.js                 初始化状态
  ├── constants.js            读取稳定常量
  ├── buildrequest.js         组装请求参数
  ├── config/<ENV>/<Journey>.js 读取接口配置
  ├── lib/api/index.js        执行 HTTP 请求
  └── components/<Journey>/   组装页面组件
```

### `client/views/nls/`

保存多语言文案资源。

### `client/stub/`

保存假数据、模拟响应和本地演示数据。正式接口接入后仍可保留用于开发和测试。

### `client/util/`

保存跨 Journey 复用的通用工具函数。只被单个 Journey 使用的工具放在对应 Journey 的 `utils.js`。

### `client/lib/api/index.js`

保存全局 API 请求执行封装，例如请求头、JSON 处理、超时和统一错误处理。具体 Journey 的参数不在这里组装。

这是 React 默认脚手架的跨项目通用层。每个新建 React 项目都应优先复用同一套请求约定，而不是在各个 Journey 中重新封装请求。

全局 API 封装至少负责：

- 根据当前环境读取 `config/DEV` 或 `config/UAT`；
- 拼接 `apiBaseUrl` 和接口路径；
- 提供统一的 `GET`、`POST`、`PUT`、`DELETE` 调用方式；
- 处理 JSON 请求和响应；
- 处理超时、请求取消和 HTTP 错误；
- 统一识别业务错误响应；
- 支持额外请求头，但不得记录 Session JSON、Token、Cookie 等敏感值。

全局封装使用浏览器原生 `fetch`，默认不引入 Axios 或其他 HTTP 客户端库。业务代码不得直接在组件或 Journey 中散落 `fetch` 调用。推荐调用关系：

```text
Journey/index.jsx
  ↓
Journey/buildrequest.js
  ↓
client/lib/api/index.js
  ↓
DEV / UAT API
```

`lib/api/index.js` 只负责“如何请求”和“如何处理响应”，不负责 CDK、Session、订单或其他业务逻辑。

### `client/server/`

服务端预留目录。除非用户明确要求，不在本 Guide 触发时设计服务端技术栈或内部结构。

## 默认生成规则

新建 React 前端时：

1. 默认使用本 Guide 的目录和命名；
2. 默认使用 `DEV` 和 `UAT` 两套 API 配置；
3. 默认使用 JavaScript 文件，不创建 `.ts` 或 `.tsx`；
4. 页面表现放入 `views/components/`；
5. 流程编排放入 `views/journey/`；
6. 不额外创建 `pages/`、`features/`、`hooks/`、`layouts/` 或 `services/`，除非用户明确要求或现有项目已有约定；
7. 不把 API 地址硬编码在组件或 Journey 中；
8. 不为了凑目录创建空的业务文件，只有真正需要时才增加新的 Section 或 Journey。

## 生成前检查清单

生成 React 前端文件时必须确认：

- 文件是否位于正确的 `client/`、`views/`、`components/` 或 `journey/` 层级；
- 页面 JSX 是否只放在 `views/components/<Journey>/`；
- Journey 入口是否只负责请求、状态和组件组装；
- API 参数是否经过当前 Journey 的 `buildrequest.js`；
- API 地址是否来自当前环境的 `config/DEV/` 或 `config/UAT/`；
- 是否错误创建了 `services/`、`pages/` 或 TypeScript 文件；
- 是否把真实 Token、Session JSON、Cookie 或生产数据写入 `stub/`、日志或配置；
- 新增文件是否有明确职责，而不是为了填充目录创建占位文件。

如果一个文件同时包含页面 UI、API 地址和业务请求逻辑，应先拆分到对应目录，再继续生成代码。
