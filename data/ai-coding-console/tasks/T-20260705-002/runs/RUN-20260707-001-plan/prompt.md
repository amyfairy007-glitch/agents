你正在执行 Plan-only Run。
你只能读取、分析和输出计划。
禁止创建、修改、删除、移动或重命名任何文件。
禁止安装依赖、执行写入型命令、提交 Git、修改配置。
不要开始实施，不要输出伪造的实施结果。

# 实施计划
## 目标理解
- Task: T-20260705-002
- Title: AI Coding Console C.6 ?????
- Project: ai-ui-agentic

## 当前状态与约束
- Project root: E:\program\ai-ui-agentic
- Stage: D-1 Plan Run
- Read only enforcement: prompt_and_post_run_git_check

### Project Rules
# Codex Global Rules

This repository is the shared, syncable Codex configuration source for all projects.

## Working Rules

- For complex tasks, analyze first, then change files.
- Prefer small, reviewable edits over broad rewrites.
- Do not store secrets, tokens, account caches, or login state here.
- Keep this repository portable and Git-friendly.

## Task SOP

- Before starting work in a project, check whether `.ai/current-state.md` and `.ai/decisions.md` exist.
- Before starting work in a project, check whether `.ai/business-context.md` exists.
- If those files exist, read them before proposing or making changes.
- If `.ai/` does not exist yet, initialize project memory first, then continue the task.
- On first contact with a project, perform a codebase analysis and generate `PROJECT_MAP.md` at the project root before substantial task execution.
- If `PROJECT_MAP.md` exists but is clearly stale after major structural changes, refresh it and preserve the previous version as an archive.
- For non-trivial tasks, write or state a short analysis or plan before editing files.
- Keep changes scoped to the task and aligned with the current recorded project state.
- Treat `.ai/business-context.md` as the durable reasoning layer for goals, constraints, tradeoffs, terminology, and stable project-specific knowledge.
- Keep reusable project-specific knowledge in project memory, and consult relevant project knowledge files when the current task touches a similar module, flow, board, or interaction.

## Project Memory Discipline

After completing a task in any project, update that project's memory files:

- `.ai/business-context.md`
- `.ai/current-state.md`
- `.ai/decisions.md`
- `.ai/handoffs/`

At task completion:

- update `.ai/business-context.md` when the task revealed or changed durable context such as business rules, user goals, important terminology, product intent, stable conventions, or non-obvious constraints
- update `.ai/current-state.md` with what changed and the next recommended step
- append meaningful decisions and rationale to `.ai/decisions.md`
- always create or update a handoff note under `.ai/handoffs/`, even for small tasks
- when a task reveals reusable project-specific knowledge, capture it in the appropriate project memory file instead of forcing it into the global rule layer

Use the templates in `tools/init-project-memory/templates/` as the starting point. The `init-project-memory` tool copies these templates when initializing a project's `.ai/` directory.

## 文档化与正式产物要求

- 凡是审计、项目接管、架构分析、实施计划、迁移计划、实施结果、验证结果、测试结果、Code Review、风险评估、收口结论、项目状态确认等可复用项目事实，必须生成并写入仓库中的正式文件，不得只保留在聊天上下文中。
- 聊天回复只能作为摘要和进度说明；关键结论的唯一正式依据必须是仓库中的产物文件。
- 在开始执行前，必须明确本次任务的正式产物路径；如果用户未指定路径，必须先根据当前仓库目录职责提出建议路径并等待确认。
- 文档归属必须遵守当前顶层架构：`knowledge/flows/` 放流程、SOP、操作方法、长期规则；`knowledge/traces/` 放项目、功能、代码、仓库、架构、审计与追踪分析资料；`data/` 放项目状态、任务状态、执行记录、验证记录、报告索引、失败/重试/交接等持续数据；`tools/` 放工具代码、工具模板、工具专属配置，不得存放真实项目执行结果；`config/` 放多工具共用的全局配置。
- 每次正式产物至少应包含：任务目标、依据和范围、结论或实施结果、风险/未确认项与后续建议、文件生成日期或版本信息。
- 如果当前任务仍处于只读审计或计划阶段，也必须生成对应审计报告或计划文件；不得因为尚未实施就省略正式产物。
- 生成、更新或移动正式产物后，聊天中必须只简要说明：已生成或更新的文件路径、核心结论、下一步或待确认项。
- 不得为了生成报告而创建无意义空目录、占位文件或重复文档；同一事实应优先更新已有正式文件，避免多份来源不一致。

