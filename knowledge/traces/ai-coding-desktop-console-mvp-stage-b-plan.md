# 多项目 AI Coding 桌面控制台 MVP — 阶段 B 实施计划

> 生成日期：2026-07-04
> 前置：阶段 A 已完成（commit: `7e1fc49`）
> 后续：阶段 C — CLI Task 流
> 当前：只出计划，不实施

---

## 一、阶段 B 范围

### 实现

| 命令 | 功能 | 对外部项目 |
|---|---|---|
| `project add --path <路径>` | 注册新项目到 manifest | 仅调用 init-project-memory（可选、需确认） |
| `project list` | 列出所有已接入项目 | 只读 manifest |
| `project status --project <名称或ID>` | 查看项目详细状态 | 只读（Git、.ai/、AGENTS.md） |
| `project prompt --project <名称或ID>` | 生成"让 AI 理解项目"的 Prompt，终端输出 | 只读（同 status 的信息源） |

### 不实现

- Task 创建、执行、审批
- Agent 调用
- 文件扫描（不遍历源码）
- 自动 PROJECT_MAP 生成
- 项目代码修改
- data/tasks/ board/ reports/ 目录创建
- 多项目批量操作

---

## 二、外部项目读取与写入边界

| 操作 | 读 | 写 | 条件 |
|---|---|---|---|
| `project add` | 路径存在性、.git/ 存在性 | manifest.json（工具库内） | — |
| `project add`（调用 init-project-memory） | — | 外部项目 `.ai/` 目录 | **仅当用户确认后**。已有 `.ai/` 则跳过不覆盖 |
| `project list` | manifest.json | — | — |
| `project status` | 外部项目：AGENTS.md、.git/、.ai/ | — | 严格只读 |
| `project prompt` | 同 project status + knowledge/flows/ | 终端输出 | — |

**唯一的外部项目写操作**：`project add` 调用的 `init-project-memory`。其他所有命令只读。

---

## 三、project add 设计

### 3.1 流程

```
1. 解析 --path 参数，Resolve-Path → 绝对路径
2. 检查路径存在（不存在 → 报错退出）
3. 检查路径是否包含 .git/ 目录（无 → 警告但允许继续）
4. 从目录名生成项目 ID（sanitize: 替换空格/特殊字符）
5. 检查 manifest 中是否已有重复登记（同路径 → 报错）
6. 检查项目 .ai/ 是否已存在
   - 已存在 → 跳过 init-project-memory
   - 不存在 → 询问用户 "是否初始化 AI 项目记忆（.ai/）？"
     - 确认 → 调用 init-project-memory.ps1 -ProjectPath <路径>
     - 拒绝 → 跳过
7. 写入 manifest：
   - 如果项目未登记过（按路径检查）：新增 entry
   - 写入后立即更新 lastUpdated 时间戳
8. 输出登记成功信息
```

### 3.2 项目 ID 生成规则

```
ID = 目录名
  → replace(/\s+/g, '-')
  → replace(/[^a-zA-Z0-9_-]/g, '')
  → toLower()
```

例：`E:\Program\my-project` → ID: `my-project`

### 3.3 manifest 写入字段（最小扩展）

```json
{
  "$schema": "个人AI工具库项目清单 v1",
  "lastUpdated": "2026-07-05T12:00:00Z",
  "projects": {
    "my-project": {
      "id": "my-project",
      "rootPath": "E:\\Program\\my-project",
      "displayName": "My Project",
      "addedAt": "2026-07-05T12:00:00Z",
      "lastActivityAt": "2026-07-05T12:00:00Z",
      "gitRemote": "https://github.com/user/repo.git",
      "hasAiMemory": true,
      "hasAgentsMd": false,
      "takeoverStatus": "registered"
    }
  }
}
```

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` | 目录名 sanitize | 稳定标识 |
| `rootPath` | --path 绝对路径 | 项目根目录 |
| `displayName` | 目录名原文 | 人可读名称 |
| `addedAt` | 当前时间 ISO | 登记时间 |
| `lastActivityAt` | 当前时间 ISO | 最近活动时间 |
| `gitRemote` | `git remote get-url origin` | 远程仓库地址（不可用时为 null） |
| `hasAiMemory` | `Test-Path .ai/` | 是否已初始化 AI 记忆 |
| `hasAgentsMd` | `Test-Path AGENTS.md` | 项目是否已有 AGENTS.md |
| `takeoverStatus` | 固定 `"registered"` | 当前仅登记，未接管 |

### 3.4 防止重复登记

按 `rootPath` 去重——遍历 manifest 中所有 projects，比较 `rootPath` 字段（忽略大小写和末尾斜杠）。发现重复时输出 "项目已登记（ID: xxx）"，不重复写入。

### 3.5 非 Git 仓库处理

警告："路径不包含 .git/ 目录，仍可登记但部分功能（Git 分支、远程地址读取）将不可用。" 允许继续。

---

## 四、project list 设计

### 输出格式

```
已接入项目:
  ID         名称            路径                       Git 远程            AI 记忆   登记时间
  --         ----            ----                      ---------           --------   --------
  my-project My Project      E:\Program\my-project      github.com/...      yes        2026-07-05
  demo-app   Demo App        E:\Program\demo-app        不可用               no        2026-07-04
  共 2 个项目
