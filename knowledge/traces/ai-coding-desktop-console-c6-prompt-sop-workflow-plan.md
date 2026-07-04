# 多项目 AI Coding 桌面控制台 — 阶段 C.6 Prompt Builder、Task SOP 实例化、全局 Capability Registry 与 Agent 指令编辑器设计

> 生成日期：2026-07-05
> 阶段：C.6 设计（C.5 三栏UI 计划就绪，D Adapter 暂停）
> 当前：只出设计文档，不实施

---

## 一、阶段 C.6 范围与非范围

### 范围

| 设计项 | 说明 |
|---|---|
| 全局 Capability Registry | 所有 Skill/SOP/Script/Prompt Template 的统一注册、查看、搜索模型 |
| Prompt Builder | 用户模糊想法 → 结构化任务说明 → Agent Prompt 的生成流水线 |
| Task 专属 SOP 实例化 | 全局 SOP 绑定到具体 Task 后，生成该项目该 Task 的专属步骤 |
| Agent 指令编辑器 | 大 Prompt 编辑、预览、保存草稿、区分"用户补充"和"最终 Prompt" |
| 五层概念模型 | 原始想法 → 结构化说明 → Capability → Task SOP → Agent Prompt |
| 优先级规则 | 系统安全 > 项目规则 > Task 范围 > Capability 边界 > 用户补充 > 模板 |

### 非范围

| 不做 | 原因 |
|---|---|
| 创建 Registry 元数据文件 | 设计阶段不写文件 |
| 移动 Skill/SOP 文件 | 不破坏现有目录 |
| 实现 Prompt Builder 代码 | 设计阶段 |
| 实现大指令编辑器 | 设计阶段 |
| 调用 Agent | 阶段 D |
| 修改外部项目 | 安全边界 |

---

## 二、当前工具库能力盘点

### 2.1 `tools/` — 可执行脚本（4 个）

| 路径 | 类型 | 功能 | 可修改项目 |
|---|---|---|---|
| `tools/init-project-memory/init-project-memory.ps1` | Script | 为目标项目初始化 .ai/ 项目记忆 | 是（仅 .ai/） |
| `tools/sync-codex-home/sync-codex-home.ps1` | Script | 同步 AGENTS.md 到 Codex 家目录 | 否（仅用户本机 .codex/） |
| `tools/ai-coding-console/cli/console.ps1` | Script | 控制台 CLI 入口（project/task/board 命令） | 部分（task approve 后 build 可修改） |
| `tools/ai-coding-console/gui/server.js` | Script | GUI HTTP 服务 | 否 |

### 2.2 `knowledge/flows/` — 流程/SOP（2 个）

| 路径 | 类型 | 内容 |
|---|---|---|
| `market-localchange-task-guide.md` | SOP | 市场 Localchange 任务处理指南（398 行，14 章） |
| `git-branch-create-ai-prompt-3.md` | Prompt Template | Git 建分支 AI 提示词（53 行） |

### 2.3 `knowledge/traces/` — 设计文档中可提取的能力（3 个）

| 路径 | 可提取类型 | 说明 |
|---|---|---|
| `generate-complete-project-background.md` | Prompt Template | 项目背景生成提示词（167 行） |
| `multi-session-collaboration-implementation-v2.md` | Skill（未实现） | 多 Session 协同工具设计（432 行） |
| `mvp1-step-ui.md` | Prompt Template | MVP1 页面 UI 补全提示词（19 行） |

### 2.4 应定义为 Skill 但尚无独立文件的能力（5 个）

| Skill | 来源 | 说明 |
|---|---|---|
| Project Takeover | `console.ps1 project status/prompt` | 读取项目状态、生成上下文 Prompt |
| Code Audit | console.ps1 Task flow + AGENTS.md rules | plan 模式只读分析 |
| Architecture Analysis | `generate-complete-project-background.md` 提示词 | 多层架构梳理 |
| Migration Analysis | 历史 JSP→React 迁移经验（已清理代码，知识残留） | 旧系统到新系统迁移对比 |
| Review & Closeout | console.ps1 task review/close | 验收收口流程 |