## Scope

- V1 only.
- No agents.
- No skills.
- No worktree automation.
- No multi-session tooling.


# Current State

## What We Are Working On

- C.6-B-2 Task Capability 浏览、选择与绑定 UI 已落地到 AI Coding Console Web.
- The workbench now exposes real capability browsing, filtering, multi-select binding, and refresh-backed task-scoped persistence.
- A formal working Task was created for the C.6 workflow: `T-20260705-002`.

## Last Updated

- 2026-07-05

## Next Step

- Continue with C.6-C only when Prompt Builder and SOP generation are intentionally started.
- Keep the capability binding UI as the current completion point for C.6-B-2.

## C.6-C Status Update

- Task `T-20260705-002` now has formal Task-scoped generation artifacts: `sop.json`, `prompt-draft.md`, and `final-prompt.md`.
- The C.6-C generation path uses local templates plus rule-based composition only; it does not call an AI model or execute an Agent.
- The prompt draft stores user additions in the fixed `## 用户补充说明` block, and the final prompt composes the saved SOP, draft, and supplement into the persisted `final-prompt.md`.
- The next forward step is Stage D only, after the team chooses to wire a real Agent executor.


# Decisions

## Decision Log

- Date: 2026-07-05
  - Decision: Standardize the next Web UI as a three-column task workbench with persistent project context on the left and the current Task as the right-side primary working object.
  - Why: The current page structure makes project, task, board, and status feel fragmented; the new layout keeps the workflow visible and reduces navigation churn.
  - Impact: Future UI work should center on left project selection, middle task selection, and right task workspace tabs instead of page-based project/task/board views.

- Date: 2026-07-05
  - Decision: Keep Git, AGENTS.md, `.ai`, capability browsing, SOP reference, prompt sources, and artifact filters in drawers or collapsible regions rather than the default homepage surface.
  - Why: These elements are useful context but should not crowd out the working surface or turn the console into a management dashboard.
  - Impact: The implementation should preserve a lightweight main canvas and push secondary information into drawers and folded panels.

- Date: 2026-07-05
  - Decision: Bind capabilities at the Task level through an inline browser in the Prompt 与 SOP tab, using the registry as a read-only source and task-scoped `capabilities.json` as the only write target.
  - Why: This keeps selection, filtering, and persistence close to the Task that will consume the abilities, while avoiding any write-back into the global registry.
  - Impact: Future C.6-C work can consume task capability bindings directly without redefining the selection surface or changing registry semantics.

- Date: 2026-07-05
  - Decision: Generate Task SOP and final Prompt from local templates plus rule-based composition, and keep user additions inside a fixed `## 用户补充说明` block in `prompt-draft.md`.
  - Why: The C.6-C stage must stay deterministic, offline, and non-executing while still producing durable artifacts that can be reviewed and resumed.
  - Impact: The backend can regenerate SOP and prompt drafts without calling a model, and the final prompt can be rebuilt from the saved SOP, draft, and supplement without inventing new runtime state.


# Business Context

## Project Mission

- Maintain the shared Codex configuration and supporting project memory for the AI UI agentic workspace.
- Evolve the AI Coding Console from a project-oriented dashboard toward a task-driven workbench that supports prompt building, SOP planning, and future agent execution.

## User Or Stakeholder Context

- The user is actively shaping the console into a daily AI workbench rather than a static admin surface.
- The near-term goal is to clarify project context, make Task the primary working object, and reserve space for future capability, prompt, and agent workflows.

## Important Business Rules Or Constraints

- Preserve the existing `tools/ai-coding-console/` runtime and the `data/ai-coding-console/` data domain.
- Keep `npm run gui` as the entry point.
- Do not create real Task / Run data during planning-only work.
- Do not hard-code a capability list in the front end; the UI must allow a future registry to plug in.
- Keep project context visible while making Task the main interaction target.
- Non-core areas such as Git, AGENTS.md, AI memory, capability browsing, SOP references, prompt sources, and artifact filters should default to collapsible or drawer-based presentation.

