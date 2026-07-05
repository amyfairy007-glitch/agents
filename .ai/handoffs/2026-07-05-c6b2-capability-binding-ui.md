# Handoff

## Summary

- Completed C.6-B-2 capability browsing, filtering, multi-select binding, and task-scoped persistence in the AI Coding Console Web UI.
- The Prompt 与 SOP tab now acts as the inline entry point for capability management and shows bound capability count in the top context.

## Completed

- Added real registry loading from `/api/capabilities`.
- Added task binding loading and saving against `/api/tasks/:projectId/:taskId/capabilities`.
- Added search, type filters, capability cards, expandable capability details, and a selected-count footer.
- Added visual summary for bound capabilities and positive Prompt/SOP placeholder copy.
- Created the formal working Task `T-20260705-002` for the C.6 workflow.

## Verification

- Registry load verified against the 15-entry registry.
- Binding verified by saving 2 capabilities, refreshing, and then unbinding one capability and refreshing again.
- The UI now reflects persisted task capability counts after reload.

## Notes for the Next Person

- Continue with C.6-C only when real Prompt Builder logic is intentionally started.
- Preserve the current registry-as-read-only / task-binding-as-write-target boundary.