```

### 字段

| 列 | 来源字段 |
|---|---|
| ID | `id` |
| 名称 | `displayName` |
| 路径 | `rootPath` |
| Git 远程 | `gitRemote`（截断至 30 字符） |
| AI 记忆 | `hasAiMemory` → yes/no |
| 登记时间 | `addedAt`（截断至日期） |

排序：按 `lastActivityAt` 降序。

---

## 五、project status 设计

### 读取项

| 类别 | 内容 | 来源 |
|---|---|---|
| 基本信息 | 项目 ID、名称、路径 | manifest |
| 登记信息 | 登记时间、接管状态 | manifest |
| Git 状态 | 当前分支、remote URL、是否有未提交变更 | `git branch`、`git remote`、`git status --porcelain` |
| AGENTS.md | 是否存在、文件大小 | `Test-Path` + `Get-Item` |
| .ai/ 记忆 | 是否存在、business-context.md 是否存在、current-state.md 是否存在、decisions.md 是否存在 | `Test-Path` |

### 输出格式

```
项目状态: my-project
──────────────────────────
路径:      E:\Program\my-project
登记时间:  2026-07-05
接管状态:  registered

Git:
  分支:    main
  远程:    https://github.com/user/repo.git
  状态:    无未提交变更

AGENTS.md:  存在 (2.5 KB)
AI 记忆:    已初始化
  business-context.md:  存在
  current-state.md:     存在
  decisions.md:         存在
```

### 禁止

- 修改任何文件
- 创建任何目录
- 执行 `git` 写操作
- 自动生成 PROJECT_MAP.md

---

## 六、project prompt 设计

### 6.1 生成的 Prompt 内容

```
你现在位于以下项目的工作目录:

项目名称: my-project
项目路径: E:\Program\my-project
当前 Git 分支: main
远程仓库: https://github.com/user/repo.git

---

以下是该项目的 AGENTS.md 内容（如果存在）:
[AGENTS.md 全文粘贴]

---

以下是该项目的 AI 项目记忆（如果存在）:

[.ai/business-context.md 全文]
[.ai/current-state.md 全文]

---

项目登记信息:
  登记时间: 2026-07-05
  接管状态: registered

---

请以只读分析模式理解以上项目。然后输出:

1. **项目目标**: 这个项目是做什么的（根据 AGENTS.md、项目记忆和目录名判断）
2. **当前阶段**: 根据 .ai/current-state.md 判断当前工作
3. **目录结构**: 根目录下主要文件和目录清单
4. **入口文件**: 启动/构建入口
5. **风险**: 是否有缺失的 AGENTS.md 或 .ai/ 记忆
6. **下一步建议**: 建议优先完成的事项

注意:
- 不要修改任何文件
- 不要执行任何命令
- 不确定的部分标记为"未确认"
```

### 6.2 生成方式

1. 读取 manifest 中该项目的信息
2. 读取项目 AGENTS.md（如存在）
3. 读取项目 .ai/business-context.md、.ai/current-state.md（如存在）
4. 读取项目根目录下的文件列表（仅直接子项，不递归）
5. 按上述模板拼接 Prompt
6. 输出到终端

### 6.3 禁止

- 写入 `data/tasks/` 或创建 Task ID
- 调用 Agent 执行 Prompt
- 写入外部项目
- 生成任何文件

---

## 七、projects-manifest.json 字段扩展

### 阶段 B 新增字段

```json
{
  "id": "my-project",
  "displayName": "My Project",
  "gitRemote": "https://...",
  "takeoverStatus": "registered"
}
```

### 阶段 B 不加入

| 不加入 | 理由 |
|---|---|
| `tasks` / `runs` / `approvals` | 阶段 C/D 才需要 |
| `agentStatus` | 无 Agent |
| `tags` / `labels` | 未实现分类功能 |
| `priority` | 未实现 |
| `jiraRef` | 未确认需求 |

---

## 八、init-project-memory 调用边界

### 调用决策

```
project add 执行时:
  if (Test-Path .ai/) → "项目已存在 AI 记忆，跳过初始化"（不调用）
  else → 询问: "该项目尚无 AI 记忆。是否初始化？(y/n)"
    if y → 调用 init-project-memory.ps1
    if n → 跳过
```

### 调用方式

```powershell
$initScript = Join-Path $PSScriptRoot "..\..\..\..\init-project-memory\init-project-memory.ps1"
powershell -ExecutionPolicy Bypass -File $initScript -ProjectPath $projectPath
```

### 失败处理

| 场景 | 处理 |
|---|---|
| 模板不存在 | 报错，不写入 manifest |
| 权限不足 | 报错，不写入 manifest |
| 调用成功 | 写入 manifest，hasAiMemory = true |

### 不覆盖保证

`init-project-memory.ps1` 的 `Copy-IfMissing` 函数（:17-36）已保证不会覆盖已存在文件。即使重复调用也是安全的。

---

## 九、CLI 参数与错误处理

### 新增路由（console.ps1 扩展）

```
$Command = "project", $Subcommand = "list"

