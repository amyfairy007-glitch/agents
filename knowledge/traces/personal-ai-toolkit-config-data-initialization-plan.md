# 个人AI工具库 — config/ 与 data/ 初始化计划

> 生成日期：2026-07-04
> 阶段：只读计划
> 目标：使 config/ 和 data/ 从"缺失"变为"有最小真实内容"，为工作台提供正式基础

---

## 一、当前缺口

| 目标目录 | AGENTS.md 职责定义 | 当前状态 | 差距 |
|---|---|---|---|
| `config/` | 多工具共用的全局配置（`:49`） | ❌ 不存在 | 需创建并放入第一个有业务意义的全局配置 |
| `data/` | 项目状态、任务状态、执行记录、验证记录、报告索引、失败/重试/交接等持续数据（`:49`） | ❌ 不存在 | 需创建并放入第一个有业务意义的数据文件 |
| `knowledge/` | 流程 + 分析资料 | ✅ 存在（flows/ + traces/） | — |
| `tools/` | 可执行工具能力 | ✅ 存在（init-project-memory + sync-codex-home） | — |

**结论**：顶层四目录中，`config/` 和 `data/` 仍然缺失。虽然 README 中声明它们"当前暂无真实内容时不强制创建"，但为后续工作台提供正式基础，需要以最小真实内容初始化。

---

## 二、config/ 的最小真实初始化方案

### 2.1 文件：`config/global.json`

**不选择 TOML 的理由**：
- 现有 `tools/sync-codex-home/config/config.toml` 是工具专属配置，格式由工具决定；
- `config/` 是全局级，需被多种工具（Node 脚本、PowerShell、未来 CLI）读取；
- JSON 是 Node 内置支持、PowerShell 内置支持（`ConvertFrom-Json`）、通用性最广的格式；
- `package.json` 已在根级使用 JSON，风格一致。

### 2.2 文件内容

```json
{
  "$schema": "个人AI工具库全局配置 v1",
  "codexHome": "%USERPROFILE%\\.codex",
  "workspaceRoots": [],
  "projectScan": {
    "maxDepth": 3,
    "exclude": ["node_modules", ".git", "dist"]
  },
  "defaults": {
    "agentMode": "plan",
    "alwaysGeneratePlan": true,
    "sessionTimeoutMinutes": 30
  }
}
```

### 2.3 字段职责

| 字段 | 类型 | 职责 | 为什么不是占位符 |
|---|---|---|---|
| `codexHome` | string | OpenCode 家目录路径。当前 `sync-codex-home` 将其硬编码在脚本 `:2` 中；集中到此配置后，工具可从全局配置读取默认值，支持跨工具复用 | 直接支撑 `sync-codex-home` 的路径策略，后续工作台也需要知道 OpenCode 位置来创建 session |
| `workspaceRoots` | string[] | 工作台扫描项目时遍历的根目录列表。初始为空，由用户根据本机实际项目存放位置填写。工作台将根据此列表发现和注册项目 | 工作台的**第一输入**：不知道去哪找项目，工作台无法运作。这是配置不是占位 |
| `projectScan.maxDepth` | number | 扫描目录的最大嵌套深度 | 防止全盘扫描，是真实行为控制参数 |
| `projectScan.exclude` | string[] | 跳过扫描的目录名 | 避免扫描 node_modules 等无意义目录 |
| `defaults.agentMode` | string | 工作台创建子 session 时的默认 Agent 模式 | 工作台创建项目分析/开发 session 时的默认行为 |
| `defaults.alwaysGeneratePlan` | boolean | 是否总是先生成计划再执行 | 对接 AGENTS.md 的"审计先行"规则 |
| `defaults.sessionTimeoutMinutes` | number | 子 Session 无响应超时阈值 | 工作台监控子任务超时需此参数 |

### 2.4 与工具专属配置的边界

| 层级 | 示例 | 位置 |
|---|---|---|
| 全局配置 | 所有工具都可能用的 OpenCode 路径、默认工作区 | `config/global.json` |
| 工具专属配置 | sync-codex-home 的 sandbox 模式 | `tools/sync-codex-home/config/config.toml` |

**不冲突**：`sync-codex-home.ps1:2` 默认的 `$CodexHome` 值未来可从 `config/global.json` 读取作为备用默认，但仍允许命令行覆盖。

---

## 三、data/ 的最小真实初始化方案

### 3.1 文件：`data/projects-manifest.json`

### 3.2 文件内容

```json
{
  "$schema": "个人AI工具库项目清单 v1",
  "lastUpdated": "2026-07-04T00:00:00Z",
  "projects": {}
}
```

### 3.3 字段职责

| 字段 | 类型 | 职责 | 为什么不是占位符 |
|---|---|---|---|
| `$schema` | string | 版本标识，供读取方判断数据格式 | 后续工作台读取时根据此字段选择解析器 |
| `lastUpdated` | string | ISO 时间戳，记录最后修改时间 | 工作台可据此判断数据是否新鲜 |
| `projects` | object | 以项目路径或 ID 为 key 的字典。初始为空 `{}`，等待工作台首次扫描后填充 | 这是工作台的**核心数据结构**，后续每次项目接入、状态更新、扫描都将修改此文件。空对象 `{}` 不是占位符——它是合法的初始状态（"暂无已接入项目"） |

### 3.4 单个项目记录的大致结构（设计参考，不在初始化时创建）

```json
{
  "projects": {
    "E:\\Program\\MyProject": {
      "name": "MyProject",
      "rootPath": "E:\\Program\\MyProject",
      "type": "frontend",
      "addedAt": "2026-07-05T...",
      "lastScanAt": "2026-07-05T...",
      "gitRemote": "https://github.com/...",
      "currentBranch": "main",
      "takeoverStatus": "not-taken-over",
      "currentPhase": null,
      "currentTask": null,
      "nextStep": null,
      "risks": [],
      "agentsMdVersion": null,
      "handoffs": []
    }
  }
}
```

