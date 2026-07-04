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
