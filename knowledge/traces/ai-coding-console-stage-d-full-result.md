# AI Coding Console Stage D 完整实施结果

Date: 2026-07-08

## 目标

在 D-1(只读 Plan Run)基础上补齐 Stage D 剩余能力，使 Task 生命周期从
生成 Final Prompt 一直闭环到 Build 执行、人工验收与关闭：

```
生成 Final Prompt
  → Plan Run (只读, D-1)
  → Approve Plan (审批门禁, task -> plan_approved)
  → Build Run (允许写文件, D-2, 门禁校验 plan_approved)
  → Review (人工验收, task -> completed)
  → Close (生成汇总报告)
```

本次范围经用户确认为「完整 Stage D」，Build 安全策略采用计划文档方案，
真实 OpenCode 执行由用户在真实终端手动验证。

## 安全策略（Build 允许写文件）

Build Run 允许 Agent 真实修改项目文件，安全依赖三层加一道硬门禁：

- **L1 Prompt**：build prompt 明确授权写文件，但把改动绑定到 Task 目标、
  SOP 与 Final Prompt 范围，并禁止 git commit / push 与破坏性命令。
- **L2 门禁**：`POST /runs/build` 与 `loadBuildContext` 硬校验
  `task.status === "plan_approved"`，否则返回 `409 build_gate_not_open`。
- **L3 Git 基线**：跑前记录 baseline，跑后收集 `changedFiles` 作为**预期 diff**
  写入 `build-diff.txt`。对 Build 而言 worktree 变脏是正常结果，不再判
  `unsafe_modified`；成功与否由退出码驱动。
- **不自动回滚、不自动提交**：任何越权/异常改动交人工处理。

Plan Run 的既有只读保证（clean worktree 前置 + 事后 git 比对判定
`unsafe_modified`）保持不变。

## 变更文件

新增：

- `tools/ai-coding-console/lib/agent-runner-core.js`
  - 从 plan runer 抽出的共享核心：进程 spawn、超时与进程树清理、
    stdout/stderr 落盘（带 try/catch 兜底）、git 快照、JSONL 文本/session 提取。
- `tools/ai-coding-console/lib/agent-adapters.js`
  - Adapter 抽象层。`OpenCodeAdapter` 为唯一真实实现；`CodexAdapter`、
    `ClaudeCodeAdapter` 为预留占位，`checkAvailability` 恒为不可用，
    `buildInvocation` 返回 `agent_adapter_not_installed`。
- `tools/ai-coding-console/lib/opencode-build-runner.js`
  - `loadBuildContext`（含门禁）、`buildBuildPrompt`、
    `prepareOpenCodeBuildStart`、`runOpenCodeBuild`。产出
    `build.log`（可读输出）、`build-diff.txt`（变更清单）、`baseline.json`。
    完成后 `approvalStatus: "pending_review"`。

修改：

- `tools/ai-coding-console/lib/opencode-plan-runner.js`
  - 改为从 core 与 adapter 引入共享函数，删除重复实现；对外导出保持不变，
    server.js 无需改动其调用点。
- `tools/ai-coding-console/lib/run-store.js`
  - `RUN_ID_PATTERN` 支持 `-plan|-build` 后缀；新增
    `getRunBuildLogPath` / `getRunBuildDiffPath`；`summarizeRunRecord`
    补充 `mode` / `changedFiles` / `trackedChangesDetected`。
- `tools/ai-coding-console/gui/server.js`
  - 新增 `POST /api/tasks/:projectId/:taskId/runs/build`（门禁 + 202 异步 + 轮询），
    以及 `persistRunningBuildRun` / `persistBuildRunResult` / `persistBuildRunFailure`。
- `tools/ai-coding-console/gui/app.js`
  - `approveTask` / `reviewTask` 支持 reject 参数；新增 `startBuildRun`、
    `renderBuildRunLauncher`（Plan 审批后出现于 Prompt tab）；审批 tab 接入真实
    Approve / Reject / Review / Close 闭环按钮，按 task 状态启用。

## 自测（Codex sandbox 内，不含真实 OpenCode 执行）

- `node --check` 全部 7 个改动文件通过。
- 模块加载与导出验证：build runer 导出四个函数；adapter `opencode` 可用、
  `codex` 不可用。
- run-id 校验：`RUN-YYYYMMDD-NNN-build` 与 `-plan` 均通过 `isSafeRunId`。
- **门禁反证（实测）**：对当前状态为 `created` 的 `T-20260705-002` 调用
  `loadBuildContext`，返回 `build_gate_not_open / task_not_plan_approved`，
  确认门禁在未审批时正确拒绝 Build。

## 未验证 / 待用户手动验证

Codex sandbox 无法代表用户真实的 OpenCode 权限环境，因此以下必须在真实终端验证：

1. Plan Run / Build Run 调用 `opencode.cmd` 的真实执行能否跑到 `completed`，
   且服务器不崩（不出现 `Failed to fetch`）。
2. Build Run 是否真实修改目标项目文件，且 `changedFiles` 与 `build-diff.txt`
   与实际改动一致。
3. GUI 的 Review 按钮走 CLI `task review`，其前置要求 run 目录存在 `build.log`
   或 `verify-result.md`。Build runer 会写 `build.log`，此衔接需端到端验证。

### 手动验证清单

强烈建议用一个独立测试项目验证，不要用本仓库（本仓库自身有未提交改动，
且不应让 Build 修改工具库本体）。

1. 真实终端确认环境：`opencode.cmd run "Reply with exactly: OK" --format json`。
2. `npm run gui`，打开 http://localhost:3456。
3. 注册测试项目 → 新建任务 → 绑定能力 → 生成 SOP 与 Final Prompt。
4. Plan Run：期望 202 → running → completed，无服务器崩溃。
5. 审批前先点 Build，应被拒 `build_gate_not_open`（门禁反证）。
6. Approve Plan → 任务变 `plan_approved`，Build 门禁开启。
7. Build Run：期望 202 → running → completed，测试项目文件被真实修改。
8. Agent tab 核对 `changedFiles`；run 目录核对 `build.log`、`build-diff.txt`。
9. Approve Review → 任务 `completed`；Close → 生成
   `data/ai-coding-console/reports/<task>-summary.md`。

## 未纳入本次范围

- 多 Session 并行、`--session --continue` 断点续传。
- 自动 Git 提交、自动回滚。
- Codex / Claude Code 真实接入（仅保留 adapter 占位）。
- `opencode.cmd serve` 守护进程模式。
