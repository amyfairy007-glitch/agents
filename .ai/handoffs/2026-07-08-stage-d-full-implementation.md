# Stage D Full Implementation Handoff

Date: 2026-07-08

## Summary

- Stage D is code-complete end to end for the AI Coding Console: Plan Run (D-1, read-only) → Approve Plan → Build Run (D-2, writes project files) → Review → Close.
- The change extracts a shared runner core, adds an Agent adapter layer, adds a Build runner with a hard approval gate, wires a build route, and connects the GUI approval closeout.

## Files Added

- `tools/ai-coding-console/lib/agent-runner-core.js` — shared process spawn, Git snapshots, output persistence, JSONL text/session extraction (extracted from the plan runner).
- `tools/ai-coding-console/lib/agent-adapters.js` — `OpenCodeAdapter` (real) + reserved `CodexAdapter` / `ClaudeCodeAdapter` (always unavailable); `getAdapter(agentType)`.
- `tools/ai-coding-console/lib/opencode-build-runner.js` — `prepareOpenCodeBuildStart` + `runOpenCodeBuild`, `mode: "build"`, plan_approved gate, writes `build.log` + `build-diff.txt`.

## Files Changed

- `tools/ai-coding-console/lib/opencode-plan-runner.js` — now delegates shared logic to the core + adapter; public exports unchanged.
- `tools/ai-coding-console/lib/run-store.js` — `RUN_ID_PATTERN`/`isSafeRunId` accept `-build`; summaries include `changedFiles` + `trackedChangesDetected`; added `getRunBuildLogPath` / `getRunBuildDiffPath`.
- `tools/ai-coding-console/gui/server.js` — added `POST /api/tasks/:projectId/:taskId/runs/build` (202 + async), build persist helpers, and the build-runner import.
- `tools/ai-coding-console/gui/app.js` — `startBuildRun`, `renderBuildRunLauncher`, real `renderApprovalsTab` (approve/reject → review/reject → close), `approveTask(reject)` / `reviewTask(reject)` reject support.

## Safety Model (Build)

- L1 Prompt: build prompt authorizes writes but binds them to the Task / SOP / final-prompt scope, forbids git commit/push and destructive commands.
- L2 Gate: `loadBuildContext` rejects build unless `task.status === "plan_approved"` (409 `build_gate_not_open`).
- L3 Git: pre/post baseline; `changedFiles` captured as the expected diff into `build-diff.txt`. A dirty worktree after Build is normal. Never auto-commit, never auto-revert.

## Self-Test (sandbox, passed)

- `node --check` on all 7 changed/added files.
- Module load + exports; adapter availability (opencode true / codex false).
- Build/plan run-id validation.
- Build gate rejects a non-approved task with `build_gate_not_open` / `task_not_plan_approved`.

## NOT Validated (requires user)

- Real `opencode.cmd` execution for Plan and Build. The Codex sandbox cannot represent the user's real OpenCode permission context.
- The CLI `task review` gate expects `build.log` / `verify-result.md` in the run dir; the Build runner writes `build.log`, but the full GUI-review-to-CLI handoff was not run end to end in sandbox.

## Next Step

- User runs manual end-to-end validation from a real terminal (`npm run gui`) on a clean, SEPARATE test project (not this repo — its worktree is dirty and Plan requires a clean tree).
- Validation checklist is in `knowledge/traces/ai-coding-console-stage-d-full-result.md`.
- After validation: UI alignment pass — collapse the top context strip to a single row (能力/Agent/Git inline, only「更多操作」dropdown) and add the 阶段总览区 to the Prompt 与 SOP tab.
