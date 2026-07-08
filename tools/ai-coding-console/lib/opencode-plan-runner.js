const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { loadCapabilityRegistry } = require("./capability-registry");
const { loadTaskCapabilityBinding, loadTaskRecord } = require("./task-capability-binding");
const {
  buildFinalPromptFromSaved,
  getFinalPromptPath,
  getSopPath,
  readFileIfExists
} = require("./task-prompt-builder");
const {
  generateRunId,
  getRunJsonPath,
  getRunPlanPath,
  getRunPromptPath,
  getRunRawOutputPath,
  getRunBaselinePath,
  isWithinRoot
} = require("./run-store");
const {
  readText,
  ensureParentDir,
  writeJsonFile,
  terminalRunStatus,
  runCommand,
  runGit,
  parseGitChangedFiles,
  buildGitSnapshot,
  findStringByKey
} = require("./agent-runner-core");

function resolveOpenCodeCmdCommand() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, "opencode.cmd"),
    "opencode.cmd"
  ];

  for (const candidate of candidates) {
    if (candidate === "opencode.cmd") {
      return { ok: true, command: candidate, isCmdShim: true };
    }
    try {
      fs.accessSync(candidate, fs.constants.R_OK);
      return { ok: true, command: candidate, isCmdShim: true };
    } catch {
      // Try next candidate.
    }
  }

  return {
    ok: false,
    statusCode: 409,
    error: "opencode_environment_not_ready",
    reason: "opencode_cmd_unavailable",
    nextAction: "manual_environment_check_required",
    details: ["OpenCode CLI command opencode.cmd is not available to this Node process."]
  };
}

function buildPlanRunMessage(promptPath) {
  return [
    "You are executing a Plan-only Run.",
    `Read the full task prompt from: ${promptPath}`,
    "Follow that prompt exactly.",
    "Do not create, modify, delete, move, rename, or commit any files.",
    "Return only a Markdown implementation plan."
  ].join(" ");
}

function quoteForCmd(value) {
  return `"${String(value ?? "").replace(/"/g, '\\"')}"`;
}

function buildOpenCodePlanInvocation({ opencodePath, promptPath }) {
  const message = buildPlanRunMessage(promptPath);
  const commandLine = [
    quoteForCmd(opencodePath),
    "run",
    quoteForCmd(message)
  ].join(" ");

  return {
    command: path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe"),
    args: ["/d", "/s", "/c", commandLine],
    commandLine,
    message,
    useShell: false
  };
}

function extractPlanFromPlainStdout(rawOutput, rawOutputRelativePath) {
  const text = String(rawOutput || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return [
      "# Plan extraction failed",
      "",
      "OpenCode did not produce readable stdout.",
      "",
      `Raw output path: ${rawOutputRelativePath}`,
      "",
      "Inspect agent-raw.log for the original output."
    ].join("\n");
  }

  const lines = text.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (/^\[(debug|info|warn|error)\]/i.test(trimmed)) return false;
    if (/^(debug|info|warn|error)\s*:/i.test(trimmed)) return false;
    return true;
  }).join("\n").trim();

  return filtered || [
    "# Plan extraction failed",
    "",
    "OpenCode stdout did not contain a clear Markdown plan after log filtering.",
    "",
    `Raw output path: ${rawOutputRelativePath}`,
    "",
    "Inspect agent-raw.log for the original output."
  ].join("\n");
}

