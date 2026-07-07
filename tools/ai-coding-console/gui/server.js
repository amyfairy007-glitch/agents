// AI Coding Desktop Console - GUI Server
// Phase C.5 - Local HTTP server, zero dependencies

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const {
  getCapabilityRegistryEntry,
  loadCapabilityRegistry
} = require("../lib/capability-registry");
const {
  isSafeTaskId,
  loadTaskCapabilityBinding,
  saveTaskCapabilityBinding,
  loadTaskRecord
} = require("../lib/task-capability-binding");
const { generateSop, loadTaskAndCapabilities, getStageConstraints } = require("../lib/task-sop-generator");
const {
  generateRunId,
  loadTaskRuns,
  loadTaskRun,
  getRunJsonPath,
  getRunPromptPath,
  getRunRawOutputPath,
  getRunPlanPath,
  getRunBaselinePath
} = require("../lib/run-store");
const { prepareOpenCodePlanStart, runOpenCodePlan } = require("../lib/opencode-plan-runner");
const { prepareOpenCodeBuildStart, runOpenCodeBuild } = require("../lib/opencode-build-runner");
const {
  generatePromptDraft,
  generateFinalPrompt,
  savePromptDraft,
  readExistingPromptDraft,
  regeneratePromptDraft,
  buildFinalPromptFromSaved,
  getPromptDraftPath,
  getFinalPromptPath,
  getSopPath,
  readFileIfExists,
  extractUserSupplement,
  writeFile
} = require("../lib/task-prompt-builder");

const PORT = 3456;
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const GUI_DIR = __dirname;
const DATA_DIR = path.join(REPO_ROOT, "data", "ai-coding-console");
const CONSOLE_PS1 = path.join(REPO_ROOT, "tools", "ai-coding-console", "cli", "console.ps1");
const MANIFEST_PATH = path.join(DATA_DIR, "projects-manifest.json");
const CAPABILITY_REGISTRY_PATH = path.join(DATA_DIR, "capability-registry.json");

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function execPS1(args) {
  return new Promise((resolve, reject) => {
    const child = execFile("powershell", [
      "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", CONSOLE_PS1,
      ...args
    ], { cwd: REPO_ROOT, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: stdout + "\n" + (stderr || err.message) });
        return;
      }
      resolve({ ok: true, output: stdout });
    });
  });
}

function serveStatic(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(filePath, "utf8"));
}

