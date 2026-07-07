// AI Coding Console - Shared Agent Runner Core
// Extracted from opencode-plan-runner.js so Plan and Build runs share one
// implementation of process spawning, Git snapshots, output persistence,
// and JSONL plan/text extraction.

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJsonFile(filePath, value) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function quoteWindowsArg(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '\\"')}"`;
}

function terminalRunStatus(status) {
  return ["completed", "failed", "timed_out", "unsafe_modified"].includes(String(status || ""));
}

function runCommand(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const rawOutputPath = options.rawOutputPath || null;
    const stderrPath = options.stderrPath || null;
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 600000;
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let failureReason = null;
    let finished = false;
    let timeoutHandle = null;
    let killTimer = null;
    let forcedFinalizeTimer = null;
    let streamWriteFailure = null;

    const stopForWriteFailure = (channel, err) => {
      if (finished || streamWriteFailure) return;
      streamWriteFailure = {
        channel,
        message: err && err.message ? err.message : String(err || "unknown_write_error")
      };
      failureReason = "runner_output_temp_directory_missing";
      try {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.end();
        }
      } catch {}
      forceKillTree();
    };

    const appendChunkSafe = (targetPath, chunk, channel) => {
      if (!targetPath) return;
      try {
        ensureParentDir(targetPath);
        fs.appendFileSync(targetPath, chunk);
      } catch (err) {
        stopForWriteFailure(channel, err);
      }
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      stdoutBytes += Buffer.byteLength(chunk);
      appendChunkSafe(rawOutputPath, chunk, "stdout");
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      stderrBytes += Buffer.byteLength(chunk);
      appendChunkSafe(stderrPath, chunk, "stderr");
    });

    if (child.stdin) {
      child.stdin.end();
    }

    const finalize = (payload) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (killTimer) clearTimeout(killTimer);
      if (forcedFinalizeTimer) clearTimeout(forcedFinalizeTimer);
      try { child.stdout?.removeAllListeners(); } catch {}
      try { child.stderr?.removeAllListeners(); } catch {}
      try { child.stdin?.removeAllListeners(); } catch {}
      try { child.stdout?.destroy(); } catch {}
      try { child.stderr?.destroy(); } catch {}
      try { child.stdin?.destroy(); } catch {}
      try { child.removeAllListeners(); } catch {}
      resolve({
        exitCode: payload.exitCode ?? null,
        signal: payload.signal ?? null,
        stdout: payload.stdout ?? stdout,
        stderr: payload.stderr ?? stderr,
        stdoutBytes,
        stderrBytes,
        timedOut,
        failureReason,
        error: payload.error || null,
        streamWriteFailure
      });
    };

    const forceKillTree = () => {
      if (!child.pid) return;
      try {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          windowsHide: true,
          shell: false,
          stdio: "ignore"
        });
        killer.on("error", () => {});
      } catch (err) {
        // Ignore best-effort kill failures; the forced finalize fallback below will still close the run.
      }
    };

    child.on("error", (err) => {
      failureReason = `spawn_error: ${err.message}`;
      finalize({ exitCode: null, signal: null, error: err.message });
    });

    child.on("close", (exitCode, signal) => {
      finalize({ exitCode, signal });
    });

    timeoutHandle = setTimeout(() => {
      if (finished) return;
      timedOut = true;
      failureReason = "timeout";
      forceKillTree();

      killTimer = setTimeout(() => {
        if (finished) return;
        forceKillTree();
      }, 2000);

      forcedFinalizeTimer = setTimeout(() => {
        if (finished) return;
        finalize({
          exitCode: null,
          signal: "timeout",
          error: "timeout_kill_pending"
        });
      }, 5000);
    }, timeoutMs);
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

async function captureGitSnapshot(label, projectRoot) {
  const statusResult = await runGit(projectRoot, ["status", "--short", "--untracked-files=no"]);
  const headResult = await runGit(projectRoot, ["rev-parse", "--short", "HEAD"]);
  const branchResult = await runGit(projectRoot, ["branch", "--show-current"]);
  return buildGitSnapshot(label, statusResult, headResult, branchResult);
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

module.exports = {
  readText,
  normalizeAbs,
  pathWithin,
  ensureParentDir,
  writeJsonFile,
  quoteWindowsArg,
  terminalRunStatus,
  runCommand,
  runGit,
  parseGitChangedFiles,
  buildGitSnapshot,
  captureGitSnapshot,
  parsePlanFromRawOutput,
  findStringByKey,
  extractTextFromJsonEvent
};