### 2.5 不应纳入 Registry 的 traces 文件（22 个）

| 类别 | 数量 | 示例 | 原因 |
|---|---|---|---|
| 审计报告 | 1 | `个人AI工具库顶层架构对齐审计报告.md` | 历史记录 |
| 迁移计划 | 1 | `personal-ai-toolkit-top-level-architecture-migration-plan.md` | 已完成的计划 |
| 阶段计划 | 6 | `*stage-a-plan.md` ~ `*stage-d-plan.md` | 过程文档 |
| 实施结果 | 6 | `*stage-a-result.md` ~ `*stage-c5-gui-result.md` | 历史记录 |
| 收口/预检 | 4 | `*closeout-*.md`, `*precheck.md` | 历史记录 |
| 能力地图 | 1 | `personal-ai-toolkit-current-capability-map.md` | 元文档（可引用，非能力本身） |
| 核心模型设计 | 2 | `*core-model-design.md`, `*core-model-closeout-plan.md` | 设计文档 |
| 技术路线 | 1 | `*technical-route-and-mvp-plan.md` | 设计文档 |

---

## 三、所有可注册能力的分类结果

| 分类 | 已识别数量 | 来源 |
|---|---|---|
| **Skill** | 5 个 | 工具逻辑 + 历史知识 + 设计文档 |
| **SOP** | 2 个 | `knowledge/flows/` |
| **Script** | 4 个 | `tools/` 下 |
| **Prompt Template** | 4 个 | `knowledge/flows/` + `knowledge/traces/` |
| **Capability Pack** | 0 个（待后续组合） | — |
| **历史记录（不注册）** | 22 个 | `knowledge/traces/` 中 |

---

## 四、不应直接纳入 Registry 的内容

| 内容 | 原因 |
|---|---|
| 迁移/审计/结果/收口文件 | 历史记录，非可复用能力 |
| 阶段计划文件 | 过程文档，已完成 |
| `AGENTS.md` 全文 | 是规则源，不是独立 Capability。Registry 可引用其摘要但不注册全文 |
| `README.md` | 仓库说明 |
| `config/global.json` | 全局配置，不是能力 |
| `data/projects-manifest.json` | 项目数据，不是能力 |

---

## 五、全局 Capability Registry 设计

### 落地位置（未来实施时）

```text
data/ai-coding-console/capability-registry.json
```

### 不创建新顶层目录，不移动现有 Skill/SOP 文件

Registry 是**索引文件**，指向现有文件路径。现有 Skill/SOP/Script 原地不动。

### Registry 结构

```json
{
  "$schema": "capability-registry-v1",
  "lastUpdated": "...",
  "entries": {
    "skill-project-takeover": {
      "id": "skill-project-takeover",
      "name": "Project Takeover",
      "type": "skill",
      "description": "Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.",
      "sourcePath": "built-in: console.ps1 project status + project prompt",
      "entryFile": null,
      "usage": "Select a registered project, click 'Takeover' to generate understanding prompt.",
      "applicableProjectTypes": ["any"],
      "riskLevel": "low",
      "canModifyProject": false,
      "canRunScript": true,
      "requiresApproval": false,
      "inputRequirements": ["registered project"],
      "expectedArtifacts": ["prompt.md"],
      "relatedSkills": ["skill-code-audit"],
      "relatedSops": [],
      "relatedScripts": ["script-console-ps1"],
      "relatedPromptTemplates": ["prompt-project-background"],
      "status": "active"
    }
  }
}
```

