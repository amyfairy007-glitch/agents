# AI Coding Console D-1 OpenCode Runner Adjustment

Date: 2026-07-07

## Goal

Correct the D-1 runner so:

- Codex sandbox limitations do not become a hard blocker for the user's real OpenCode environment
- stdout/stderr persistence does not crash the Node server when temporary output paths disappear during a Plan Run

This update does not create a new formal Run, does not enter D-2, and does not change Prompt / SOP / Capability logic.

## Files Updated

- `tools/ai-coding-console/lib/opencode-plan-runner.js`
- `tools/ai-coding-console/gui/server.js`
- `knowledge/traces/ai-coding-console-d1-opencode-plan-run-result.md`

## Reliable D-1 Fixes Kept

The runner still keeps the parts that are valid regardless of Codex sandbox context:

- `opencode.cmd` resolution from the active runtime installation directory
- clean Git worktree pre-check
- timeout handling
- continuous stdout/stderr capture to disk
- `taskkill /t /f` process-tree cleanup on timeout
- post-run Git status comparison
- normal failed / timed_out / unsafe_modified status handling

## Real Crash Root Cause

The real server crash was not caused by OpenCode itself. The failure came from the runner's own stdout persistence path:

- the stdout event handler called synchronous append writes to a temp file such as `<temp-dir>/agent-raw.jsonl`
- that temp directory was cleaned up before all stdout callbacks had fully drained
- a later stdout chunk then hit `ENOENT`
- the write happened inside an EventEmitter callback without local `try/catch`
- the exception bubbled out of the callback and terminated the Node server process
- the browser then surfaced only `Failed to fetch`

This was a runner lifecycle bug, not a validated OpenCode execution failure.

## Sandbox Misjudgment Removed

The previous draft introduced a hard guard that inspected a derived OpenCode config directory and rejected runs when Codex could not access it.

That behavior was removed because:

- Codex is running under the sandbox account `othyreinspmxpbw\\codexsandboxoffline`
- that sandbox account cannot reliably inspect the user's real OpenCode config area
- the user already confirmed that `opencode.cmd run ... --format json` succeeds in a real cmd session

So:

- the runner no longer blocks on `.config` readability
- the runner no longer treats `EPERM` / `Access denied` from the Codex sandbox as evidence that the user's real OpenCode environment is broken
- the runner no longer hardcodes or derives a fixed `C:\\Users\\Administrator\\.config\\opencode` access check as a precondition

## Runtime Environment Change

The runner now uses:

- `env: { ...process.env }`

and does not overwrite:

- `HOME`
- `USERPROFILE`
- `APPDATA`
- `LOCALAPPDATA`
- `XDG_CONFIG_HOME`

This keeps D-1 aligned with the real terminal environment that actually succeeds for the user.

## Output Persistence Change

The runner now uses the formal Run directory as the live output target instead of writing agent output into a disposable temp raw-output directory.

Current behavior:

- create the formal run directory before spawn
- create empty `prompt.md`, `agent-raw.log`, and `stderr.log` before stdout/stderr arrive
- append stdout directly into the formal `agent-raw.log`
- append stderr directly into the formal `stderr.log`
- avoid removing the output directory while stream callbacks are still active

This reduces lifecycle complexity and removes the previous temp-directory race.

## Automatic Invocation Chain

The D-1 automatic chain is now:

```text
GUI
-> POST /api/tasks/:projectId/:taskId/runs/plan
-> Node server prepares and persists a running Run record
-> Node server starts the runner in the background
-> OpenCode stdout/stderr stream into the formal Run directory
-> Frontend polls GET /api/tasks/:projectId/:taskId/runs/:runId
```

The POST route no longer waits for OpenCode to finish.

Successful startup returns HTTP `202`:

```json
{
  "runId": "RUN-...",
  "status": "running"
}
```

Startup precondition failures still return structured JSON before any Run directory is created.

## OpenCode Launch Method