## Key Terminology

- Project: a context boundary.
- Task: the current work object.
- Capability / Skill / SOP: the working method.
- Agent: the executor.
- Run: a single execution.
- Artifact: the execution output.

## Recurring Tradeoffs Or Why Behind The Current Shape

- The UI must favor task flow over dashboard density to avoid becoming a control panel.
- Prompt construction should be composition-first, not a blank long-form authoring experience.
- The interface should be ready for future Run and approval volume without surfacing everything at once.
- Capability Registry and Agent Adapter are future integrations, so the current layout needs stable hooks without assuming their data is present.

## Stable Project-Specific Conventions To Remember

- Treat `.ai/current-state.md`, `.ai/decisions.md`, and `.ai/handoffs/` as mandatory project memory outputs after a task.
- Keep formal analytical or planning conclusions in repository files, not only in chat.
- Prefer small, reviewable changes and preserve the existing console architecture whenever possible.
- C.6-C prompt generation is deterministic and offline: `sop.json`, `prompt-draft.md`, and `final-prompt.md` are built from the Task record, bound capabilities, AGENTS.md, and local templates.
- The prompt draft must keep user additions inside the fixed `## 用户补充说明` block so the final prompt can regenerate from saved state without guessing at arbitrary Markdown content.
- Task `T-20260705-002` is the formal C.6 working Task for capability binding, SOP generation, prompt draft editing, and final prompt persistence.


### Task Rules
# 最终 Agent Prompt

## 角色与任务

你是一个项目执行 Agent。当前 Task 为 **AI Coding Console C.6 ?????**。
描述：AI Coding Console C.6 ?????

任务范围：基于已绑定的 Capability 和生成 SOP 执行当前步骤。
当前阶段：C.6-C | Agent 执行：禁止

## 项目上下文

- 项目 ID：ai-ui-agentic
- 项目路径：E:\program\ai-ui-agentic

## 执行边界

- Agent 执行：禁止
- 模型调用：禁止（当前阶段使用本地规则拼装）
- 项目修改：已绑定能力均不允许修改项目文件
- 脚本执行：禁止
- 生成优先级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补充

## 已绑定 Capability

- **Project Takeover** (skill)
  - 说明：Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.
  - 风险等级：low
  - 是否修改项目：否
  - 是否需要审批：否
  - 预期产物：prompt.md

## SOP 当前步骤

- S1: 读取项目上下文与约束（pending）
- S2: 审查已绑定 Capability 边界与说明（pending）
- S3: 生成 Task 专属 SOP（pending）
- S4: 生成与编辑 Prompt 草稿（pending）
- S5: 生成最终 Prompt（pending）
- S6: 生成结果报告与更新项目记忆（pending）

## 预期产物

- project-summary.md
- capability-summary.md
- sop.json
- prompt-draft.md
- final-prompt.md
- result-report.md
- updated .ai/ memory

## Prompt 草稿

# Prompt 草稿

## 任务目标

当前 Task 为 **AI Coding Console C.6 ?????**。
描述：AI Coding Console C.6 ?????

本阶段目标：完成 Task 专属 SOP 生成与最终 Prompt 构建，不进�� Agent 执行。

## 项目上下文

- 项目 ID：ai-ui-agentic
- 项目路径：E:\program\ai-ui-agentic
- 当前期：C.6-C（SOP + Prompt 生成阶段）
- 前置阶段：C.6-A Capability Registry（�）、C.6-B-1 绑定 API（�）、C.6-B-2 绑定 UI（�）
- 后续阶段：Stage D（Agent 执行）

## 已绑定能力

- **Project Takeover** (skill)
  - 说明：Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.
  - 风险等级：low
  - 是否修改项目：否
  - 是否需要审批：否
  - 预期产物：prompt.md

## 约束与边界

- 当前阶段禁止 Agent 执行与 AI 模型调用
- 所有生成基于本地模板与规则拼�
- 禁止修改 Task 数据文件以外的项目文件
- 已绑定能力的 canModifyProject 属性决定是否可以在后续修改项目文件
- 生成�容优��级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补�

## 建议执行步骤