if ($Command -eq "project") {
  switch ($Subcommand) {
    "add"     { Invoke-ProjectAdd @args }
    "list"    { Invoke-ProjectList }
    "status"  { Invoke-ProjectStatus @args }
    "prompt"  { Invoke-ProjectPrompt @args }
    default   { Write-Error "Unknown project command: $Subcommand" }
  }
}
```

### 错误处理矩阵

| 错误场景 | 命令 | 处理 |
|---|---|---|
| 路径不存在 | `add --path <不存在>` | `Write-Host "路径不存在: <path>" -ForegroundColor Red; exit 1` |
| 非 Git 仓库 | `add --path <无.git>` | 警告后继续（不阻塞） |
| 重复项目 | `add --path <已登记>` | `Write-Host "项目已登记 (ID: $id)" -ForegroundColor Yellow; exit 0` |
| 项目不存在 | `status --project <未知>` | `Write-Host "未找到项目: <name>" -ForegroundColor Red; exit 1` |
| .ai/ 缺失 | `status` | 显示 "未初始化"，不报错 |
| Git 不可用 | 所有 Git 读取 | 显示 "Git 不可用"，不报错，继续输出其他信息 |
| 权限不足 | `add` 写 manifest 时 | `Write-Host "权限不足，无法写入 manifest" -ForegroundColor Red; exit 1` |
| 缺少 --path | `add` | `Write-Host "缺少 --path 参数"; exit 1` |
| 缺少 --project | `status`/`prompt` | `Write-Host "缺少 --project 参数"; exit 1` |

---

## 十、验证方案

### 10.1 测试项目准备

使用当前个人AI工具库自身作为测试项目：

```powershell
$testProject = "E:\program\ai-ui-agentic"
```

### 10.2 验证步骤

```powershell
# 1. 新项目登记
console.ps1 project add --path $testProject
# 预期: 登记成功，显示 hasAiMemory = true, hasAgentsMd = true

# 2. 重复登记
console.ps1 project add --path $testProject
# 预期: "项目已登记 (ID: ai-ui-agentic)"

# 3. project list
console.ps1 project list
# 预期: 列出至少 1 个项目

# 4. project status
console.ps1 project status --project ai-ui-agentic
# 预期: 显示路径、Git 分支、.ai/ 状态、AGENTS.md 状态

# 5. project prompt
console.ps1 project prompt --project ai-ui-agentic
# 预期: 终端输出完整 Prompt，不写入任何文件

# 6. manifest JSON 合法
Get-Content data/ai-coding-console/projects-manifest.json -Raw | ConvertFrom-Json

# 7. 外部项目没有被修改
git -C $testProject status --short
# 预期: 仅可能因 init-project-memory 调用产生 .ai/ 目录（如果之前不存在）

# 8. git diff --check
# 预期: 通过

# 9. 现有工具未被修改
git diff tools/init-project-memory/ tools/sync-codex-home/ AGENTS.md config/global.json
# 预期: 无输出
```

---

## 十一、提交与回滚

**提交**：单次 commit

```
git commit -m "feat: 控制台阶段 B — 项目登记与状态读取"
```

**回滚**：

```powershell
git revert --no-edit HEAD
```

---

## 十二、阶段 B 完成标准

| # | 条件 |
|---|---|
| 1 | `project add` 可成功登记一个真实项目 |
| 2 | 重复登记正确拒绝（不创建重复条目） |
| 3 | `project list` 可列出所有已登记项目 |
| 4 | `project status` 正确读取 Git 分支、.ai/、AGENTS.md |
| 5 | `project prompt` 终端输出完整 Prompt（不写文件） |
| 6 | manifest 为合法 JSON，新字段仅限阶段 B 范围 |
| 7 | 外部项目无代码被修改（除用户确认后的 .ai/ 初始化） |
| 8 | 未修改 AGENTS.md、config/global.json、现有 tools/ |
| 9 | 所有错误场景有明确输出和 exit code |
| 10 | git status 干净（仅含阶段 B 相关文件） |

---

## 十三、风险与待确认项

| 风险 | 级别 | 说明 |
|---|---|---|
| PowerShell git 命令兼容性 | 🟡 中 | `git status --porcelain`、`git remote get-url` 在不同 git 版本中可能有差异。使用 try/catch 兜底 |
| init-project-memory 路径查找 | 🟢 低 | console.ps1 需要找到 init-project-memory.ps1 的位置。通过 `$PSScriptRoot` 相对路径 `..\..\init-project-memory\` 定位 |

| 序号 | 待确认项 |
|---|---|
| 1 | `project add` 是否默认调用 init-project-memory，还是每次询问？建议每次询问（与计划一致） |
| 2 | project prompt 的内容模板是否需要调整（如是否加入 knowledge/flows/ 相关内容）？当前模板已包含 "读取现有流程" 的描述 |
| 3 | 是否需要在阶段 B 运行后清理测试用的 manifest 条目？ |

---

> **状态：阶段 B 实施计划完成。待用户确认后进入实施。**
