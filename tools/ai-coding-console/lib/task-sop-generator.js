const path = require("path");
const { loadTaskCapabilityBinding, loadTaskRecord } = require("./task-capability-binding");

const PRIORITY_ORDER = [
  "system_stage_security",
  "project_agents_rules",
  "task_scope",
  "bound_capability",
  "user_supplement"
];

function readAgentsMd(repoRoot) {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  if (!require("fs").existsSync(agentsPath)) return "";
  return require("fs").readFileSync(agentsPath, "utf8");
}

function getStageConstraints() {
  return {
    stage: "C.6-C",
    allowAgentExecution: false,
    allowModelCalls: false,
    allowProjectModification: true,
    allowScriptExecution: false,
    maxSteps: 8,
    status: "draft"
  };
}

function buildSystemSops(task, projectId, boundCapabilities, agentsRules) {
  const stage = getStageConstraints();
  const steps = [];

  steps.push({
    id: "S1",
    title: "读取项目上下文与约束",
    purpose: "确认当前项目规则、范围和现有状态，包括 AGENTS.md、.ai/ 记忆文件和项目目录结构",
    inputs: ["project root", "AGENTS.md", ".ai/current-state.md", ".ai/decisions.md", ".ai/business-context.md"],
    expectedArtifacts: ["project-summary.md"],
    requiresApproval: false,
    status: "pending"
  });

  steps.push({
    id: "S2",
    title: "审查已绑定 Capability 边界与说明",
    purpose: "分析当前 Task 已绑定的 Capability 的作用、风险等级、预期产物和执行边界",
    inputs: boundCapabilities.map(c => c.id),
    expectedArtifacts: ["capability-summary.md"],
    requiresApproval: false,
    status: "pending"
  });

  steps.push({
    id: "S3",
    title: "生成 Task 专属 SOP",
    purpose: "基于项目规则、Task 目标和已绑定 Capability 生成当前 Task 专属的 SOP 时间线",
    inputs: ["task.json", "capabilities.json", "AGENTS.md"],
    expectedArtifacts: ["sop.json"],
    requiresApproval: false,
    status: "pending"
  });

  steps.push({
    id: "S4",
    title: "生成与编辑 Prompt 草稿",
    purpose: "基于 SOP 和已绑定 Capability 生成 Prompt 草稿，允许用户编辑并补充要求",
    inputs: ["sop.json", "capabilities.json", "user supplement"],
    expectedArtifacts: ["prompt-draft.md"],
    requiresApproval: false,
    status: "pending"
  });

  steps.push({
    id: "S5",
    title: "生成最终 Prompt",
    purpose: "基于已确认的 SOP 和 Prompt 草稿生成最终可交付的 Agent Prompt",
    inputs: ["sop.json", "prompt-draft.md", "user supplement"],
    expectedArtifacts: ["final-prompt.md"],
    requiresApproval: true,
    status: "pending"
  });

  steps.push({
    id: "S6",
    title: "生成结果报告与更新项目记忆",
    purpose: "将本次 SOP 与 Prompt 生成结果写入正式产物文件，更新项目记忆",
    inputs: ["sop.json", "final-prompt.md", "result template"],
    expectedArtifacts: ["result-report.md", "updated .ai/ memory"],
    requiresApproval: false,
    status: "pending"
  });

  return steps;
}

function generateSop(repoRoot, task, projectId, boundCapabilities) {
  const agentsRules = readAgentsMd(repoRoot);
  const stage = getStageConstraints();

  const steps = buildSystemSops(task, projectId, boundCapabilities, agentsRules);

  return {
    taskId: task.taskId,
    generatedAt: new Date().toISOString(),
    sourceCapabilityIds: boundCapabilities.map(c => c.id),
    status: "draft",
    stage: stage.stage,
    allowAgentExecution: stage.allowAgentExecution,
    priorityOrder: PRIORITY_ORDER,
    steps
  };
}

function loadTaskAndCapabilities(repoRoot, projectId, taskId, registryPath) {
  const taskRecord = loadTaskRecord(repoRoot, projectId, taskId);
  if (!taskRecord.ok) return taskRecord;

  const binding = loadTaskCapabilityBinding(repoRoot, projectId, taskId, registryPath);
  if (!binding.ok) {
    return {
      ok: false,
      statusCode: binding.statusCode || 400,
      error: binding.error || "no_capability_binding",
      details: binding.details || [],
      task: taskRecord.task
    };
  }

  return {
    ok: true,
    task: taskRecord.task,
    capabilities: binding.capabilities || [],
    capabilityIds: binding.capabilityIds || []
  };
}

module.exports = {
  generateSop,
  getStageConstraints,
  loadTaskAndCapabilities,
  PRIORITY_ORDER
};