> 单体 project 的详细 schema 留待工作台设计阶段精化。当前仅需要 projects-manifest.json 的顶层结构。

### 3.5 为什么是 projects-manifest.json 而非 task/run 文件

- 工作台第一要务是**知道管哪些项目**。未知项目则无法创建任务；
- 多 Session 协同设计文档（`multi-session-collaboration-implementation-v2.md`）中规划的 `data/<task-id>/` 结构是第二层——**项目下的任务记录**；
- 初始化以项目清单为起点：先有项目注册能力，再有任务记录能力；
- 初始化为 `{"projects": {}}` 不会阻塞后续增删。

---

## 四、为什么不是占位文件

| 常见反例 | 本方案替代 | 区别 |
|---|---|---|
| `config/.gitkeep` | `config/global.json` | `.gitkeep` 无业务意义；`global.json` 包含工作台启动时真实需要的配置项 |
| `data/.gitkeep` | `data/projects-manifest.json` | `.gitkeep` 无业务意义；`projects-manifest.json` 定义了工作台核心数据结构的初始状态 |
| `data/empty.md` | — | 不存在此文件，不创建 |
| `config/placeholder.toml` | — | 不存在此文件，不创建 |

---

## 五、与后续工作台的衔接方式

### 5.1 工作台启动时的读取流程（规划）

```
工作台启动
├── 读取 config/global.json
│   ├── workspaceRoots    → 确定扫描哪些目录
│   ├── projectScan       → 扫描深度和排除规则
│   └── defaults          → Agent 模式 / 超时等默认行为
│
├── 扫描 workspaceRoots 下的项目目录
│   └── 对每个候选项目：
│       ├── 检查 .git/（确认是 Git 仓库）
│       ├── 读取 AGENTS.md / .ai/（确认 AI 接管状态）
│       └── 写入 data/projects-manifest.json
│
└── 展示项目列表
    └── 用户可选择项目进入管理模式
```

### 5.2 工作台运行时的写入流程（规划）

```
用户操作（例：任务创建、状态更新）
└── 写入 data/projects-manifest.json
    └── 更新对应项目的 currentTask / nextStep / risks 等字段
```

### 5.3 与现有工具的衔接

| 现有工具 | 衔接方式 |
|---|---|
| `tools/init-project-memory/` | 工作台扫描到未初始化项目时调用，创建 `.ai/` 结构 |
| `tools/sync-codex-home/` | 工作台更新 `AGENTS.md` 后调用，同步到 Codex 家目录 |
| `knowledge/flows/` | 工作台的任务处理流程从这里读取操作指南 |
| `knowledge/traces/` | 工作台的项目分析结果写入这里 |

---

## 六、是否需要修改 AGENTS.md、README.md

### AGENTS.md

**不需要修改**。`AGENTS.md:49` 已明确定义 `config/` 和 `data/` 的职责，本次初始化完全符合已有规则。

### README.md

**需要更新**。当前 README 中：

| 旧描述 | 问题 | 新描述 |
|---|---|---|
| `config/` "当前暂无真实内容，不强制创建" | config/ 将有真实内容 | 改为说明 `config/global.json` 的用途 |
| `data/` "当前暂无真实内容，不强制创建" | data/ 将有真实内容 | 改为说明 `data/projects-manifest.json` 的用途 |

---

## 七、实际新增和修改文件清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `config/global.json` | 全局配置，含 7 个真实业务字段 |
| 新增 | `data/projects-manifest.json` | 项目清单注册表，初始状态为 `{"projects": {}}` |
| 修改 | `README.md` | 更新 config/ 和 data/ 的描述，从"暂无内容"改为有实际用途 |

---

## 八、验证命令

### 8.1 目录存在性

```powershell
Test-Path config/  # 预期：True
Test-Path data/    # 预期：True
```

### 8.2 文件内容验证

```powershell
# config/global.json 是合法 JSON
$config = Get-Content config/global.json -Raw | ConvertFrom-Json
$config.codexHome           # 预期：有值
$config.workspaceRoots      # 预期：空数组

# data/projects-manifest.json 是合法 JSON
$data = Get-Content data/projects-manifest.json -Raw | ConvertFrom-Json
$data.projects              # 预期：空对象
```

### 8.3 README 引用检查

```powershell
Select-String -Path README.md -Pattern 'config|data'
# 预期：不再出现"暂无真实内容"
```

### 8.4 git diff/status

```powershell
git diff --check   # 预期：通过
git status --short # 预期：仅含上述新增和修改文件
```

---

## 九、回滚方式

单次 commit，回滚命令：

```powershell
git revert --no-edit HEAD
```

---

## 十、待确认事项

| 序号 | 事项 | 选项 |
|---|---|---|
| 1 | `config/global.json` 使用 JSON 格式，是否确认？还是改用 TOML 与 `sync-codex-home/config/config.toml` 一致？ | JSON（推荐）或 TOML |
| 2 | `data/projects-manifest.json` 中单体 project 的字段设计作为后续工作台设计时再精化，当前只定义顶层结构。是否接受？ | |
| 3 | README.md 的更新：仅改 config/ 和 data/ 的描述行，还是加一个独立小节说明？ | |
| 4 | `config/global.json` 是否需要纳入 `.gitignore` 或保留提交？当前无敏感内容，建议提交 | 提交（推荐）或 gitignore |

---

> **下一步：用户确认后，按计划初始化 config/ + data/ + 更新 README，单次提交。**
