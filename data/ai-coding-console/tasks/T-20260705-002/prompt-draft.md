# Prompt 草稿

## 任务目标

当前 Task 为 **AI Coding Console C.6 工作流接入**。
描述：AI Coding Console C.6 工作流接入

本阶段目标：完成 Task 专属 SOP 生成与最终 Prompt 构建，不进入 Agent 执行。

## 项目上下文

- 项目 ID：ai-ui-agentic
- 项目路径：E:\program\ai-ui-agentic
- 当前期：C.6-C（SOP + Prompt 生成阶段）
- 前置阶段：C.6-A Capability Registry（✅）、C.6-B-1 绑定 API（✅）、C.6-B-2 绑定 UI（✅）
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
- 所有生成基于本地模板与规则拼装
- 禁止修改 Task 数据文件以外的项目文件
- 已绑定能力的 canModifyProject 属性决定是否可以在后续修改项目文件
- 生成内容优先级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补充

## 建议执行步骤

1. 读取项目上下文与约束（AGENTS.md、.ai/ 记忆文件）
2. 审查已绑定 Capability 边界与说明
3. 基于规则生成 Task 专属 SOP 时间线
4. 编辑 Prompt 草稿并补充用户要求
5. 生成最终 Agent Prompt
6. 生成结果报告并更新项目记忆

## 用户补充说明
Please keep this read-only and do not execute Agent.
