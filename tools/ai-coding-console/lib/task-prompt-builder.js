const path = require("path");
const fs = require("fs");

const USER_SUPPLEMENT_HEADING = "## 用户补充说明";

function getPromptDraftPath(repoRoot, taskId) {
  return path.join(repoRoot, "data", "ai-coding-console", "tasks", taskId, "prompt-draft.md");
}

function getFinalPromptPath(repoRoot, taskId) {
  return path.join(repoRoot, "data", "ai-coding-console", "tasks", taskId, "final-prompt.md");
}

function getSopPath(repoRoot, taskId) {
  return path.join(repoRoot, "data", "ai-coding-console", "tasks", taskId, "sop.json");
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function extractUserSupplement(promptDraftContent) {
  if (!promptDraftContent) return "";
  const lines = promptDraftContent.split(/\r?\n/);
  let inBlock = false;
  const supplement = [];
  for (const line of lines) {
    if (line.trim() === USER_SUPPLEMENT_HEADING) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.startsWith("## ") || line.startsWith("# ")) break;
      supplement.push(line);
    }
  }
  return supplement.join("\n").trim();
}

function removeUserSupplement(promptDraftContent) {
  if (!promptDraftContent) return promptDraftContent;
  const headingIndex = promptDraftContent.indexOf(USER_SUPPLEMENT_HEADING);
  if (headingIndex === -1) return promptDraftContent;
  return promptDraftContent.slice(0, headingIndex).trimEnd();
}

function renderCapabilityDetails(capability) {
  const expectedArtifacts = Array.isArray(capability.expectedArtifacts) && capability.expectedArtifacts.length
    ? capability.expectedArtifacts.join(", ")
    : "无";

  return [
    `- **${capability.name || capability.id}** (${capability.type || "unknown"})`,
    `  - 说明：${capability.description || "无"}`,
    `  - 风险等级：${capability.riskLevel || "low"}`,
    `  - 是否修改项目：${capability.canModifyProject ? "是" : "否"}`,
    `  - 是否需要审批：${capability.requiresApproval ? "是" : "否"}`,
    `  - 预期产物：${expectedArtifacts}`
  ].join("\n");
}

function generatePromptDraft(task, projectId, boundCapabilities) {
  const capabilitySection = (boundCapabilities || []).map(renderCapabilityDetails).join("\n\n");

  return [
    "# Prompt 草稿",
    "",
    "## 任务目标",
    "",
    `当前 Task 为 **${task.title || "无标题"}**。`,
    `描述：${task.description || "无"}`,
    "",
    "本阶段目标：完成 Task 专属 SOP 生成与最终 Prompt 构建，不进入 Agent 执行。",
    "",
    "## 项目上下文",
    "",
    `- 项目 ID：${projectId}`,
    `- 项目路径：${task.projectPath || "未指定"}`,
    "- 当前期：C.6-C（SOP + Prompt 生成阶段）",
    "- 前置阶段：C.6-A Capability Registry（✅）、C.6-B-1 绑定 API（✅）、C.6-B-2 绑定 UI（✅）",
    "- 后续阶段：Stage D（Agent 执行）",
    "",
    "## 已绑定能力",
    "",
    capabilitySection || "暂无绑定能力",
    "",
    "## 约束与边界",
    "",
    "- 当前阶段禁止 Agent 执行与 AI 模型调用",
    "- 所有生成基于本地模板与规则拼装",
    "- 禁止修改 Task 数据文件以外的项目文件",
    "- 已绑定能力的 canModifyProject 属性决定是否可以在后续修改项目文件",
    "- 生成内容优先级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补充",
    "",
    "## 建议执行步骤",
    "",
    "1. 读取项目上下文与约束（AGENTS.md、.ai/ 记忆文件）",
    "2. 审查已绑定 Capability 边界与说明",
    "3. 基于规则生成 Task 专属 SOP 时间线",
    "4. 编辑 Prompt 草稿并补充用户要求",
    "5. 生成最终 Agent Prompt",
    "6. 生成结果报告并更新项目记忆",
    "",
    USER_SUPPLEMENT_HEADING,
    ""
  ].join("\n");
}

