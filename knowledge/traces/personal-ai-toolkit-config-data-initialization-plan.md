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

**结论**：顶层四目录中，`config/` 和 `data/` 仍然缺失。需要以最小真实内容初始化。

### 前置条件确认：能力接管收口

在执行 config/data 初始化前，已确认以下收口全部完成：

| 检查项 | AGENTS.md 验证 | 目录验证 | 状态 |
|---|---|---|---|
| TASK-SOP.md 无效引用已删除 | `Select-String AGENTS.md -Pattern 'TASK-SOP'` → 无输出 | — | ✅ |
| 旧 `templates/project-memory/` 路径已更新 | `Select-String AGENTS.md -Pattern 'templates/project-memory'` → 无输出 | — | ✅ |
| `scripts/` 空目录已删除 | — | `Test-Path scripts/` → False | ✅ |
| `templates/` 空目录已删除 | — | `Test-Path templates/` → False | ✅ |

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
  "workspaceRoots": [],
  "projectScan": {
    "maxDepth": 3,
    "exclude": ["node_modules", ".git", "dist"]
  }
}
```

### 2.3 字段职责

| 字段 | 类型 | 职责 | 为什么不是占位符 |
|---|---|---|---|
| `$schema` | string | 版本标识，供读取方判断配置格式 | 后续工作台读取时根据此字段选择解析策略 |
| `workspaceRoots` | string[] | 工作台扫描项目时遍历的根目录列表。初始为空，由用户根据本机实际项目存放位置填写 | 工作台的**第一输入**：不知道去哪找项目，工作台无法运作 |
| `projectScan.maxDepth` | number | 扫描目录的最大嵌套深度（默认 3） | 防止全盘扫描，真实行为控制参数 |
| `projectScan.exclude` | string[] | 跳过扫描的目录名，排除 `node_modules` `.git` `dist` | 避免扫描无意义目录 |

### 2.4 与工具专属配置的边界

| 层级 | 示例 | 位置 |
|---|---|---|
| 全局配置 | 所有工具都可能用的工作区根目录和扫描策略 | `config/global.json` |
| 工具专属配置 | sync-codex-home 的 sandbox 模式 | `tools/sync-codex-home/config/config.toml` |

**不冲突**：`config/global.json` 不包含工具专属配置，工具专属配置保留在各自 `tools/<name>/config/` 下。

---

## 三、data/ 的最小真实初始化方案

### 3.1 文件：`data/projects-manifest.json`

### 3.2 文件内容

```json
{
  "$schema": "个人AI工具库项目清单 v1",
  "lastUpdated": null,
  "projects": {}
}
```

### 3.3 字段职责

| 字段 | 类型 | 职责 | 为什么不是占位符 |
|---|---|---|---|
| `$schema` | string | 版本标识，供读取方判断数据格式 | 后续工作台读取时根据此字段选择解析器 |
| `lastUpdated` | string\|null | ISO 时间戳，记录最后修改时间。初始为 `null`，表示"尚未写入任何数据" | `null` 准确表达了初始状态：无真实数据写入过。相比于伪造一个时间，`null` 更诚实且可由工作台判断是否需要首次扫描 |
| `projects` | object | 以项目路径为 key 的字典。初始为空 `{}`，等待工作台首次扫描后填充 | 工作台**核心数据结构**。空对象 `{}` 不是占位符——它是合法初始状态（"暂无已接入项目"） |

> 单体 project 的详细 schema 留待工作台设计阶段精化。当前不提前定义任何项目字段，也不在文件中包含设计草稿。在文件外补充设计参考不会出现在正式产物文件中。

### 3.4 为什么是 projects-manifest.json 而非 task/run 文件

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
│   └── projectScan       → 扫描深度和排除规则
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
| 新增 | `config/global.json` | 全局配置，含 4 个字段：`$schema`、`workspaceRoots`、`projectScan`（2 子字段） |
| 新增 | `data/projects-manifest.json` | 项目清单注册表，初始状态 `{"projects": {}}`，`lastUpdated: null` |
| 修改 | `README.md` | 更新 config/ 和 data/ 的描述行，从"暂无真实内容"改为指向实际文件 |

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
$config.workspaceRoots      # 预期：空数组
$config.projectScan.maxDepth  # 预期：3

# data/projects-manifest.json 是合法 JSON
$data = Get-Content data/projects-manifest.json -Raw | ConvertFrom-Json
$data.projects              # 预期：空对象
$data.lastUpdated           # 预期：null
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

## 十、已确认事项（本次修订结论）

| 事项 | 结论 |
|---|---|
| config/ 格式 | JSON，与 `package.json` 一致 |
| config/ 字段范围 | 仅 `$schema` + `workspaceRoots` + `projectScan`；不含 codexHome / defaults |
| data/lastUpdated | 初始值 `null`，不伪造时间 |
| data/ 单体项目 schema | 不在初始化时定义，留待工作台设计阶段 |
| README 更新范围 | 仅改 config/ 和 data/ 的描述行，不写未实现功能 |
| 提交策略 | 所有文件提交，无敏感内容 |

---

> **状态：已根据用户确认完成修订。等待确认后执行初始化。**

---

> **状态：已根据用户确认完成修订（v2）。所有待确认事项已决议。等待确认后执行初始化。**
