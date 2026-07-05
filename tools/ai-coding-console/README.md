# AI Coding Desktop Console

Phase: C.5+ - Three-column Workbench

## Quick Start

```
npm run gui
# Then open http://localhost:3456
```

The GUI now uses a three-column task workbench:

- Left: projects
- Middle: tasks for the current project
- Right: the active task workspace

Capability Registry, Prompt Builder, and real agent execution remain reserved for later phases.

## Directory Structure

```
tools/ai-coding-console/
├── README.md                     ← This file
├── config/
│   └── console-config.json       ← Console-specific config
├── cli/
│   └── console.ps1                ← CLI entry (all commands)
├── gui/                           ← Three-column workbench UI
│   ├── server.js                 ← Node.js HTTP server (0 deps)
│   ├── index.html                ← Main shell and styles
│   └── app.js                    ← Workbench state and rendering logic

data/ai-coding-console/
├── projects-manifest.json        ← Registered project index
├── capability-registry.json      ← Capability Registry index
├── tasks/                        ← Created on demand
├── board/                        ← Created on demand
└── reports/                      ← Created on demand
```

## Capability Registry

- Registry path: `data/ai-coding-console/capability-registry.json`
- Capability types: `skill`, `sop`, `script`, `prompt-template`, `capability-pack`
- This stage only exposes registry metadata and read-only API access.
- Future C.6-B / C.6-C work will connect Web browsing, Task binding, Prompt, and SOP flows.

## Task Capability Binding

- Binding path: `data/ai-coding-console/tasks/<task-id>/capabilities.json`
- Read API: `GET /api/tasks/:projectId/:taskId/capabilities`
- Write API: `POST /api/tasks/:projectId/:taskId/capabilities`
- Bindings are task-scoped and only store `capabilityIds`.
- Missing binding files read back as empty bindings.
- Write requests validate every `capabilityId` against `data/ai-coding-console/capability-registry.json` and return `invalid_capability_ids` for unknown IDs.

## CLI Commands

```powershell
powershell -ExecutionPolicy Bypass -File tools\ai-coding-console\cli\console.ps1 help
```
