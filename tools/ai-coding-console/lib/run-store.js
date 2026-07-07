const fs = require("fs");
const path = require("path");
const { isSafeTaskId, loadTaskRecord } = require("./task-capability-binding");

const RUN_ID_PATTERN = /^RUN-\d{8}-\d{3}-(plan|build)$/;

function normalizeAbs(p) {
  return path.resolve(p).toLowerCase();
}

function isWithinRoot(rootDir, candidatePath) {
  const root = normalizeAbs(rootDir);
  const candidate = normalizeAbs(candidatePath);
  return candidate === root || candidate.startsWith(root + path.sep);
}

function isSafeRunId(runId) {
  return typeof runId === "string" && RUN_ID_PATTERN.test(runId) && !runId.includes("..");
}

function getTasksRoot(repoRoot) {
  return path.join(repoRoot, "data", "ai-coding-console", "tasks");
}

function getTaskDir(repoRoot, taskId) {
  return path.join(getTasksRoot(repoRoot), taskId);
}

function getRunsDir(repoRoot, taskId) {
  return path.join(getTaskDir(repoRoot, taskId), "runs");
}

function getRunDir(repoRoot, taskId, runId) {
  return path.join(getRunsDir(repoRoot, taskId), runId);
}

function getRunJsonPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "run.json");
}

function getRunPromptPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "prompt.md");
}

function getRunRawOutputPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "agent-raw.jsonl");
}

function getRunPlanPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "plan.md");
}

function getRunBaselinePath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "baseline.json");
}

function getRunBuildLogPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "build.log");
}

function getRunBuildDiffPath(repoRoot, taskId, runId) {
  return path.join(getRunDir(repoRoot, taskId, runId), "build-diff.txt");
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, exists: false, error: null, value: null };
  }

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  try {
    return { ok: true, exists: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, exists: true, error: err.message, value: null };
  }
}

function readTextFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function getRunDirectories(repoRoot, taskId) {
  const runsDir = getRunsDir(repoRoot, taskId);
  if (!fs.existsSync(runsDir)) return [];

  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isSafeRunId(entry.name))
    .map((entry) => entry.name);
}

function generateRunId(repoRoot, taskId, mode) {
  const prefix = mode === "plan" ? "RUN-" : `RUN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-`;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const pattern = mode === "plan"
    ? new RegExp(`^RUN-${today}-(\\d{3})-plan$`)
    : new RegExp(`^RUN-${today}-(\\d{3})-${String(mode || "plan").replace(/[^A-Za-z0-9._-]/g, "")}$`);

  let nextSeq = 1;
  for (const runId of getRunDirectories(repoRoot, taskId)) {
    const match = runId.match(pattern);
    if (!match) continue;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq >= nextSeq) {
      nextSeq = seq + 1;
    }
  }

  const seqText = String(nextSeq).padStart(3, "0");
  return `RUN-${today}-${seqText}-${mode || "plan"}`;
}

function summarizeRunRecord(repoRoot, taskId, runId, runRecord, baselineRecord, planText, rawText) {
  const runDir = getRunDir(repoRoot, taskId, runId);
  const planPath = path.relative(repoRoot, getRunPlanPath(repoRoot, taskId, runId));
  const rawPath = path.relative(repoRoot, getRunRawOutputPath(repoRoot, taskId, runId));
  const baselinePath = path.relative(repoRoot, getRunBaselinePath(repoRoot, taskId, runId));
  const promptPath = path.relative(repoRoot, getRunPromptPath(repoRoot, taskId, runId));

  return {
    runId,
    taskId: runRecord.taskId || taskId,
    projectId: runRecord.projectId || null,
    agentType: runRecord.agentType || "opencode",
    mode: runRecord.mode || "plan",
    status: runRecord.status || "unknown",
    createdAt: runRecord.createdAt || null,
    startedAt: runRecord.startedAt || null,
    finishedAt: runRecord.finishedAt || null,
    sessionRef: runRecord.sessionRef || null,
    exitCode: typeof runRecord.exitCode === "number" ? runRecord.exitCode : null,
    error: runRecord.error || null,
    timeoutMs: typeof runRecord.timeoutMs === "number" ? runRecord.timeoutMs : null,
    stdoutBytes: typeof runRecord.stdoutBytes === "number" ? runRecord.stdoutBytes : null,
    stderrBytes: typeof runRecord.stderrBytes === "number" ? runRecord.stderrBytes : null,
    failureReason: runRecord.failureReason || null,
    planPath,
    rawOutputPath: rawPath,
    promptPath,
    baselinePath,
    approvalStatus: runRecord.approvalStatus || null,
    readOnlyEnforcement: runRecord.readOnlyEnforcement || null,
    changedFiles: baselineRecord && Array.isArray(baselineRecord.changedFiles) ? baselineRecord.changedFiles : [],
    trackedChangesDetected: baselineRecord ? Boolean(baselineRecord.trackedChangesDetected) : false,
    hasPlan: Boolean(planText && planText.trim()),
    hasRawOutput: Boolean(rawText && rawText.trim()),
    planPreview: planText ? planText.trim().slice(0, 500) : "",
    rawPreview: rawText ? rawText.trim().slice(0, 240) : "",
    baseline: baselineRecord || null,
    runDir
  };
}