### 元信息字段定义

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 唯一标识，kebab-case |
| `name` | string | 展示名称 |
| `type` | string | `skill` / `sop` / `script` / `prompt-template` / `capability-pack` |
| `description` | string | 一句话说明 |
| `sourcePath` | string | 来源路径或 "built-in: <说明>" |
| `entryFile` | string\|null | Script 的入口文件（仅 type=script） |
| `usage` | string | 如何使用 |
| `applicableProjectTypes` | string[] | 适用项目类型 |
| `riskLevel` | string | `low` / `medium` / `high` |
| `canModifyProject` | boolean | 是否会修改项目文件 |
| `canRunScript` | boolean | 是否会执行脚本 |
| `requiresApproval` | boolean | 是否需要人工审批 |
| `inputRequirements` | string[] | 需要的输入 |
| `expectedArtifacts` | string[] | 期望的输出 |
| `relatedSkills` | string[] | 关联 Skill ID |
| `relatedSops` | string[] | 关联 SOP ID |
| `relatedScripts` | string[] | 关联 Script ID |
| `relatedPromptTemplates` | string[] | 关联 Prompt Template ID |
| `status` | string | `active` / `draft` / `deprecated` / `unavailable` |

---

## 六、Skill、SOP、Script、Prompt Template、Capability Pack 的关系

```
Capability Pack（组合）
  ├── Skill（能做什么）          ← 抽象能力描述
  ├── SOP（按什么步骤做）        ← 可跨项目复用的步骤模板
  ├── Script（可执行工具）       ← 具体可执行代码
  └── Prompt Template（提示词）  ← 发给 Agent 的 Prompt 模板
```

| 组合 | 关系 |
|---|---|
| Skill : SOP | 1 个 Skill 可关联 0..N 个 SOP |
| SOP : Script | 1 个 SOP 步骤可能调用 0..N 个 Script |
| Skill : Prompt Template | 1 个 Skill 可关联 0..N 个 Prompt Template |
| Capability Pack | 将上述四者打包为一个可分发的能力单元 |

---

## 七、Registry 的真实来源与目录归属

| 来源目录 | 注册为 | 扫描方式 |
|---|---|---|
| `tools/` 下 `*.ps1`、`*.js` | Script | 读取路径 + 文件头部注释解析（`# Purpose: ...`） |
| `knowledge/flows/` 下 `*.md` | SOP / Prompt Template | 读取文件头部 title + description |
| `knowledge/traces/` 中设计文档 | Prompt Template（仅部分） | 人工标记（`# @registry: prompt-template`） |
| `built-in:` 前缀 | Skill / SOP | 硬编码在 Registry JSON 中，指向 console.ps1 的子功能 |

### 不自动扫描 `knowledge/traces/`

`traces/` 中大量文件是历史记录。只有显式标记了 `@registry:` 的文件才会被纳入。

---

## 八、五层概念模型

```
Layer 1: 原始想法
  = 用户一句话输入
  例: "帮我整理这个项目结构"

Layer 2: 结构化任务说明
  = 目标、范围、限制、交付物、验收条件
  由 Prompt Builder 从 Layer 1 自动生成

Layer 3: 全局 Skill / SOP / Script / Prompt Template
  = 个人AI工具库中可跨项目复用的能力
  用户从 Registry 中选择或系统推荐

Layer 4: Task 专属 SOP
  = Layer 2 + Layer 3 在当前项目和当前 Task 上实例化后的具体步骤
  每步有: stepId, title, type, status, requiresApproval, expectedArtifacts

Layer 5: Agent Prompt
  = Layer 4 当前步骤 + 项目规则 + 用户补充 + 安全边界 → 发给 Agent 的最终内容
```

| 不得混淆 | 区别 |
|---|---|
| 全局 Skill/SOP ≠ 项目 AGENTS.md | 前者跨项目复用，后者是项目专属规则 |
| 项目 AGENTS.md ≠ Task SOP | 前者是持久规则，后者是临时工作步骤 |
| Task SOP ≠ 单次 Agent Prompt | 前者是整个 Task 的所有步骤，后者是当前步骤发送给 Agent 的内容 |
| Script ≠ Agent Prompt | Script 是可执行工具代码，Agent Prompt 是发给 AI 的指令 |
| 历史报告 ≠ 全局能力 | 历史报告是过去的产物，不能当成可复用能力 |

---

## 九、Prompt Builder 设计

### 输入 → 输出流水线