1. 读取项目上下文与约束（AGENTS.md、.ai/ 记忆文件）
2. 审查已绑定 Capability 边界与说明
3. 基于规则生成 Task 专属 SOP 时间线
4. 编辑 Prompt 草稿并补�用户要求
5. 生成最终 Agent Prompt
6. 生成结果报告并更新项目记忆
## 用户补�说明

Please keep this read-only and do not execute Agent.

## 用户补充说明

（无）

## 验证要求

- 所有生成内容必须落盘到指定路径
- 不得覆盖已有且需要保留的文件
- 生成后检查文件内容完整性
- 确认文件路径与目录职责一致

## 禁止事项

- 不得修改 AGENTS.md、console.ps1、capability-registry.json
- 不得创建临时 Task、Run、Artifact 或 board 数据
- 不得调用外部 API 或 AI 模型（当前阶段）
- 不得修改 Task 数据文件以外的项目文件
- 不得递归扫描外部项目

## 已绑定 Capability 摘要
- id: skill-project-takeover
  name: Project Takeover
  type: skill
  description: Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.
  riskLevel: low
  canModifyProject: false
  requiresApproval: false
  expectedArtifacts: prompt.md

## SOP
{
  "taskId": "T-20260705-002",
  "generatedAt": "2026-07-05T14:07:24.936Z",
  "sourceCapabilityIds": [
    "skill-project-takeover"
  ],
  "status": "draft",
  "stage": "C.6-C",
  "allowAgentExecution": false,
  "priorityOrder": [
    "system_stage_security",
    "project_agents_rules",
    "task_scope",
    "bound_capability",
    "user_supplement"
  ],
  "steps": [
    {
      "id": "S1",
      "title": "读取项目上下文与约束",
      "purpose": "确认当前项目规则、范围和现有状态，包括 AGENTS.md、.ai/ 记忆文件和项目目录结构",
      "inputs": [
        "project root",
        "AGENTS.md",
        ".ai/current-state.md",
        ".ai/decisions.md",
        ".ai/business-context.md"
      ],
      "expectedArtifacts": [
        "project-summary.md"
      ],
      "requiresApproval": false,
      "status": "pending"
    },
    {
      "id": "S2",
      "title": "审查已绑定 Capability 边界与说明",
      "purpose": "分析当前 Task 已绑定的 Capability 的作用、风险等级、预期产物和执行边界",
      "inputs": [
        "skill-project-takeover"
      ],
      "expectedArtifacts": [
        "capability-summary.md"
      ],
      "requiresApproval": false,
      "status": "pending"
    },
    {
      "id": "S3",
      "title": "生成 Task 专属 SOP",
      "purpose": "基于项目规则、Task 目标和已绑定 Capability 生成当前 Task 专属的 SOP 时间线",
      "inputs": [
        "task.json",
        "capabilities.json",
        "AGENTS.md"
      ],
      "expectedArtifacts": [
        "sop.json"
      ],
      "requiresApproval": false,
      "status": "pending"
    },
    {
      "id": "S4",
      "title": "生成与编辑 Prompt 草稿",
      "purpose": "基于 SOP 和已绑定 Capability 生成 Prompt 草稿，允许用户编辑并补充要求",
      "inputs": [
        "sop.json",
        "capabilities.json",
        "user supplement"
      ],
      "expectedArtifacts": [
        "prompt-draft.md"
      ],
      "requiresApproval": false,
      "status": "pending"
    },
    {
      "id": "S5",
      "title": "生成最终 Prompt",
      "purpose": "基于已确认的 SOP 和 Prompt 草稿生成最终可交付的 Agent Prompt",
      "inputs": [
        "sop.json",
        "prompt-draft.md",
        "user supplement"
      ],
      "expectedArtifacts": [
        "final-prompt.md"
      ],
      "requiresApproval": true,
      "status": "pending"
    },
    {
      "id": "S6",
      "title": "生成结果报告与更新项目记忆",
      "purpose": "将本次 SOP 与 Prompt 生成结果写入正式产物文件，更新项目记忆",
      "inputs": [
        "sop.json",
        "final-prompt.md",
        "result template"
      ],
      "expectedArtifacts": [
        "result-report.md",
        "updated .ai/ memory"
      ],
      "requiresApproval": false,
      "status": "pending"
    }
  ]
}

## Final Prompt
# 最终 Agent Prompt

## 角色与任务

