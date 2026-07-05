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
