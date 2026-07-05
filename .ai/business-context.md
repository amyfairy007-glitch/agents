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
