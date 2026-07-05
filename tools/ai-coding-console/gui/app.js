// AI Coding Console - Workbench
const API = "";

const state = {
  projects: [],
  activeProjectId: "",
  activeTaskId: "",
  activeTab: "workbench",
  projectRailCollapsed: false,
  taskRailCollapsed: false,
  projectDrawerOpen: false,
  capabilityOpen: false,
  promptEditorOpen: false,
  promptFullscreen: false,
  banner: null,
  loadingProjects: false,
  loadingContext: false,
  loadingTaskDetail: false,
  projectDetail: null,
  taskList: [],
  taskDetail: null,
  capabilityRegistry: [],
  capabilityRegistryLoading: false,
  capabilityRegistryError: "",
  capabilityBinding: null,
  capabilityBindingLoading: false,
  capabilityBindingSaving: false,
  capabilityBindingError: "",
  capabilityDraftIds: [],
  capabilityExpandedId: "",
  capabilitySearch: "",
  capabilityTypeFilter: "all",
  taskFilter: "all",
  projectSearch: "",
  activeAppSection: "projects",
  workspacePreviewMode: "",
  moreMenuOpen: false,
  createTaskOpen: false,
  createTaskDesc: "",
  promptDraft: "",
  finalPromptPreview: "",
  sourceFoldoutOpen: false,
  promptSopData: null,
  promptSopLoading: false,
  promptSopError: "",
  userSupplement: "",
  sopGenerated: false,
  promptFinalized: false,
  error: ""
};

function $(sel) {
  return document.querySelector(sel);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "暂无";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function shortText(value, max = 42) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeTask(task) {
  return {
    raw: task,
    taskId: task?.taskId || task?.taskid || task?.id || "",
    title: task?.title || task?.Title || task?.name || task?.summary || task?.desc || task?.description || "未命名任务",
    description: task?.description || task?.desc || task?.summary || task?.notes || "",
    status: String(task?.status || task?.state || "unknown"),
    updatedAt: task?.updatedAt || task?.updatedat || task?.modifiedAt || task?.modifiedat || task?.createdAt || task?.createdat || "",
    createdAt: task?.createdAt || task?.createdat || "",
    currentAgent: task?.currentAgent || task?.agent || task?.assignedAgent || task?.executor || "",
    currentSopStep: task?.currentSopStep || task?.sopStep || task?.currentStep || task?.step || "",
    nextStep: task?.nextStep || task?.nextAction || task?.next || ""
  };
}

function normalizeCapabilityEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    raw: entry,
    id: String(entry.id || ""),
    name: String(entry.name || entry.id || ""),
    type: String(entry.type || ""),
    description: String(entry.description || ""),
    sourcePath: String(entry.sourcePath || ""),
    entryFile: entry.entryFile || null,
    usage: String(entry.usage || ""),
    applicableProjectTypes: Array.isArray(entry.applicableProjectTypes) ? entry.applicableProjectTypes : [],
    riskLevel: String(entry.riskLevel || "low"),
    canModifyProject: Boolean(entry.canModifyProject),
    canRunScript: Boolean(entry.canRunScript),
    requiresApproval: Boolean(entry.requiresApproval),
    inputRequirements: Array.isArray(entry.inputRequirements) ? entry.inputRequirements : [],
    expectedArtifacts: Array.isArray(entry.expectedArtifacts) ? entry.expectedArtifacts : [],
    relatedSkills: Array.isArray(entry.relatedSkills) ? entry.relatedSkills : [],
    relatedSops: Array.isArray(entry.relatedSops) ? entry.relatedSops : [],
    relatedScripts: Array.isArray(entry.relatedScripts) ? entry.relatedScripts : [],
    relatedPromptTemplates: Array.isArray(entry.relatedPromptTemplates) ? entry.relatedPromptTemplates : [],
    status: String(entry.status || "active")
  };
}

function capabilityTypeLabel(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "skill") return "Skill";
  if (normalized === "sop") return "SOP";
  if (normalized === "script") return "Script";
  if (normalized === "prompt-template") return "Prompt Template";
  if (normalized === "capability-pack") return "Capability Pack";
  return type || "Unknown";
}

function capabilityTypeOptions() {
  return [
    { key: "all", label: "全部" },
    { key: "skill", label: "Skill" },
    { key: "sop", label: "SOP" },
    { key: "script", label: "Script" },
    { key: "prompt-template", label: "Prompt Template" }
  ];
}

function getCapabilityList() {
  return [...state.capabilityRegistry].sort((a, b) => {
    const typeOrder = { skill: 1, sop: 2, script: 3, "prompt-template": 4, "capability-pack": 5 };
    const ao = typeOrder[String(a.type || "").toLowerCase()] || 99;
    const bo = typeOrder[String(b.type || "").toLowerCase()] || 99;
    if (ao !== bo) return ao - bo;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
  });
}

function getSelectedCapabilityIds() {
  const ids = Array.isArray(state.capabilityDraftIds) && state.capabilityDraftIds.length
    ? state.capabilityDraftIds
    : Array.isArray(state.capabilityBinding?.capabilityIds)
      ? state.capabilityBinding.capabilityIds
      : [];
  return [...new Set(ids.map((id) => String(id)))];
}

function getBoundCapabilityIds() {
  return Array.isArray(state.capabilityBinding?.capabilityIds)
    ? [...new Set(state.capabilityBinding.capabilityIds.map((id) => String(id)))]
    : [];
}

function getBoundCapabilities() {
  const ids = getBoundCapabilityIds();
  const lookup = new Map(getCapabilityList().map((entry) => [entry.id, entry]));
  return ids.map((id) => lookup.get(id)).filter(Boolean);
}

function getCapabilityCountLabel() {
  const count = getBoundCapabilityIds().length;
  return count ? `${count} 项` : "未绑定";
}

function resetCapabilityBrowserState() {
  state.capabilityOpen = false;
  state.capabilityBindingError = "";
  state.capabilityBindingSaving = false;
  state.capabilityExpandedId = "";
  state.capabilitySearch = "";
  state.capabilityTypeFilter = "all";
  state.capabilityDraftIds = [];
}

function syncCapabilityDraftFromBinding() {
  state.capabilityDraftIds = getBoundCapabilityIds();
}

function applyCapabilityBindingResult(result) {
  state.capabilityBinding = result || null;
  state.capabilityBindingError = "";
  syncCapabilityDraftFromBinding();
}

function parseProjectStatus(statusOutput, projectRecord) {
  const summary = {
    gitBranch: null,
    gitDirty: null,
    gitRemote: projectRecord?.gitRemote || projectRecord?.gitremote || null,
    agentsMd: Boolean(projectRecord?.hasAgentsMd || projectRecord?.hasagentsmd),
    aiMemory: Boolean(projectRecord?.hasAiMemory || projectRecord?.hasaimemory),
    projectState: projectRecord?.takeoverStatus || projectRecord?.takeoverstatus || "unknown"
  };

  const lines = String(statusOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const branchMatch = line.match(/(?:git\s*)?branch\s*[:=]\s*(.+)$/i);
    if (branchMatch && !summary.gitBranch) summary.gitBranch = branchMatch[1].trim();

    const remoteMatch = line.match(/(?:git\s*)?remote\s*[:=]\s*(.+)$/i);
    if (remoteMatch && !summary.gitRemote) summary.gitRemote = remoteMatch[1].trim();

    const dirtyMatch = line.match(/(?:git\s*)?(?:dirty|status)\s*[:=]\s*(.+)$/i);
    if (dirtyMatch && summary.gitDirty === null) {
      const value = dirtyMatch[1].trim().toLowerCase();
      summary.gitDirty = value.includes("dirty") || value.includes("modified") || value === "true" || value === "yes";
    }

    if (/dirty/i.test(line) && summary.gitDirty === null) summary.gitDirty = true;

    const agentsMatch = line.match(/AGENTS\.md.*?(present|missing|yes|no)/i);
    if (agentsMatch) summary.agentsMd = /present|yes/i.test(agentsMatch[1]);

    const memoryMatch = line.match(/\.ai\/?.*?(present|missing|yes|no)/i);
    if (memoryMatch) summary.aiMemory = /present|yes/i.test(memoryMatch[1]);

    const stateMatch = line.match(/(?:project\s*)?state\s*[:=]\s*(.+)$/i);
    if (stateMatch && summary.projectState === "unknown") summary.projectState = stateMatch[1].trim();
  }

  return summary;
}

async function apiGet(path) {
  const response = await fetch(API + path);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || response.statusText);
  }
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.output || response.statusText);
  return data;
}

