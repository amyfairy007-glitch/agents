# Current State

## What We Are Working On

- C.6-B-2 Task Capability 浏览、选择与绑定 UI 已落地到 AI Coding Console Web.
- The workbench now exposes real capability browsing, filtering, multi-select binding, and refresh-backed task-scoped persistence.
- A formal working Task was created for the C.6 workflow: `T-20260705-002`.

## Last Updated

- 2026-07-08

## Next Step (archived — superseded by the Stage D section below)

- Continue with C.6-C only when Prompt Builder and SOP generation are intentionally started.
- Keep the capability binding UI as the current completion point for C.6-B-2.

## C.6-C Status Update

- Task `T-20260705-002` now has formal Task-scoped generation artifacts: `sop.json`, `prompt-draft.md`, and `final-prompt.md`.
- The C.6-C generation path uses local templates plus rule-based composition only; it does not call an AI model or execute an Agent.
- The prompt draft stores user additions in the fixed `## 用户补充说明` block, and the final prompt composes the saved SOP, draft, and supplement into the persisted `final-prompt.md`.
- The next forward step is Stage D only, after the team chooses to wire a real Agent executor.

## Stage D Status Update (2026-07-08)

- Stage D is now code-complete end to end: Plan Run (D-1, read-only) → Approve Plan → Build Run (D-2, allowed to write project files) → Review → Close.
- New lib modules: `agent-runner-core.js` (shared process/Git/JSONL core extracted from the plan runner), `agent-adapters.js` (OpenCode adapter + reserved Codex/Claude placeholders), `opencode-build-runner.js` (Build Run with the plan_approved gate).
- `run-store.js` now accepts `-build` run ids and surfaces `changedFiles` in run summaries. `server.js` exposes `POST /api/tasks/:projectId/:taskId/runs/build` (202 + async, plan_approved gate).
- Build safety: L1 prompt authorizes writes but binds them to the SOP/final-prompt scope; L2 hard gate rejects build unless `task.status === "plan_approved"`; L3 Git baseline records the expected diff into `build-diff.txt`. The runner never auto-commits and never auto-reverts.
- GUI: Prompt tab shows a Build launcher after plan approval; Approvals tab now drives the real approve/reject → review/reject → close closeout; Agent tab lists plan and build runs together.
- NOT YET VALIDATED: real OpenCode `opencode.cmd` execution for Plan/Build. The Codex sandbox cannot represent the user's real permission context. Manual validation from a real terminal (`npm run gui`) is required — see `knowledge/traces/ai-coding-console-stage-d-full-result.md`.
- Self-test passed in sandbox: `node --check` on all changed files, module load + exports, adapter availability (opencode true / codex false), build/plan run-id validation, and the build gate correctly rejecting a non-approved task with `build_gate_not_open`.

## Next Step

- User to run the manual end-to-end validation on a clean, separate test project (not this repo) and report whether Plan/Build reach `completed` and whether Build truly modifies files.
- After validation, proceed to the UI alignment pass (top context strip single-row收敛 + Prompt tab 阶段总览区).
