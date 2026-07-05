const fs = require("fs");
const path = require("path");
const { loadCapabilityRegistry } = require("./capability-registry");

const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function normalizeAbs(p) {
  return path.resolve(p).toLowerCase();
}

function isWithinRoot(rootDir, candidatePath) {
  const root = normalizeAbs(rootDir);
  const candidate = normalizeAbs(candidatePath);
  return candidate === root || candidate.startsWith(root + path.sep);
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

function isSafeTaskId(taskId) {
  return typeof taskId === "string" && TASK_ID_PATTERN.test(taskId) && !taskId.includes("..");
}

function getTasksRoot(repoRoot) {
  return path.join(repoRoot, "data", "ai-coding-console", "tasks");
}

function getTaskDir(repoRoot, taskId) {
  return path.join(getTasksRoot(repoRoot), taskId);
}

function getTaskJsonPath(repoRoot, taskId) {
  return path.join(getTaskDir(repoRoot, taskId), "task.json");
}

function getCapabilitiesPath(repoRoot, taskId) {
  return path.join(getTaskDir(repoRoot, taskId), "capabilities.json");
}

function loadTaskRecord(repoRoot, projectId, taskId) {
  if (!isSafeTaskId(taskId)) {
    return { ok: false, statusCode: 400, error: "invalid_task_id" };
  }

  const taskJsonPath = getTaskJsonPath(repoRoot, taskId);
  if (!fs.existsSync(taskJsonPath)) {
    return { ok: false, statusCode: 404, error: "task_not_found" };
  }

  const taskJsonAbs = path.resolve(taskJsonPath);
  if (!isWithinRoot(repoRoot, taskJsonAbs)) {
    return { ok: false, statusCode: 400, error: "invalid_task_path" };
  }

  const parsed = readJsonFileIfExists(taskJsonPath);
  if (!parsed.ok) {
    return { ok: false, statusCode: 500, error: "invalid_task_json", details: [parsed.error] };
  }

  const task = parsed.value || {};
  const taskProjectId = task.projectId || task.projectid;
  if (!taskProjectId || taskProjectId !== projectId) {
    return { ok: false, statusCode: 404, error: "task_not_found" };
  }

  return { ok: true, task, taskJsonPath };
}

function validateCapabilityIds(registry, capabilityIds) {
  const uniqueIds = [];
  const seen = new Set();
  const invalidIds = [];

  for (const rawId of capabilityIds) {
    const id = String(rawId);
    if (!seen.has(id)) {
      seen.add(id);
      uniqueIds.push(id);
    }
  }

  for (const id of uniqueIds) {
    if (!registry.entries || !Object.prototype.hasOwnProperty.call(registry.entries, id)) {
      invalidIds.push(id);
    }
  }

  return { uniqueIds, invalidIds };
}

function loadTaskCapabilityBinding(repoRoot, projectId, taskId, registryPath) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) {
    return taskRecord;
  }

  const loadedRegistry = loadCapabilityRegistry(registryPath, repoRoot);
  if (!loadedRegistry.ok) {
    return {
      ok: false,
      statusCode: loadedRegistry.statusCode || 500,
      error: loadedRegistry.error,
      details: loadedRegistry.details || []
    };
  }

  const bindingPath = getCapabilitiesPath(repoRoot, taskId);
  const bindingFile = readJsonFileIfExists(bindingPath);
  if (bindingFile.exists && !bindingFile.ok) {
    return {
      ok: false,
      statusCode: 500,
      error: "invalid_task_capability_binding",
      details: [bindingFile.error]
    };
  }

  const binding = bindingFile.exists ? bindingFile.value : null;
  if (binding !== null && (typeof binding !== "object" || Array.isArray(binding))) {
    return {
      ok: false,
      statusCode: 500,
      error: "invalid_task_capability_binding",
      details: ["Binding file must be a JSON object."]
    };
  }

  if (binding && binding.taskId && binding.taskId !== taskId) {
    return {
      ok: false,
      statusCode: 500,
      error: "invalid_task_capability_binding",
      details: ["Binding taskId does not match the requested task."]
    };
  }

  if (binding && binding.capabilityIds && !Array.isArray(binding.capabilityIds)) {
    return {
      ok: false,
      statusCode: 500,
      error: "invalid_task_capability_binding",
      details: ["capabilityIds must be an array."]
    };
  }

  const capabilityIdsRaw = binding && Array.isArray(binding.capabilityIds) ? binding.capabilityIds : [];
  const capabilityIds = [];
  const seen = new Set();
  for (const rawId of capabilityIdsRaw) {
    const id = String(rawId);
    if (!seen.has(id)) {
      seen.add(id);
      capabilityIds.push(id);
    }
  }

  const { invalidIds } = validateCapabilityIds(loadedRegistry.registry, capabilityIds);
  if (invalidIds.length) {
    return {
      ok: false,
      statusCode: 500,
      error: "invalid_binding_capability_ids",
      invalidIds
    };
  }

  const capabilities = capabilityIds.map(id => loadedRegistry.registry.entries[id]);
  return {
    ok: true,
    taskId,
    projectId,
    updatedAt: binding && typeof binding.updatedAt === "string" ? binding.updatedAt : null,
    capabilityIds,
    capabilities
  };
}

function saveTaskCapabilityBinding(repoRoot, projectId, taskId, capabilityIds, registryPath) {
  const normalizedInput = Array.isArray(capabilityIds) ? capabilityIds : null;
  if (!normalizedInput) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_request_body"
    };
  }

  const uniqueIds = [];
  const seen = new Set();
  for (const rawId of normalizedInput) {
    if (typeof rawId !== "string" || !rawId.trim()) {
      return {
        ok: false,
        statusCode: 400,
        error: "invalid_request_body"
      };
    }
    const id = rawId.trim();
    if (!seen.has(id)) {
      seen.add(id);
      uniqueIds.push(id);
    }
  }

  const loadedRegistry = loadCapabilityRegistry(registryPath, repoRoot);
  if (!loadedRegistry.ok) {
    return {
      ok: false,
      statusCode: loadedRegistry.statusCode || 500,
      error: loadedRegistry.error,
      details: loadedRegistry.details || []
    };
  }

  const { invalidIds } = validateCapabilityIds(loadedRegistry.registry, uniqueIds);
  if (invalidIds.length) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_capability_ids",
      invalidIds
    };
  }

  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) {
    return taskRecord;
  }

  const bindingPath = getCapabilitiesPath(repoRoot, taskId);
  const bindingDir = path.dirname(bindingPath);
  if (!isWithinRoot(repoRoot, bindingDir)) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_task_path"
    };
  }

  fs.mkdirSync(bindingDir, { recursive: true });
  const payload = {
    taskId,
    updatedAt: new Date().toISOString(),
    capabilityIds: uniqueIds
  };
  fs.writeFileSync(bindingPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const capabilities = uniqueIds.map(id => loadedRegistry.registry.entries[id]);
  return {
    ok: true,
    taskId,
    projectId,
    updatedAt: payload.updatedAt,
    capabilityIds: uniqueIds,
    capabilities
  };
}

module.exports = {
  getCapabilitiesPath,
  getTaskDir,
  isSafeTaskId,
  loadTaskCapabilityBinding,
  loadTaskRecord,
  saveTaskCapabilityBinding,
  validateCapabilityIds
};