Current `opencode.cmd run --help` only exposes a positional `message` argument and these options:

- `--print-logs`
- `--log-level`
- `--pure`
- `--command`
- `--continue`
- `--session`
- `--fork`

It does not expose `--format json` or `--file`.

The D-1 Plan Runner therefore no longer uses:

```text
--format json
--file
```

Windows `.cmd` execution is routed through `cmd.exe`, but the OpenCode invocation is built as one auditable command line with only the supported positional message.

The effective launch shape is:

```text
command: cmd.exe
args: ["/d", "/s", "/c", "<quoted opencode.cmd run message>"]
cwd: <Task projectPath>
env: inherited process.env
stdio: pipe
stdin: closed immediately
```

The runner does not set a temporary `HOME`, `USERPROFILE`, `APPDATA`, or `LOCALAPPDATA`, and it does not hardcode an Administrator profile path.

The stored Run diagnostics include:

- command
- args
- cwd
- whether `cmd.exe` was used
- whether the real process environment was inherited

Diagnostics intentionally exclude full environment dumps, tokens, and OpenCode config content.

### Windows cmd quoting correction

A real GUI-triggered run exposed an invalid Windows command line:

```text
'C:\nvm4w\nodejs\opencode.cmd" run "You...
```

This is invalid for `cmd.exe` because Windows command paths are not quoted with single quotes, and the path ended up with only a closing double quote.

The runner now constructs the `.cmd` command line with double quotes only:

```text
"C:\nvm4w\nodejs\opencode.cmd" run "You are executing a Plan-only Run. Read the full task prompt from: prompt.md Follow that prompt exactly. Do not create, modify, delete, move, rename, or commit any files. Return only a Markdown implementation plan."
```

The Node spawn shape is:

```json
{
  "command": "C:\\Windows\\System32\\cmd.exe",
  "args": [
    "/d",
    "/s",
    "/c",
    "\"C:\\nvm4w\\nodejs\\opencode.cmd\" run \"<escaped message>\""
  ]
}
```

Codex sandbox validation did not run `opencode.cmd`. It only verified command construction and confirmed that the command line contains no single quotes, starts with a double-quoted `opencode.cmd` path, and double-quotes the short message.

## Prompt Handoff

The full D-1 Plan Prompt is still persisted to:

```text
runs/<run-id>/prompt.md
```

The OpenCode CLI message is intentionally short and points OpenCode at that prompt file:

```text
You are executing a Plan-only Run. Read the full task prompt from: <path-to-prompt.md> Follow that prompt exactly. Do not create, modify, delete, move, rename, or commit any files. Return only a Markdown implementation plan.
```

This avoids putting the complete `final-prompt.md` content onto the Windows command line while keeping `prompt.md` as the durable source of truth.

## Output Format

D-1 no longer assumes JSONL output from OpenCode.

New Plan Run output files:

- `agent-raw.log`: complete stdout from OpenCode
- `stderr.log`: complete stderr from OpenCode
- `plan.md`: extracted readable Markdown plan

`run.json` records:

- `outputFormat: "plain_stdout"`
- `sessionRef: null` unless a future adapter can reliably provide one
- diagnostics containing command / args / cwd only

`plan.md` generation now treats stdout as plain text:

- if stdout is already Markdown, it is saved directly
- obvious log lines are filtered when possible
- if a plan cannot be extracted, `plan.md` records the extraction failure and points to `agent-raw.log`

Historical Runs remain compatible: `run-store.js` now prefers `agent-raw.log`, but falls back to `agent-raw.jsonl` when only the legacy file exists.

## Stream Error Containment

All stdout/stderr file writes are now locally guarded:

- write failures are captured with `try/catch`
- the child process is terminated when persistence fails
- the run is classified as `failed`
- `failureReason` is recorded as `runner_output_temp_directory_missing` for the known ENOENT case
- route-level persistence also returns structured JSON instead of crashing the whole server

## Frontend Polling