function buildPlanPrompt({
  repoRoot,
  task,
  projectId,
  finalPrompt,
  sop,
  capabilities,
  taskRules,
  projectRules
}) {
  const capabilitySection = (capabilities || []).map((capability) => {
    const artifacts = Array.isArray(capability.expectedArtifacts) ? capability.expectedArtifacts.join(", ") : "";
    return [
      `- id: ${capability.id}`,
      `  name: ${capability.name || capability.id || ""}`,
      `  type: ${capability.type || ""}`,
      `  description: ${capability.description || ""}`,
      `  riskLevel: ${capability.riskLevel || "low"}`,
      `  canModifyProject: ${capability.canModifyProject ? "true" : "false"}`,
      `  requiresApproval: ${capability.requiresApproval ? "true" : "false"}`,
      `  expectedArtifacts: ${artifacts || ""}`
    ].join("\n");
  }).join("\n\n");

  const sopText = JSON.stringify(sop, null, 2);
  const projectRuleText = projectRules.map((item) => item.content).filter(Boolean).join("\n\n");
  const taskRuleText = taskRules.map((item) => item.content).filter(Boolean).join("\n\n");

  return [
    "你正在执行 Plan-only Run。",
    "你只能读取、分析和输出计划。",
    "禁止创建、修改、删除、移动或重命名任何文件。",
    "禁止安装依赖、执行写入型命令、提交 Git、修改配置。",
    "不要开始实施，不要输出伪造的实施结果。",
    "",
    "# 实施计划",
    "## 目标理解",
    `- Task: ${task.taskId || ""}`,
    `- Title: ${task.title || ""}`,
    `- Project: ${projectId}`,
    "",
    "## 当前状态与约束",
    `- Project root: ${task.projectPath || repoRoot}`,
    `- Stage: D-1 Plan Run`,
    `- Read only enforcement: prompt_and_post_run_git_check`,
    "",
    "### Project Rules",
    projectRuleText || "(none)",
    "",
    "### Task Rules",
    taskRuleText || "(none)",
    "",
    "## 已绑定 Capability 摘要",
    capabilitySection || "(none)",
    "",
    "## SOP",
    sopText,
    "",
    "## Final Prompt",
    finalPrompt || "(missing final prompt)",
    "",
    "## 拟修改文件",
    "- 本次只能输出计划，不得修改任何文件。",
    "",
    "## 分步实施方案",
    "- 先核对安全边界与约束。",
    "- 再列出拟修改文件与影响范围。",
    "- 最后给出验证方案。",
    "",
    "## 风险与安全边界",
    "- 发现与 Final Prompt 冲突时，必须在计划中指出，不得自行改文件解决。",
    "- 本次不得进入 Build、审批或 Agent 执行。",
    "",
    "## 验证方案",
    "- 说明建议的验证步骤，不实际执行写入。",
    "",
    "## 不在本次范围内的内容",
    "- Build",
    "- Agent 执行",
    "- 代码写入",
    "- 审批闭环",
    ""
  ].join("\n");
}