function loadTaskRuns(repoRoot, projectId, taskId) {
  if (!isSafeTaskId(taskId)) {
    return { ok: false, statusCode: 400, error: "invalid_task_id" };
  }

  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) return taskRecord;

  const runsDir = getRunsDir(repoRoot, taskId);
  if (!fs.existsSync(runsDir)) {
    return { ok: true, taskId, projectId, runs: [] };
  }

  const runs = [];
  for (const runId of getRunDirectories(repoRoot, taskId)) {
    const runJsonPath = getRunJsonPath(repoRoot, taskId, runId);
    const runFile = readJsonFileIfExists(runJsonPath);
    if (!runFile.ok || !runFile.value) continue;

    const planText = readTextFileIfExists(getRunPlanPath(repoRoot, taskId, runId)) || "";
    const rawText = readTextFileIfExists(getRunRawOutputPath(repoRoot, taskId, runId)) || "";
    const baselineRecord = readJsonFileIfExists(getRunBaselinePath(repoRoot, taskId, runId));
    runs.push(summarizeRunRecord(
      repoRoot,
      taskId,
      runId,
      runFile.value,
      baselineRecord.ok ? baselineRecord.value : null,
      planText,
      rawText
    ));
  }

  runs.sort((a, b) => {
    const ta = a.createdAt || a.startedAt || "";
    const tb = b.createdAt || b.startedAt || "";
    if (ta !== tb) return tb.localeCompare(ta);
    return String(b.runId || "").localeCompare(String(a.runId || ""));
  });

  return { ok: true, taskId, projectId, runs };
}

function loadTaskRun(repoRoot, projectId, taskId, runId) {
  if (!isSafeTaskId(taskId) || !isSafeRunId(runId)) {
    return { ok: false, statusCode: 400, error: "invalid_run_route" };
  }

  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) return taskRecord;

  const runDir = getRunDir(repoRoot, taskId, runId);
  if (!isWithinRoot(repoRoot, runDir)) {
    return { ok: false, statusCode: 400, error: "invalid_run_path" };
  }

  const runJsonPath = getRunJsonPath(repoRoot, taskId, runId);
  if (!fs.existsSync(runJsonPath)) {
    return { ok: false, statusCode: 404, error: "run_not_found" };
  }

  const runFile = readJsonFileIfExists(runJsonPath);
  if (!runFile.ok) {
    return { ok: false, statusCode: 500, error: "invalid_run_json", details: [runFile.error] };
  }

  const planText = readTextFileIfExists(getRunPlanPath(repoRoot, taskId, runId)) || "";
  const rawText = readTextFileIfExists(getRunRawOutputPath(repoRoot, taskId, runId)) || "";
  const promptText = readTextFileIfExists(getRunPromptPath(repoRoot, taskId, runId)) || "";
  const baselineFile = readJsonFileIfExists(getRunBaselinePath(repoRoot, taskId, runId));

  return {
    ok: true,
    taskId,
    projectId,
    runId,
    run: runFile.value,
    prompt: promptText,
    plan: planText,
    rawOutput: rawText,
    baseline: baselineFile.ok ? baselineFile.value : null,
    summary: summarizeRunRecord(
      repoRoot,
      taskId,
      runId,
      runFile.value,
      baselineFile.ok ? baselineFile.value : null,
      planText,
      rawText
    )
  };
}

module.exports = {
  generateRunId,
  getRunBaselinePath,
  getRunBuildLogPath,
  getRunBuildDiffPath,
  getRunDir,
  getRunJsonPath,
  getRunPlanPath,
  getRunPromptPath,
  getRunRawOutputPath,
  getRunsDir,
  isSafeRunId,
  isWithinRoot,
  loadTaskRun,
  loadTaskRuns,
  readJsonFileIfExists,
  readTextFileIfExists
};
