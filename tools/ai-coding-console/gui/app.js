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
  setBanner("warn", "阶段 C.6 能力尚未接入，当前仅保留工作台布局与占位交互。");
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
    render();
    return;
  }

  state.loadingTaskDetail = true;
  render();
  try {
    const detail = await apiGet(`/api/tasks/${encodeURIComponent(state.activeProjectId)}/${encodeURIComponent(state.activeTaskId)}`);
    if (state.activeTaskId) state.taskDetail = detail;
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
  const gitDirty = summary?.gitDirty === null ? "未知" : summary.gitDirty ? "dirty" : "clean";

  if (!task && !state.workspacePreviewMode) {
    return `
      <section class="panel hero-panel">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Workspace</span>
            <h3>${project ? escapeHTML(project.displayName || project.id) : "未选择项目"}</h3>
          </div>
          <div class="panel-actions">
            <button class="ghost-btn" onclick="window.consoleWorkbench.refreshCurrentContext()">刷新</button>
            <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="hero-empty">
            <div class="context-compact">
              <span class="panel-kicker">工作区</span>
              <h3>当前项目：${project ? escapeHTML(project.displayName || project.id) : "未选择项目"}</h3>
            </div>
            <p>还没有任务，或者尚未选择任务。先从一句想法开始，创建一个 Task，右侧工作区就会进入完整流程。</p>
            <div class="button-row">
              <button class="primary-btn" onclick="window.consoleWorkbench.openCreateTaskModal()">+ 新建任务</button>
              <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
            </div>
            <div class="hero-sample">“我想梳理这个项目结构……”</div>
          </div>
        </div>
      </section>
    `;
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
        <div class="context-pill"><span>能力</span><strong>${task?.currentSopStep ? escapeHTML(task.currentSopStep) : "未绑定"}</strong></div>
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
          <p>从一句想法开始，先新建一个 Task。当前界面会保持聚焦，不会提前铺开 Prompt、Agent 输出或产物空壳。</p>
          <div class="button-row">
            <button class="primary-btn" onclick="window.consoleWorkbench.openCreateTaskModal()">+ 新建任务</button>
            <button class="ghost-btn" onclick="window.consoleWorkbench.toggleProjectDrawer()">项目详情</button>
          </div>
          <div class="hero-sample">“我想梳理这个项目结构……”</div>
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
            <p>${description ? escapeHTML(description) : "结构化任务说明将在 C.6-C 接入。"}</p>
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
            <p>${description ? escapeHTML(description) : "暂无结构化内容。"}</p>
          </div>
          <div class="work-column">
            <span class="panel-kicker">选择 Skill / SOP</span>
            <h4>尚未绑定能力</h4>
            <p>Capability Registry 尚未初始化。</p>
            <button class="ghost-btn" onclick="window.consoleWorkbench.showBannerNotice()">选择能力</button>
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

function renderPromptTab() {
  const task = getTaskDetailTask() || getSelectedTask();
  const promptPreview = state.finalPromptPreview || [
    "阶段 C.6 能力尚未接入，当前无法生成真实最终 Agent Prompt。",
    `当前任务：${task ? task.title : "暂无 Task"}`,
    "后续将在这里组合：用户补充要求 + Capability / SOP + Source 引用 + 最终 Prompt 预览。"
  ].join("\n");

  return `
    <section class="panel tab-panel ${state.promptFullscreen ? "fullscreen" : ""}">
      <div class="panel-head">
        <div>
          <span class="panel-kicker">Prompt 与 SOP</span>
          <h3>Prompt Builder 预留区</h3>
        </div>
        <div class="panel-actions">
          <button class="ghost-btn" onclick="window.consoleWorkbench.toggleCapabilityPanel()">选择能力</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.togglePromptEditor()">${state.promptEditorOpen ? "收起大编辑器" : "展开大编辑器"}</button>
          <button class="ghost-btn" onclick="window.consoleWorkbench.togglePromptFullscreen()">${state.promptFullscreen ? "退出全屏" : "全屏"}</button>
        </div>
      </div>
      <div class="panel-body prompt-body">
        <div class="stacked ${state.capabilityOpen ? "open" : ""}">
          <button class="stacked-toggle" onclick="window.consoleWorkbench.toggleCapabilityPanel()">
            <span>能力区</span>
            <strong>Capability Registry 尚未初始化</strong>
          </button>
          ${state.capabilityOpen ? `
            <div class="stacked-content">
              <p>后续可浏览：Skill / SOP / Script / Prompt Template / Capability Pack。</p>
              <p>当前阶段仅保留布局、入口和筛选位置，不写死具体能力清单。</p>
            </div>
          ` : ""}
        </div>

        <div class="stacked ${state.promptEditorOpen ? "open" : ""}">
          <button class="stacked-toggle" onclick="window.consoleWorkbench.togglePromptEditor()">
            <span>大 Prompt 编辑器</span>
            <strong>${state.promptEditorOpen ? "已展开" : "默认折叠"}</strong>
          </button>
          ${state.promptEditorOpen ? `
            <div class="prompt-editor-layout">
              <div class="editor-column">
                <label>用户补充要求</label>
                <textarea class="prompt-textarea" oninput="window.consoleWorkbench.setPromptDraft(this.value)" placeholder="在这里补充本次任务需要强调的要求、边界、偏好和约束。">${escapeHTML(state.promptDraft)}</textarea>
                <div class="helper-text">这里只保留当前页面会话草稿，不会写入真实 Prompt 数据。</div>
              </div>
              <div class="editor-column">
                <label>最终 Agent Prompt 预览</label>
                <pre class="prompt-preview">${escapeHTML(promptPreview)}</pre>
                <div class="helper-text">用户补充要求 ≠ 最终 Agent Prompt。后者将在 C.6 接入后组合。</div>
              </div>
            </div>
            <div class="source-foldout">
              <button class="stacked-toggle secondary" onclick="window.consoleWorkbench.toggleSourceFoldout()">
                <span>Source 引用</span>
                <strong>折叠区预留</strong>
              </button>
              ${state.sourceFoldoutOpen ? `
                <div class="stacked-content grid-two">
                  <div>
                    <strong>未来来源</strong>
                    <ul>
                      <li>原始想法输入</li>
                      <li>结构化任务说明</li>
                      <li>Capability / SOP 选择</li>
                      <li>用户补充要求</li>
                      <li>最终 Prompt 预览</li>
                    </ul>
                  </div>
                  <div>
                    <strong>当前阶段</strong>
                    <ul>
                      <li>不生成真实 Prompt</li>
                      <li>不保存真实 Prompt</li>
                      <li>不读取未来 registry 文件</li>
                    </ul>
                  </div>
                </div>
              ` : ""}
            </div>
            <div class="button-row">
              <button class="primary-btn" onclick="window.consoleWorkbench.savePromptDraft()">保存草稿</button>
              <button class="ghost-btn" onclick="window.consoleWorkbench.previewFinalPrompt()">预览最终 Prompt</button>
              <button class="ghost-btn" onclick="window.consoleWorkbench.showBannerNotice()">执行当前步骤</button>
            </div>
          ` : `
            <div class="stacked-content roomy">
              <strong>大 Prompt 编辑器默认折叠。</strong>
              <p>展开后会占据右栏主区域，支持长文本编辑与近似全屏查看。</p>
            </div>
          `}
        </div>
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

const consoleWorkbench = {
  navigateProject,
  navigateTask,
  handleAppRail,
  toggleProjectRail,
  toggleTaskRail,
  toggleProjectDrawer,
  toggleCapabilityPanel,
  togglePromptEditor,
  togglePromptFullscreen,
  toggleSourceFoldout,
  toggleMoreMenu,
  setWorkspacePreviewMode,
  clearWorkspacePreviewMode,
  setTaskFilter,
  setProjectSearch,
  setTab,
  openCreateTaskModal,
  closeModal,
  setCreateTaskDesc,
  setPromptDraft,
  submitCreateTask,
  showBannerNotice,
  executePrimaryAction,
  previewFinalPrompt,
  savePromptDraft,
  approveTask,
  reviewTask,
  closeTask,
  refreshCurrentContext
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
