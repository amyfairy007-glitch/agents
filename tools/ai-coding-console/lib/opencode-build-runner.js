// AI Coding Console - OpenCode Build Runner (Stage D-2)
//
// Build runs are allowed to modify project files. Safety comes from three
// layers plus a hard gate:
//   L1 Prompt : the build prompt authorizes writes but binds them to the SOP
//               and final-prompt scope.
//   L2 Gate   : a build run may only start when task.status === "plan_approved".
//   L3 Git    : the runner records a pre-run baseline and, after the run,
//               captures changedFiles as the expected diff (a dirty worktree
//               is normal for a build, not an "unsafe" verdict).
// The runner never auto-commits and never auto-reverts. Any change is left for
// human review.

const fs = require("fs");
const path = require("path");
const { loadCapabilityRegistry } = require("./capability-registry");
const { loadTaskCapabilityBinding, loadTaskRecord } = require("./task-capability-binding");
const { getFinalPromptPath, getSopPath, readFileIfExists } = require("./task-prompt-builder");
const {
  getRunJsonPath,
  getRunPlanPath,
  getRunPromptPath,
  getRunRawOutputPath,
  getRunBaselinePath,
  getRunBuildLogPath,
  getRunBuildDiffPath
} = require("./run-store");
const {
  readText,
  runCommand,
  captureGitSnapshot
} = require("./agent-runner-core");
const { getAdapter } = require("./agent-adapters");

const BUILD_TIMEOUT_MS = Number(process.env.AI_CODING_CONSOLE_OPENCODE_TIMEOUT_MS || 600000);

function taskStatusOf(task) {
  return String((task && (task.status || task.Status)) || "").toLowerCase();
}

function buildBuildPrompt({ repoRoot, task, projectId, finalPrompt, sop, capabilities, projectRules }) {
  const capabilitySection = (capabilities || []).map((capability) => {
    const artifacts = Array.isArray(capability.expectedArtifacts) ? capability.expectedArtifacts.join(", ") : "";
    return [
      `- id: ${capability.id}`,
      `  name: ${capability.name || capability.id || ""}`,
      `  type: ${capability.type || ""}`,
      `  canModifyProject: ${capability.canModifyProject ? "true" : "false"}`,
      `  requiresApproval: ${capability.requiresApproval ? "true" : "false"}`,
      `  expectedArtifacts: ${artifacts || ""}`
    ].join("\n");
  }).join("\n\n");

  const sopText = JSON.stringify(sop, null, 2);
  const projectRuleText = (projectRules || []).map((item) => item.content).filter(Boolean).join("\n\n");

  return [
    "你正在执行 Build Run。",
    "本次已通过人工 Plan 审批，允许你在项目工作区内创建、修改文件以完成任务。",
    "严格边界：",
    "- 只能修改与本 Task 目标、SOP、Final Prompt 直接相关的文件。",
    "- 禁止提交 Git（不要执行 git commit / git push）。",
    "- 禁止修改 .git 配置、删除无关文件、执行破坏性命令。",
    "- 完成后简要说明你改动了哪些文件以及原因。",
    "- 若与 Final Prompt 冲突，停止并在输出中说明，不要强行绕过。",
    "",
    "# 实施执行",
    "## 目标",
    `- Task: ${task.taskId || ""}`,
    `- Title: ${task.title || ""}`,
    `- Project: ${projectId}`,
    `- Project root: ${task.projectPath || repoRoot}`,
    `- Stage: D-2 Build Run`,
    "",
    "## 项目规则",
    projectRuleText || "(none)",
    "",
    "## 已绑定 Capability",
    capabilitySection || "(none)",
    "",
    "## SOP",
    sopText,
    "",
    "## Final Prompt",
    finalPrompt || "(missing final prompt)",
    "",
    "## 执行要求",
    "- 按 SOP 步骤实施。",
    "- 每次写文件前确认路径在项目工作区内。",
    "- 结束时输出改动文件清单与验证建议。",
    ""
  ].join("\n");
}

