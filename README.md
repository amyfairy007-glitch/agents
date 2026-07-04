# 个人AI工具库

本仓库是个人开发用的 AI 工具库，用于统一沉淀 AI 开发规则、流程、分析资料、工具能力和后续项目管理数据。

## 当前顶层结构

```
个人AI工具库/
├── AGENTS.md                    ← OpenCode 全局规则入口（唯一正式规则文件）
├── README.md                    ← 仓库说明
├── package.json                 ← Node 项目根配置（当前无依赖和脚本）
├── .gitignore                   ← Git 忽略规则
├── config/                      ← 多工具共用的全局配置（当前暂无真实内容，不强制创建）
├── knowledge/                   ← AI 可读规则、SOP、流程、分析资料
│   ├── flows/                   ← 流程、SOP、操作方法
│   └── traces/                  ← 项目、功能、代码、仓库、工具设计、审计与追踪分析资料
├── data/                        ← 项目档案、任务状态、运行记录、验证记录等持续数据（当前暂无真实内容，不强制创建）
└── tools/                       ← 实际可执行、可复用的工具能力
```

## 根目录文件职责

| 文件 | 说明 |
|---|---|
| `AGENTS.md` | OpenCode 自动读取的全局规则文件。包含协作模式、产物要求、开发规则。 |
| `README.md` | 本文件，仓库使用说明。 |
| `package.json` | Node 项目根配置。当前无依赖、无 scripts，后续工具可按需注册命令。 |
| `.gitignore` | Git 忽略规则。 |

## 当前已有工具

### `tools/init-project-memory/`

**用途**：为指定项目创建 `.ai/` 项目记忆结构，从模板复制初始文件。

**初始化内容**：
- `.ai/business-context.md`
- `.ai/current-state.md`
- `.ai/decisions.md`
- `.ai/defect-patterns.md`
- `.ai/handoffs/handoff-template.md`

**模板位置**：`tools/init-project-memory/templates/`

**调用命令**：

```powershell
powershell -ExecutionPolicy Bypass -File tools\init-project-memory\init-project-memory.ps1 -ProjectPath "E:\Path\To\YourProject"
```

### `tools/sync-codex-home/`

**用途**：将仓库 `AGENTS.md` 和可选的工具配置模板同步到 OpenCode 家目录（`%USERPROFILE%\.codex`）。

**同步 AGENTS.md**：

```powershell
powershell -ExecutionPolicy Bypass -File tools\sync-codex-home\sync-codex-home.ps1
```

**同步 AGENTS.md + config.toml**：

```powershell
powershell -ExecutionPolicy Bypass -File tools\sync-codex-home\sync-codex-home.ps1 -IncludeConfig
```

**工具专属配置**：`tools/sync-codex-home/config/config.toml`

## 知识资料

### `knowledge/flows/` — 流程、SOP、操作方法

| 资料 | 说明 |
|---|---|
| `market-localchange-task-guide.md` | 市场 Localchange 任务处理指南 |
| `git-branch-create-ai-prompt-3.md` | Git 建分支 AI 提示词 |

### `knowledge/traces/` — 分析、审计、设计与追踪

| 资料 | 说明 |
|---|---|
| `generate-complete-project-background.md` | 项目背景生成提示词 |
| `multi-session-collaboration-implementation.md` | 多 Session 协同工具设计文档 V1 |
| `multi-session-collaboration-implementation-v2.md` | 多 Session 协同工具设计文档 V2 |
| `mvp1-step-ui.md` | MVP1 页面 UI 补全提示词 |
| `个人AI工具库顶层架构对齐审计报告.md` | 顶层架构只读审计报告 |
| `personal-ai-toolkit-top-level-architecture-migration-plan.md` | 顶层架构对齐迁移计划 |
| `personal-ai-toolkit-top-level-architecture-migration-stage-1-result.md` | 迁移阶段一实施结果 |
| `personal-ai-toolkit-top-level-architecture-stage-1-closeout-result.md` | 迁移阶段一收尾结果 |
| `personal-ai-toolkit-top-level-architecture-stage-2-precheck.md` | 迁移阶段二预检查 |
| `personal-ai-toolkit-top-level-architecture-migration-stage-2-result.md` | 迁移阶段二实施结果 |

## 正式产物规则

审计、项目接管、架构分析、实施计划、实施结果、验证结果、Code Review、风险评估、项目状态确认等关键结论必须生成为仓库中的正式 Markdown 文件，不得只保留在聊天上下文中。

聊天回复仅作为摘要和进度说明；关键结论的唯一正式依据是仓库产物文件。

产物归属遵循顶层架构：
- `knowledge/flows/` — 流程、SOP、操作方法、长期规则
- `knowledge/traces/` — 项目、功能、代码、仓库、架构、审计与追踪分析资料
- `data/` — 项目状态、任务状态、执行记录、验证记录、失败/重试/交接等持续数据
- `tools/` — 工具代码、工具模板、工具专属配置；不得存放真实项目执行结果
- `config/` — 多工具共用的全局配置

## 当前状态

- 顶层架构对齐：阶段一（知识文档归位）✅、阶段二（脚本与模板迁移）✅、阶段三（README 更新）✅
- 多项目 AI Coding 工作台：尚未开发，将在现有工具库能力接管完成后增量设计
- 后续计划：先完成现有工具库能力确认，再基于现有结构增量接入工作台功能