function sendJSON(res, data, status) {
  res.writeHead(status || 200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status) {
  sendJSON(res, { error: msg }, status || 500);
}

function writeJSONFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function persistRunningPlanRun(prepared) {
  fs.mkdirSync(prepared.paths.runDir, { recursive: true });
  fs.writeFileSync(prepared.paths.promptPath, prepared.promptText || "", "utf8");
  fs.writeFileSync(prepared.paths.rawOutputPath, "", "utf8");
  fs.writeFileSync(prepared.paths.stderrPath, "", "utf8");
  fs.writeFileSync(prepared.paths.planPath, "", "utf8");
  writeJSONFile(prepared.paths.baselinePath, prepared.baseline);
  writeJSONFile(prepared.paths.runJsonPath, prepared.runRecord);
}

function persistPlanRunResult(taskId, runId, result) {
  const runDir = path.dirname(getRunJsonPath(REPO_ROOT, taskId, runId));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(getRunPromptPath(REPO_ROOT, taskId, runId), result.promptText || "", "utf8");
  fs.writeFileSync(getRunRawOutputPath(REPO_ROOT, taskId, runId), result.rawOutput || "", "utf8");
  fs.writeFileSync(getRunPlanPath(REPO_ROOT, taskId, runId), result.planText || "", "utf8");
  writeJSONFile(getRunBaselinePath(REPO_ROOT, taskId, runId), result.baseline || {});
  writeJSONFile(getRunJsonPath(REPO_ROOT, taskId, runId), result.runRecord || {});
}

function persistRunningBuildRun(prepared) {
  fs.mkdirSync(prepared.paths.runDir, { recursive: true });
  fs.writeFileSync(prepared.paths.promptPath, prepared.promptText || "", "utf8");
  fs.writeFileSync(prepared.paths.rawOutputPath, "", "utf8");
  fs.writeFileSync(prepared.paths.stderrPath, "", "utf8");
  fs.writeFileSync(prepared.paths.planPath, "", "utf8");
  fs.writeFileSync(prepared.paths.buildLogPath, "", "utf8");
  fs.writeFileSync(prepared.paths.buildDiffPath, "", "utf8");
  writeJSONFile(prepared.paths.baselinePath, prepared.baseline);
  writeJSONFile(prepared.paths.runJsonPath, prepared.runRecord);
}

function persistBuildRunResult(taskId, runId, result) {
  // build.log, build-diff.txt, and agent-raw.jsonl are written to disk by the
  // build runner itself (build.log via direct write, raw via stream). Here we
  // only persist prompt, baseline, and the final run record.
  const runDir = path.dirname(getRunJsonPath(REPO_ROOT, taskId, runId));
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(getRunPromptPath(REPO_ROOT, taskId, runId), result.promptText || "", "utf8");
  writeJSONFile(getRunBaselinePath(REPO_ROOT, taskId, runId), result.baseline || {});
  writeJSONFile(getRunJsonPath(REPO_ROOT, taskId, runId), result.runRecord || {});
}

function persistBuildRunFailure(prepared, err) {
  const message = err && err.message ? err.message : String(err || "unknown_build_run_failure");
  const finishedAt = new Date().toISOString();
  const runRecord = {
    ...prepared.runRecord,
    status: "failed",
    finishedAt,
    error: message.slice(0, 1000),
    failureReason: "runner_internal_error",
    approvalStatus: "not_opened"
  };
  const baseline = {
    ...prepared.baseline,
    safetyVerdict: "failed",
    failureReason: "runner_internal_error",
    post: null,
    opencode: {
      ...(prepared.baseline && prepared.baseline.opencode ? prepared.baseline.opencode : {}),
      error: message.slice(0, 1000)
    }
  };
  try {
    writeJSONFile(prepared.paths.baselinePath, baseline);
    writeJSONFile(prepared.paths.runJsonPath, runRecord);
  } catch (writeErr) {
    console.error("Failed to persist Build Run failure:", writeErr.message);
  }
}

function persistPlanRunFailure(prepared, err) {
  const message = err && err.message ? err.message : String(err || "unknown_plan_run_failure");
  const finishedAt = new Date().toISOString();
  const runRecord = {
    ...prepared.runRecord,
    status: "failed",
    finishedAt,
    error: message.slice(0, 1000),
    failureReason: "runner_internal_error",
    approvalStatus: "not_opened"
  };
  const baseline = {
    ...prepared.baseline,
    safetyVerdict: "failed",
    failureReason: "runner_internal_error",
    post: null,
    opencode: {
      ...(prepared.baseline && prepared.baseline.opencode ? prepared.baseline.opencode : {}),
      error: message.slice(0, 1000)
    }
  };
  try {
    writeJSONFile(prepared.paths.baselinePath, baseline);
    writeJSONFile(prepared.paths.runJsonPath, runRecord);
  } catch (writeErr) {
    console.error("Failed to persist Plan Run failure:", writeErr.message);
  }
}

function isSafeProjectId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");
}

function getProjectTasks(projectId) {
  const tasksDir = path.join(DATA_DIR, "tasks");
  if (!fs.existsSync(tasksDir)) return [];
  const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
  const tasks = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const taskPath = path.join(tasksDir, e.name, "task.json");
    const task = readJSON(taskPath);
    if (!task) continue;
    if (task.projectId !== projectId && task.projectid !== projectId) continue;
    tasks.push(task);
  }
  tasks.sort((a, b) => {
    const ca = a.createdAt || a.createdat || "";
    const cb = b.createdAt || b.createdat || "";
    return cb.localeCompare(ca);
  });
  return tasks;
}

