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
  getRunPlanPath,
  getRunPromptPath,
  getRunRawOutputPath,
  getRunBaselinePath,
  isWithinRoot
} = require("./run-store");

function readText(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function normalizeAbs(p) {
  return path.resolve(p).toLowerCase();
}

function pathWithin(rootDir, candidatePath) {
  const root = normalizeAbs(rootDir);
  const candidate = normalizeAbs(candidatePath);
  return candidate === root || candidate.startsWith(root + path.sep);
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolve({ exitCode, signal, stdout, stderr });
    });
  });
}

function runGit(repoRoot, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: repoRoot,
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

function parseGitChangedFiles(statusOutput) {
  return String(statusOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^[MADRCU?!]{1,2}\s+(.*)$/);
      return match ? match[1].replace(/\\/g, "/") : line;
    });
}

function buildGitSnapshot(label, statusResult, headResult, branchResult) {
  const status = String(statusResult?.stdout || "").trim();
  return {
    label,
    statusShort: status,
    changedFiles: parseGitChangedFiles(status),
    head: String(headResult?.stdout || "").trim() || null,
    branch: String(branchResult?.stdout || "").trim() || null,
    exitCode: {
      status: statusResult?.exitCode ?? null,
      head: headResult?.exitCode ?? null,
      branch: branchResult?.exitCode ?? null
    }
  };
}

function extractTextFromJsonEvent(value, state) {
  if (!value || state.done) return;
  if (typeof value === "string") {
    if (state.captureText) {
      state.textChunks.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractTextFromJsonEvent(item, state);
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      if (/session/i.test(key) && !state.sessionRef) {
        state.sessionRef = entry;
      }
      if (/^(text|content|message|delta|output|markdown|plan|response|chunk)$/i.test(key)) {
        state.textChunks.push(entry);
      }
      continue;
    }

    if (entry && typeof entry === "object") {
      if (/session/i.test(key) && !state.sessionRef) {
        const nested = findStringByKey(entry, /session/i);
        if (nested) state.sessionRef = nested;
      }
      if (/^(data|payload|result|message|content|output|delta|event)$/i.test(key)) {
        extractTextFromJsonEvent(entry, state);
      } else {
        extractTextFromJsonEvent(entry, state);
      }
    }
  }
}

function findStringByKey(value, pattern) {
  if (!value || typeof value !== "object") return "";
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && pattern.test(key) && entry.trim()) {
      return entry;
    }
    if (entry && typeof entry === "object") {
      const nested = findStringByKey(entry, pattern);
      if (nested) return nested;
    }
  }
  return "";
}

function parsePlanFromRawOutput(rawOutput) {
  const lines = String(rawOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());

  const state = {
    captureText: true,
    textChunks: [],
    sessionRef: ""
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      extractTextFromJsonEvent(parsed, state);
    } catch (err) {
      state.textChunks.push(line);
    }
  }

  const text = state.textChunks
    .map((chunk) => String(chunk || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    text,
    sessionRef: state.sessionRef || findStringByKey({ rawOutput }, /session/i) || ""
  };
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

async function runOpenCodePlan({ repoRoot, projectId, taskId, runId, registryPath }) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) {
    return taskRecord;
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

  const tempWorkspace = path.join(os.tmpdir(), `ai-coding-console-opencode-${runId}`);
  const tempPromptPath = path.join(tempWorkspace, "prompt.md");
  fs.mkdirSync(tempWorkspace, { recursive: true });
  fs.writeFileSync(tempPromptPath, promptText, "utf8");

  const preStatus = await runGit(repoRoot, ["status", "--short", "--untracked-files=no"]);
  const preHead = await runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
  const preBranch = await runGit(repoRoot, ["branch", "--show-current"]);
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

  const configRoot = path.join(tempWorkspace, "config");
  const homeRoot = path.join(tempWorkspace, "home");
  const userProfileRoot = path.join(tempWorkspace, "userprofile");
  const tempRoot = path.join(tempWorkspace, "tmp");
  for (const dir of [configRoot, homeRoot, userProfileRoot, tempRoot]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const env = {
    ...process.env,
    USERPROFILE: userProfileRoot,
    HOME: homeRoot,
    XDG_CONFIG_HOME: configRoot,
    TEMP: tempRoot,
    TMP: tempRoot
  };

  const message = `Plan-only run ${taskId}`;
  const command = "cmd.exe";
  const args = [
    "/d",
    "/s",
    "/c",
    "opencode.cmd",
    "run",
    message,
    "--format",
    "json",
    "--file",
    tempPromptPath
  ];

  const startedAt = new Date().toISOString();
  const execResult = await runCommand(command, args, { cwd: repoRoot, env });
  const finishedAt = new Date().toISOString();

  const parsed = parsePlanFromRawOutput(execResult.stdout);
  const rawOutput = String(execResult.stdout || "");
  const planText = parsed.text && parsed.text.trim()
    ? parsed.text.trim()
    : [
        "# Plan extraction failed",
        "",
        "OpenCode did not expose a readable Markdown plan in stdout.",
        "",
        `Raw output path: ${path.relative(repoRoot, getRunRawOutputPath(repoRoot, taskId, runId))}`,
        "",
        "Inspect agent-raw.jsonl for the original JSONL stream."
      ].join("\n");

  const postStatus = await runGit(repoRoot, ["status", "--short", "--untracked-files=no"]);
  const postHead = await runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
  const postBranch = await runGit(repoRoot, ["branch", "--show-current"]);
  const postSnapshot = buildGitSnapshot("post", postStatus, postHead, postBranch);
  const trackedChangesDetected = Boolean(String(postSnapshot.statusShort || "").trim());

  const safetyVerdict = trackedChangesDetected ? "unsafe_modified" : (execResult.exitCode === 0 ? "completed" : "failed");
  const status = trackedChangesDetected ? "unsafe_modified" : (execResult.exitCode === 0 ? "completed" : "failed");
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
    sessionRef: parsed.sessionRef || null,
    exitCode: execResult.exitCode,
    error: execResult.exitCode === 0 ? null : (execResult.stderr || "opencode_plan_failed").trim().slice(0, 1000) || null,
    planPath: path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId)),
    rawOutputPath: path.relative(repoRoot, getRunRawOutputPath(repoRoot, taskId, runId)),
    promptPath: path.relative(repoRoot, getRunPromptPath(repoRoot, taskId, runId)),
    baselinePath: path.relative(repoRoot, getRunBaselinePath(repoRoot, taskId, runId)),
    readOnlyEnforcement: "prompt_and_post_run_git_check",
    approvalStatus,
    opencode: {
      command,
      args,
      tempPromptPath,
      tempWorkspace
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
    pre: preSnapshot,
    post: postSnapshot,
    opencode: {
      command,
      args,
      exitCode: execResult.exitCode,
      signal: execResult.signal || null,
      stderr: execResult.stderr || "",
      sessionRef: parsed.sessionRef || null
    }
  };

  try {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  } catch (err) {
    // Ignore cleanup failures.
  }

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

module.exports = {
  buildPlanPrompt,
  parsePlanFromRawOutput,
  runOpenCodePlan
};