async function prepareOpenCodePlanStart({ repoRoot, projectId, taskId, runId, registryPath }) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) return taskRecord;

  const projectRoot = path.resolve(taskRecord.task.projectPath || taskRecord.task.projectpath || repoRoot);
  if (!fs.existsSync(projectRoot)) {
    return {
      ok: false,
      statusCode: 400,
      error: "project_root_not_found",
      details: [projectRoot]
    };
  }

  const finalPromptPath = getFinalPromptPath(repoRoot, taskId);
  const sopPath = getSopPath(repoRoot, taskId);
  const finalPrompt = readFileIfExists(finalPromptPath);
  if (!finalPrompt) {
    return {
      ok: false,
      statusCode: 400,
      error: "final_prompt_not_found",
      details: [path.relative(repoRoot, finalPromptPath)]
    };
  }

  const sopRaw = readFileIfExists(sopPath);
  if (!sopRaw) {
    return {
      ok: false,
      statusCode: 400,
      error: "sop_not_found",
      details: [path.relative(repoRoot, sopPath)]
    };
  }

  let sop;
  try {
    sop = JSON.parse(sopRaw);
  } catch (err) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_sop_json",
      details: [err.message]
    };
  }

  const binding = loadTaskCapabilityBinding(repoRoot, projectId, taskId, registryPath);
  if (!binding.ok || !Array.isArray(binding.capabilities) || !binding.capabilities.length) {
    return {
      ok: false,
      statusCode: 400,
      error: "no_capability_bound",
      details: binding.details || ["Task has no bound capabilities."]
    };
  }

  const registry = loadCapabilityRegistry(registryPath, repoRoot);
  if (!registry.ok) return registry;

  const opencodeCommand = resolveOpenCodeCmdCommand();
  if (!opencodeCommand.ok) {
    return {
      ok: false,
      statusCode: opencodeCommand.statusCode || 409,
      error: opencodeCommand.error || "opencode_environment_not_ready",
      reason: opencodeCommand.reason || "opencode_cli_unavailable",
      nextAction: opencodeCommand.nextAction || "manual_environment_check_required",
      details: opencodeCommand.details || []
    };
  }

  const preStatus = await runGit(projectRoot, ["status", "--short", "--untracked-files=no"]);
  const preHead = await runGit(projectRoot, ["rev-parse", "--short", "HEAD"]);
  const preBranch = await runGit(projectRoot, ["branch", "--show-current"]);
  const preSnapshot = buildGitSnapshot("pre", preStatus, preHead, preBranch);

  if (String(preSnapshot.statusShort || "").trim()) {
    return {
      ok: false,
      statusCode: 409,
      error: "project_worktree_not_clean",
      changedFiles: preSnapshot.changedFiles,
      baseline: {
        taskId,
        runId,
        projectId,
        projectRoot,
        pre: preSnapshot,
        post: null,
        safetyVerdict: "dirty_precondition"
      }
    };
  }

  const projectRules = [];
  const taskRules = [];
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

  const finalPromptContent = finalPrompt.trim();
  taskRules.push({
    label: "final-prompt.md",
    content: finalPromptContent
  });

  const promptText = buildPlanPrompt({
    repoRoot,
    task: taskRecord.task,
    projectId,
    finalPrompt: finalPromptContent,
    sop,
    capabilities: binding.capabilities,
    taskRules,
    projectRules
  });

  const runDir = path.dirname(getRunJsonPath(repoRoot, taskId, runId));
  const promptPath = getRunPromptPath(repoRoot, taskId, runId);
  const rawOutputPath = getRunRawOutputPath(repoRoot, taskId, runId);
  const stderrPath = path.join(runDir, "stderr.log");
  const baselinePath = getRunBaselinePath(repoRoot, taskId, runId);
  const timeoutMs = Number(process.env.AI_CODING_CONSOLE_OPENCODE_TIMEOUT_MS || 600000);
  const invocation = buildOpenCodePlanInvocation({
    opencodePath: opencodeCommand.command,
    promptPath
  });
  const createdAt = new Date().toISOString();
  const runRecord = {
    runId,
    taskId,
    projectId,
    agentType: "opencode",
    mode: "plan",
    status: "running",
    createdAt,
    startedAt: createdAt,
    finishedAt: null,
    sessionRef: null,
    exitCode: null,
    error: null,
    timeoutMs,
    stdoutBytes: 0,
    stderrBytes: 0,
    failureReason: null,
    planPath: path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId)),
    rawOutputPath: path.relative(repoRoot, rawOutputPath),
    outputFormat: "plain_stdout",
    promptPath: path.relative(repoRoot, promptPath),
    stderrPath: path.relative(repoRoot, stderrPath),
    baselinePath: path.relative(repoRoot, baselinePath),
    readOnlyEnforcement: "prompt_and_post_run_git_check",
    approvalStatus: "not_opened",
    diagnostics: {
      command: invocation.command,
      commandLine: invocation.commandLine,
      args: invocation.args,
      cwd: projectRoot,
      useShell: Boolean(invocation.useShell),
      inheritedUserEnv: true
    }
  };
  const baseline = {
    taskId,
    runId,
    projectId,
    projectRoot,
    readOnlyEnforcement: "prompt_and_post_run_git_check",
    safetyVerdict: "running",
    trackedChangesDetected: false,
    changedFiles: [],
    timeoutMs,
    stdoutBytes: 0,
    stderrBytes: 0,
    failureReason: null,
    pre: preSnapshot,
    post: null,
    opencode: {
      command: invocation.command,
      commandLine: invocation.commandLine,
      args: invocation.args,
      cwd: projectRoot,
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
    projectRoot,
    promptText,
    runRecord,
    baseline,
    paths: {
      runDir,
      promptPath,
      rawOutputPath,
      stderrPath,
      planPath: getRunPlanPath(repoRoot, taskId, runId),
      baselinePath,
      runJsonPath: getRunJsonPath(repoRoot, taskId, runId)
    }
  };
}