function loadBuildContext({ repoRoot, projectId, taskId, registryPath }) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) return taskRecord;

  const status = taskStatusOf(taskRecord.task);
  if (status !== "plan_approved") {
    return {
      ok: false,
      statusCode: 409,
      error: "build_gate_not_open",
      reason: "task_not_plan_approved",
      nextAction: "approve_plan_first",
      details: [`Build requires task.status === "plan_approved" (current: ${status || "unknown"}).`]
    };
  }

  const projectRoot = path.resolve(taskRecord.task.projectPath || taskRecord.task.projectpath || repoRoot);
  if (!fs.existsSync(projectRoot)) {
    return { ok: false, statusCode: 400, error: "project_root_not_found", details: [projectRoot] };
  }

  const finalPrompt = readFileIfExists(getFinalPromptPath(repoRoot, taskId));
  if (!finalPrompt) {
    return { ok: false, statusCode: 400, error: "final_prompt_not_found", details: [path.relative(repoRoot, getFinalPromptPath(repoRoot, taskId))] };
  }

  const sopRaw = readFileIfExists(getSopPath(repoRoot, taskId));
  if (!sopRaw) {
    return { ok: false, statusCode: 400, error: "sop_not_found", details: [path.relative(repoRoot, getSopPath(repoRoot, taskId))] };
  }
  let sop;
  try {
    sop = JSON.parse(sopRaw);
  } catch (err) {
    return { ok: false, statusCode: 400, error: "invalid_sop_json", details: [err.message] };
  }

  const binding = loadTaskCapabilityBinding(repoRoot, projectId, taskId, registryPath);
  if (!binding.ok || !Array.isArray(binding.capabilities) || !binding.capabilities.length) {
    return { ok: false, statusCode: 400, error: "no_capability_bound", details: binding.details || ["Task has no bound capabilities."] };
  }

  const registry = loadCapabilityRegistry(registryPath, repoRoot);
  if (!registry.ok) return registry;

  const projectRules = [];
  const projectRuleFiles = [
    { path: path.join(repoRoot, "AGENTS.md"), label: "AGENTS.md" },
    { path: path.join(repoRoot, ".ai", "current-state.md"), label: ".ai/current-state.md" },
    { path: path.join(repoRoot, ".ai", "decisions.md"), label: ".ai/decisions.md" },
    { path: path.join(repoRoot, ".ai", "business-context.md"), label: ".ai/business-context.md" }
  ];
  for (const file of projectRuleFiles) {
    const content = readText(file.path);
    if (content.trim()) projectRules.push({ label: file.label, content });
  }

  const promptText = buildBuildPrompt({
    repoRoot,
    task: taskRecord.task,
    projectId,
    finalPrompt: finalPrompt.trim(),
    sop,
    capabilities: binding.capabilities,
    projectRules
  });

  return { ok: true, task: taskRecord.task, projectRoot, promptText };
}