```
用户输入: "帮我整理这个项目结构"
  │
  ▼
Prompt Builder Step 1: 生成结构化任务说明
  ├── 从 project status 读取项目上下文
  ├── 从 .ai/ 读取项目记忆
  ├── 组装: 目标 + 范围 + 限制 + 交付物
  └── 输出: 结构化说明（用户可编辑）
  │
  ▼
Prompt Builder Step 2: 推荐 Capability
  ├── 扫描 Registry 中匹配的 Skill/SOP
  ├── 根据项目类型过滤
  ├── 根据风险级别排序
  └── 显示推荐列表（用户可选择/取消）
  │
  ▼
Prompt Builder Step 3: 生成 Task SOP
  ├── 将选中的 Skill + SOP 实例化到当前 Task
  ├── 每步生成: 标题、描述、输入引用、期望产物
  └── 用户可调整步骤顺序、增删步骤
  │
  ▼
Prompt Builder Step 4: 生成当前步骤 Agent Prompt
  ├── 聚合: 项目规则 + 结构化说明 + Capability + 当前步骤 + 用户补充
  ├── 生成 draftAgentPrompt
  └── 用户在大指令编辑器中预览 → 编辑 → 确认 → finalAgentPrompt
```

### 每一层的用户可编辑性

| 层 | 用户可编辑 |
|---|---|
| 结构化任务说明 | ✅ 可改目标/范围/限制/交付物 |
| Capability 选择 | ✅ 可选择不同 Skill/SOP/Prompt Template |
| Task SOP 步骤 | ✅ 可增删改步骤顺序 |
| Agent Prompt | ✅ 大指令编辑器全文编辑 |

---

## 十、Task 专属 SOP 实例化规则

### 从全局 SOP 生成 Task SOP

```
全局 SOP (market-localchange-task-guide.md)
  ├── 1. 接收 Task → 读取项目背景
  ├── 2. 差异判断 → 分析当前市场与 core 的区别
  ├── 3. 代码覆盖关系 → 查找 localchange / config
  ├── 4. 开发判断 → 决定改哪里
  └── 5. 验证与交付 → 检查并补充 Jira

↓ 实例化到 Task "US-market-login-fix" ↓

Task 专属 SOP:
  ├── Step 1: 读取美国市场 login journey 结构
  ├── Step 2: 对比 core/journey/login 与美国/journey/login 差异
  ├── Step 3: 检查美国/localchange.js 中 login 相关配置
  ├── Step 4: 输出差异报告与修复建议
  └── Step 5: 等待人工审批 [REQUIRES APPROVAL]
```

### SOP 步骤模型

```json
{
  "stepId": "step-001",
  "title": "读取美国市场 login journey 结构",
  "description": "...",
  "type": "analysis",
  "status": "pending",
  "requiresApproval": false,
  "canModifyProject": false,
  "inputReferences": [
    "project .ai/business-context.md",
    "capability: skill-market-localchange"
  ],
  "expectedArtifacts": ["structure-report.md"],
  "agentPromptDraft": "...",
  "finalAgentPrompt": null,
  "startedAt": null,
  "completedAt": null
}
```

### SOP 步骤状态机

```
pending → ready → running → completed
                 ↘ failed
                 ↘ skipped
```

| 状态 | 含义 |
|---|---|
| `pending` | 尚未开始 |
| `ready` | Prompt 已生成，等待执行 |
| `running` | Agent 正在执行 |
| `completed` | Agent 执行完成 |
| `failed` | 执行失败 |
| `skipped` | 用户手动跳过 |

### 人工确认点

每个 SOP 步骤可以标记 `requiresApproval: true`。该步骤完成后，Task 进入 `awaiting_approval` 状态，用户确认后才能继续下一步。

---

## 十一、Agent Prompt 组合顺序（优先级从高到低）

```
1. 系统安全边界 / 阶段限制
   "Run in plan mode. Do NOT modify any files."
   "This is Phase C.6 design only. Do not execute."

2. 当前项目 AGENTS.md 规则
   [AGENTS.md 全文]

3. 当前 Task 结构化说明
   "Goal: ... Scope: ... Constraints: ... Deliverables: ..."

4. 选中 Capability 的能力边界
   "Using Skill: project-takeover (read-only, low risk)"
   "Using SOP: market-localchange-task-guide"

5. 用户补充要求
   "Additional: focus on login journey only"

6. Prompt Template 模板变量填充
   "Output format: markdown with sections..."
```