async function runOpenCodePlan({ repoRoot, projectId, taskId, runId, registryPath }) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) {
    return taskRecord;
  }
  const projectRoot = path.resolve(taskRecord.task.projectPath || taskRecord.task.projectpath || repoRoot);

  const finalPromptPath = getFinalPromptPath(repoRoot, taskId);
  const sopPath = getSopPath(repoRoot, taskId);
  const finalPrompt = readFileIfExists(finalPromptPath);
  if (!finalPrompt) {
    return {
      ok: false,
      statusCode: 400,
      error: "final_prompt_not_found",
      details: [path.relative(repoRoot, finalPromptPath)]
    };
  }

  const sopRaw = readFileIfExists(sopPath);
  if (!sopRaw) {
    return {
      ok: false,
      statusCode: 400,
      error: "sop_not_found",
      details: [path.relative(repoRoot, sopPath)]
    };
  }

  let sop;
  try {
    sop = JSON.parse(sopRaw);
  } catch (err) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_sop_json",
      details: [err.message]
    };
  }

  const binding = loadTaskCapabilityBinding(repoRoot, projectId, taskId, registryPath);
  if (!binding.ok || !Array.isArray(binding.capabilities) || !binding.capabilities.length) {
    return {
      ok: false,
      statusCode: 400,
      error: "no_capability_bound",
      details: binding.details || ["Task has no bound capabilities."]
    };
  }

  const registry = loadCapabilityRegistry(registryPath, repoRoot);
  if (!registry.ok) {
    return registry;
  }

  const projectRules = [];
  const taskRules = [];
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

  const finalPromptContent = finalPrompt.trim();
  taskRules.push({
    label: "final-prompt.md",
    content: finalPromptContent
  });

  const promptText = buildPlanPrompt({
    repoRoot,
    task: taskRecord.task,
    projectId,
    finalPrompt: finalPromptContent,
    sop,
    capabilities: binding.capabilities,
    taskRules,
    projectRules
  });

  const opencodeCommand = resolveOpenCodeCmdCommand();
  if (!opencodeCommand.ok) {
    return {
      ok: false,
      statusCode: opencodeCommand.statusCode || 409,
      error: opencodeCommand.error || "opencode_environment_not_ready",
      reason: opencodeCommand.reason || "opencode_cli_unavailable",
      nextAction: opencodeCommand.nextAction || "manual_environment_check_required",
      details: opencodeCommand.details || [],
      baseline: {
        taskId,
        runId,
        projectId,
        readOnlyEnforcement: "prompt_and_post_run_git_check",
        safetyVerdict: "environment_not_ready",
        pre: null,
        post: null,
        changedFiles: [],
        timeoutMs: null,
        stdoutBytes: 0,
        stderrBytes: 0,
        failureReason: "environment_not_ready",
        guard: {
          opencodeCommand: opencodeCommand.command || null
        }
      }
    };
  }

  const runDir = path.dirname(getRunJsonPath(repoRoot, taskId, runId));
  const promptPath = getRunPromptPath(repoRoot, taskId, runId);
  const rawOutputPath = getRunRawOutputPath(repoRoot, taskId, runId);
  const stderrPath = path.join(runDir, "stderr.log");
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(promptPath, promptText, "utf8");
  fs.writeFileSync(rawOutputPath, "", "utf8");
  fs.writeFileSync(stderrPath, "", "utf8");

  const preStatus = await runGit(projectRoot, ["status", "--short", "--untracked-files=no"]);
  const preHead = await runGit(projectRoot, ["rev-parse", "--short", "HEAD"]);
  const preBranch = await runGit(projectRoot, ["branch", "--show-current"]);
  const preSnapshot = buildGitSnapshot("pre", preStatus, preHead, preBranch);

  if (String(preSnapshot.statusShort || "").trim()) {
    return {
      ok: false,
      statusCode: 409,
      error: "project_worktree_not_clean",
      changedFiles: preSnapshot.changedFiles,
      baseline: {
        pre: preSnapshot,
        post: null,
        safetyVerdict: "dirty_precondition"
      }
    };
  }

  const invocation = buildOpenCodePlanInvocation({
    opencodePath: opencodeCommand.command,
    promptPath
  });
  const command = invocation.command;
  const args = invocation.args;

  const startedAt = new Date().toISOString();
  const timeoutMs = Number(process.env.AI_CODING_CONSOLE_OPENCODE_TIMEOUT_MS || 600000);
  const execResult = await runCommand(command, args, {
    cwd: projectRoot,
    env: { ...process.env },
    timeoutMs,
    rawOutputPath,
    stderrPath,
    useShell: invocation.useShell
  });
  const finishedAt = new Date().toISOString();

  const rawOutput = readText(rawOutputPath);
  const rawOutputRelativePath = path.relative(repoRoot, getRunRawOutputPath(repoRoot, taskId, runId));
  const stderrOutput = readText(stderrPath) || String(execResult.stderr || "");
  const planText = extractPlanFromPlainStdout(rawOutput || execResult.stdout || "", rawOutputRelativePath);

  const postStatus = await runGit(projectRoot, ["status", "--short", "--untracked-files=no"]);
  const postHead = await runGit(projectRoot, ["rev-parse", "--short", "HEAD"]);
  const postBranch = await runGit(projectRoot, ["branch", "--show-current"]);
  const postSnapshot = buildGitSnapshot("post", postStatus, postHead, postBranch);
  const trackedChangesDetected = Boolean(String(postSnapshot.statusShort || "").trim());

  const streamWriteFailed = Boolean(execResult.streamWriteFailure);
  const safetyVerdict = trackedChangesDetected
    ? "unsafe_modified"
    : (streamWriteFailed
      ? "failed"
      : (execResult.timedOut ? "timed_out" : (execResult.exitCode === 0 ? "completed" : "failed")));
  const status = trackedChangesDetected
    ? "unsafe_modified"
    : (streamWriteFailed
      ? "failed"
      : (execResult.timedOut ? "timed_out" : (execResult.exitCode === 0 ? "completed" : "failed")));
  const approvalStatus = status === "completed" ? "pending" : "not_opened";
  const runRecord = {
    runId,
    taskId,
    projectId,
    agentType: "opencode",
    mode: "plan",
    status,
    createdAt: startedAt,
    startedAt,
    finishedAt,
    sessionRef: null,
    exitCode: execResult.exitCode,
    error: status === "completed"
      ? null
      : (streamWriteFailed
        ? `runner_output_temp_directory_missing: ${execResult.streamWriteFailure.message}`.slice(0, 1000)
        : (execResult.timedOut ? "opencode_plan_timed_out" : (stderrOutput || execResult.error || "opencode_plan_failed")).trim().slice(0, 1000) || null),
    timeoutMs,
    stdoutBytes: execResult.stdoutBytes || 0,
    stderrBytes: execResult.stderrBytes || 0,
    failureReason: streamWriteFailed
      ? "runner_output_temp_directory_missing"
      : (execResult.timedOut ? "timeout" : (execResult.error ? "spawn_error" : (execResult.exitCode === 0 ? null : "non_zero_exit"))),
    planPath: path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId)),
    rawOutputPath: path.relative(repoRoot, getRunRawOutputPath(repoRoot, taskId, runId)),
    outputFormat: "plain_stdout",
    promptPath: path.relative(repoRoot, getRunPromptPath(repoRoot, taskId, runId)),
    baselinePath: path.relative(repoRoot, getRunBaselinePath(repoRoot, taskId, runId)),
    readOnlyEnforcement: "prompt_and_post_run_git_check",
    approvalStatus,
    diagnostics: {
      command,
      commandLine: invocation.commandLine,
      args,
      cwd: projectRoot,
      usesCmdExe: true,
      inheritedUserEnv: true
    }
  };

  const baseline = {
    taskId,
    runId,
    projectId,
    readOnlyEnforcement: "prompt_and_post_run_git_check",
    safetyVerdict,
    trackedChangesDetected,
    changedFiles: postSnapshot.changedFiles,
    timeoutMs,
    stdoutBytes: execResult.stdoutBytes || 0,
    stderrBytes: execResult.stderrBytes || 0,
    failureReason: streamWriteFailed
      ? "runner_output_temp_directory_missing"
      : (execResult.timedOut ? "timeout" : (execResult.error ? "spawn_error" : (execResult.exitCode === 0 ? null : "non_zero_exit"))),
    pre: preSnapshot,
    post: postSnapshot,
    opencode: {
      command,
      args,
      cwd: projectRoot,
      exitCode: execResult.exitCode,
      signal: execResult.signal || null,
      stderr: stderrOutput || "",
      sessionRef: null,
      streamWriteFailure: execResult.streamWriteFailure || null
    }
  };

  return {
    ok: true,
    runRecord,
    promptText,
    rawOutput,
    planText,
    baseline,
    status,
    approvalStatus,
    changedFiles: postSnapshot.changedFiles,
    trackedChangesDetected,
    exitCode: execResult.exitCode,
    error: execResult.exitCode === 0 ? null : execResult.stderr || null
  };
}

