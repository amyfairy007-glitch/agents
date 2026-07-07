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
- create empty `prompt.md`, `agent-raw.jsonl`, and `stderr.log` before stdout/stderr arrive
- append stdout directly into the formal `agent-raw.jsonl`
- append stderr directly into the formal `stderr.log`
- avoid removing the output directory while stream callbacks are still active

This reduces lifecycle complexity and removes the previous temp-directory race.

## Stream Error Containment

All stdout/stderr file writes are now locally guarded:

- write failures are captured with `try/catch`
- the child process is terminated when persistence fails
- the run is classified as `failed`
- `failureReason` is recorded as `runner_output_temp_directory_missing` for the known ENOENT case
- route-level persistence also returns structured JSON instead of crashing the whole server

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

## Unchanged Scope

- no new `RUN-*` created in this adjustment round
- no OpenCode execution from Codex sandbox
- no D-2 Build / approval / review features
- no Prompt / SOP / Capability model changes
- no config directory mutation
- no commit
