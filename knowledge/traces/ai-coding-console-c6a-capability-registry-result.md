# AI Coding Console C.6-A Capability Registry Result

## Task Scope

- Goal: register the reusable AI capability set into a single capability registry and expose it through read-only GUI APIs.
- Scope: data registry, server-side read APIs, validation, and formal result recording.
- Non-goals: Web registry browser, Task binding, Prompt Builder, Task SOP generation, live agent execution, real runs, and external project mutation.

## Source Review

- Verified real repository sources for the 15 target capabilities.
- The original trace reference `knowledge/traces/ai-coding-console-c6-prompt-sop-workflow-plan.md` is not present in the repository.
- The actual matching source used for the prompt/SOP capability mapping is `knowledge/traces/ai-coding-desktop-console-c6-prompt-sop-workflow-plan.md`.
- The capability names were aligned to the actual repository facts and file names, including `script-console-cli` instead of the plan-only label `script-console-ps1`.

## Registry Summary

- Total entries: 15
- By type:
  - `skill`: 5
  - `sop`: 2
  - `script`: 4
  - `prompt-template`: 4
  - `capability-pack`: 0

## Registered Capabilities

| id | type | sourcePath | status |
|---|---|---|---|
| `skill-project-takeover` | `skill` | `built-in: console.ps1 project status + project prompt` | `active` |
| `skill-code-audit` | `skill` | `built-in: AGENTS.md rules` | `active` |
| `skill-architecture-analysis` | `skill` | `built-in: generate-project-background prompt` | `active` |
| `skill-migration-analysis` | `skill` | `built-in: historical migration knowledge` | `active` |
| `skill-review-closeout` | `skill` | `built-in: console.ps1 task review/close` | `active` |
| `sop-market-localchange` | `sop` | `knowledge/flows/market-localchange-task-guide.md` | `active` |
| `sop-task-lifecycle` | `sop` | `built-in: console.ps1 task flow` | `active` |
| `script-init-project-memory` | `script` | `tools/init-project-memory/init-project-memory.ps1` | `active` |
| `script-sync-codex-home` | `script` | `tools/sync-codex-home/sync-codex-home.ps1` | `active` |
| `script-console-cli` | `script` | `tools/ai-coding-console/cli/console.ps1` | `active` |
| `script-gui-server` | `script` | `tools/ai-coding-console/gui/server.js` | `active` |
| `prompt-git-branch-create` | `prompt-template` | `knowledge/flows/git-branch-create-ai-prompt-3.md` | `active` |
| `prompt-project-background` | `prompt-template` | `knowledge/traces/generate-complete-project-background.md` | `active` |
| `prompt-multi-session-collab` | `prompt-template` | `knowledge/traces/multi-session-collaboration-implementation-v2.md` | `active` |
| `prompt-mvp1-step-ui` | `prompt-template` | `knowledge/traces/mvp1-step-ui.md` | `active` |

## Validation Results

- Registry JSON parse: passed.
- Registry schema and enum validation: passed.
- Entry ID uniqueness: passed.
- Entry file existence checks: passed for all scripts.
- Repository-relative source path existence checks: passed for all file-backed capabilities.
- Built-in sourcePath descriptions: present and non-empty for all built-in capabilities.
- Related capability ID references: passed.
- Historical reports and closeout files were not registered as capabilities.

## API Verification

- `GET http://127.0.0.1:3456/api/capabilities`: returned the full 15-entry registry after `data/ai-coding-console/capability-registry.json` was added.
- `GET http://127.0.0.1:3456/api/capabilities/skill-project-takeover`: returned the expected single entry.
- `GET http://127.0.0.1:3456/api/capabilities/not-found-id`: returns a structured JSON error response from the server route.

## Browser Verification

- Direct browser-control verification was blocked because the shared Playwright browser profile was already in use by another session.
- HTTP-level verification of `http://127.0.0.1:3456/#/` returned status `200`, which confirms the GUI shell responds normally.
- The registered project list remains backed by the existing `projects-manifest.json` data and was not removed by this stage.

## `git diff --check`

- Passed after the registry and result files were added.

## Files Modified

- `data/ai-coding-console/capability-registry.json`
- `tools/ai-coding-console/lib/capability-registry.js`
- `tools/ai-coding-console/gui/server.js`
- `tools/ai-coding-console/README.md`
- `knowledge/traces/ai-coding-console-c6a-capability-registry-result.md`

## Exclusions

- No Task, Run, board, or artifact test data was created.
- No capability execution logic was added.
- No external project was modified.
- No Web browser UI for browsing/binding capabilities was implemented in this stage.

## C.6-B Readiness

- Data-layer prerequisites for C.6-B are in place.
- The remaining blocker for full C.6-B readiness is the Web browsing and binding UI, not the registry data itself.

## Timestamp

- Generated: 2026-07-04T18:26:03.2516440Z

## Commit Hash

- `e0495d5` (`feat: 新增 AI Coding Console 全局能力注册表`)
