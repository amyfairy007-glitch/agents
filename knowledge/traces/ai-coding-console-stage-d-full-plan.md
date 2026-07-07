# AI Coding Console Stage D 完整实施计划

> 生成日期：2026-07-07
> 前置：Stage D-1（OpenCode Plan Run 只读）已实现，待真实终端验证
> 范围：完整 Stage D —— Build 执行 + 审批门禁 + Review/Close 闭环 + Adapter 抽象层

---

## 一、任务目标

在已有 D-1 Plan Run（只读）基础上，补齐 Stage D 剩余能力，使一个 Task 能够完成从
`plan → 人工审批 → build（允许 Agent 真实写文件）→ 人工验收 → close` 的完整生命周期。

同时引入 Agent Adapter 抽象层，消除对 `opencode.cmd` 的硬编码，为未来接入 Codex / Claude Code 预留位。

## 二、依据与范围

### 依据

- `knowledge/traces/ai-coding-desktop-console-mvp-stage-d-opencode-adapter-plan.md`（Stage D 原始设计，方案 A + 三层只读防线 + Git 基线检测 + Adapter 6 方法契约）
- `knowledge/traces/ai-coding-console-d1-opencode-plan-run-result.md`（D-1 落地与崩溃修复记录）
- `AGENTS.md`（analyze first, then change files；正式产物要求）
- 现有代码：`opencode-plan-runner.js`、`run-store.js`、`server.js`、`cli/console.ps1`、`gui/app.js`

### 用户确认的方向决策（2026-07-07）

1. 范围：完整 Stage D（Build + 审批 + Review/Close + Adapter）
2. Build 安全策略：采用计划文档方案（三层防线 + 门禁 + Git 基线，不自动回滚、不自动提交）
3. 验证方式：本次实现 + Codex sandbox 自测；真实 OpenCode 端到端由用户在真实终端手动验证

### 本次范围内

- Agent Runner 共享核心抽取
- Agent Adapter 抽象层（OpenCode 实现 + Codex/Claude 预留）
- Build Run（`mode:"build"`，允许写文件）
- Build 门禁（`task.status === "plan_approved"` 才可 dispatch）
- run-store 支持 build run 记录
- server.js 新增 `POST /runs/build` 路由
- GUI：Build 按钮 + 审批闭环（plan approve/reject、final review/reject、close）
- 自测（不含真实 OpenCode 执行）

### 本次不做（明确排除）

- 多 Session 并行（V1 单 Task 单 Run）
- 自动 Git 提交
- 自动回滚（`git checkout` / `git reset`）
- Codex / Claude Code 真实接入（仅预留 Adapter，`checkAvailability` 恒 false）
- `opencode.cmd serve` 守护进程管理

## 三、安全边界与门禁设计

Build 允许 Agent 真实修改项目文件，这是核心安全边界。采用计划文档定义的分层策略：

| 层 | 机制 | 说明 |
|---|---|---|
| L1 Prompt 授权 | build prompt 明确授权写文件，但要求严格遵守 SOP、final-prompt 与 Capability 边界 | 与 plan prompt 的"禁止写文件"相对 |
| L2 状态门禁 | `POST /runs/build` 硬校验 `task.status === "plan_approved"` | 未审批返回 409，拒绝创建 Run |
| L3 Git 基线 | 跑前记录 baseline，跑后收集 `changedFiles` 作为预期 diff | build 有变更属正常，写入 `build-diff.txt`，不再判 unsafe_modified |

补充约束：

- 不自动回滚，不自动提交；任何异常变更由人工处理
- build 跑前仍要求 worktree clean（与 plan 一致，保证 diff 可归因）
- Run 完成后 `approvalStatus: "pending_review"`，进入 final review 门禁

## 四、Run 状态机（对齐现有实现）

```
plan run:  running → completed / failed / timed_out / unsafe_modified
build run: running → completed / failed / timed_out
task:      created → (plan run) → plan_approved（人工）→ (build run)
                   → completed（final review 人工）→ closed
```

- plan run 保持原有语义（写文件 = unsafe_modified）
- build run 允许写文件，`changedFiles` 记录预期变更，不判 unsafe
- CLI `task review` 门禁要求 run 目录存在 `build.log` 或 `verify-result.md`，build run 将产出 `build.log`，从而打通闭环

