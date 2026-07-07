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

- Date: 2026-07-08
  - Decision: Implement full Stage D (Plan → Approve → Build → Review → Close) rather than stopping at D-1. Build Run is allowed to modify real project files.
  - Why: The Plan-only loop is not a usable delivery on its own; the team decided the console should carry a task through real implementation and human closeout.
  - Impact: A Build Run now writes to the project worktree. All downstream safety depends on the gate + Git baseline described below, not on any read-only guarantee.

- Date: 2026-07-08
  - Decision: Gate Build behind a hard precondition (`task.status === "plan_approved"`) checked server-side in `loadBuildContext`, and rely on three layers for Build safety: L1 prompt scope, L2 status gate, L3 post-run Git diff captured to `build-diff.txt`. Never auto-commit, never auto-revert.
  - Why: OpenCode's `run` command has no `--readonly`/`--deny-edit` flag, so writes cannot be technically blocked once Build starts. The gate ensures a human approved the plan first, and the Git baseline makes every change auditable and reversible by a human.
  - Impact: A dirty worktree after Build is normal (not "unsafe"), unlike Plan. Build success is driven by exit code + human review, and any unexpected change is left for manual handling.

- Date: 2026-07-08
  - Decision: Introduce an Agent adapter layer (`agent-adapters.js`) and a shared runner core (`agent-runner-core.js`); runners resolve a CLI by `agentType` instead of hardcoding `opencode.cmd`. Codex and Claude are reserved adapters that always report unavailable.
  - Why: Keep the Plan/Build runners and server routes free of OpenCode-specific branching so a second Agent can be added without rewriting the run pipeline, and avoid duplicating the process/Git/JSONL logic across plan and build runners.
  - Impact: `opencode-plan-runner.js` keeps its public exports but now delegates to the core and adapter; adding an Agent means implementing one adapter, not touching the runners or server routes.