async function loadPromptSop() {
  if (!state.activeProjectId || !state.activeTaskId) {
    state.promptSopData = null;
    state.promptSopError = "";
    state.sopGenerated = false;
    state.promptFinalized = false;
    return;
  }
  state.promptSopLoading = true;
  render();
  try {
    const result = await apiGet(`/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/prompt-sop`);
    state.promptSopData = result;
    state.promptSopError = "";
    state.sopGenerated = !!(result && result.sop && result.sop.steps && result.sop.steps.length);
    state.promptFinalized = !!(result && result.finalPrompt);
    state.userSupplement = "";
    if (result && result.promptDraft) {
      const suppMatch = result.promptDraft.match(/## 用户补充说明\n([\s\S]*)$/);
      if (suppMatch) state.userSupplement = suppMatch[1].trim();
    }
  } catch (err) {
    state.promptSopData = null;
    state.promptSopError = err.message || "加载失败";
    state.sopGenerated = false;
    state.promptFinalized = false;
  } finally {
    state.promptSopLoading = false;
    render();
  }
}

async function generatePromptSop(regenerate) {
  if (!state.activeProjectId || !state.activeTaskId) {
    setBanner("error", "请先选择真实 Task。");
    render();
    return;
  }
  state.promptSopLoading = true;
  setBanner("info", "正在生成 SOP 与 Prompt 草稿...");
  render();
  try {
    const result = await apiPost(
      `/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/prompt-sop/generate`,
      { regenerate: !!regenerate }
    );
    state.promptSopData = result;
    state.sopGenerated = true;
    state.promptSopError = "";
    if (result.note === "draft_already_exists_use_regenerate") {
      setBanner("warn", "草稿已存在，未覆盖。如需重新生成请再次点击并确认覆盖。");
    } else {
      setBanner("success", "SOP 与 Prompt 草稿已生成。");
    }
    render();
  } catch (err) {
    state.promptSopError = err.message || "生成失败";
    if (err.message.includes("no_capability_bound")) {
      setBanner("error", "需要先绑定至少一个 Capability，才能生成当前 Task 的 SOP 与 Prompt。");
    } else if (err.message.includes("task_not_found")) {
      setBanner("error", "Task 不存在，请刷新重试。");
    } else {
      setBanner("error", state.promptSopError);
    }
    render();
  } finally {
    state.promptSopLoading = false;
    render();
  }
}

async function saveEditedPromptDraft() {
  if (!state.activeProjectId || !state.activeTaskId) {
    setBanner("error", "请先选择真实 Task。");
    render();
    return;
  }
  if (!state.promptSopData || !state.promptSopData.promptDraft) {
    setBanner("error", "请先生成 SOP 与 Prompt 草稿。");
    render();
    return;
  }
  setBanner("info", "正在保存草稿...");
  render();
  try {
    const result = await apiPost(
      `/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/prompt-sop/draft`,
      { promptDraft: state.promptSopData.promptDraft }
    );
    setBanner("success", "草稿已保存。");
    render();
  } catch (err) {
    setBanner("error", `保存草稿失败：${err.message}`);
    render();
  }
}

async function finalizePrompt() {
  if (!state.activeProjectId || !state.activeTaskId) {
    setBanner("error", "请先选择真实 Task。");
    render();
    return;
  }
  if (!state.sopGenerated) {
    setBanner("error", "请先生成 SOP，再生成最终 Prompt。");
    render();
    return;
  }
  state.promptSopLoading = true;
  setBanner("info", "正在生成最终 Prompt...");
  render();
  try {
    const result = await apiPost(
      `/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/prompt-sop/finalize`,
      {}
    );
    state.promptSopData.finalPrompt = result.finalPrompt;
    state.promptFinalized = true;
    setBanner("success", "最终 Prompt 已生成。");
    render();
  } catch (err) {
    state.promptSopError = err.message || "生成失败";
    if (err.message.includes("sop_not_generated")) {
      setBanner("error", "请先生成 SOP。");
    } else {
      setBanner("error", `生成最终 Prompt 失败：${err.message}`);
    }
    render();
  } finally {
    state.promptSopLoading = false;
    render();
  }
}

function setBanner(type, text) {
  state.banner = text ? { type, text } : null;
}

function setError(text) {
  state.error = text || "";
}

function getProjectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function getSelectedProject() {
  return state.projectDetail || getProjectById(state.activeProjectId);
}

function getSelectedTask() {
  return state.taskList.find((task) => task.taskId === state.activeTaskId) || null;
}

function getTaskDetailTask() {
  return state.taskDetail?.task ? normalizeTask(state.taskDetail.task) : getSelectedTask();
}

function classifyTask(task) {
  const status = String(task?.status || "").toLowerCase();
  if (status.includes("complete") || status.includes("done")) return "completed";
  if (status.includes("wait") || status.includes("review") || status.includes("approval") || status.includes("approve")) return "waiting";
  if (status.includes("run") || status.includes("active") || status.includes("progress") || status.includes("start") || status.includes("processing")) return "progress";
  return "progress";
}

function taskFilterMatches(task) {
  const bucket = classifyTask(task);
  if (state.taskFilter === "all") return true;
  if (state.taskFilter === "progress") return bucket === "progress";
  if (state.taskFilter === "waiting") return bucket === "waiting";
  if (state.taskFilter === "completed") return bucket === "completed";
  return true;
}

function taskActionModel(task) {
  if (!task) {
    return {
      title: "当前项目暂无 Task",
      description: "请先创建一个任务，右侧工作区才会进入完整流程。",
      currentStep: "尚未选择 Task",
      nextStep: "点击 [新建任务] 开始工作",
      buttonLabel: "新建任务",
      action: "create-task"
    };
  }

  const status = String(task.status || "").toLowerCase();
  if (status.includes("complete") || status.includes("done")) {
    return {
      title: task.title,
      description: task.description || "",
      currentStep: task.currentSopStep || "已完成",
      nextStep: "查看结果并验收",
      buttonLabel: "查看结果并验收",
      action: "artifact"
    };
  }

  if (status.includes("wait") || status.includes("review") || status.includes("approval") || status.includes("approve")) {
    return {
      title: task.title,
      description: task.description || "",
      currentStep: task.currentSopStep || "等待审批",
      nextStep: "查看计划并批准",
      buttonLabel: "查看计划并批准",
      action: "approvals"
    };
  }

  if (status.includes("run") || status.includes("active") || status.includes("progress") || status.includes("start") || status.includes("processing")) {
    return {
      title: task.title,
      description: task.description || "",
      currentStep: task.currentSopStep || "执行中",
      nextStep: "查看执行输出",
      buttonLabel: "查看执行输出",
      action: "agent"
    };
  }

  return {
    title: task.title,
    description: task.description || "",
    currentStep: task.currentSopStep || "待开始",
    nextStep: "生成 Prompt 与 SOP",
    buttonLabel: "生成 Prompt 与 SOP",
    action: "prompt"
  };
}

function parseHash() {
  const hash = location.hash.replace(/^#/, "");
  const match = hash.match(/^\/projects\/([^/]+)(?:\/tasks\/([^/]+))?$/);
  if (!match) return { projectId: "", taskId: "" };
  return {
    projectId: decodeURIComponent(match[1]),
    taskId: match[2] ? decodeURIComponent(match[2]) : ""
  };
}

function setHash(projectId, taskId = "") {
  if (!projectId) return;
  const target = taskId ? `#/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}` : `#/projects/${encodeURIComponent(projectId)}`;
  if (location.hash !== target) location.hash = target;
}

function setTab(tab) {
  state.activeTab = tab;
  render();
}

function toggleProjectRail() {
  state.projectRailCollapsed = !state.projectRailCollapsed;
  render();
}

function toggleTaskRail() {
  state.taskRailCollapsed = !state.taskRailCollapsed;
  render();
}

function toggleProjectDrawer() {
  state.projectDrawerOpen = !state.projectDrawerOpen;
  render();
}

function toggleCapabilityPanel() {
  state.capabilityOpen = !state.capabilityOpen;
  if (state.capabilityOpen && state.capabilityBinding) {
    syncCapabilityDraftFromBinding();
  }
  render();
}

function openCapabilityPanel() {
  state.capabilityOpen = true;
  if (state.capabilityBinding) syncCapabilityDraftFromBinding();
  render();
}

function closeCapabilityPanel() {
  state.capabilityOpen = false;
  state.capabilityExpandedId = "";
  state.capabilityBindingError = "";
  render();
}

function togglePromptEditor() {
  state.promptEditorOpen = !state.promptEditorOpen;
  render();
}

function togglePromptFullscreen() {
  state.promptFullscreen = !state.promptFullscreen;
  render();
}

function setTaskFilter(filter) {
  state.taskFilter = filter;
  render();
}

function setProjectSearch(value) {
  state.projectSearch = value;
  render();
}

function setCapabilitySearch(value) {
  state.capabilitySearch = value || "";
  render();
}

function setCapabilityTypeFilter(value) {
  state.capabilityTypeFilter = value || "all";
  render();
}

function toggleCapabilitySelection(capabilityId, checked) {
  const id = String(capabilityId || "");
  if (!id) return;
  const next = new Set(getSelectedCapabilityIds());
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  state.capabilityDraftIds = [...next];
  render();
}

function toggleCapabilityExpanded(capabilityId) {
  const id = String(capabilityId || "");
  state.capabilityExpandedId = state.capabilityExpandedId === id ? "" : id;
  render();
}

async function loadCapabilityRegistry() {
  if (state.capabilityRegistry.length || state.capabilityRegistryLoading) {
    return state.capabilityRegistry;
  }
  state.capabilityRegistryLoading = true;
  state.capabilityRegistryError = "";
  render();
  try {
    const result = await apiGet("/api/capabilities");
    const entries = result && result.entries && typeof result.entries === "object" ? Object.values(result.entries) : [];
    state.capabilityRegistry = entries.map(normalizeCapabilityEntry).filter(Boolean);
    state.capabilityRegistryError = "";
    return state.capabilityRegistry;
  } catch (error) {
    state.capabilityRegistry = [];
    state.capabilityRegistryError = error.message || "Capability Registry load failed";
    return [];
  } finally {
    state.capabilityRegistryLoading = false;
    render();
  }
}

async function loadCapabilityBindingForTask() {
  const projectId = state.activeProjectId;
  const taskId = state.activeTaskId;
  if (!projectId || !taskId) {
    state.capabilityBinding = null;
    state.capabilityBindingError = "";
    state.capabilityDraftIds = [];
    state.capabilityExpandedId = "";
    render();
    return null;
  }

  state.capabilityBindingLoading = true;
  state.capabilityBindingError = "";
  render();

  try {
    await loadCapabilityRegistry();
    const result = await apiGet(`/api/tasks/${encodeURIComponent(projectId)}/${encodeURIComponent(taskId)}/capabilities`);
    applyCapabilityBindingResult(result);
    return result;
  } catch (error) {
    const message = error.message || "Failed to load task capability binding";
    state.capabilityBinding = null;
    state.capabilityDraftIds = [];
    state.capabilityBindingError = message;
    return null;
  } finally {
    state.capabilityBindingLoading = false;
    render();
  }
}

function filterCapabilityEntry(entry) {
  const query = state.capabilitySearch.trim().toLowerCase();
  const typeFilter = state.capabilityTypeFilter;
  if (typeFilter !== "all" && String(entry.type || "").toLowerCase() !== typeFilter) return false;
  if (!query) return true;
  return [
    entry.id,
    entry.name,
    entry.description,
    entry.sourcePath,
    entry.usage
  ].some((field) => String(field || "").toLowerCase().includes(query));
}

function getFilteredCapabilityEntries() {
  return getCapabilityList().filter(filterCapabilityEntry);
}

function buildCapabilityBindingPayload() {
  return getSelectedCapabilityIds();
}

async function saveCapabilityBinding() {
  const task = getTaskDetailTask() || getSelectedTask();
  if (!state.activeProjectId || !state.activeTaskId || !task) {
    setBanner("error", "请先选择真实 Task。");
    render();
    return;
  }

  state.capabilityBindingSaving = true;
  state.capabilityBindingError = "";
  render();

  try {
    const result = await apiPost(
      `/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/capabilities`,
      { capabilityIds: buildCapabilityBindingPayload() }
    );
    applyCapabilityBindingResult(result);
    state.capabilityOpen = false;
    setBanner("success", `已保存能力绑定：${result.capabilityIds.length} 项。`);
    await refreshActiveTask();
  } catch (error) {
    state.capabilityBindingError = error.message || "保存绑定失败";
    setBanner("error", state.capabilityBindingError);
    render();
  } finally {
    state.capabilityBindingSaving = false;
    render();
  }
}

function cancelCapabilityBinding() {
  syncCapabilityDraftFromBinding();
  closeCapabilityPanel();
}

function setCreateTaskDesc(value) {
  state.createTaskDesc = value;
}

function setPromptDraft(value) {
  state.promptDraft = value;
}

function setWorkspacePreviewMode(mode) {
  state.workspacePreviewMode = mode || "";
  state.moreMenuOpen = false;
  state.activeTab = mode === "run" ? "agent" : "workbench";
  setBanner(mode ? "info" : null, mode ? "示例预览已打开。刷新后不会保留。" : "");
  render();
}

function clearWorkspacePreviewMode() {
  state.workspacePreviewMode = "";
  state.moreMenuOpen = false;
  render();
}

function toggleMoreMenu() {
  state.moreMenuOpen = !state.moreMenuOpen;
  render();
}

function handleAppRail(section) {
  state.activeAppSection = section;
  if (section === "projects") {
    state.banner = null;
    refreshCurrentContext();
    return;
  }
  setBanner("info", "当前阶段暂未开放。");
  render();
}

function openCreateTaskModal() {
  state.createTaskOpen = true;
  state.createTaskDesc = "";
  render();
}

function closeModal() {
  state.createTaskOpen = false;
  render();
}

function showStageNotice() {
  setBanner("warn", "当前阶段功能尚未完全接入。");
  render();
}

function executePrimaryAction() {
  const task = getTaskDetailTask() || getSelectedTask();
  const model = taskActionModel(task);

  if (model.action === "create-task") {
    openCreateTaskModal();
    return;
  }

  if (model.action === "prompt") {
    state.activeTab = "prompt";
    showStageNotice();
    return;
  }

  if (model.action === "approvals") {
    state.activeTab = "approvals";
    render();
    return;
  }

  if (model.action === "agent") {
    state.activeTab = "agent";
    render();
    return;
  }

  if (model.action === "artifact") {
    state.activeTab = "artifact";
    render();
  }
}

function previewFinalPrompt() {
  const task = getTaskDetailTask() || getSelectedTask();
  state.finalPromptPreview = [
    "阶段 C.6 能力尚未接入，当前无法生成真实最终 Agent Prompt。",
    `当前任务：${task ? task.title : "暂无 Task"}`,
    "后续将在这里组合：用户补充要求 + Capability / SOP + Source 引用 + 最终 Prompt 预览。"
  ].join("\n");
  setBanner("info", "已刷新最终 Prompt 预览占位。");
  render();
}

function savePromptDraft() {
  setBanner("success", "草稿仅保留在当前页面会话中，不会写入真实 Prompt 数据。");
  render();
}

async function submitCreateTask() {
  const projectId = state.activeProjectId;
  const desc = state.createTaskDesc.trim();
  if (!projectId) {
    setBanner("error", "请先选择一个项目。");
    render();
    return;
  }
  if (!desc) {
    setBanner("error", "任务描述不能为空。");
    render();
    return;
  }

  setBanner("info", "正在创建任务...");
  render();

  try {
    const result = await apiPost("/api/tasks/create", { projectId, desc });
    closeModal();
    setBanner("success", "任务已创建，正在刷新工作台。");
    render();
    const nextTaskId = result.taskId || "";
    await selectContext(projectId, nextTaskId);
    if (nextTaskId) setHash(projectId, nextTaskId);
  } catch (error) {
    setBanner("error", `创建任务失败：${error.message}`);
    render();
  }
}

async function approveTask() {
  const task = getTaskDetailTask();
  if (!task?.taskId) return;
  if (!confirm(`Approve plan for ${task.taskId}?`)) return;
  try {
    const result = await apiPost(`/api/tasks/${encodeURIComponent(task.taskId)}/approve`, {});
    setBanner(result.ok ? "success" : "error", result.output || "审批已提交。");
    await refreshActiveTask();
  } catch (error) {
    setBanner("error", `审批失败：${error.message}`);
    render();
  }
}

async function reviewTask() {
  const task = getTaskDetailTask();
  if (!task?.taskId) return;
  if (!confirm(`Review ${task.taskId}?`)) return;
  try {
    const result = await apiPost(`/api/tasks/${encodeURIComponent(task.taskId)}/review`, {});
    setBanner(result.ok ? "success" : "error", result.output || "验收已提交。");
    await refreshActiveTask();
  } catch (error) {
    setBanner("error", `验收失败：${error.message}`);
    render();
  }
}

async function closeTask() {
  const task = getTaskDetailTask();
  if (!task?.taskId) return;
  if (!confirm(`Close ${task.taskId}?`)) return;
  try {
    const result = await apiPost(`/api/tasks/${encodeURIComponent(task.taskId)}/close`, {});
    setBanner(result.ok ? "success" : "error", result.output || "任务已关闭。");
    await refreshActiveTask();
  } catch (error) {
    setBanner("error", `关闭失败：${error.message}`);
    render();
  }
}

async function loadProjects() {
  state.loadingProjects = true;
  render();
  try {
    const projects = await apiGet("/api/projects");
    state.projects = Array.isArray(projects) ? projects : [];
    setError("");
  } catch (error) {
    setError(error.message);
    state.projects = [];
  } finally {
    state.loadingProjects = false;
    render();
  }
}

async function selectContext(projectId, taskId = "") {
  state.workspacePreviewMode = "";
  state.moreMenuOpen = false;
  resetCapabilityBrowserState();
  state.capabilityBinding = null;
  state.capabilityBindingError = "";
  state.capabilityBindingLoading = false;
  state.capabilityRegistryError = "";
  state.promptSopData = null;
  state.promptSopError = "";
  state.sopGenerated = false;
  state.promptFinalized = false;
  state.userSupplement = "";

  if (!projectId) {
    state.activeProjectId = "";
    state.activeTaskId = "";
    state.projectDetail = null;
    state.taskList = [];
    state.taskDetail = null;
    render();
    return;
  }

  state.activeProjectId = projectId;
  state.activeTaskId = taskId || "";
  state.projectDetail = null;
  state.taskList = [];
  state.taskDetail = null;
  state.loadingContext = true;
  state.loadingTaskDetail = false;
  setError("");
  render();

  try {
    const [projectDetail, taskListRaw] = await Promise.all([
      apiGet(`/api/projects/${encodeURIComponent(projectId)}`),
      apiGet(`/api/tasks/${encodeURIComponent(projectId)}`)
    ]);

    const normalizedProject = projectDetail || {};
    const normalizedSummary = normalizedProject.statusSummary || parseProjectStatus(normalizedProject.statusOutput, normalizedProject);
    state.projectDetail = { ...normalizedProject, statusSummary: normalizedSummary };
    state.taskList = Array.isArray(taskListRaw) ? taskListRaw.map(normalizeTask) : [];

    const preferredTaskId = taskId || state.activeTaskId;
    const preferredTask = state.taskList.find((item) => item.taskId === preferredTaskId) || state.taskList[0] || null;
    state.activeTaskId = preferredTask ? preferredTask.taskId : "";
    state.loadingContext = false;
    render();

    if (state.activeTaskId) {
      await refreshActiveTask();
    } else {
      state.taskDetail = null;
      render();
    }
  } catch (error) {
    state.loadingContext = false;
    setError(error.message);
    render();
  }
}

async function refreshActiveTask() {
  if (!state.activeProjectId || !state.activeTaskId) {
    state.taskDetail = null;
    state.capabilityBinding = null;
    state.capabilityDraftIds = [];
    render();
    return;
  }

  state.promptSopData = null;
  state.promptSopError = "";
  state.sopGenerated = false;
  state.promptFinalized = false;
  state.userSupplement = "";

  state.loadingTaskDetail = true;
  render();
  try {
    const detail = await apiGet(`/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}`);
    if (state.activeTaskId) state.taskDetail = detail;
    await loadCapabilityBindingForTask();
    await loadPromptSop();
  } catch (error) {
    setBanner("error", `任务详情加载失败：${error.message}`);
    state.taskDetail = null;
  } finally {
    state.loadingTaskDetail = false;
    render();
  }
}

async function handleRoute() {
  const route = parseHash();
  const projectId = route.projectId || state.activeProjectId || state.projects[0]?.id || "";
  const taskId = route.taskId || "";
  await selectContext(projectId, taskId);
}

function renderAppRail() {
  const items = [
    { key: "projects", label: "项目", hint: "当前阶段可用" },
    { key: "capability", label: "能力", hint: "当前阶段暂未开放" },
    { key: "workflow", label: "Task / 工作流", hint: "当前阶段暂未开放" },
    { key: "artifact", label: "产物", hint: "当前阶段暂未开放" },
    { key: "docs", label: "文档", hint: "当前阶段暂未开放" },
    { key: "settings", label: "设置", hint: "当前阶段暂未开放" }
  ];

  return `
    <aside class="app-rail">
      <div class="app-rail-brand" title="AI Coding Console">
        <div class="app-rail-mark">AI</div>
        <div class="app-rail-brand-text">
          <strong>Console</strong>
          <span>Workbench</span>
        </div>
      </div>
      <div class="app-rail-list">
        ${items.map((item) => {
          const active = state.activeAppSection === item.key ? "active" : "";
          const disabled = item.key !== "projects" ? "disabled" : "";
          return `
            <button class="app-rail-item ${active} ${disabled}" title="${escapeHTML(item.hint)}" onclick="window.consoleWorkbench.handleAppRail(${escapeHTML(JSON.stringify(item.key))})">
              <span class="app-rail-icon">${escapeHTML(item.key === "projects" ? "⌂" : "·")}</span>
              <span class="app-rail-label">${escapeHTML(item.label)}</span>
            </button>
          `;
        }).join("")}
      </div>
      <div class="app-rail-footer">
        <span class="app-rail-dot"></span>
        <span>AI Coding Console</span>
      </div>
    </aside>
  `;
}

function renderProjectRail() {
  const project = getSelectedProject();
  const railClass = state.projectRailCollapsed ? "rail collapsed" : "rail";
  const query = state.projectSearch.trim().toLowerCase();
  const visibleProjects = state.projects.filter((item) => {
    if (!query) return true;
    return [item.displayName, item.id, item.rootPath]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(query));
  });

  const items = visibleProjects.length
    ? visibleProjects.map((item) => {
        const active = item.id === state.activeProjectId ? "active" : "";
        const status = item.statusSummary?.projectState || item.takeoverStatus || "unknown";
        return `
          <button class="project-item ${active}" onclick="window.consoleWorkbench.navigateProject(${escapeHTML(JSON.stringify(item.id))})">
            <span class="project-dot"></span>
            <span class="project-meta">
              <strong>${escapeHTML(item.displayName || item.id)}</strong>
              <small>${escapeHTML(item.rootPath || status)}</small>
            </span>
          </button>
        `;
      }).join("")
    : `<div class="empty-state compact">${state.loadingProjects ? "项目加载中..." : "暂无已登记项目"}<span>请先通过 CLI 登记项目，列表会在此同步显示。</span></div>`;

  return `
    <aside class="${railClass}">
      <div class="rail-header">
        <div>
          <span class="rail-kicker">Project</span>
          <h2>项目</h2>
        </div>
        <button class="icon-btn" onclick="window.consoleWorkbench.toggleProjectRail()" title="${state.projectRailCollapsed ? "展开项目栏" : "折叠项目栏"}" aria-label="${state.projectRailCollapsed ? "展开项目栏" : "折叠项目栏"}">${state.projectRailCollapsed ? "»" : "«"}</button>
      </div>
      <div class="rail-body">
        ${state.projectRailCollapsed ? `
          <button class="rail-expand-button" onclick="window.consoleWorkbench.toggleProjectRail()" title="展开项目栏" aria-label="展开项目栏">
            <span class="rail-expand-icon">›</span>
            <span class="rail-expand-label">展开</span>
          </button>
        ` : `
          <div class="rail-toolbar project-toolbar">
            <input class="project-search" type="search" placeholder="搜索项目" value="${escapeHTML(state.projectSearch)}" oninput="window.consoleWorkbench.setProjectSearch(this.value)">
            <span class="rail-hint">项目始终作为上下文边界可见。</span>
          </div>
          <div class="rail-list">${items}</div>
          ${!visibleProjects.length ? `<div class="empty-state compact">未找到匹配项目<span>试试搜索其他名称或路径。</span></div>` : ""}
          <div class="rail-footer stack">
            <button class="ghost-btn project-detail-rail" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
            <span class="rail-hint">Git / AGENTS / .ai 收纳在右上角抽屉里。</span>
          </div>
          <div class="rail-footer">
            <div class="mini-summary">
              <span>当前项目</span>
              <strong>${project ? escapeHTML(project.displayName || project.id) : "未选择"}</strong>
            </div>
          </div>
        `}
      </div>
    </aside>
  `;
}

function renderTaskFilters() {
  const filters = [
    { key: "all", label: "全部" },
    { key: "progress", label: "进行中" },
    { key: "waiting", label: "等待我处理" },
    { key: "completed", label: "已完成" }
  ];

  return filters.map((filter) => `
    <button class="filter-chip ${state.taskFilter === filter.key ? "active" : ""}" onclick="window.consoleWorkbench.setTaskFilter(${escapeHTML(JSON.stringify(filter.key))})">
      ${escapeHTML(filter.label)}
    </button>
  `).join("");
}

function renderTaskRail() {
  const railClass = state.taskRailCollapsed ? "rail task-rail collapsed" : "rail task-rail";
  const visibleTasks = state.taskList.filter(taskFilterMatches);
  const selectedTask = getSelectedTask();

  const taskItems = visibleTasks.length
    ? visibleTasks.map((task) => {
        const active = task.taskId === state.activeTaskId ? "active" : "";
        const updatedAt = task.updatedAt ? formatDate(task.updatedAt) : "暂无更新时间";
        const status = task.status || "unknown";
        return `
          <button class="task-card ${active}" onclick="window.consoleWorkbench.navigateTask(${escapeHTML(JSON.stringify(task.taskId))})">
            <div class="task-card-head">
              <strong>${escapeHTML(shortText(task.title, state.taskRailCollapsed ? 16 : 28))}</strong>
              <span class="status-tag">${escapeHTML(status)}</span>
            </div>
            ${state.taskRailCollapsed ? "" : `
              <div class="task-card-body">
                <span>${escapeHTML(updatedAt)}</span>
                <span>当前 Agent：${task.currentAgent ? escapeHTML(shortText(task.currentAgent, 18)) : "暂无"}</span>
                <span>当前 SOP：${task.currentSopStep ? escapeHTML(shortText(task.currentSopStep, 18)) : "暂无"}</span>
              </div>
            `}
          </button>
        `;
      }).join("")
    : `<div class="empty-state">${state.loadingContext ? "Task 加载中..." : "当前项目暂无 Task"}<span>点击 [+ 新建任务] 开始工作。</span></div>`;

  return `
    <aside class="${railClass}">
      <div class="rail-header">
        <div>
          <span class="rail-kicker">Task</span>
          <h2>当前项目 Task</h2>
        </div>
        <button class="icon-btn" onclick="window.consoleWorkbench.toggleTaskRail()" title="收窄 / 展开">${state.taskRailCollapsed ? "»" : "«"}</button>
      </div>
      <div class="rail-body">
        <div class="task-rail-top">
          <button class="primary-btn" onclick="window.consoleWorkbench.openCreateTaskModal()">+ 新建任务</button>
          <div class="filter-row">${renderTaskFilters()}</div>
        </div>
        <div class="rail-list">${taskItems}</div>
        ${state.taskRailCollapsed ? "" : `
          <div class="rail-footer">
            <div class="mini-summary">
              <span>当前选中</span>
              <strong>${selectedTask ? escapeHTML(selectedTask.title) : "暂无 Task"}</strong>
            </div>
          </div>
        `}
      </div>
    </aside>
  `;
}

function renderMoreMenu() {
  if (!state.moreMenuOpen) return "";
  return `
    <div class="more-menu" onclick="event.stopPropagation()">
      <button onclick="window.consoleWorkbench.setWorkspacePreviewMode('sop')">预览工作区示例</button>
      <button onclick="window.consoleWorkbench.setWorkspacePreviewMode('run')">预览执行完成示例</button>
      <button onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例预览</button>
    </div>
  `;
}

function renderContextStrip() {
  const project = getSelectedProject();
  const task = getTaskDetailTask() || getSelectedTask();
  const summary = project?.statusSummary || parseProjectStatus(project?.statusOutput, project || {});
  const gitDirty = summary?.gitDirty === null ? "未明" : summary.gitDirty ? "dirty" : "clean";

  if (!task && !state.workspacePreviewMode) {
    return renderOnboardingPanel(project);
  }

  return `
    <section class="panel context-strip compact">
      <div class="context-title">
        <div>
          <span class="rail-kicker">Workspace</span>
          <h2>${escapeHTML(project?.displayName || project?.id || "未选择项目")}</h2>
        </div>
        <div class="context-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.refreshCurrentContext()">刷新</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.toggleMoreMenu()">更多操作</button>
        </div>
      </div>
      <div class="context-pill-row">
        <div class="context-pill"><span>项目</span><strong>${escapeHTML(project?.displayName || project?.id || "未选择")}</strong></div>
        <div class="context-pill"><span>任务</span><strong>${escapeHTML(task?.title || "未选择")}</strong></div>
        <div class="context-pill"><span>能力</span><strong>${getCapabilityCountLabel()}</strong></div>
        <div class="context-pill"><span>Agent</span><strong>${task?.currentAgent ? escapeHTML(task.currentAgent) : "未选择"}</strong></div>
        <div class="context-pill"><span>状态</span><strong>${escapeHTML(task?.status || "暂无")}</strong></div>
        <div class="context-pill"><span>Git</span><strong>${summary?.gitBranch ? `${escapeHTML(summary.gitBranch)} / ${escapeHTML(gitDirty)}` : escapeHTML(gitDirty)}</strong></div>
      </div>
      ${renderMoreMenu()}
    </section>
  `;
}

function renderOnboardingPanel(project) {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">工作区</span>
          <h3>当前项目：${escapeHTML(project?.displayName || project?.id || "未选择项目")}</h3>
        </div>
        <button class="primary-btn" onclick="window.consoleWorkbench.openCreateTaskModal()">+ 新建任务</button>
      </div>
      <div class="panel-body">
        <div class="hero-empty work-hero">
          <div class="empty-badge">还没有任务，或者尚未选择任务。</div>
          <p>从一句想法开始，例如“我想梳理这个项目结构……”。创建真实 Task 后，这里会进入任务工作流，而不是空白控制台。</p>
          <div class="button-row">
            <button class="primary-btn" onclick="window.consoleWorkbench.openCreateTaskModal()">+ 新建任务</button>
            <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderSopPreviewPanel() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">工作区示例</span>
          <h3>示例预览，不会写入真实 Task 数据。</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例</button>
        </div>
      </div>
      <div class="panel-body demo-workbench">
        <div class="demo-grid">
          <article class="summary-card demo-focus">
            <span>原始想法</span>
            <p>设计并实现 OpenCode Adapter 的任务工作流示例。</p>
            <div class="helper-text">当前任务标题仅用于视觉验收。</div>
          </article>
          <article class="summary-card">
            <span>结构化任务说明</span>
            <p>结构化任务说明将在 C.6-C 接入。</p>
          </article>
          <article class="summary-card">
            <span>选择 Skill / SOP</span>
            <p>尚未绑定能力</p>
            <button class="ghost-btn demo-inline" onclick="window.consoleWorkbench.showBannerNotice()">选择能力</button>
          </article>
        </div>
        <div class="sop-preview">
          <div class="sop-preview-head">
            <div>
              <span class="panel-kicker">SOP 时间线</span>
              <h4>当前步骤高亮，后续步骤待开始</h4>
            </div>
            <button class="ghost-btn" onclick="window.consoleWorkbench.showBannerNotice()">编辑本步骤指令</button>
          </div>
          <div class="sop-timeline">
            <div class="sop-step done"><span>1</span><strong>需求澄清</strong><em>已完成</em></div>
            <div class="sop-step done"><span>2</span><strong>选择能力</strong><em>已完成</em></div>
            <div class="sop-step active"><span>3</span><strong>生成任务专属 SOP</strong><em>当前步骤</em></div>
            <div class="sop-step"><span>4</span><strong>编辑最终 Prompt</strong><em>待开始</em></div>
            <div class="sop-step"><span>5</span><strong>执行当前步骤</strong><em>待开始</em></div>
          </div>
          <div class="sop-side">
            <div class="summary-card">
              <span>当前 Agent</span>
              <p>OpenCode</p>
            </div>
            <div class="summary-card">
              <span>当前步骤目标</span>
              <p>把用户想法转成结构化 SOP 草稿。</p>
            </div>
            <div class="summary-card wide">
              <span>下一步</span>
              <p>继续在 Prompt 与 SOP 中查看布局；此示例不会写入真实 Task。</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderRunPreviewPanel() {
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">工作区示例</span>
          <h3>示例预览，不代表真实 Agent 执行结果。</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例</button>
        </div>
      </div>
      <div class="panel-body demo-run">
        <div class="demo-run-summary">
          <div class="summary-card wide"><span>Run 摘要</span><p>执行状态：已完成 · Agent：OpenCode · 耗时：25 分钟</p></div>
          <div class="summary-card"><span>输出说明</span><p>展示的是示例内容，便于视觉验收 Agent 输出和产物布局。</p></div>
          <div class="summary-card"><span>执行日志摘要</span><p>计划输出、实时日志、最终回复、错误信息将按真实 Run 接入。</p></div>
        </div>
        <div class="callout">
          <strong>下一步</strong>
          <span>切换到 Agent 输出、产物或审批记录查看对应预览。</span>
        </div>
      </div>
    </section>
  `;
}

function renderRealWorkbench(task) {
  const model = taskActionModel(task);
  const description = task?.description || task?.raw?.description || task?.raw?.desc || "";
  const boundCapabilities = getBoundCapabilities();
  const boundCount = boundCapabilities.length;

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">工作区</span>
          <h3>${escapeHTML(task.title)}</h3>
        </div>
        <button class="primary-btn" onclick="window.consoleWorkbench.executePrimaryAction()">${escapeHTML(model.buttonLabel)}</button>
      </div>
      <div class="panel-body">
        <div class="demo-workbench real-workbench">
          <article class="summary-card">
            <span>任务说明</span>
            <p>${description ? escapeHTML(description) : "结构化任务说明将随 C.6-C 接入。"}</p>
          </article>
          <article class="summary-card">
            <span>当前状态</span>
            <p>${escapeHTML(task.status || "暂无")}</p>
          </article>
          <article class="summary-card">
            <span>当前步骤</span>
            <p>${escapeHTML(task.currentSopStep || "尚未生成 SOP")}</p>
          </article>
          <article class="summary-card">
            <span>下一步动作</span>
            <p>${escapeHTML(task.nextStep || model.nextStep)}</p>
          </article>
        </div>
        <div class="real-workbench-grid">
          <div class="work-column">
            <span class="panel-kicker">原始想法</span>
            <h4>${escapeHTML(task.title)}</h4>
            <p>${description ? escapeHTML(description) : "当前 Task 还没有补充描述。"}</p>
          </div>
          <div class="work-column">
            <span class="panel-kicker">选择 Skill / SOP</span>
            <h4>${boundCount ? `已绑定能力 ${boundCount} 项` : "尚未绑定能力"}</h4>
            <p>${boundCount ? "已绑定能力将作为后续 Prompt 与 SOP 生成的输入。" : "选择 Skill、SOP、Script 或 Prompt Template，为当前 Task 建立后续执行和 Prompt 的基础。"}</p>
            <div class="button-row">
              <button class="ghost-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">${boundCount ? "管理能力" : "选择能力"}</button>
            </div>
            ${boundCount ? `<div class="capability-pill-row">${boundCapabilities.map(renderCapabilityPill).join("")}</div>` : ""}
          </div>
          <div class="work-column">
            <span class="panel-kicker">当前步骤与下一步</span>
            <h4>${escapeHTML(task.currentSopStep || "尚未生成 SOP")}</h4>
            <p>${escapeHTML(task.nextStep || model.nextStep)}</p>
            <button class="primary-btn" onclick="window.consoleWorkbench.executePrimaryAction()">${escapeHTML(model.buttonLabel)}</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderWorkspaceTab() {
  const task = getTaskDetailTask() || getSelectedTask();
  if (!task && !state.workspacePreviewMode) return renderOnboardingPanel(getSelectedProject());
  if (state.workspacePreviewMode === "sop") return renderSopPreviewPanel();
  if (state.workspacePreviewMode === "run" && state.activeTab === "workbench") return renderRunPreviewPanel();
  if (!task) return renderOnboardingPanel(getSelectedProject());
  return renderRealWorkbench(task);
}

function renderCapabilityPill(entry) {
  return `
    <span class="capability-pill">
      <strong>${escapeHTML(entry.name || entry.id)}</strong>
      <em>${escapeHTML(capabilityTypeLabel(entry.type))}</em>
    </span>
  `;
}

function renderCapabilityBindingSummary() {
  const boundCapabilities = getBoundCapabilities();
  const count = boundCapabilities.length;
  const countLabel = count ? `${count} 项` : "未绑定";
  const leadCopy = count
    ? "已绑定能力将作为后续 Prompt 与 SOP 生成的输入。C.6-C 将基于当前 Task、绑定能力和项目规则生成真实内容。"
    : "选择 Skill、SOP、Script 或 Prompt Template，为当前 Task 建立后续执行和 Prompt 的基础。";

  return `
    <section class="capability-summary">
      <div class="capability-summary-head">
        <div>
          <span class="panel-kicker">Capability Binding</span>
          <h4>${count ? `已绑定能力 ${countLabel}` : "尚未绑定能力"}</h4>
          <p>${escapeHTML(leadCopy)}</p>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">${count ? "管理能力" : "选择能力"}</button>
        </div>
      </div>
      ${count ? `<div class="capability-pill-row">${boundCapabilities.map(renderCapabilityPill).join("")}</div>` : ""}
    </section>
  `;
}

function renderCapabilityBrowser() {
  const task = getTaskDetailTask() || getSelectedTask();
  const entries = getFilteredCapabilityEntries();
  const selectedIds = new Set(getSelectedCapabilityIds());
  const selectedCount = selectedIds.size;

  if (state.capabilityRegistryLoading) {
    return `
      <section class="capability-browser">
        <div class="capability-browser-head">
          <div>
            <span class="panel-kicker">Capability Registry</span>
            <h4>正在加载真实能力库</h4>
          </div>
        </div>
        <div class="empty-state roomy"><strong>正在读取 Registry ...</strong><span>请稍候，正在加载 15 条真实能力定义。</span></div>
      </section>
    `;
  }

  if (state.capabilityRegistryError) {
    return `
      <section class="capability-browser">
        <div class="capability-browser-head">
          <div>
            <span class="panel-kicker">Capability Registry</span>
            <h4>加载失败</h4>
          </div>
          <div class="panel-actions">
            <button class="ghost-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">重试</button>
          </div>
        </div>
        <div class="empty-state roomy"><strong>${escapeHTML(state.capabilityRegistryError)}</strong><span>Registry 读取失败时不会写入任何绑定。</span></div>
      </section>
    `;
  }

  const cards = entries.length ? entries.map((entry) => {
    const checked = selectedIds.has(entry.id);
    const expanded = state.capabilityExpandedId === entry.id;
    const risk = String(entry.riskLevel || "low");
    return `
      <article class="capability-card ${checked ? "selected" : ""} ${expanded ? "expanded" : ""}">
        <div class="capability-card-head">
          <label class="capability-check">
            <input type="checkbox" ${checked ? "checked" : ""} onchange="window.consoleWorkbench.toggleCapabilitySelection(${escapeHTML(JSON.stringify(entry.id))}, this.checked)">
          </label>
          <button class="capability-card-title" onclick="window.consoleWorkbench.toggleCapabilityExpanded(${escapeHTML(JSON.stringify(entry.id))})">
            <strong>${escapeHTML(entry.name || entry.id)}</strong>
            <span>${escapeHTML(entry.id)}</span>
          </button>
          <div class="capability-card-meta">
            <span class="status-tag type">${escapeHTML(capabilityTypeLabel(entry.type))}</span>
            <span class="status-tag risk risk-${escapeHTML(risk)}">${escapeHTML(risk)}</span>
            <span class="status-tag">${entry.canModifyProject ? "会修改项目" : "不修改项目"}</span>
          </div>
        </div>
        <div class="capability-card-body">
          <p>${escapeHTML(entry.description || "暂无说明")}</p>
          <div class="capability-card-foot">
            <span>风险：${escapeHTML(risk)}</span>
            <span>审批：${entry.requiresApproval ? "需要" : "不需要"}</span>
            <span>修改项目：${entry.canModifyProject ? "是" : "否"}</span>
          </div>
        </div>
        ${expanded ? `
          <div class="capability-detail">
            <div><span>description</span><strong>${escapeHTML(entry.description || "N/A")}</strong></div>
            <div><span>sourcePath</span><strong>${escapeHTML(entry.sourcePath || "N/A")}</strong></div>
            <div><span>riskLevel</span><strong>${escapeHTML(entry.riskLevel || "low")}</strong></div>
            <div><span>canModifyProject</span><strong>${entry.canModifyProject ? "true" : "false"}</strong></div>
            <div><span>requiresApproval</span><strong>${entry.requiresApproval ? "true" : "false"}</strong></div>
            <div><span>expectedArtifacts</span><strong>${escapeHTML((entry.expectedArtifacts || []).join(", ") || "N/A")}</strong></div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("") : `<div class="empty-state roomy"><strong>未找到匹配能力</strong><span>可以试试清空搜索，或切换类型筛选。</span></div>`;

  return `
    <section class="capability-browser">
      <div class="capability-browser-head">
        <div>
          <span class="panel-kicker">Capability Registry</span>
          <h4>浏览、筛选并绑定真实能力</h4>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.cancelCapabilityBinding()">取消</button>
          <button class="primary-btn" onclick="window.consoleWorkbench.saveCapabilityBinding()" ${state.capabilityBindingSaving ? "disabled" : ""}>${state.capabilityBindingSaving ? "保存中..." : "保存绑定"}</button>
        </div>
      </div>
      <div class="capability-toolbar">
        <input class="project-search" type="search" placeholder="搜索名称、描述或 ID" value="${escapeHTML(state.capabilitySearch)}" oninput="window.consoleWorkbench.setCapabilitySearch(this.value)">
        <div class="filter-row">
          ${capabilityTypeOptions().map((item) => `
            <button class="filter-chip ${state.capabilityTypeFilter === item.key ? "active" : ""}" onclick="window.consoleWorkbench.setCapabilityTypeFilter(${escapeHTML(JSON.stringify(item.key))})">${escapeHTML(item.label)}</button>
          `).join("")}
        </div>
      </div>
      <div class="capability-selection-meta">
        <span>已选择 ${selectedCount} 项</span>
        <span>${task ? `当前 Task：${escapeHTML(task.title)}` : "当前 Task：未选择"}</span>
      </div>
      ${state.capabilityBindingError ? `<div class="error-banner">${escapeHTML(state.capabilityBindingError)}</div>` : ""}
      <div class="capability-card-list">
        ${cards}
      </div>
      <div class="capability-browser-footer">
        <div class="capability-selected-strip">
          ${getSelectedCapabilityIds().length ? getSelectedCapabilityIds().map((id) => {
            const entry = getCapabilityList().find((item) => item.id === id);
            if (!entry) return "";
            return `<span class="capability-pill">${escapeHTML(entry.name || entry.id)}<em>${escapeHTML(capabilityTypeLabel(entry.type))}</em></span>`;
          }).join("") : `<span class="capability-empty-note">未选择能力</span>`}
        </div>
        <div class="capability-browser-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.cancelCapabilityBinding()">取消</button>
          <button class="primary-btn" onclick="window.consoleWorkbench.saveCapabilityBinding()" ${state.capabilityBindingSaving ? "disabled" : ""}>${state.capabilityBindingSaving ? "保存中..." : "保存绑定"}</button>
        </div>
      </div>
    </section>
  `;
}

function renderSopTimeline(steps) {
  if (!steps || !steps.length) return '<div class="empty-state compact"><span>暂无 SOP 步骤。</span></div>';
  return steps.map((step) => {
    const statusClass = step.status === "active" ? "sop-step active" : step.status === "done" || step.status === "completed" ? "sop-step done" : "sop-step";
    return `
      <div class="${statusClass}">
        <span>${escapeHTML(step.id)}</span>
        <strong>${escapeHTML(step.title)}</strong>
        <em>${escapeHTML(step.purpose)}</em>
        <span class="sop-step-meta">
          ${step.requiresApproval ? '<span class="status-tag">需审批</span>' : ""}
          <span class="status-tag">${escapeHTML(step.expectedArtifacts && step.expectedArtifacts.length ? step.expectedArtifacts.join(", ") : "")}</span>
        </span>
      </div>
    `;
  }).join("");
}

function renderFinalPromptArea() {
  const hasFinal = state.promptSopData && state.promptSopData.finalPrompt;
  if (!hasFinal) {
    return `
      <div class="editor-column">
        <label>最终 Prompt</label>
        <div class="empty-state compact"><span>尚未生成。请先生成 SOP 与 Prompt 草稿，然后点击 [生成最终 Prompt]。</span></div>
        <button class="primary-btn" onclick="window.consoleWorkbench.finalizePrompt()" ${state.sopGenerated ? "" : "disabled"}>生成最终 Prompt</button>
        <div class="helper-text">${state.sopGenerated ? "SOP 已生成，可以生成最终 Prompt。" : "请先生成 SOP。"}</div>
      </div>
    `;
  }
  return `
    <div class="editor-column">
      <label>最终 Prompt <button class="copy-btn" onclick="window.consoleWorkbench.copyFinalPrompt()" title="复制最终 Prompt">📋 复制</button></label>
      <pre class="prompt-preview final-prompt-preview">${escapeHTML(state.promptSopData.finalPrompt)}</pre>
    </div>
  `;
}

function renderPromptSopNotBound() {
  const count = getBoundCapabilities().length;
  if (!count) {
    return `
      <div class="prompt-sop-empty">
        <div class="summary-card wide">
          <span>需要先绑定至少一个 Capability</span>
          <p>才能生成当前 Task 的 SOP 与 Prompt。请在下方选择能力并保存绑定。</p>
        </div>
        <div class="button-row">
          <button class="primary-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">去选择能力</button>
        </div>
        ${state.capabilityOpen ? renderCapabilityBrowser() : ""}
      </div>
    `;
  }
  return `
    <div class="prompt-sop-ready">
      <div class="capability-pill-row">
        <span>已绑定能力：${count} 项</span>
        ${getBoundCapabilities().map(renderCapabilityPill).join("")}
      </div>
      <p>系统会基于当前 Task、项目规则和已绑定能力，生成可审核的 Task SOP 与 Prompt 草稿。</p>
      <div class="button-row">
        <button class="primary-btn" onclick="window.consoleWorkbench.generatePromptSop(false)" ${state.promptSopLoading ? "disabled" : ""}>${state.promptSopLoading ? "生成中..." : "生成 SOP 与 Prompt 草稿"}</button>
        <button class="ghost-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">管理能力</button>
      </div>
      ${state.capabilityOpen ? renderCapabilityBrowser() : ""}
    </div>
  `;
}

function renderPromptSopGenerated() {
  const data = state.promptSopData;
  const steps = (data && data.sop && data.sop.steps) || [];
  const promptDraft = (data && data.promptDraft) || "";

  return `
    <div class="prompt-sop-generated">
      <div class="sop-section">
        <div class="section-head">
          <span class="panel-kicker">A. Task SOP</span>
          <h4>SOP 时间线（共 ${steps.length} 步）</h4>
        </div>
        <div class="sop-timeline">${renderSopTimeline(steps)}</div>
      </div>

      <div class="prompt-section">
        <div class="section-head">
          <span class="panel-kicker">B. Prompt 草稿</span>
          <h4>可编辑草稿</h4>
        </div>
        <div class="editor-column">
          <label>补充要求（可选）</label>
          <textarea class="prompt-textarea user-supplement-input" placeholder="例如：不要修改文件，只做分析。先输出计划，不进入实施。重点检查 AGENTS.md 与目录职责。" oninput="window.consoleWorkbench.updateUserSupplement(this.value)">${escapeHTML(state.userSupplement)}</textarea>
          <div class="helper-text">保存后补充要求会进入 Prompt 草稿的「用户补充说明」区块。</div>
        </div>
        <div class="editor-column">
          <label>Prompt 草稿全文</label>
          <textarea class="prompt-textarea prompt-draft-editor" oninput="window.consoleWorkbench.updatePromptDraftContent(this.value)">${escapeHTML(promptDraft)}</textarea>
          <div class="button-row">
            <button class="primary-btn" onclick="window.consoleWorkbench.saveEditedPromptDraft()">保存草稿</button>
            <button class="ghost-btn" onclick="window.consoleWorkbench.generatePromptSop(true)">重新生成草稿</button>
          </div>
        </div>
      </div>

      <div class="final-section">
        <div class="section-head">
          <span class="panel-kicker">C. 最终 Prompt</span>
          <h4>${state.promptFinalized ? "已生成" : "尚未生成"}</h4>
        </div>
        <div class="prompt-editor-layout">${renderFinalPromptArea()}</div>
      </div>
    </div>
  `;
}

function renderPromptSopContent() {
  if (state.promptSopLoading) {
    return '<div class="empty-state roomy"><strong>正在加载...</strong><span>请稍候。</span></div>';
  }
  if (state.promptSopError && !state.sopGenerated) {
    return `<div class="error-banner">${escapeHTML(state.promptSopError)}</div>`;
  }

  if (state.sopGenerated && state.promptSopData) {
    return renderPromptSopGenerated();
  }

  return renderPromptSopNotBound();
}

function renderPromptTab() {
  return `
    <section class="panel tab-panel ${state.promptFullscreen ? "fullscreen" : ""}">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Prompt 与 SOP</span>
          <h3>Task SOP + Prompt 生成</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">${getBoundCapabilities().length ? "管理能力" : "选择能力"}</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.togglePromptFullscreen()">${state.promptFullscreen ? "退出全屏" : "全屏"}</button>
        </div>
      </div>
      <div class="panel-body prompt-body">
        ${renderCapabilityBindingSummary()}
        ${state.capabilityOpen ? renderCapabilityBrowser() : ""}
        ${renderPromptSopContent()}
      </div>
    </section>
  `;
}

function renderAgentTab() {
  if (state.workspacePreviewMode === "run") {
    return `
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Agent 输出</span>
            <h3>示例预览，不代表真实 Agent 执行结果。</h3>
          </div>
          <button class="ghost-btn" onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例</button>
        </div>
        <div class="panel-body">
          <div class="run-summary-grid">
            <div class="summary-card wide"><span>当前 Run</span><p>Run #20260705-001 · 已完成</p></div>
            <div class="summary-card"><span>Agent</span><p>OpenCode</p></div>
            <div class="summary-card"><span>开始时间</span><p>2026-07-05 10:50</p></div>
            <div class="summary-card"><span>结束时间</span><p>2026-07-05 11:15</p></div>
            <div class="summary-card"><span>耗时</span><p>25 分钟</p></div>
            <div class="summary-card wide"><span>执行日志摘要</span><p>计划输出、实时日志、最终回复、错误信息将按真实 Run 接入。</p></div>
          </div>
          <div class="button-row">
            <button class="primary-btn" onclick="window.consoleWorkbench.showBannerNotice()">下一步操作</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Agent 输出</span>
          <h3>尚未执行</h3>
        </div>
        <button class="ghost-btn" onclick="window.consoleWorkbench.showBannerNotice()">预留输出面板</button>
      </div>
      <div class="panel-body">
        <div class="empty-state roomy">
          <strong>当前阶段尚未接入真实 Agent。</strong>
          <span>这里会预留计划输出、实时日志、最终回复、Run 状态、错误信息以及停止 / 重试入口，但不会生成假日志。</span>
        </div>
        <div class="future-stack">
          <div class="future-card">计划输出</div>
          <div class="future-card">实时日志</div>
          <div class="future-card">最终回复</div>
          <div class="future-card">Run 状态</div>
          <div class="future-card">错误信息</div>
          <div class="future-card">停止 / 重试</div>
        </div>
      </div>
    </section>
  `;
}

function renderArtifactTab() {
  if (state.workspacePreviewMode === "run") {
    return `
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">产物</span>
            <h3>示例预览，不代表真实产物写入。</h3>
          </div>
          <button class="ghost-btn" onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例</button>
        </div>
        <div class="panel-body">
          <div class="artifact-group">
            <div class="artifact-group-head"><strong>Step 3 · Adapter 架构设计与接口定义</strong><span>3 个文件</span></div>
            <div class="artifact-list">
              <div class="artifact-row">adapter-architecture.md · 12.3 KB</div>
              <div class="artifact-row">adapter-interface-definition.md · 8.7 KB</div>
              <div class="artifact-row">adapter-data-model.json · 6.1 KB</div>
            </div>
          </div>
          <div class="artifact-group">
            <div class="artifact-group-head"><strong>来源说明</strong><span>示例内容</span></div>
            <div class="artifact-list">
              <div class="artifact-row">来源步骤：当前 SOP 步骤</div>
              <div class="artifact-row">来源 Run：Run #20260705-001</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  const taskDetail = state.taskDetail || {};
  const task = getTaskDetailTask() || getSelectedTask();
  const runs = Array.isArray(taskDetail.runs) ? taskDetail.runs : [];

  const runGroups = runs.length
    ? runs.map((run) => {
        const artifacts = Array.isArray(run.artifacts) ? run.artifacts : [];
        return `
          <article class="artifact-group">
            <div class="artifact-group-head">
              <strong>${escapeHTML(run.runId || "Run")}</strong>
              <span>${artifacts.length ? `${artifacts.length} 个产物` : "暂无产物"}</span>
            </div>
            <div class="artifact-list">
              ${artifacts.length ? artifacts.map((artifact) => `<div class="artifact-row">${escapeHTML(artifact)}</div>`).join("") : `<div class="artifact-row muted">Run 目录已预留，当前无 Artifact。</div>`}
            </div>
          </article>
        `;
      }).join("")
    : "";

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">产物</span>
          <h3>Task → SOP 步骤 → Run → Artifact</h3>
        </div>
        <button class="ghost-btn" onclick="window.consoleWorkbench.showBannerNotice()">产物筛选预留</button>
      </div>
      <div class="panel-body">
        ${task ? `
          <div class="callout">
            <strong>当前 Task：${escapeHTML(task.title)}</strong>
            <span>未来会按 SOP 步骤分组查看报告、日志、图片、Markdown、JSON。当前只显示结构骨架和已有真实条目。</span>
          </div>
        ` : `
          <div class="empty-state roomy">
            <strong>当前没有可浏览的产物。</strong>
            <span>先选择一个 Task，后续才会按 Run 生成 Artifact。这里不会创建任何 artifact-index.json。</span>
          </div>
        `}

        ${runGroups || `<div class="empty-state roomy"><strong>暂无 Run。</strong><span>当前不会创建任何 artifact-index.json，也不会伪造测试产物。</span></div>`}
      </div>
    </section>
  `;
}

function renderApprovalsTab() {
  if (state.workspacePreviewMode === "run") {
    return `
      <section class="panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">审批记录</span>
            <h3>示例预览，不会写入真实审批数据。</h3>
          </div>
          <button class="ghost-btn" onclick="window.consoleWorkbench.clearWorkspacePreviewMode()">关闭示例</button>
        </div>
        <div class="panel-body">
          <div class="approval-card">
            <strong>当前审批状态</strong>
            <div class="approval-meta"><span>状态：等待人工确认</span><span>说明：示例预览</span></div>
          </div>
          <div class="approval-card">
            <strong>已完成项</strong>
            <div class="approval-meta"><span>结构设计</span><span>输出整理</span><span>报告路径记录</span></div>
          </div>
          <div class="approval-card">
            <strong>下一步动作</strong>
            <div class="approval-meta"><span>点击审批按钮仅作视觉演示，不会提交真实数据。</span></div>
          </div>
          <div class="button-row">
            <button class="primary-btn" onclick="window.consoleWorkbench.showBannerNotice()">审批按钮（示例）</button>
          </div>
        </div>
      </section>
    `;
  }

  const taskDetail = state.taskDetail || {};
  const task = getTaskDetailTask() || getSelectedTask();
  const approvals = Array.isArray(taskDetail.approvals) ? taskDetail.approvals : [];

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">审批记录</span>
          <h3>任务状态与已有审批</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.approveTask()">Approve</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.reviewTask()">Review</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.closeTask()">Close</button>
        </div>
      </div>
      <div class="panel-body">
        ${task ? `
          <div class="summary-card wide">
            <span>当前 Task 状态</span>
            <p>${escapeHTML(task.status || "暂无")}</p>
          </div>
        ` : `<div class="empty-state roomy"><strong>尚未选中 Task。</strong><span>没有可展示的审批信息。</span></div>`}

        ${approvals.length ? approvals.map((item) => `
          <article class="approval-card">
            <strong>${escapeHTML(item.approvalId || item.id || "审批记录")}</strong>
            <div class="approval-meta">
              <span>类型：${escapeHTML(item.type || "unknown")}</span>
              <span>状态：${escapeHTML(item.status || "unknown")}</span>
              <span>时间：${escapeHTML(formatDate(item.decidedAt || item.createdAt || item.updatedAt || ""))}</span>
            </div>
          </article>
        `).join("") : `<div class="empty-state roomy"><strong>当前没有已有审批。</strong><span>这里不会新增审批逻辑，只保留已有状态与记录的展示位。</span></div>`}
      </div>
    </section>
  `;
}

function renderTabs() {
  const task = getTaskDetailTask() || getSelectedTask();
  if (!task && !state.workspacePreviewMode) {
    return `
      <div class="workspace-landing">
        ${renderWorkspaceTab()}
      </div>
    `;
  }

  const tabs = [
    ["workbench", "工作区"],
    ["prompt", "Prompt 与 SOP"],
    ["agent", "Agent 输出"],
    ["artifact", "产物"],
    ["approvals", "审批记录"]
  ];

  const tabButtons = tabs.map(([key, label]) => `
    <button class="tab-btn ${state.activeTab === key ? "active" : ""}" onclick="window.consoleWorkbench.setTab(${escapeHTML(JSON.stringify(key))})">${escapeHTML(label)}</button>
  `).join("");

  let tabContent = renderWorkspaceTab();
  if (state.activeTab === "prompt") tabContent = renderPromptTab();
  if (state.activeTab === "agent") tabContent = renderAgentTab();
  if (state.activeTab === "artifact") tabContent = renderArtifactTab();
  if (state.activeTab === "approvals") tabContent = renderApprovalsTab();

  return `
    ${state.workspacePreviewMode ? `<div class="demo-banner">示例预览，不会写入真实 Task 数据。</div>` : ""}
    <div class="tab-strip">${tabButtons}</div>
    <div class="tab-content">${tabContent}</div>
  `;
}

function renderProjectDrawer() {
  if (!state.projectDrawerOpen) return "";
  const project = getSelectedProject();
  const summary = project?.statusSummary || parseProjectStatus(project?.statusOutput, project || {});
  return `
    <div class="drawer-mask" onclick="window.consoleWorkbench.toggleProjectDrawer()"></div>
    <aside class="drawer-panel">
      <div class="drawer-head">
        <div>
          <span class="rail-kicker">Project Detail</span>
          <h3>${project ? escapeHTML(project.displayName || project.id) : "Project Detail"}</h3>
        </div>
        <button class="icon-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">×</button>
      </div>
      <div class="drawer-body">
        <div class="detail-card">
          <span>Project Path</span>
          <strong>${project?.rootPath ? escapeHTML(project.rootPath) : "N/A"}</strong>
        </div>
        <div class="detail-grid">
          <div class="detail-card"><span>Git Branch</span><strong>${summary?.gitBranch ? escapeHTML(summary.gitBranch) : "N/A"}</strong></div>
          <div class="detail-card"><span>Git Dirty</span><strong>${summary?.gitDirty === null ? "N/A" : summary.gitDirty ? "dirty" : "clean"}</strong></div>
          <div class="detail-card"><span>Git Remote</span><strong>${summary?.gitRemote ? escapeHTML(summary.gitRemote) : "N/A"}</strong></div>
          <div class="detail-card"><span>AGENTS.md</span><strong>${summary?.agentsMd ? "present" : "N/A"}</strong></div>
          <div class="detail-card"><span>.ai / AI Memory</span><strong>${summary?.aiMemory ? "present" : "N/A"}</strong></div>
          <div class="detail-card"><span>Project State</span><strong>${escapeHTML(summary?.projectState || "unknown")}</strong></div>
        </div>
        <div class="detail-card full">
          <span>Registered At</span>
          <strong>${project?.addedAt ? escapeHTML(formatDate(project.addedAt)) : "N/A"}</strong>
        </div>
        <div class="detail-note">
          Git, AGENTS.md, and .ai are summarized here without rebuilding CLI state logic.
        </div>
      </div>
    </aside>
  `;
}

function renderModal() {
  if (!state.createTaskOpen) return "";
  return `
    <div class="modal-mask" onclick="window.consoleWorkbench.closeModal()"></div>
    <div class="modal-panel" onclick="event.stopPropagation()">
      <div class="modal-head">
        <h3>新建任务</h3>
        <button class="icon-btn" onclick="window.consoleWorkbench.closeModal()">×</button>
      </div>
      <div class="modal-body">
        <label>任务描述</label>
        <textarea class="modal-textarea" oninput="window.consoleWorkbench.setCreateTaskDesc(this.value)" placeholder="输入本次任务的描述...">${escapeHTML(state.createTaskDesc)}</textarea>
        <div class="helper-text">这会调用现有 API 创建真实 Task，不会自动创建任何测试数据以外的内容。</div>
      </div>
      <div class="modal-actions">
        <button class="ghost-btn" onclick="window.consoleWorkbench.closeModal()">取消</button>
        <button class="primary-btn" onclick="window.consoleWorkbench.submitCreateTask()">创建任务</button>
      </div>
    </div>
  `;
}

function renderBanner() {
  if (!state.banner) return "";
  return `<div class="banner ${escapeHTML(state.banner.type)}">${escapeHTML(state.banner.text)}</div>`;
}

function renderMain() {
  const shellClass = [
    "workbench-shell",
    `app-section-${state.activeAppSection}`,
    state.projectRailCollapsed ? "project-collapsed" : "",
    state.taskRailCollapsed ? "task-collapsed" : ""
  ].join(" ");

  return `
    <div class="app-bg"></div>
    <div class="app-shell ${shellClass}">
      <header class="topbar">
        <div>
          <span class="app-kicker">AI Coding Console</span>
          <h1>新版 Web 工作台</h1>
        </div>
        <div class="topbar-actions">
          <span class="topbar-badge">C.5 / Workbench</span>
          <button class="ghost-btn" onclick="window.consoleWorkbench.refreshCurrentContext()">刷新</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
        </div>
      </header>

      <div class="workbench-body">
        ${renderAppRail()}
        <div class="workbench-grid">
          ${renderProjectRail()}
          ${renderTaskRail()}
          <main class="workspace">
            ${renderBanner()}
            ${state.error ? `<div class="error-banner">${escapeHTML(state.error)}</div>` : ""}
            ${renderContextStrip()}
            ${renderTabs()}
          </main>
        </div>
      </div>
      ${renderProjectDrawer()}
      ${renderModal()}
    </div>
  `;
}

function render() {
  const root = $("#app");
  if (!root) return;
  root.innerHTML = renderMain();
}

async function refreshCurrentContext() {
  await handleRoute();
}

function showBannerNotice() {
  showStageNotice();
}

function toggleSourceFoldout() {
  state.sourceFoldoutOpen = !state.sourceFoldoutOpen;
  render();
}

function navigateProject(projectId) {
  state.activeAppSection = "projects";
  setHash(projectId);
}

function navigateTask(taskId) {
  if (!state.activeProjectId) return;
  setHash(state.activeProjectId, taskId);
}

function updateUserSupplement(value) {
  state.userSupplement = value;
  if (state.promptSopData && state.promptSopData.promptDraft) {
    state.promptSopData.promptDraft = state.promptSopData.promptDraft.replace(
      /## 用户补充说明[\s\S]*$/,
      "## 用户补充说明\n" + value
    );
  }
  render();
}

function updatePromptDraftContent(value) {
  if (state.promptSopData) {
    state.promptSopData.promptDraft = value;
    const suppMatch = value.match(/## 用户补充说明\n([\s\S]*)$/);
    if (suppMatch) state.userSupplement = suppMatch[1].trim();
  }
  render();
}

async function copyFinalPrompt() {
  if (!state.promptSopData || !state.promptSopData.finalPrompt) return;
  try {
    await navigator.clipboard.writeText(state.promptSopData.finalPrompt);
    setBanner("success", "最终 Prompt 已复制到剪贴板。");
  } catch {
    setBanner("error", "复制失败，请手动选择文本。");
  }
  render();
}

const consoleWorkbench = {
  navigateProject,
  navigateTask,
  handleAppRail,
  toggleProjectRail,
  toggleTaskRail,
  toggleProjectDrawer,
  toggleCapabilityPanel,
  openCapabilityPanel,
  closeCapabilityPanel,
  togglePromptEditor,
  togglePromptFullscreen,
  toggleSourceFoldout,
  toggleMoreMenu,
  setWorkspacePreviewMode,
  clearWorkspacePreviewMode,
  setTaskFilter,
  setProjectSearch,
  setCapabilitySearch,
  setCapabilityTypeFilter,
  toggleCapabilitySelection,
  toggleCapabilityExpanded,
  setTab,
  openCreateTaskModal,
  closeModal,
  setCreateTaskDesc,
  setPromptDraft,
  submitCreateTask,
  saveCapabilityBinding,
  cancelCapabilityBinding,
  showBannerNotice,
  executePrimaryAction,
  previewFinalPrompt,
  savePromptDraft,
  approveTask,
  reviewTask,
  closeTask,
  refreshCurrentContext,
  loadPromptSop,
  generatePromptSop,
  saveEditedPromptDraft,
  finalizePrompt,
  updateUserSupplement,
  updatePromptDraftContent,
  copyFinalPrompt
};

window.consoleWorkbench = consoleWorkbench;
window.addEventListener("hashchange", () => {
  handleRoute().catch((error) => {
    setBanner("error", `路由加载失败：${error.message}`);
    render();
  });
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadProjects();
    await handleRoute();
  } catch (error) {
    setBanner("error", `初始化失败：${error.message}`);
    render();
  }
});

// ---- D-1 Plan Run wiring ----

Object.assign(state, {
  planRuns: [],
  selectedRunId: "",
  selectedRunDetail: null,
  planRunLoading: false,
  planRunLaunching: false,
  planRunError: "",
  planRunNotice: ""
});

function getCurrentFinalPrompt() {
  return state.promptSopData && state.promptSopData.finalPrompt ? String(state.promptSopData.finalPrompt) : "";
}

function getSelectedRunSummary() {
  if (state.selectedRunDetail && state.selectedRunDetail.summary) {
    return state.selectedRunDetail.summary;
  }
  if (!state.selectedRunId) return null;
  return state.planRuns.find((item) => item.runId === state.selectedRunId) || null;
}

function runStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  if (value === "completed") return "已完成";
  if (value === "failed") return "失败";
  if (value === "unsafe_modified") return "安全失败";
  if (value === "running") return "运行中";
  return value || "未知";
}

function formatIso(value) {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { hour12: false });
}

function renderPlanRunLauncher() {
  const finalPrompt = getCurrentFinalPrompt();
  const task = getTaskDetailTask() || getSelectedTask();

  if (!task) {
    return `
      <section class="stacked">
        <div class="stacked-toggle">
          <strong>Plan Run</strong>
          <span class="status-tag">D-1</span>
        </div>
        <div class="stacked-content">
          <p>尚未选择 Task，无法启动 OpenCode Plan Run。</p>
        </div>
      </section>
    `;
  }

  if (!finalPrompt) {
    return `
      <section class="stacked">
        <div class="stacked-toggle">
          <strong>Plan Run</strong>
          <span class="status-tag">未准备</span>
        </div>
        <div class="stacked-content">
          <p>尚未生成 Final Prompt，当前不能启动 OpenCode Plan Run。</p>
        </div>
      </section>
    `;
  }

  const selectedRun = getSelectedRunSummary();
  const currentStatus = selectedRun ? runStatusLabel(selectedRun.status) : "未运行";
  const message = state.planRunLaunching
    ? "正在调用 OpenCode 生成 Plan，期间不会进入 Build。"
    : (selectedRun && selectedRun.status === "completed"
      ? "等待人工审批，尚未允许 Build。"
      : "仅生成计划，不会进入代码实施。");

  return `
    <section class="stacked">
      <div class="stacked-toggle">
        <strong>OpenCode Plan Run</strong>
        <span class="status-tag">${escapeHTML(currentStatus)}</span>
      </div>
      <div class="stacked-content">
        <p>${escapeHTML(message)}</p>
        <div class="button-row">
          <button class="primary-btn" onclick="window.consoleWorkbench.startPlanRun()" ${state.planRunLaunching ? "disabled" : ""}>
            ${state.planRunLaunching ? "正在生成..." : "使用 OpenCode 生成 Plan"}
          </button>
        </div>
        ${state.planRunError ? `<div class="error-banner">${escapeHTML(state.planRunError)}</div>` : ""}
        ${state.planRunNotice ? `<div class="banner success">${escapeHTML(state.planRunNotice)}</div>` : ""}
      </div>
    </section>
  `;
}

function renderPlanRunSummaryCard(run) {
  return `
    <article class="summary-card wide">
      <span>Run ${escapeHTML(run.runId || "")}</span>
      <p>${escapeHTML(runStatusLabel(run.status))} · ${escapeHTML(formatIso(run.startedAt || run.createdAt))} → ${escapeHTML(formatIso(run.finishedAt))}</p>
      <div class="capability-card-foot">
        <span>Agent: ${escapeHTML(run.agentType || "opencode")}</span>
        <span>Exit: ${run.exitCode === null || run.exitCode === undefined ? "n/a" : escapeHTML(String(run.exitCode))}</span>
        <span>审批: ${escapeHTML(run.approvalStatus || "pending")}</span>
      </div>
    </article>
  `;
}

function renderRunDetailView() {
  const run = state.selectedRunDetail;
  if (!run) {
    return `
      <div class="empty-state roomy">
        <strong>尚未选择 Run</strong>
        <span>这里会显示已生成的 Plan、Run 元数据和等待人工审批的状态。</span>
      </div>
    `;
  }

  const runRecord = run.run || {};

  return `
    <div class="grid-two">
      <section class="artifact-group">
        <div class="artifact-group-head">
          <strong>Run 元数据</strong>
          <span>${escapeHTML(runStatusLabel(runRecord.status || run.summary?.status))}</span>
        </div>
        <div class="artifact-list">
          <div class="artifact-row">Run ID: ${escapeHTML(runRecord.runId || run.summary?.runId || "")}</div>
          <div class="artifact-row">Task ID: ${escapeHTML(runRecord.taskId || run.summary?.taskId || "")}</div>
          <div class="artifact-row">Project ID: ${escapeHTML(runRecord.projectId || run.summary?.projectId || "")}</div>
          <div class="artifact-row">Created: ${escapeHTML(formatIso(runRecord.createdAt || run.summary?.createdAt))}</div>
          <div class="artifact-row">Started: ${escapeHTML(formatIso(runRecord.startedAt || run.summary?.startedAt))}</div>
          <div class="artifact-row">Finished: ${escapeHTML(formatIso(runRecord.finishedAt || run.summary?.finishedAt))}</div>
          <div class="artifact-row">Exit code: ${runRecord.exitCode === null || runRecord.exitCode === undefined ? "n/a" : escapeHTML(String(runRecord.exitCode))}</div>
          <div class="artifact-row">Approval status: ${escapeHTML(runRecord.approvalStatus || run.summary?.approvalStatus || "pending")}</div>
          <div class="artifact-row">Session ref: ${escapeHTML(runRecord.sessionRef || run.summary?.sessionRef || "n/a")}</div>
        </div>
      </section>
      <section class="artifact-group">
        <div class="artifact-group-head">
          <strong>安全检查</strong>
          <span>${escapeHTML(runRecord.status === "unsafe_modified" ? "unsafe_modified" : "checked")}</span>
        </div>
        <div class="artifact-list">
          <div class="artifact-row">Read only: ${escapeHTML(runRecord.readOnlyEnforcement || "prompt_and_post_run_git_check")}</div>
          <div class="artifact-row">Changed files: ${(run.baseline && Array.isArray(run.baseline.changedFiles) && run.baseline.changedFiles.length) ? escapeHTML(run.baseline.changedFiles.join(", ")) : "none"}</div>
          <div class="artifact-row">Safety verdict: ${escapeHTML(run.baseline?.safetyVerdict || "unknown")}</div>
          <div class="artifact-row">Post-run worktree: ${escapeHTML(run.baseline?.post?.statusShort ? "dirty" : "clean")}</div>
        </div>
      </section>
    </div>
    <section class="artifact-group">
      <div class="artifact-group-head">
        <strong>Plan Markdown</strong>
        <span>${escapeHTML((run.plan || "").length ? `${run.plan.length} chars` : "empty")}</span>
      </div>
      <div class="artifact-list">
        <pre class="prompt-preview final-prompt-preview">${escapeHTML(run.plan || "Plan markdown is empty.")}</pre>
      </div>
    </section>
    <section class="artifact-group">
      <div class="artifact-group-head">
        <strong>原始 JSONL</strong>
        <span>${escapeHTML((run.rawOutput || "").length ? `${run.rawOutput.length} chars` : "empty")}</span>
      </div>
      <div class="artifact-list">
        <pre class="prompt-preview final-prompt-preview">${escapeHTML(run.rawOutput || "No raw output captured.")}</pre>
      </div>
    </section>
    <div class="banner warn">等待人工审批，尚未允许 Build。</div>
  `;
}

async function loadPlanRuns() {
  if (!state.activeProjectId || !state.activeTaskId) {
    state.planRuns = [];
    state.selectedRunId = "";
    state.selectedRunDetail = null;
    state.planRunError = "";
    return;
  }

  state.planRunError = "";
  state.planRunLoading = true;
  render();
  try {
    const result = await apiGet(`/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/runs`);
    state.planRuns = Array.isArray(result.runs) ? result.runs : [];
    if (!state.selectedRunId || !state.planRuns.some((item) => item.runId === state.selectedRunId)) {
      state.selectedRunId = state.planRuns[0] ? state.planRuns[0].runId : "";
    }
    if (state.selectedRunId) {
      await loadPlanRunDetail(state.selectedRunId);
    } else {
      state.selectedRunDetail = null;
    }
  } catch (error) {
    state.planRuns = [];
    state.selectedRunDetail = null;
    state.planRunError = error.message || "加载 Run 列表失败";
  } finally {
    state.planRunLoading = false;
    render();
  }
}

async function loadPlanRunDetail(runId) {
  if (!state.activeProjectId || !state.activeTaskId || !runId) {
    state.selectedRunDetail = null;
    return;
  }
  const result = await apiGet(`/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/runs/${encodeURIComponent(runId)}`);
  state.selectedRunDetail = result;
  state.selectedRunId = runId;
  render();
}

async function startPlanRun() {
  if (!state.activeProjectId || !state.activeTaskId) {
    setBanner("error", "请先选择真实 Task。");
    render();
    return;
  }
  if (!getCurrentFinalPrompt()) {
    setBanner("error", "尚未生成 Final Prompt，不能启动 Plan Run。");
    render();
    return;
  }

  state.planRunLaunching = true;
  state.planRunError = "";
  state.planRunNotice = "";
  setBanner("info", "正在调用 OpenCode 生成 Plan，只会生成计划。");
  render();

  try {
    const result = await apiPost(
      `/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}/runs/plan`,
      {}
    );
    if (result && result.run) {
      state.selectedRunId = result.run.runId || "";
      state.planRunNotice = result.run.status === "completed"
        ? "等待人工审批，尚未允许 Build。"
        : "Plan Run 已记录。";
    }
    await loadPlanRuns();
    if (result && result.run) {
      await loadPlanRunDetail(result.run.runId);
    }
    setBanner(result && result.run && result.run.status === "completed" ? "success" : "warn", state.planRunNotice);
    render();
  } catch (error) {
    state.planRunError = error.message || "Plan Run 失败";
    setBanner("error", state.planRunError);
    render();
  } finally {
    state.planRunLaunching = false;
    render();
  }
}

function renderPromptTab() {
  const task = getTaskDetailTask() || getSelectedTask();
  return `
    <section class="panel tab-panel ${state.promptFullscreen ? "fullscreen" : ""}">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Prompt 与 SOP</span>
          <h3>Task SOP + Prompt 生成</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.openCapabilityPanel()">${getBoundCapabilities().length ? "管理能力" : "选择能力"}</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.togglePromptFullscreen()">${state.promptFullscreen ? "退出全屏" : "全屏"}</button>
        </div>
      </div>
      <div class="panel-body prompt-body">
        ${renderCapabilityBindingSummary()}
        ${state.capabilityOpen ? renderCapabilityBrowser() : ""}
        ${renderPromptSopContent()}
        ${renderPlanRunLauncher()}
        <div class="summary-card wide">
          <span>当前 Task</span>
          <p>${escapeHTML(task ? task.title : "未选择 Task")}</p>
        </div>
      </div>
    </section>
  `;
}

function renderAgentTab() {
  const runs = Array.isArray(state.planRuns) ? state.planRuns : [];
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Agent 输出</span>
          <h3>Plan Run 记录</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.loadPlanRuns()">刷新 Run 列表</button>
        </div>
      </div>
      <div class="panel-body">
        ${state.planRunLoading ? `<div class="empty-state roomy"><strong>正在加载 Run ...</strong><span>请稍候。</span></div>` : ""}
        ${state.planRunError ? `<div class="error-banner">${escapeHTML(state.planRunError)}</div>` : ""}
        ${runs.length ? `
          <div class="grid-two">
            <div class="artifact-group">
              <div class="artifact-group-head">
                <strong>Run 列表</strong>
                <span>${escapeHTML(String(runs.length))}</span>
              </div>
              <div class="artifact-list">
                ${runs.map((run) => `
                  <button class="task-card ${state.selectedRunId === run.runId ? "active" : ""}" onclick="window.consoleWorkbench.loadPlanRunDetail(${escapeHTML(JSON.stringify(run.runId))})">
                    <div class="task-card-head">
                      <strong>${escapeHTML(run.runId)}</strong>
                      <span class="status-tag">${escapeHTML(runStatusLabel(run.status))}</span>
                    </div>
                    <div class="task-card-body">
                      <span>${escapeHTML(formatIso(run.startedAt || run.createdAt))}</span>
                      <span>Exit: ${run.exitCode === null || run.exitCode === undefined ? "n/a" : escapeHTML(String(run.exitCode))}</span>
                      <span>审批: ${escapeHTML(run.approvalStatus || "pending")}</span>
                    </div>
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="artifact-group">
              <div class="artifact-group-head">
                <strong>Run 详情</strong>
                <span>${escapeHTML(state.selectedRunDetail?.run?.runId || state.selectedRunId || "未选择")}</span>
              </div>
              <div class="artifact-list">
                ${renderRunDetailView()}
              </div>
            </div>
          </div>
        ` : `
          <div class="empty-state roomy">
            <strong>尚未生成正式 Run</strong>
            <span>先在 Prompt 与 SOP Tab 生成 Final Prompt，再使用 OpenCode 启动 Plan Run。</span>
          </div>
        `}
      </div>
    </section>
  `;
}

function renderApprovalsTab() {
  const selected = getSelectedRunSummary();
  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">审批记录</span>
          <h3>D-1 仅保留等待人工审批提示</h3>
        </div>
      </div>
      <div class="panel-body">
        <div class="empty-state roomy">
          <strong>${selected ? "等待人工审批，尚未允许 Build。" : "当前没有可审批的正式 Run。"}</strong>
          <span>Stage D-1 只会生成 Plan，不提供 Build、Review、Close 或审批动作。</span>
        </div>
        ${selected ? renderPlanRunSummaryCard(selected) : ""}
      </div>
    </section>
  `;
}

const refreshActiveTaskBase = refreshActiveTask;
refreshActiveTask = async function refreshActiveTaskD1() {
  await refreshActiveTaskBase();
  await loadPlanRuns();
};

Object.assign(window.consoleWorkbench, {
  loadPlanRuns,
  loadPlanRunDetail,
  startPlanRun
});