function generateFinalPrompt(task, projectId, boundCapabilities, sop, promptDraft, userSupplement) {
  const capabilitySection = (boundCapabilities || []).map(renderCapabilityDetails).join("\n\n");
  const steps = (sop && Array.isArray(sop.steps) ? sop.steps : []);
  const stepSection = steps.length
    ? steps.map((step) => `- ${step.id}: ${step.title}（${step.status || "pending"}）`).join("\n")
    : "- 暂未生成";
  const artifactList = steps.length
    ? [...new Set(steps.flatMap((step) => Array.isArray(step.expectedArtifacts) ? step.expectedArtifacts : []))]
        .map((artifact) => `- ${artifact}`)
        .join("\n")
    : "- 暂未指定";
  const promptDraftBody = removeUserSupplement(promptDraft || "").trim() || "（无）";
  const capabilityModifyLabel = (boundCapabilities || []).some((capability) => capability.canModifyProject)
    ? "已绑定能力中存在允许修改项目文件的能力"
    : "已绑定能力均不允许修改项目文件";

  return [
    "# 最终 Agent Prompt",
    "",
    "## 角色与任务",
    "",
    `你是一个项目执行 Agent。当前 Task 为 **${task.title || "无标题"}**。`,
    `描述：${task.description || "无"}`,
    "",
    "任务范围：基于已绑定的 Capability 和生成 SOP 执行当前步骤。",
    `当前阶段：${(sop && sop.stage) || "C.6-C"} | Agent 执行：${((sop && sop.allowAgentExecution) || false) ? "允许" : "禁止"}`,
    "",
    "## 项目上下文",
    "",
    `- 项目 ID：${projectId}`,
    `- 项目路径：${task.projectPath || "未指定"}`,
    "",
    "## 执行边界",
    "",
    `- Agent 执行：${((sop && sop.allowAgentExecution) || false) ? "允许" : "禁止"}`,
    "- 模型调用：禁止（当前阶段使用本地规则拼装）",
    `- 项目修改：${capabilityModifyLabel}`,
    "- 脚本执行：禁止",
    "- 生成优先级：系统约束 > 项目规则 > Task 目标 > Capability 边界 > 用户补充",
    "",
    "## 已绑定 Capability",
    "",
    capabilitySection || "暂无绑定能力",
    "",
    "## SOP 当前步骤",
    "",
    stepSection,
    "",
    "## 预期产物",
    "",
    artifactList,
    "",
    "## Prompt 草稿",
    "",
    promptDraftBody,
    "",
    USER_SUPPLEMENT_HEADING,
    "",
    userSupplement || "（无）",
    "",
    "## 验证要求",
    "",
    "- 所有生成内容必须落盘到指定路径",
    "- 不得覆盖已有且需要保留的文件",
    "- 生成后检查文件内容完整性",
    "- 确认文件路径与目录职责一致",
    "",
    "## 禁止事项",
    "",
    "- 不得修改 AGENTS.md、console.ps1、capability-registry.json",
    "- 不得创建临时 Task、Run、Artifact 或 board 数据",
    "- 不得调用外部 API 或 AI 模型（当前阶段）",
    "- 不得修改 Task 数据文件以外的项目文件",
    "- 不得递归扫描外部项目"
  ].join("\n");
}

function readExistingPromptDraft(repoRoot, taskId) {
  return readFileIfExists(getPromptDraftPath(repoRoot, taskId));
}

function savePromptDraft(repoRoot, taskId, content) {
  const filePath = getPromptDraftPath(repoRoot, taskId);
  writeFile(filePath, content);
  return { ok: true, path: filePath };
}

function regeneratePromptDraft(repoRoot, taskId, task, projectId, boundCapabilities) {
  const existing = readExistingPromptDraft(repoRoot, taskId);
  const userSupplement = extractUserSupplement(existing || "");
  const draft = generatePromptDraft(task, projectId, boundCapabilities);
  const prefix = draft.split(USER_SUPPLEMENT_HEADING)[0].trimEnd();
  return `${prefix}\n${USER_SUPPLEMENT_HEADING}\n${userSupplement ? `${userSupplement}\n` : ""}`;
}

function buildFinalPromptFromSaved(repoRoot, taskId) {
  const sopRaw = readFileIfExists(getSopPath(repoRoot, taskId));
  if (!sopRaw) return { ok: false, error: "sop_not_generated" };

  let sop;
  try {
    sop = JSON.parse(sopRaw);
  } catch (error) {
    return { ok: false, error: "invalid_sop_json" };
  }

  const promptDraft = readExistingPromptDraft(repoRoot, taskId);
  if (!promptDraft) return { ok: false, error: "prompt_draft_not_found" };

  const userSupplement = extractUserSupplement(promptDraft);
  return { ok: true, sop, promptDraft, userSupplement };
}

module.exports = {
  extractUserSupplement,
  generatePromptDraft,
  generateFinalPrompt,
  getPromptDraftPath,
  getFinalPromptPath,
  getSopPath,
  readExistingPromptDraft,
  regeneratePromptDraft,
  savePromptDraft,
  buildFinalPromptFromSaved,
  USER_SUPPLEMENT_HEADING,
  readFileIfExists,
  writeFile,
  removeUserSupplement
};
