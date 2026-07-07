# AI Coding Console Web 编码修复结果

- 任务目标：修复 AI Coding Console Web 页面中的中文乱码，只处理字符编码与文本显示链路，不改业务逻辑、Task 流程、OpenCode Runner、API 语义、布局结构或视觉设计。
- 依据与范围：检查并修复 `tools/ai-coding-console/gui/` 的静态与 API 响应编码、当前 Web 实际读取的任务数据 `data/ai-coding-console/tasks/T-20260705-002/`，并验证浏览器页面与接口输出。
- 生成日期：2026-07-07
- 版本信息：V1 编码修复

## 根因

1. 当前 Web 页面使用的任务数据 `data/ai-coding-console/tasks/T-20260705-002/task.json` 中，标题与描述已经被历史数据写成了字面量 `?????`，不是单纯浏览器渲染问题。
2. 由该任务数据生成并持久化的 `prompt.md`、`prompt-draft.md`、`final-prompt.md` 继续继承了错误标题，因此页面中的 Task 标题、Prompt 与 Final Prompt 会一起显示异常文本。
3. `tools/ai-coding-console/gui/server.js` 的 JSON 响应此前未统一显式返回 `charset=utf-8`，静态文件缺失时的文本响应也未声明 UTF-8，增加了链路上的编码歧义。
4. GUI 源码文件本身不是本次页面乱码的主因：`index.html` 已包含 `<meta charset="UTF-8">`，`app.js`、`task-prompt-builder.js`、`task-sop-generator.js` 实际源码为 UTF-8 正常文本。

## 修改文件

- `tools/ai-coding-console/gui/server.js`
- `data/ai-coding-console/tasks/T-20260705-002/task.json`
- `data/ai-coding-console/tasks/T-20260705-002/prompt.md`
- `data/ai-coding-console/tasks/T-20260705-002/sop.json`
- `data/ai-coding-console/tasks/T-20260705-002/prompt-draft.md`
- `data/ai-coding-console/tasks/T-20260705-002/final-prompt.md`
- `knowledge/traces/ai-coding-console-web-encoding-fix-result.md`

## 编码统一策略

- Web 源文件与当前修复后的任务文本产物统一按 UTF-8 读取和写入。
- 本次修复去除了 `task.json` 与 `prompt.md` 中的 UTF-8 BOM，避免继续依赖 BOM 兜底。
- 任务标题与描述恢复为正式来源中可确认的文本：`AI Coding Console C.6 工作流接入`。
- `sop.json`、`prompt-draft.md`、`final-prompt.md` 使用现有本地生成逻辑重新落盘，修复持久化文本中的错误标题与异常字符，不改生成规则语义。

## HTTP 响应 charset 处理

- 静态 HTML 保持 `text/html; charset=utf-8`
- 静态 JS 保持 `application/javascript; charset=utf-8`
- JSON API 统一显式返回 `application/json; charset=utf-8`
- 静态文件缺失时的文本响应显式返回 `text/plain; charset=utf-8`
- 404 JSON 响应显式返回 `application/json; charset=utf-8`

## 实际验证

1. 页面验证
   - 通过本地 GUI 页面快照验证，页面标题为 `AI Coding Console - Workbench`。
   - 首页可见中文 UI 文案正常显示，包括 `新版 Web 工作台`、`刷新`、`项目详情`、`Prompt 与 SOP`、`审批记录`。
   - 任务列表中 `T-20260705-002` 显示为 `AI Coding Console C.6 工作流接入`。
2. API 验证
   - `GET /api/tasks/ai-ui-agentic/T-20260705-002` 返回 `application/json; charset=utf-8`，并返回正确中文标题与描述。
   - `GET /api/tasks/ai-ui-agentic/T-20260705-002/prompt-sop` 返回 `application/json; charset=utf-8`，其中 SOP、Prompt Draft、Final Prompt 的中文内容正常。
   - `GET /api/capabilities` 返回 `application/json; charset=utf-8`，Capability 数据可正常解析显示。
   - `GET /` 返回 `text/html; charset=utf-8`。
3. 文件与格式验证
   - `index.html` 已确认包含 `<meta charset="UTF-8">` 且位于 `<head>` 前部。
   - GUI / 相关生成模块读取文本时使用 UTF-8。
   - `git diff --check` 执行通过，仅有现有工作区的 LF/CRLF 提示，无 diff 格式错误。

## 历史源文件损坏情况

- 发现当前任务历史文件中仍存在未恢复的历史乱码或问号文本，主要位于禁止修改范围内的 Run 历史产物，例如：
  - `data/ai-coding-console/tasks/T-20260705-002/runs/RUN-20260707-001-plan/prompt.md`
  - `data/ai-coding-console/tasks/T-20260705-002/runs/RUN-20260707-001-plan/plan.md`
  - `data/ai-coding-console/tasks/T-20260705-002/runs/RUN-20260705-002-plan/*`
- 这些文件属于历史 Run 记录，本次按要求未改动。
- 当前 Web 实际展示链路已优先修复到正常状态；历史 Run 产物若后续需要恢复，应基于正式来源或 Git 历史逐项确认后再处理。

## 未修改范围

- 未修改 `tools/ai-coding-console/lib/opencode-plan-runner.js`
- 未修改 Task 生命周期语义
- 未修改 Capability Registry 语义
- 未修改 Prompt / SOP 生成逻辑语义
- 未修改 OpenCode 自动调用逻辑
- 未修改 D-2 功能
- 未修改外部项目
- 未改动历史 Run 数据文件

## Commit Hash

- 待最终提交后记录于 Git 历史与本次聊天结果中。