你是一个项目执行 Agent。当前 Task 为 **AI Coding Console C.6 ?????**。
描述：AI Coding Console C.6 ?????

任务范围：基于已绑定的 Capability 和生成 SOP 执行当前步骤。
当前阶段：C.6-C | Agent 执行：禁止

## 项目上下文

- 项目 ID：ai-ui-agentic
- 项目路径：E:\program\ai-ui-agentic

## 执行边界

- Agent 执行：禁止
- 模型调用：禁止（当前阶段使用本地规则拼装）
- 项目修改：已绑定能力均不允许修改项目文件
- 脚本执行：禁止
- 生成优先级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补充

## 已绑定 Capability

- **Project Takeover** (skill)
  - 说明：Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.
  - 风险等级：low
  - 是否修改项目：否
  - 是否需要审批：否
  - 预期产物：prompt.md

## SOP 当前步骤

- S1: 读取项目上下文与约束（pending）
- S2: 审查已绑定 Capability 边界与说明（pending）
- S3: 生成 Task 专属 SOP（pending）
- S4: 生成与编辑 Prompt 草稿（pending）
- S5: 生成最终 Prompt（pending）
- S6: 生成结果报告与更新项目记忆（pending）

## 预期产物

- project-summary.md
- capability-summary.md
- sop.json
- prompt-draft.md
- final-prompt.md
- result-report.md
- updated .ai/ memory

## Prompt 草稿

# Prompt 草稿

## 任务目标

当前 Task 为 **AI Coding Console C.6 ?????**。
描述：AI Coding Console C.6 ?????

本阶段目标：完成 Task 专属 SOP 生成与最终 Prompt 构建，不进�� Agent 执行。

## 项目上下文

- 项目 ID：ai-ui-agentic
- 项目路径：E:\program\ai-ui-agentic
- 当前期：C.6-C（SOP + Prompt 生成阶段）
- 前置阶段：C.6-A Capability Registry（�）、C.6-B-1 绑定 API（�）、C.6-B-2 绑定 UI（�）
- 后续阶段：Stage D（Agent 执行）

## 已绑定能力

- **Project Takeover** (skill)
  - 说明：Read project structure, git status, AGENTS.md, and .ai/ memory. Generate a comprehensive context prompt for AI to understand the project.
  - 风险等级：low
  - 是否修改项目：否
  - 是否需要审批：否
  - 预期产物：prompt.md

## 约束与边界

- 当前阶段禁止 Agent 执行与 AI 模型调用
- 所有生成基于本地模板与规则拼�
- 禁止修改 Task 数据文件以外的项目文件
- 已绑定能力的 canModifyProject 属性决定是否可以在后续修改项目文件
- 生成�容优��级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补�

## 建议执行步骤

1. 读取项目上下文与约束（AGENTS.md、.ai/ 记忆文件）
2. 审查已绑定 Capability 边界与说明
3. 基于规则生成 Task 专属 SOP 时间线
4. 编辑 Prompt 草稿并补�用户要求
5. 生成最终 Agent Prompt
6. 生成结果报告并更新项目记忆
## 用户补�说明

Please keep this read-only and do not execute Agent.

## 用户补充说明

（无）

## 验证要求

- 所有生成内容必须落盘到指定路径
- 不得覆盖已有且需要保留的文件
- 生成后检查文件内容完整性
- 确认文件路径与目录职责一致

## 禁止事项

- 不得修改 AGENTS.md、console.ps1、capability-registry.json
- 不得创建临时 Task、Run、Artifact 或 board 数据
- 不得调用外部 API 或 AI 模型（当前阶段）
- 不得修改 Task 数据文件以外的项目文件
- 不得递归扫描外部项目

## 拟修改文件
- 本次只能输出计划，不得修改任何文件。

## 分步实施方案
- 先核对安全边界与约束。
- 再列出拟修改文件与影响范围。
- 最后给出验证方案。

## 风险与安全边界
- 发现与 Final Prompt 冲突时，必须在计划中指出，不得自行改文件解决。
- 本次不得进入 Build、审批或 Agent 执行。

## 验证方案
- 说明建议的验证步骤，不实际执行写入。

## 不在本次范围内的内容
- Build
- Agent 执行
- 代码写入
- 审批闭环