任何低优先级内容不得突破高优先级边界。例如：用户补充说"直接改代码"但 Task 限制为计划模式 → 最终 Prompt 必须保留 plan mode 限制。

---

## 十二、大指令编辑器交互设计

### 状态

| 状态 | 行为 |
|---|---|
| 折叠 | 右栏底部小条 "Prompt Editor [展开]" |
| 展开 | 占右栏主区域，左侧工作区最小化 |
| 全屏 | 浏览器全屏模式（可选） |

### 编辑器区域

```
┌─ Prompt Editor ──────────────────────────┐
│ [Save Draft] [Preview Final] [Close]     │
├──────────────────────────────────────────┤
│ ┌─ Sources (collapsible) ──────────────┐ │
│ │ ✓ project AGENTS.md                  │ │
│ │ ✓ task structured description        │ │
│ │ ✓ skill: project-takeover            │ │
│ │ ✓ sop: market-localchange-task-guide │ │
│ │ ✓ step-001 requirements              │ │
│ │ [ ] user supplement (empty)          │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ User Supplement ────────────────────┐ │
│ │ [focus on login journey only       ] │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ Final Prompt Preview ───────────────┐ │
│ │ Run in plan mode. Do NOT modify...   │ │
│ │ ## Project Context                   │ │
│ │ ... (auto-generated from sources)    │ │
│ │ ## User Requirements                 │ │
│ │ focus on login journey only          │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [Save Draft]  [Send to Agent] (Phase D)  │
└──────────────────────────────────────────┘
```

### 必须明确区分

| 概念 | 位置 |
|---|---|
| 用户补充要求 | "User Supplement" 输入框（小，可折叠） |
| 最终 Agent Prompt | "Final Prompt Preview" 区域（大，只读预览，由 sources 自动拼接） |
| Sources 勾选 | 用户可取消勾选不需要的 source（如不引用某个 Skill） |

---

## 十三、三栏工作台中的 Capability / Prompt / SOP 交互

在阶段 C.5 设计的三栏工作台基础上，右栏新增 Tab 或区域：

```
右栏 Task 工作区:
  ┌─ Tabs ──────────────────────────────┐
  │ [Overview] [SOP] [Prompt] [Output]  │
  ├──────────────────────────────────────┤
  │                                      │
  │  (当前 Tab 内容)                      │
  │                                      │
  └──────────────────────────────────────┘
```

| Tab | 内容 |
|---|---|
| Overview | Task 基本信息、状态、审批入口（当前已有） |
| SOP | Task 专属 SOP 步骤列表，每步可展开查看详情 |
| Prompt | Prompt Builder 入口 + 大指令编辑器 |
| Output | Agent 执行产物（阶段 D） |

---

## 十四、CLI 与数据域变化边界

### 不变

| 项 | 说明 |
|---|---|
| `console.ps1` 现有命令 | project/task/board 命令全部保留 |
| `data/ai-coding-console/` 现有结构 | manifest、tasks/、board/、reports/ 保留 |
| server.js API | 所有现有端点保留 |

### 未来新增（实施阶段）

| 新增 | 位置 |
|---|---|
| `data/ai-coding-console/capability-registry.json` | Registry 索引文件 |
| `data/ai-coding-console/tasks/<id>/sop.json` | Task 专属 SOP 步骤 |
| `data/ai-coding-console/tasks/<id>/prompt-draft.md` | 草稿 Prompt |
| `data/ai-coding-console/tasks/<id>/final-prompt.md` | 最终 Prompt |

---

## 十五、与阶段 D OpenCode Adapter、未来 Codex / Claude Adapter 的衔接

### 当前步骤生成 finalAgentPrompt 后