The frontend now treats Plan Run startup and Plan Run completion as separate phases:

- clicking `使用 OpenCode 生成 Plan` calls POST once
- the POST response provides the `runId`
- the UI polls `GET /api/tasks/:projectId/:taskId/runs/:runId`
- polling stops only on `completed`, `failed`, `timed_out`, or `unsafe_modified`

The UI distinguishes:

- local GUI server unreachable
- startup failure
- OpenCode running / receiving output
- completed and waiting for manual approval
- failed
- timed out
- project file modification detected

No Build, approval, Review, or Close action was added in this adjustment.

## Historical Failure Preserved

Existing historical Run data was preserved.

`data/ai-coding-console/tasks/T-20260705-002/runs/RUN-20260707-001-plan/` remains in place and is now explicitly marked as:

- `status: failed`
- `failureReason: runner_output_temp_directory_missing`
- `error: runner_output_temp_directory_missing: ENOENT while writing agent-raw.jsonl from stdout callback`
- `approvalStatus: not_opened`

The corresponding `baseline.json` is also marked with:

- `safetyVerdict: failed`
- `failureReason: runner_output_temp_directory_missing`

No historical failed Run was deleted, overwritten, or converted into a false success.

`RUN-20260708-001-plan` is also preserved as a failed historical Run. It records the real CLI mismatch where OpenCode printed help and exited because the previous runner passed unsupported `--format json` / `--file` arguments.

## Internal Lifecycle Verification

Before retrying any real OpenCode execution, an internal lifecycle self-test was run without calling OpenCode:

- create a temporary runner output directory
- append simulated stdout and stderr chunks
- remove the directory only after intended writes complete
- simulate a late write after cleanup
- confirm the late write fails with `ENOENT`
- confirm the process remains alive after the simulated write failure

Observed result:

- write while directory exists: success
- simulated late write after cleanup: `ENOENT`
- process survival after write error: confirmed

This verified that write failures are now caught locally instead of killing the server.

Additional Codex sandbox verification:

- `node --check` passed for the runner, server, and GUI app files
- the runner module loads and exports `prepareOpenCodePlanStart`
- `runOutputLifecycleSelfTest(...)` returned `serverAlive: true`
- a direct startup-precheck call returned structured `409 project_worktree_not_clean` while the repo had local D-1 edits
- that dirty-worktree check did not create a synthetic Run directory
- source validation confirmed the Plan Runner no longer contains `--format` or `--file`
- source validation confirmed the new raw output path is `agent-raw.log`
- run-store validation confirmed legacy `agent-raw.jsonl` files are still readable

The GUI server launch check could not be completed inside Codex because the sandbox approval for starting `npm run gui` timed out. This is recorded as a sandbox validation limit, not as an application failure.

## Still Not Claimed

This change does not prove that D-1 is already fully working end to end.

It removes:

- the false negative introduced by the Codex sandbox
- the confirmed runner crash caused by temp output lifecycle misuse

The next real validation must happen from the user's real GUI launch terminal, not from the Codex sandbox, because the sandbox still cannot represent the user's true OpenCode permission context.

## Next Recommended Validation

Run the GUI from the same real user terminal context that can already execute:

```text
opencode.cmd run "Reply with exactly: OK" --format json
```

Then perform the next D-1 real run validation there.

Expected real-user validation flow:

```text
cd /d E:\Program\ai-ui-agentic
npm run gui
```

Then use the GUI to start the next real Plan Run and verify:

- POST returns `202`
- Run appears as `running`
- Agent Output tab updates through polling
- terminal status becomes `completed`, `failed`, `timed_out`, or `unsafe_modified`
- no server crash appears as plain `Failed to fetch`

## Unchanged Scope

- no new `RUN-*` created in this adjustment round
- no OpenCode execution from Codex sandbox
- no D-2 Build / approval / review features
- no Prompt / SOP / Capability model changes
- no config directory mutation
- no commit
