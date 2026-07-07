// AI Coding Console - Agent Adapter Layer
// Stage D: decouple runners from any single Agent CLI.
//
// The Plan/Build runners must not hardcode `opencode.cmd`. They resolve an
// adapter by `agentType` and ask it for the CLI command and invocation shape.
// OpenCode is the only real adapter in Stage D. Codex and Claude Code are
// reserved placeholders that always report unavailable.

const fs = require("fs");
const path = require("path");
const { quoteWindowsArg, parsePlanFromRawOutput, findStringByKey } = require("./agent-runner-core");

// ---- OpenCode adapter ----

function resolveOpenCodeCommand() {
  // Prefer the native opencode.exe over the opencode.cmd shim.
  //
  // On Windows the .cmd shim cannot be spawned reliably:
  //   - `cmd.exe /d /s /c "..."` wrapping makes `opencode run` hang with zero
  //     output (though `--version` works);
  //   - `spawn(opencode.cmd, args, {shell:true})` throws EINVAL on Node 20+.
  // The npm package ships a real PE executable at
  //   node_modules/opencode-ai/bin/opencode.exe
  // which we can spawn directly with shell:false — no shim, no cmd.exe, no
  // EINVAL, no hang. We resolve that first and fall back to the .cmd shim only
  // if the .exe is missing.
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, "node_modules", "opencode-ai", "bin", "opencode.exe"),
    path.join(nodeDir, "opencode.exe"),
    path.join(nodeDir, "opencode.cmd")
  ];

  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.R_OK);
      return { ok: true, command: candidate, isCmdShim: candidate.toLowerCase().endsWith(".cmd") };
    } catch (err) {
      // try next candidate
    }
  }

  return {
    ok: false,
    statusCode: 409,
    error: "opencode_environment_not_ready",
    reason: "opencode_cli_unavailable",
    nextAction: "manual_environment_check_required",
    details: [`OpenCode CLI not found. Looked for: ${candidates.join(", ")}`]
  };
}

function buildOpenCodeInvocation({ opencodePath, promptText, isCmdShim }) {
  // Native opencode.exe is spawned directly with shell:false and a plain
  // argument array — Node handles argument quoting, no cmd.exe, no shell.
  //
  // The prompt is passed as the positional `message` argument, NOT via
  // `--file`. Empirically `opencode run --file <largePrompt>` hangs with zero
  // output on a ~16KB prompt (probes P7/P8), while passing the same content as
  // the message argument succeeds reliably, including at 32KB (probes
  // P9/P10/P11). Because we spawn with shell:false, the message is a single
  // argv entry and is not subject to the cmd.exe 8191-char command-line limit.
  const args = [
    "run",
    promptText,
    "--format",
    "json"
  ];

  return {
    command: opencodePath,
    args,
    // Only the legacy .cmd fallback needs a shell; the .exe must not use one.
    useShell: Boolean(isCmdShim),
    // Display-only; the real prompt is omitted here to keep it readable.
    commandLine: [
      quoteWindowsArg(opencodePath),
      "run",
      "<prompt message, " + String(promptText || "").length + " chars>",
      "--format",
      "json"
    ].join(" ")
  };
}

const OpenCodeAdapter = {
  agentType: "opencode",
  checkAvailability() {
    return resolveOpenCodeCommand();
  },
  buildInvocation({ promptText }) {
    const resolved = resolveOpenCodeCommand();
    if (!resolved.ok) return resolved;
    const invocation = buildOpenCodeInvocation({
      opencodePath: resolved.command,
      promptText,
      isCmdShim: resolved.isCmdShim
    });
    return {
      ok: true,
      command: invocation.command,
      args: invocation.args,
      useShell: invocation.useShell,
      commandLine: invocation.commandLine
    };
  },
  parseOutput(rawOutput) {
    return parsePlanFromRawOutput(rawOutput);
  },
  getSessionRef(rawOutput) {
    const parsed = parsePlanFromRawOutput(rawOutput);
    return parsed.sessionRef || findStringByKey({ rawOutput }, /session/i) || "";
  }
};

// ---- Reserved adapters (Stage D: never available, never executed) ----

function makeReservedAdapter(agentType) {
  return {
    agentType,
    checkAvailability() {
      return {
        ok: false,
        statusCode: 409,
        error: "agent_adapter_not_installed",
        reason: `agent_adapter_not_installed: ${agentType}`,
        nextAction: "manual_environment_check_required",
        details: [`Agent adapter not installed: ${agentType}`]
      };
    },
    buildInvocation() {
      return {
        ok: false,
        statusCode: 409,
        error: "agent_adapter_not_installed",
        details: [`Agent adapter not installed: ${agentType}`]
      };
    },
    parseOutput() {
      return { text: "", sessionRef: "" };
    },
    getSessionRef() {
      return "";
    }
  };
}

const CodexAdapter = makeReservedAdapter("codex");
const ClaudeCodeAdapter = makeReservedAdapter("claude");

const ADAPTERS = {
  opencode: OpenCodeAdapter,
  codex: CodexAdapter,
  claude: ClaudeCodeAdapter
};

function getAdapter(agentType) {
  const key = String(agentType || "opencode").toLowerCase();
  return ADAPTERS[key] || null;
}

module.exports = {
  getAdapter,
  resolveOpenCodeCommand,
  buildOpenCodeInvocation,
  OpenCodeAdapter,
  CodexAdapter,
  ClaudeCodeAdapter
};