function getTaskDetail(taskId) {
  const taskDir = path.join(DATA_DIR, "tasks", taskId);
  const task = readJSON(path.join(taskDir, "task.json"));
  if (!task) return null;

  const runListing = loadTaskRuns(REPO_ROOT, task.projectId || task.projectid || "", taskId);
  const runs = runListing.ok ? runListing.runs : [];

  const approvals = [];
  const appDir = path.join(taskDir, "approvals");
  if (fs.existsSync(appDir)) {
    for (const af of fs.readdirSync(appDir)) {
      if (!af.endsWith(".json")) continue;
      const ad = readJSON(path.join(appDir, af));
      if (ad) approvals.push(ad);
    }
  }

  return { task, runs, approvals };
}

function getProjectInfo(projectId) {
  const manifest = readJSON(MANIFEST_PATH);
  if (!manifest || !manifest.projects) return null;
  return manifest.projects[projectId] || null;
}

function parseProjectStatus(statusOutput, projectRecord) {
  const summary = {
    gitBranch: null,
    gitDirty: null,
    gitRemote: projectRecord?.gitRemote || projectRecord?.gitremote || null,
    agentsMd: projectRecord?.hasAgentsMd || projectRecord?.hasagentsmd || false,
    aiMemory: projectRecord?.hasAiMemory || projectRecord?.hasaimemory || false,
    projectState: projectRecord?.takeoverStatus || projectRecord?.takeoverstatus || "unknown"
  };

  const lines = String(statusOutput || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const branchMatch = line.match(/(?:git\s*)?branch\s*[:=]\s*(.+)$/i);
    if (branchMatch && !summary.gitBranch) {
      summary.gitBranch = branchMatch[1].trim();
    }

    const remoteMatch = line.match(/(?:git\s*)?remote\s*[:=]\s*(.+)$/i);
    if (remoteMatch && !summary.gitRemote) {
      summary.gitRemote = remoteMatch[1].trim();
    }

    const dirtyMatch = line.match(/(?:git\s*)?(?:dirty|status)\s*[:=]\s*(.+)$/i);
    if (dirtyMatch && summary.gitDirty === null) {
      const value = dirtyMatch[1].trim().toLowerCase();
      summary.gitDirty = value.includes("dirty") || value.includes("modified") || value === "true" || value === "yes";
    }

    if (/dirty/i.test(line) && summary.gitDirty === null) {
      summary.gitDirty = true;
    }

    const agentsMatch = line.match(/AGENTS\.md.*?(present|missing|yes|no)/i);
    if (agentsMatch) {
      summary.agentsMd = /present|yes/i.test(agentsMatch[1]);
    }

    const memoryMatch = line.match(/\.ai\/?.*?(present|missing|yes|no)/i);
    if (memoryMatch) {
      summary.aiMemory = /present|yes/i.test(memoryMatch[1]);
    }

    const stateMatch = line.match(/(?:project\s*)?state\s*[:=]\s*(.+)$/i);
    if (stateMatch && summary.projectState === "unknown") {
      summary.projectState = stateMatch[1].trim();
    }
  }

  return summary;
}

