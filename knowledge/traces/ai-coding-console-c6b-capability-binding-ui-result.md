# AI Coding Console C.6-B-2 能力绑定 UI 结果报告

- 生成日期: 2026-07-05
- 阶段: C.6-B-2 Task Capability 浏览、选择与绑定 UI 接入
- 结论: 已完成真实 Capability 浏览、筛选、多选、保存绑定和刷新回显；未进入 C.6-C、Prompt Builder、SOP 生成或 Agent 执行。

## 1. 修改文件

- `tools/ai-coding-console/gui/app.js`
- `tools/ai-coding-console/gui/index.html`

## 2. 使用的 API

- `GET /api/capabilities`
- `GET /api/capabilities/:id`
- `GET /api/tasks/:projectId/:taskId/capabilities`
- `POST /api/tasks/:projectId/:taskId/capabilities`

## 3. UI 交互结果

- 在右侧 Prompt 与 SOP 区内接入了真实 Capability 浏览器。
- 支持按名称、描述、ID 搜索。
- 支持按类型筛选: 全部 / Skill / SOP / Script / Prompt Template。
- 支持多选勾选和取消勾选。
- 支持展开单条能力详情，展示 `description`、`sourcePath`、`riskLevel`、`canModifyProject`、`requiresApproval`、`expectedArtifacts`。
- 保存后会更新顶部上下文能力数量，并在能力区显示已绑定能力列表。
- Prompt / SOP 区的占位文案已改为正向说明，明确绑定能力会作为后续 Prompt / SOP 输入。

## 4. 真实 Task

- 使用的真实 Task: `T-20260705-002`
- 标题: `AI Coding Console C.6 工作流接入`
- 这是正式工作对象，不是临时测试 Task。

## 5. 绑定验证结果

- 真实 registry 成功加载到 15 条能力。
- 已成功绑定 2 项能力:
  - `skill-project-takeover`
  - `sop-task-lifecycle`
- 刷新页面后能力计数仍显示 `2 项`。
- 重新打开管理面板时，绑定状态可回显。
- 随后取消了 `sop-task-lifecycle` 并再次保存。
- 刷新后能力计数变为 `1 项`，说明解绑也已写回任务绑定文件。

## 6. 数据保留情况

- 保留了正式任务 `T-20260705-002`。
- 已清理旧的临时测试任务 `T-20260705-001`。
- 未创建临时 Run、Artifact 或 board 数据。

## 7. 未实现范围

- 未进入 C.6-C。
- 未实现 Prompt Builder 真实生成逻辑。
- 未实现 Task SOP 自动生成。
- 未接入 Agent 执行、Run、Artifact 写入或审批逻辑。
- 未修改 capability registry 数据文件本体。

## 8. 与 UI 的边界

- 绑定能力只写入任务级 `capabilities.json`，不回写全局 Registry。
- UI 只负责浏览、筛选、选择、保存和回显，不生成真实 Prompt 或 SOP。
- 顶部能力数量、Prompt/SOP 占位和管理面板都只消费任务绑定结果。

## 9. 验证说明

- `npm run gui` 已启动并可访问。
- 浏览器验证完成了:
  - registry 加载
  - 搜索 / 筛选
  - 多选保存
  - 刷新持久化
  - 再次打开管理面板回显
  - 取消一个能力并保存
  - 刷新确认解绑
- `git diff --check` 已通过。

## 10. Commit

- commit hash: `pending`