async function runOpenCodeSmoke({ repoRoot, timeoutMs = 10000 }) {
  const tempWorkspace = path.join(os.tmpdir(), `ai-coding-console-opencode-smoke-${Date.now()}`);
  const tempPromptPath = path.join(tempWorkspace, "prompt.md");
  const tempRawOutputPath = path.join(tempWorkspace, "agent-raw.log");
  const tempStderrPath = path.join(tempWorkspace, "opencode-stderr.log");
  fs.mkdirSync(tempWorkspace, { recursive: true });
  fs.writeFileSync(tempPromptPath, [
    "你正在执行 Plan-only Run。",
    "你只能读取、分析和输出计划。",
    "禁止创建、修改、删除、移动或重命名任何文件。",
    "## 实施计划",
    "### 验证方案",
    "- smoke"
  ].join("\n"), "utf8");
  fs.writeFileSync(tempRawOutputPath, "", "utf8");
  fs.writeFileSync(tempStderrPath, "", "utf8");

  const opencodeCommand = resolveOpenCodeCmdCommand();
  if (!opencodeCommand.ok) {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup failures.
    }
    return {
      ok: false,
      statusCode: opencodeCommand.statusCode || 409,
      error: opencodeCommand.error || "opencode_environment_not_ready",
      reason: opencodeCommand.reason || "opencode_cli_unavailable",
      nextAction: opencodeCommand.nextAction || "manual_environment_check_required",
      details: opencodeCommand.details || []
    };
  }

  const env = {
    ...process.env
  };

  const smokeInvocation = buildOpenCodePlanInvocation({
    opencodePath: opencodeCommand.command,
    promptPath: tempPromptPath
  });

  const startedAt = new Date().toISOString();
  const result = await runCommand(
    smokeInvocation.command,
    smokeInvocation.args,
    {
      cwd: repoRoot,
      env,
      timeoutMs,
      rawOutputPath: tempRawOutputPath,
      stderrPath: tempStderrPath,
      useShell: smokeInvocation.useShell
    }
  );
  const finishedAt = new Date().toISOString();

  return {
    ok: true,
    startedAt,
    finishedAt,
    command: smokeInvocation.command,
    args: smokeInvocation.commandLine,
    timeoutMs,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    failureReason: result.failureReason,
    stdoutBytes: result.stdoutBytes || 0,
    stderrBytes: result.stderrBytes || 0,
    stdoutPreview: String(result.stdout || "").slice(0, 1200),
    stderrPreview: String(result.stderr || "").slice(0, 1200),
    streamWriteFailure: result.streamWriteFailure || null
  };
}