// ===== Server =====

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:" + PORT);
  const p = url.pathname;
  const m = req.method;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (m === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // === Static ===
  if (p === "/" || p === "/index.html") {
    serveStatic(res, path.join(GUI_DIR, "index.html"), "text/html; charset=utf-8"); return;
  }
  if (p === "/app.js") {
    serveStatic(res, path.join(GUI_DIR, "app.js"), "application/javascript; charset=utf-8"); return;
  }

  // === API ===

  // GET /api/projects
  if (p === "/api/projects" && m === "GET") {
    const manifest = readJSON(MANIFEST_PATH);
    if (!manifest || !manifest.projects) { sendJSON(res, []); return; }
    const projects = [];
    for (const key of Object.keys(manifest.projects)) {
      const prj = manifest.projects[key];
      const summary = parseProjectStatus("", prj);
      projects.push({
        id: prj.id || key,
        displayName: prj.displayName || prj.displayname || key,
        rootPath: prj.rootPath || prj.rootpath || "",
        hasAiMemory: prj.hasAiMemory || prj.hasaimemory || false,
        hasAgentsMd: prj.hasAgentsMd || prj.hasagentsmd || false,
        gitRemote: prj.gitRemote || prj.gitremote || null,
        addedAt: prj.addedAt || prj.addedat || "",
        takeoverStatus: prj.takeoverStatus || prj.takeoverstatus || "unknown",
        statusSummary: summary
      });
    }
    sendJSON(res, projects);
    return;
  }

  // GET /api/projects/:id
  const projMatch = p.match(/^\/api\/projects\/(.+)$/);
  if (projMatch && m === "GET") {
    const pid = decodeURIComponent(projMatch[1]);
    const prj = getProjectInfo(pid);
    if (!prj) { sendError(res, "Project not found", 404); return; }
    execPS1(["project", "status", "--project", pid]).then(result => {
      const statusSummary = parseProjectStatus(result.output, prj);
      sendJSON(res, {
        id: prj.id || pid,
        displayName: prj.displayName || prj.displayname || pid,
        rootPath: prj.rootPath || prj.rootpath || "",
        hasAiMemory: prj.hasAiMemory || prj.hasaimemory || false,
        hasAgentsMd: prj.hasAgentsMd || prj.hasagentsmd || false,
        gitRemote: prj.gitRemote || prj.gitremote || null,
        addedAt: prj.addedAt || prj.addedat || "",
        takeoverStatus: prj.takeoverStatus || prj.takeoverstatus || "unknown",
        statusOutput: result.output,
        statusSummary
      });
    });
    return;
  }

  // GET /api/capabilities
  if (p === "/api/capabilities" && m === "GET") {
    const loaded = loadCapabilityRegistry(CAPABILITY_REGISTRY_PATH, REPO_ROOT);
    if (!loaded.ok) {
      sendJSON(res, {
        error: loaded.error,
        details: loaded.details || []
      }, loaded.statusCode || 500);
      return;
    }
    sendJSON(res, loaded.registry);
    return;
  }

  // GET /api/capabilities/:id
  const capabilityMatch = p.match(/^\/api\/capabilities\/([^/]+)$/);
  if (capabilityMatch && m === "GET") {
    const capabilityId = decodeURIComponent(capabilityMatch[1]);
    const loaded = getCapabilityRegistryEntry(CAPABILITY_REGISTRY_PATH, REPO_ROOT, capabilityId);
    if (!loaded.ok) {
      sendJSON(res, {
        error: loaded.error,
        details: loaded.details || []
      }, loaded.statusCode || 500);
      return;
    }
    sendJSON(res, loaded.entry);
    return;
  }

  // GET /api/tasks/:projectId
  const tasksListMatch = p.match(/^\/api\/tasks\/([^/]+)$/);
  if (tasksListMatch && m === "GET") {
    const pid = decodeURIComponent(tasksListMatch[1]);
    if (!isSafeProjectId(pid)) { sendError(res, "Invalid project id", 400); return; }
    const prj = getProjectInfo(pid);
    if (!prj) { sendJSON(res, []); return; }
    sendJSON(res, getProjectTasks(pid));
    return;
  }

  // GET /api/tasks/:projectId/:taskId
  const taskMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)$/);
  if (taskMatch && m === "GET") {
    const detail = getTaskDetail(decodeURIComponent(taskMatch[2]));
    if (!detail) { sendError(res, "Task not found", 404); return; }
    sendJSON(res, detail);
    return;
  }

  // GET/POST /api/tasks/:projectId/:taskId/capabilities
  const taskCapabilitiesMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/capabilities$/);
  if (taskCapabilitiesMatch) {
    const projectId = decodeURIComponent(taskCapabilitiesMatch[1]);
    const taskId = decodeURIComponent(taskCapabilitiesMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    if (m === "GET") {
      const loaded = loadTaskCapabilityBinding(REPO_ROOT, projectId, taskId, CAPABILITY_REGISTRY_PATH);
      if (!loaded.ok) {
        sendJSON(res, {
          error: loaded.error,
          details: loaded.details || [],
          invalidIds: loaded.invalidIds || []
        }, loaded.statusCode || 500);
        return;
      }
      sendJSON(res, loaded);
      return;
    }
    if (m === "POST") {
      let body = "";
      req.on("data", d => body += d);
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            sendJSON(res, { error: "invalid_request_body" }, 400);
            return;
          }
          const result = saveTaskCapabilityBinding(
            REPO_ROOT,
            projectId,
            taskId,
            parsed.capabilityIds,
            CAPABILITY_REGISTRY_PATH
          );
          if (!result.ok) {
            sendJSON(res, {
              error: result.error,
              details: result.details || [],
              invalidIds: result.invalidIds || []
            }, result.statusCode || 500);
            return;
          }
          sendJSON(res, result);
        } catch (err) {
          sendJSON(res, { error: "invalid_request_body", details: [err.message] }, 400);
        }
      });
      return;
    }
  }

  // GET /api/tasks/:projectId/:taskId/prompt-sop
  const promptSopGetMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/prompt-sop$/);
  if (promptSopGetMatch && m === "GET") {
    const projectId = decodeURIComponent(promptSopGetMatch[1]);
    const taskId = decodeURIComponent(promptSopGetMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    const sopRaw = readFileIfExists(getSopPath(REPO_ROOT, taskId));
    const promptDraft = readExistingPromptDraft(REPO_ROOT, taskId);
    const finalPrompt = readFileIfExists(getFinalPromptPath(REPO_ROOT, taskId));

    let sop = null;
    if (sopRaw) {
      try { sop = JSON.parse(sopRaw); } catch (e) { sop = null; }
    }

    const hasGeneratedContent = !!(sop || promptDraft || finalPrompt);

    sendJSON(res, {
      taskId,
      sop,
      promptDraft: promptDraft || null,
      finalPrompt: finalPrompt || null,
      hasGeneratedContent
    });
    return;
  }

  // POST /api/tasks/:projectId/:taskId/prompt-sop/generate
  const promptSopGenerateMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/prompt-sop\/generate$/);
  if (promptSopGenerateMatch && m === "POST") {
    const projectId = decodeURIComponent(promptSopGenerateMatch[1]);
    const taskId = decodeURIComponent(promptSopGenerateMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const regenerate = parsed && parsed.regenerate === true;

        const loaded = loadTaskAndCapabilities(REPO_ROOT, projectId, taskId, CAPABILITY_REGISTRY_PATH);
        if (!loaded.ok) {
          const taskCheck = loadTaskRecord(REPO_ROOT, projectId, taskId);
          if (!taskCheck.ok) {
            sendJSON(res, { error: "task_not_found", details: [taskCheck.error] }, 404);
          } else {
            sendJSON(res, { error: "no_capability_bound", details: loaded.details || [] }, 400);
          }
          return;
        }

        if (!loaded.capabilities || loaded.capabilities.length === 0) {
          sendJSON(res, { error: "no_capability_bound", details: ["Task has no bound capabilities"] }, 400);
          return;
        }

        const sop = generateSop(REPO_ROOT, loaded.task, projectId, loaded.capabilities);
        writeFile(getSopPath(REPO_ROOT, taskId), JSON.stringify(sop, null, 2) + "\n");

        let promptDraft;
        if (regenerate) {
          promptDraft = regeneratePromptDraft(REPO_ROOT, taskId, loaded.task, projectId, loaded.capabilities);
        } else {
          const existing = readExistingPromptDraft(REPO_ROOT, taskId);
          if (existing) {
            sendJSON(res, {
              ok: true,
              taskId,
              sop,
              promptDraft: existing,
              hasGeneratedContent: true,
              note: "draft_already_exists_use_regenerate"
            });
            return;
          }
          promptDraft = generatePromptDraft(loaded.task, projectId, loaded.capabilities);
        }

        savePromptDraft(REPO_ROOT, taskId, promptDraft);

        sendJSON(res, {
          ok: true,
          taskId,
          sop,
          promptDraft,
          hasGeneratedContent: true
        });
      } catch (err) {
        sendJSON(res, { error: "generate_failed", details: [err.message] }, 500);
      }
    });
    return;
  }

  // POST /api/tasks/:projectId/:taskId/prompt-sop/draft
  const promptSopDraftMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/prompt-sop\/draft$/);
  if (promptSopDraftMatch && m === "POST") {
    const projectId = decodeURIComponent(promptSopDraftMatch[1]);
    const taskId = decodeURIComponent(promptSopDraftMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const promptDraft = parsed && parsed.promptDraft;
        if (typeof promptDraft !== "string" || !promptDraft.trim()) {
          sendJSON(res, { error: "invalid_request_body", details: ["promptDraft must be a non-empty string"] }, 400);
          return;
        }

        const taskCheck = loadTaskRecord(REPO_ROOT, projectId, taskId);
        if (!taskCheck.ok) {
          sendJSON(res, { error: "task_not_found", details: [taskCheck.error] }, 404);
          return;
        }

        savePromptDraft(REPO_ROOT, taskId, promptDraft);
        sendJSON(res, { ok: true, taskId, promptDraft });
      } catch (err) {
        sendJSON(res, { error: "invalid_request_body", details: [err.message] }, 400);
      }
    });
    return;
  }

  // POST /api/tasks/:projectId/:taskId/prompt-sop/finalize
const promptSopFinalizeMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/prompt-sop\/finalize$/);
  if (promptSopFinalizeMatch && m === "POST") {
    const projectId = decodeURIComponent(promptSopFinalizeMatch[1]);
    const taskId = decodeURIComponent(promptSopFinalizeMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      try {
        const taskCheck = loadTaskRecord(REPO_ROOT, projectId, taskId);
        if (!taskCheck.ok) {
          sendJSON(res, { error: "task_not_found", details: [taskCheck.error] }, 404);
          return;
        }

        const sopRaw = readFileIfExists(getSopPath(REPO_ROOT, taskId));
        if (!sopRaw) {
          sendJSON(res, { error: "sop_not_generated", details: ["Generate SOP first before finalizing prompt"] }, 400);
          return;
        }
        let sop;
        try { sop = JSON.parse(sopRaw); } catch (e) {
          sendJSON(res, { error: "invalid_sop_json", details: [e.message] }, 500);
          return;
        }

        const binding = loadTaskCapabilityBinding(REPO_ROOT, projectId, taskId, CAPABILITY_REGISTRY_PATH);
        if (!binding.ok || !binding.capabilities || binding.capabilities.length === 0) {
          sendJSON(res, { error: "no_capability_bound", details: ["Task has no bound capabilities"] }, 400);
          return;
        }

        const promptDraft = readExistingPromptDraft(REPO_ROOT, taskId);
        if (!promptDraft) {
          sendJSON(res, { error: "prompt_draft_not_found", details: ["Prompt draft not found"] }, 400);
          return;
        }

        const userSupplement = extractUserSupplement(promptDraft);
        const finalPrompt = generateFinalPrompt(
          taskCheck.task, projectId, binding.capabilities, sop, promptDraft, userSupplement
        );

        writeFile(getFinalPromptPath(REPO_ROOT, taskId), finalPrompt);

        sendJSON(res, {
          ok: true,
          taskId,
          finalPrompt,
          sop
        });
      } catch (err) {
        sendJSON(res, { error: "finalize_failed", details: [err.message] }, 500);
      }
    });
    return;
  }

  // GET /api/tasks/:projectId/:taskId/runs
  const runsListMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/runs$/);
  if (runsListMatch && m === "GET") {
    const projectId = decodeURIComponent(runsListMatch[1]);
    const taskId = decodeURIComponent(runsListMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    const loaded = loadTaskRuns(REPO_ROOT, projectId, taskId);
    if (!loaded.ok) {
      sendJSON(res, {
        error: loaded.error,
        details: loaded.details || []
      }, loaded.statusCode || 500);
      return;
    }
    sendJSON(res, {
      taskId,
      projectId,
      runs: loaded.runs || []
    });
    return;
  }

  // GET /api/tasks/:projectId/:taskId/runs/:runId
  const runDetailMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/runs\/([^/]+)$/);
  if (runDetailMatch && m === "GET") {
    const projectId = decodeURIComponent(runDetailMatch[1]);
    const taskId = decodeURIComponent(runDetailMatch[2]);
    const runId = decodeURIComponent(runDetailMatch[3]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }
    const loaded = loadTaskRun(REPO_ROOT, projectId, taskId, runId);
    if (!loaded.ok) {
      sendJSON(res, {
        error: loaded.error,
        details: loaded.details || []
      }, loaded.statusCode || 500);
      return;
    }
    sendJSON(res, loaded);
    return;
  }

  // POST /api/tasks/:projectId/:taskId/runs/plan
  const planRunMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/runs\/plan$/);
  if (planRunMatch && m === "POST") {
    const projectId = decodeURIComponent(planRunMatch[1]);
    const taskId = decodeURIComponent(planRunMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }

    const runId = generateRunId(REPO_ROOT, taskId, "plan");
    prepareOpenCodePlanStart({
      repoRoot: REPO_ROOT,
      projectId,
      taskId,
      runId,
      registryPath: CAPABILITY_REGISTRY_PATH
    }).then((prepared) => {
      if (!prepared.ok) {
        sendJSON(res, {
          error: prepared.error,
          details: prepared.details || [],
          changedFiles: prepared.changedFiles || [],
          baseline: prepared.baseline || null,
          reason: prepared.reason || null,
          nextAction: prepared.nextAction || null
        }, prepared.statusCode || 500);
        return;
      }

      try {
        persistRunningPlanRun(prepared);
      } catch (err) {
        sendJSON(res, {
          error: "plan_run_start_persist_failed",
          details: [err.message],
          runId
        }, 500);
        return;
      }

      runOpenCodePlan({
        repoRoot: REPO_ROOT,
        projectId,
        taskId,
        runId,
        registryPath: CAPABILITY_REGISTRY_PATH
      }).then((result) => {
        if (!result.ok) {
          persistPlanRunFailure(prepared, new Error(result.error || "plan_run_failed"));
          return;
        }
        persistPlanRunResult(taskId, runId, result);
      }).catch((err) => {
        persistPlanRunFailure(prepared, err);
      });

      sendJSON(res, {
        ok: true,
        runId,
        status: "running",
        run: prepared.runRecord,
        summary: {
          runId,
          status: "running",
          approvalStatus: prepared.runRecord.approvalStatus,
          exitCode: null,
          sessionRef: null,
          planPath: prepared.runRecord.planPath,
          rawOutputPath: prepared.runRecord.rawOutputPath,
          promptPath: prepared.runRecord.promptPath,
          baselinePath: prepared.runRecord.baselinePath,
          changedFiles: [],
          trackedChangesDetected: false
        }
      }, 202);
    }).catch((err) => {
      sendJSON(res, {
        error: "plan_run_start_failed",
        details: [err.message]
      }, 500);
    });
    return;
  }

  // POST /api/tasks/:projectId/:taskId/runs/build
  const buildRunMatch = p.match(/^\/api\/tasks\/([^/]+)\/([^/]+)\/runs\/build$/);
  if (buildRunMatch && m === "POST") {
    const projectId = decodeURIComponent(buildRunMatch[1]);
    const taskId = decodeURIComponent(buildRunMatch[2]);
    if (!isSafeProjectId(projectId) || !isSafeTaskId(taskId)) {
      sendJSON(res, { error: "invalid_task_route" }, 400);
      return;
    }

    const runId = generateRunId(REPO_ROOT, taskId, "build");
    prepareOpenCodeBuildStart({
      repoRoot: REPO_ROOT,
      projectId,
      taskId,
      runId,
      registryPath: CAPABILITY_REGISTRY_PATH
    }).then((prepared) => {
      if (!prepared.ok) {
        sendJSON(res, {
          error: prepared.error,
          details: prepared.details || [],
          reason: prepared.reason || null,
          nextAction: prepared.nextAction || null,
          baseline: prepared.baseline || null
        }, prepared.statusCode || 500);
        return;
      }

      try {
        persistRunningBuildRun(prepared);
      } catch (err) {
        sendJSON(res, {
          error: "build_run_start_persist_failed",
          details: [err.message],
          runId
        }, 500);
        return;
      }

      runOpenCodeBuild({
        repoRoot: REPO_ROOT,
        projectId,
        taskId,
        runId,
        registryPath: CAPABILITY_REGISTRY_PATH
      }).then((result) => {
        if (!result.ok) {
          persistBuildRunFailure(prepared, new Error(result.error || "build_run_failed"));
          return;
        }
        persistBuildRunResult(taskId, runId, result);
      }).catch((err) => {
        persistBuildRunFailure(prepared, err);
      });

      sendJSON(res, {
        ok: true,
        runId,
        status: "running",
        run: prepared.runRecord,
        summary: {
          runId,
          status: "running",
          mode: "build",
          approvalStatus: prepared.runRecord.approvalStatus,
          exitCode: null,
          sessionRef: null,
          planPath: prepared.runRecord.planPath,
          rawOutputPath: prepared.runRecord.rawOutputPath,
          promptPath: prepared.runRecord.promptPath,
          baselinePath: prepared.runRecord.baselinePath,
          changedFiles: [],
          trackedChangesDetected: false
        }
      }, 202);
    }).catch((err) => {
      sendJSON(res, {
        error: "build_run_start_failed",
        details: [err.message]
      }, 500);
    });
    return;
  }

  // GET /api/board/:projectId
  const boardMatch = p.match(/^\/api\/board\/(.+)$/);
  if (boardMatch && m === "GET") {
    const pid = decodeURIComponent(boardMatch[1]);
    if (!isSafeProjectId(pid)) { sendError(res, "Invalid project id", 400); return; }
    execPS1(["board", "show", "--project", pid]).then(() => {
      const boardDir = path.join(DATA_DIR, "board");
      const boardFile = path.join(boardDir, pid + "-board.md");
      if (fs.existsSync(boardFile)) {
        sendJSON(res, { content: fs.readFileSync(boardFile, "utf8") });
      } else {
        sendJSON(res, { content: "# No board generated yet." });
      }
    });
    return;
  }

  // POST /api/tasks/create
  if (p === "/api/tasks/create" && m === "POST") {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", async () => {
      try {
        const { projectId, desc } = JSON.parse(body);
        if (!projectId || !desc) { sendError(res, "Missing projectId or desc", 400); return; }
        if (!isSafeProjectId(projectId)) { sendError(res, "Invalid project id", 400); return; }
        const result = await execPS1(["task", "create", "--project", projectId, "--desc", desc]);
        if (result.ok) {
          const tid = result.output.match(/T-\d{8}-\d{3}/)?.[0] || "";
          sendJSON(res, { ok: true, taskId: tid, output: result.output });
        } else {
          sendJSON(res, { ok: false, output: result.output }, 400);
        }
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // POST /api/tasks/:id/approve
  const approveMatch = p.match(/^\/api\/tasks\/([^/]+)\/approve$/);
  if (approveMatch && m === "POST") {
    const tid = decodeURIComponent(approveMatch[1]);
    if (!isSafeTaskId(tid)) { sendError(res, "Invalid task id", 400); return; }
    let body = "";
    req.on("data", d => body += d);
    req.on("end", async () => {
      try {
        const { reject } = JSON.parse(body || "{}");
        const args = ["task", "approve", "--task", tid];
        if (reject) args.push("--reject");
        const result = await execPS1(args);
        sendJSON(res, { ok: result.ok, output: result.output });
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // POST /api/tasks/:id/review
  const reviewMatch = p.match(/^\/api\/tasks\/([^/]+)\/review$/);
  if (reviewMatch && m === "POST") {
    const tid = decodeURIComponent(reviewMatch[1]);
    if (!isSafeTaskId(tid)) { sendError(res, "Invalid task id", 400); return; }
    let body = "";
    req.on("data", d => body += d);
    req.on("end", async () => {
      try {
        const { reject } = JSON.parse(body || "{}");
        const args = ["task", "review", "--task", tid];
        if (reject) args.push("--reject");
        const result = await execPS1(args);
        sendJSON(res, { ok: result.ok, output: result.output });
      } catch (e) { sendError(res, e.message); }
    });
    return;
  }

  // POST /api/tasks/:id/close
  const closeMatch = p.match(/^\/api\/tasks\/([^/]+)\/close$/);
  if (closeMatch && m === "POST") {
    const tid = decodeURIComponent(closeMatch[1]);
    if (!isSafeTaskId(tid)) { sendError(res, "Invalid task id", 400); return; }
    execPS1(["task", "close", "--task", tid]).then(result => {
      sendJSON(res, { ok: result.ok, output: result.output });
    });
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("AI Coding Console GUI: http://localhost:" + PORT);
  console.log("Press Ctrl+C to stop.");
});