## 五、实施拆分

| 步骤 | 内容 | 主要文件 |
|---|---|---|
| 1 | 本计划文档 | `knowledge/traces/ai-coding-console-stage-d-full-plan.md` |
| 2 | 抽取运行共享核心 | `lib/agent-runner-core.js`（新），改造 `lib/opencode-plan-runner.js` 引入 core |
| 3 | Agent Adapter 抽象层 | `lib/agent-adapters.js`（新） |
| 4 | Build Runner | `lib/opencode-build-runner.js`（新） |
| 5 | run-store 支持 build | `lib/run-store.js` |
| 6 | server.js build 路由 | `gui/server.js` |
| 7 | GUI build + 审批闭环 | `gui/app.js`、`gui/index.html` |
| 8 | 自测 + 结果文档 | 结果文档 + `.ai/` 记忆更新 |

### 关键设计：抽取核心而非重写

`opencode-plan-runner.js` 的 D-1 链路刚修复过崩溃 bug，稳定可用。本次将其中与 plan/build 无关的通用函数（`runCommand`、`runGit`、`buildGitSnapshot`、`parseGitChangedFiles`、`resolveOpenCodeCommand`、`buildOpenCodeInvocation`、`parsePlanFromRawOutput`）抽到 `agent-runner-core.js`，plan-runner 改为引入。这样：

- plan 链路对外导出（`prepareOpenCodePlanStart` / `runOpenCodePlan`）保持不变，server.js 无需改动 plan 部分
- build-runner 复用同一套经过验证的进程/Git/输出处理逻辑，避免重复实现与新 bug

## 六、Adapter 契约（对齐原设计 6 方法）

```
OpenCodeAdapter:
  checkAvailability()        → resolveOpenCodeCommand().ok
  buildInvocation(ctx)       → { command, args, commandLine }
  parseOutput(rawOutput)     → { text, sessionRef }
  getSessionRef(event)       → string | null
CodexAdapter / ClaudeCodeAdapter:
  checkAvailability()        → false
  其余方法 → 抛 "Agent adapter not installed: <name>"
getAdapter(agentType)        → 默认 "opencode"
```

server.js / runner 通过 `agentType` 选 adapter，不再散落 opencode 分支。

## 七、产物目录（build run）

```
data/ai-coding-console/tasks/<task-id>/runs/<RUN-...-build>/
├── run.json          ← mode:"build", changedFiles, approvalStatus
├── prompt.md         ← build prompt
├── agent-raw.jsonl   ← Agent stdout 原始流
├── build.log         ← build 输出（供 CLI review 门禁识别）
├── build-diff.txt    ← 跑后 git 变更清单
└── baseline.json     ← pre/post Git 快照
```

## 八、完成标准

| # | 条件 |
|---|---|
| 1 | `POST /runs/build` 在 `plan_approved` 前返回 409 门禁拒绝 |
| 2 | `plan_approved` 后 build run 可创建、202 返回、异步执行 |
| 3 | build run 产出 build.log + build-diff.txt，changedFiles 记录预期变更 |
| 4 | Adapter 抽象层可用，opencode 硬编码收敛到 adapter |
| 5 | GUI 可完成 plan approve/reject、build、final review/reject、close |
| 6 | 所有改动文件 `node --check` 通过 |
| 7 | plan 链路无回归（导出不变） |

## 九、风险与未确认项

- **真实 OpenCode build 执行未在 sandbox 验证**：Codex sandbox 权限不代表用户真实环境，build 真实写文件行为必须由用户在真实终端验证
- **`--session --continue` 断点续传未验证**：本次 build run 不依赖 plan session 续传，采用独立 run + final-prompt 上下文；续传作为后续优化
- **越权检测在 build 模式下被放宽**：build 本就允许写文件，L3 从"拦截"降级为"记录 diff"，异常需人工复核 build-diff.txt

## 十、验证移交（用户手动）

```
cd /d E:\program\ai-ui-agentic
npm run gui
# 浏览器打开 http://localhost:3456
# 1. 选 Task → 生成 Final Prompt → Plan Run（202 → running → completed）
# 2. Approvals → Approve plan（task → plan_approved）
# 3. Build Run（202 → running → completed，检查真实文件变更 + build-diff.txt）
# 4. Approvals → Review（task → completed）→ Close
```