async function prepareOpenCodeBuildStart({ repoRoot, projectId, taskId, runId, registryPath }) {
  const context = loadBuildContext({ repoRoot, projectId, taskId, registryPath });
  if (!context.ok) return context;

  const adapter = getAdapter("opencode");
  const availability = adapter.checkAvailability();
  if (!availability.ok) {
    return {
      ok: false,
      statusCode: availability.statusCode || 409,
      error: availability.error || "opencode_environment_not_ready",
      reason: availability.reason || "opencode_cli_unavailable",
      nextAction: availability.nextAction || "manual_environment_check_required",
      details: availability.details || []
    };
  }

  const preSnapshot = await captureGitSnapshot("pre", context.projectRoot);
  // Note: unlike Plan, a Build run does NOT require a clean worktree gate here,
  // because Build is expected to change files. We still record the baseline so
  // the post-run diff is auditable.

  const promptPath = getRunPromptPath(repoRoot, taskId, runId);
  const rawOutputPath = getRunRawOutputPath(repoRoot, taskId, runId);
  const stderrPath = path.join(path.dirname(getRunJsonPath(repoRoot, taskId, runId)), "stderr.log");
  const buildLogPath = getRunBuildLogPath(repoRoot, taskId, runId);
  const baselinePath = getRunBaselinePath(repoRoot, taskId, runId);

  const invocation = adapter.buildInvocation({ message: `Build run ${taskId}`, promptPath });
  if (!invocation.ok) {
    return { ok: false, statusCode: invocation.statusCode || 409, error: invocation.error, details: invocation.details || [] };
  }

  const createdAt = new Date().toISOString();
  const runRecord = {
    runId,
    taskId,
    projectId,
    agentType: "opencode",
    mode: "build",
    status: "running",
    createdAt,
    startedAt: createdAt,
    finishedAt: null,
    sessionRef: null,
    exitCode: null,
    error: null,
    timeoutMs: BUILD_TIMEOUT_MS,
    stdoutBytes: 0,
    stderrBytes: 0,
    failureReason: null,
    planPath: path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId)),
    rawOutputPath: path.relative(repoRoot, rawOutputPath),
    promptPath: path.relative(repoRoot, promptPath),
    stderrPath: path.relative(repoRoot, stderrPath),
    buildLogPath: path.relative(repoRoot, buildLogPath),
    buildDiffPath: path.relative(repoRoot, getRunBuildDiffPath(repoRoot, taskId, runId)),
    baselinePath: path.relative(repoRoot, baselinePath),
    readOnlyEnforcement: "build_gate_and_post_run_git_diff",
    approvalStatus: "not_opened",
    diagnostics: {
      command: invocation.command,
      args: invocation.args,
      cwd: context.projectRoot,
      usesCmdExe: true,
      inheritedUserEnv: true
    }
  };
  const baseline = {
    taskId,
    runId,
    projectId,
    projectRoot: context.projectRoot,
    readOnlyEnforcement: "build_gate_and_post_run_git_diff",
    safetyVerdict: "running",
    trackedChangesDetected: false,
    changedFiles: [],
    timeoutMs: BUILD_TIMEOUT_MS,
    stdoutBytes: 0,
    stderrBytes: 0,
    failureReason: null,
    pre: preSnapshot,
    post: null,
    opencode: {
      command: invocation.command,
      args: invocation.args,
      cwd: context.projectRoot,
      exitCode: null,
      signal: null,
      stderr: "",
      sessionRef: null,
      streamWriteFailure: null
    }
  };

  return {
    ok: true,
    runId,
    projectRoot: context.projectRoot,
    promptText: context.promptText,
    runRecord,
    baseline,
    paths: {
      runDir: path.dirname(getRunJsonPath(repoRoot, taskId, runId)),
      promptPath,
      rawOutputPath,
      stderrPath,
      planPath: getRunPlanPath(repoRoot, taskId, runId),
      buildLogPath,
      buildDiffPath: getRunBuildDiffPath(repoRoot, taskId, runId),
      baselinePath,
      runJsonPath: getRunJsonPath(repoRoot, taskId, runId)
    }
  };
}