function runOutputLifecycleSelfTest(repoRoot) {
  const testDir = path.join(repoRoot, "data", "ai-coding-console", "tmp-runner-selftest");
  const rawPath = path.join(testDir, "agent-raw.log");
  const stderrPath = path.join(testDir, "stderr.log");
  const records = [];
  let serverAlive = true;

  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  try {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(rawPath, "", "utf8");
    fs.writeFileSync(stderrPath, "", "utf8");
    fs.appendFileSync(rawPath, Buffer.from("{\"type\":\"text\",\"text\":\"hello\"}\n", "utf8"));
    records.push("write_ok");
    fs.appendFileSync(stderrPath, Buffer.from("stderr-line\n", "utf8"));
    records.push("stderr_ok");
    const rawBeforeCleanup = readText(rawPath);
    fs.rmSync(testDir, { recursive: true, force: true });
    let writeError = null;
    try {
      fs.appendFileSync(rawPath, Buffer.from("late-write", "utf8"));
    } catch (err) {
      writeError = {
        code: err.code || null,
        message: err.message || String(err)
      };
      records.push("late_write_failed");
    }
    return {
      ok: true,
      records,
      rawBeforeCleanup,
      writeError,
      serverAlive
    };
  } catch (err) {
    serverAlive = true;
    return {
      ok: false,
      records,
      error: err.message,
      serverAlive
    };
  } finally {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = {
  buildPlanPrompt,
  buildOpenCodePlanInvocation,
  prepareOpenCodePlanStart,
  extractPlanFromPlainStdout,
  quoteForCmd,
  resolveOpenCodeCmdCommand,
  runOutputLifecycleSelfTest,
  runOpenCodePlan,
  runOpenCodeSmoke
};
