# Global Codex Config Repository

This repository is the shared, Git-synced Codex configuration source for all your projects.

## What Lives Here

- `AGENTS.md`: active global rule file to sync into the real Codex home.
- `TASK-SOP.md`: detailed task workflow and source-of-truth SOP for humans maintaining the process.
- `templates/codex-home/config.toml`: safe default template for a real Codex home.
- `templates/project-memory/`: templates used to initialize per-project memory files.
- `scripts/init-project-memory.ps1`: bootstrap script for a project-local `.ai` folder.
- `scripts/sync-codex-home.ps1`: syncs safe config files into the actual Codex home on Windows.

## How To Use It

### 1. Initialize a project

From PowerShell, run:

```powershell
.\scripts\init-project-memory.ps1 -ProjectPath "E:\Path\To\YourProject"
```

### 2. Sync global Codex files into the real Codex home

Sync `AGENTS.md` only:

```powershell
.\scripts\sync-codex-home.ps1
```

Sync `AGENTS.md` and the safe `config.toml` template:

```powershell
.\scripts\sync-codex-home.ps1 -IncludeConfig
```

### 3. Keep project memory updated

Use the project-local `.ai` files as the running memory for that project:

- `.ai/business-context.md`
- `.ai/defect-patterns.md`
- `.ai/current-state.md`
- `.ai/decisions.md`
- `.ai/handoffs/`

## Notes

- V1 only.
- No agents.
- No skills.
- No worktree automation.
- No multi-session setup.