async function runOpenCodeBuild({ repoRoot, projectId, taskId, runId, registryPath }) {
  const context = loadBuildContext({ repoRoot, projectId, taskId, registryPath });
  if (!context.ok) return context;

  const adapter = getAdapter("opencode");
  const invocation = adapter.buildInvocation({
    message: `Build run ${taskId}`,
    promptPath: getRunPromptPath(repoRoot, taskId, runId)
  });
  if (!invocation.ok) {
    return { ok: false, statusCode: invocation.statusCode || 409, error: invocation.error, details: invocation.details || [] };
  }

  const runDir = path.dirname(getRunJsonPath(repoRoot, taskId, runId));
  const promptPath = getRunPromptPath(repoRoot, taskId, runId);
  const rawOutputPath = getRunRawOutputPath(repoRoot, taskId, runId);
  const stderrPath = path.join(runDir, "stderr.log");
  const buildLogPath = getRunBuildLogPath(repoRoot, taskId, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(promptPath, context.promptText, "utf8");
  fs.writeFileSync(rawOutputPath, "", "utf8");
  fs.writeFileSync(stderrPath, "", "utf8");

  const preSnapshot = await captureGitSnapshot("pre", context.projectRoot);

  const startedAt = new Date().toISOString();
  const execResult = await runCommand(invocation.command, invocation.args, {
    cwd: context.projectRoot,
    env: { ...process.env },
    timeoutMs: BUILD_TIMEOUT_MS,
    rawOutputPath,
    stderrPath
  });
  const finishedAt = new Date().toISOString();

  const rawOutput = readText(rawOutputPath);
  const parsed = adapter.parseOutput(rawOutput || execResult.stdout || "");
  const stderrOutput = readText(stderrPath) || String(execResult.stderr || "");
  const buildText = parsed.text && parsed.text.trim()
    ? parsed.text.trim()
    : [
        "# Build output extraction failed",
        "",
        "OpenCode did not expose readable text output in stdout.",
        `Raw output path: ${path.relative(repoRoot, rawOutputPath)}`
      ].join("\n");

  // Persist the human-readable build output to build.log (mirrors plan.md role).
  fs.writeFileSync(buildLogPath, buildText, "utf8");

  const postSnapshot = await captureGitSnapshot("post", context.projectRoot);
  const changedFiles = postSnapshot.changedFiles || [];
  const trackedChangesDetected = Boolean(String(postSnapshot.statusShort || "").trim());

  // Write the expected build diff artifact for review.
  fs.writeFileSync(
    getRunBuildDiffPath(repoRoot, taskId, runId),
    changedFiles.length ? changedFiles.join("\n") + "\n" : "(no tracked changes detected)\n",
    "utf8"
  );

  const streamWriteFailed = Boolean(execResult.streamWriteFailure);
  // For Build, changed files are EXPECTED. Success is driven by exit code, not
  // by worktree cleanliness.
  const status = streamWriteFailed
    ? "failed"
    : (execResult.timedOut ? "timed_out" : (execResult.exitCode === 0 ? "completed" : "failed"));
  const safetyVerdict = status === "completed" ? "build_completed" : status;
  const approvalStatus = status === "completed" ? "pending_review" : "not_opened";

  const runRecord = {
    runId,
    taskId,
    projectId,
    agentType: "opencode",
    mode: "build",
    status,
    createdAt: startedAt,
    startedAt,
    finishedAt,
    sessionRef: parsed.sessionRef || null,
    exitCode: execResult.exitCode,
    error: status === "completed"
      ? null
      : (streamWriteFailed
        ? `runner_output_temp_directory_missing: ${execResult.streamWriteFailure.message}`.slice(0, 1000)
        : (execResult.timedOut ? "opencode_build_timed_out" : (stderrOutput || execResult.error || "opencode_build_failed")).trim().slice(0, 1000) || null),
    timeoutMs: BUILD_TIMEOUT_MS,
    stdoutBytes: execResult.stdoutBytes || 0,
    stderrBytes: execResult.stderrBytes || 0,
    failureReason: streamWriteFailed
      ? "runner_output_temp_directory_missing"
      : (execResult.timedOut ? "timeout" : (execResult.error ? "spawn_error" : (execResult.exitCode === 0 ? null : "non_zero_exit"))),
    planPath: path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId)),
    rawOutputPath: path.relative(repoRoot, rawOutputPath),
    promptPath: path.relative(repoRoot, promptPath),
    buildLogPath: path.relative(repoRoot, buildLogPath),
    buildDiffPath: path.relative(repoRoot, getRunBuildDiffPath(repoRoot, taskId, runId)),
    baselinePath: path.relative(repoRoot, getRunBaselinePath(repoRoot, taskId, runId)),
    readOnlyEnforcement: "build_gate_and_post_run_git_diff",
    approvalStatus,
    diagnostics: {
      command: invocation.command,
      args: invocation.args,
      cwd: context.projectRoot,
      usesCmdExe: true,
      inheritedUserEnv: true
    }
  };

  const baseline = {
    taskId,
    runId,
    projectId,
    projectRoot: context.projectRoot,
    readOnlyEnforcement: "build_gate_and_post_run_git_diff",
    safetyVerdict,
    trackedChangesDetected,
    changedFiles,
    timeoutMs: BUILD_TIMEOUT_MS,
    stdoutBytes: execResult.stdoutBytes || 0,
    stderrBytes: execResult.stderrBytes || 0,
    failureReason: runRecord.failureReason,
    pre: preSnapshot,
    post: postSnapshot,
    opencode: {
      command: invocation.command,
      args: invocation.args,
      cwd: context.projectRoot,
      exitCode: execResult.exitCode,
      signal: execResult.signal || null,
      stderr: stderrOutput || "",
      sessionRef: parsed.sessionRef || null,
      streamWriteFailure: execResult.streamWriteFailure || null
    }
  };

  return {
    ok: true,
    runRecord,
    promptText: context.promptText,
    rawOutput,
    planText: buildText,
    buildText,
    baseline,
    status,
    approvalStatus,
    changedFiles,
    trackedChangesDetected,
    exitCode: execResult.exitCode,
    error: execResult.exitCode === 0 ? null : execResult.stderr || null
  };
}

module.exports = {
  buildBuildPrompt,
  loadBuildContext,
  prepareOpenCodeBuildStart,
  runOpenCodeBuild
};
