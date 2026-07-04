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

Use the templates in `templates/project-memory/` as the starting point.

For the full workflow, see `TASK-SOP.md` in this repository. `AGENTS.md` is the active enforcement layer; `TASK-SOP.md` is the detailed operating guide.

## Scope

- V1 only.
- No agents.
- No skills.
- No worktree automation.
- No multi-session tooling.