```
Task SOP Step N
  → finalAgentPrompt (已生成)
  → 用户点击 [Execute This Step]
  → AdapterRegistry.get(agentType).dispatchPlanRun({
       workDir: projectPath,
       promptContent: finalAgentPrompt,
       taskId: taskId,
       stepId: stepId
     })
  → Adapter 写入 run.json, sessionRef, agentMetadata
  → Run 产物回写到 SOP 步骤 (step.completedAt, step.artifactRefs)
```

### 多 Agent 不绑定

| 不绑定 | 说明 |
|---|---|
| Capability 不绑定 OpenCode | 同一个 Skill 可用于 OpenCode/Codex/Claude |
| Task SOP 不绑定 OpenCode | 步骤的 agentType 是灵活字段 |
| Prompt Builder 不绑定 OpenCode | finalAgentPrompt 是通用 prompt 文本 |

Agent 只是执行器。更换 Agent 只需改 `agentType` 字段。

---

## 十六、实施拆分建议

| 阶段 | 内容 |
|---|---|
| 1 | Registry JSON schema + 初始 Seed 数据（手工编写 10-15 条 entry） |
| 2 | Registry 浏览/搜索 API + GUI 面板 |
| 3 | Prompt Builder 核心流水线（模糊想法 → 结构化说明 → 推荐 Capability） |
| 4 | Task SOP 实例化引擎 + SOP 步骤面板 |
| 5 | 大指令编辑器（Sources 勾选 + Supplement + Preview） |
| 6 | SOP 步骤状态机 + agentType 字段 |

---

## 十七、验证方案

```text
1. Registry JSON schema 可被 JSON Schema validator 通过
2. 手工编写 10 条 seed entry，每条的 fields 完整
3. Prompt Builder 输入 "分析项目结构" → 输出结构化说明草稿
4. 选择 skill-project-takeover → Task SOP 生成 3-5 步骤
5. 大编辑器: Sources 可勾选/取消 → Preview 内容正确拼接
6. SOP 步骤状态: pending → ready → completed
7. 所有现有 API/CLI 未受影响
```

---

## 十八、风险、待确认项与不确定事实

### 风险

| 风险 | 级别 | 说明 |
|---|---|---|
| Registry 首次 seed 数据需大量手工编写 | 🟡 中 | 10-15 条 entry，每条 15 字段 |
| Prompt Builder 的"自动生成结构化说明"依赖 AI | 🟡 中 | 阶段 C.6 无 Agent，需用规则模板代替 AI 生成 |
| Task SOP 实例化逻辑复杂 | 🟡 中 | 全局 SOP 是通用叙述，变成具体步骤需要规则引擎 |

### 待确认

| # | 事项 |
|---|---|
| 1 | Prompt Builder 第一版是否调用 console.ps1 现有的 `project prompt` 作为结构化说明生成基础？建议是 |
| 2 | Registry 的 seed 数据是否包含所有 10+ 条 entry，还是先做 5 条 MVP？建议 MVP 5 条 |
| 3 | 大指令编辑器是否需要"版本历史/回退"功能？建议第一版不做 |
| 4 | SOP 步骤的 `agentPromptDraft` 和 `finalAgentPrompt` 是否都保存？建议都保存，final 是冻结版本 |

### 不确定事实

| 事实 | 状态 |
|---|---|
| OpenCode 是否支持接收 `finalAgentPrompt` 作为 `--command` 参数 | 协议探测中 `--command` 已确认可用 |
| Codex / Claude CLI 的 Prompt 传入方式 | 未确认 |

---

> **设计文件路径**: `knowledge/traces/ai-coding-desktop-console-c6-prompt-sop-workflow-plan.md`
> **当前识别到的所有可注册能力**:
> - Skill: 5 个（Project Takeover, Code Audit, Architecture Analysis, Migration Analysis, Review & Closeout）
> - SOP: 2 个（market-localchange-task-guide, task-lifecycle）
> - Script: 4 个（init-project-memory, sync-codex-home, console.ps1, server.js）
> - Prompt Template: 4 个（git-branch-create, project-background, multi-session-collab, mvp1-step-ui）
> **不应纳入 Registry**: 22 个历史审计/迁移/结果文件
