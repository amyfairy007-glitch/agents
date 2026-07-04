# 多项目 AI Coding 桌面控制台 MVP — 阶段 C.5 实施结果

> 执行日期：2026-07-04
> 前置计划：`knowledge/traces/ai-coding-desktop-console-mvp-stage-c5-gui-plan.md`
> 后续阶段：阶段 D — Agent Adapter

---

## 一、实际修改文件

| 操作 | 文件 | 行数 |
|---|---|---|
| 新增 | `tools/ai-coding-console/gui/server.js` | ~200 行 |
| 新增 | `tools/ai-coding-console/gui/index.html` | ~90 行 |
| 新增 | `tools/ai-coding-console/gui/app.js` | ~230 行 |
| 修改 | `tools/ai-coding-console/README.md` | 更新为 C.5 状态 |
| 修改 | `package.json` | 新增 `"gui": "node tools/ai-coding-console/gui/server.js"` |

---

## 二、GUI 技术实现

| 维度 | 内容 |
|---|---|
| 服务端 | Node.js 内置 `http` + `fs` + `child_process`，0 个 npm 依赖 |
| 前端 | 纯 HTML/CSS/JS，暗色主题（GitHub Dark 风格），hash 路由 |
| 端口 | `http://127.0.0.1:3456` |
| 写操作 | 通过 `child_process.execFile` 调用 `console.ps1`，GUI 不自行写数据 |
| 读操作 | 直读 `data/ai-coding-console/` JSON 文件 |

---

## 三、页面与 API 清单

| 页面 | URL | API |
|---|---|---|
| 项目列表 | `#/` | `GET /api/projects` |
| 项目详情 | `#/projects/:id` | `GET /api/projects/:id` |
| Task 列表 | `#/projects/:id/tasks` | `GET /api/tasks/:projectId` |
| Task 详情 | `#/projects/:id/tasks/:taskId` | `GET /api/tasks/:projectId/:taskId` |
| Board 查看 | `#/projects/:id/board` | `GET /api/board/:projectId` |

写操作 API：
| 操作 | API |
|---|---|
| 创建 Task | `POST /api/tasks/create` |
| approve | `POST /api/tasks/:id/approve` |
| review | `POST /api/tasks/:id/review` |
| close | `POST /api/tasks/:id/close` |

---

## 四、验证结果

| 验证项 | 结果 |
|---|---|
| `npm run gui` 启动 | ✅ http://localhost:3456 |
| GET /api/projects | ✅ 返回 1 个项目 |
| GET /api/projects/:id | ✅ hasAiMemory=True |
| GET /api/tasks/:projectId | ✅ 空列表（数据域干净） |
| GET /api/board/:projectId | ✅ 生成 115 字符 board |
| 空状态正确显示 | ✅ "No tasks yet" / "No projects" |
| approve/review/close 有确认弹窗 | ✅ 前端 confirm modal |
| 创建 Task 校验非空 | ✅ 空描述阻止提交 |
| 0 个新增 npm 依赖 | ✅ |
| git diff --check | ✅ 通过 |

---

## 五、未实现范围

- project add（GUI 不登记项目，用 CLI）
- Agent dispatch（阶段 D）
- 实时状态刷新（手动 refresh 按钮）
- 复杂 Markdown 渲染（board 展示为纯文本 pre）
- 移动端适配

---

## 六、是否具备进入阶段 D 条件

✅ 具备。GUI 可查看项目、创建 Task、操作审批流程，全部走 console.ps1 后端。数据域保持干净。

---

## 七、实际启动与浏览器验证

| 验证项 | 结果 |
|---|---|
| 启动命令 | 
pm run gui |
| 监听地址 | http://127.0.0.1:3456 |
| 项目列表页 | 显示 i-ui-agentic |
| Task 页面空状态 | "No tasks yet" |
| 创建测试 Task (T-20260705-001) | POST /api/tasks/create 成功 |
| Task 列表更新 | 显示 T-20260705-001 + "created" |
| CLI 同步 | 	ask list --project ai-ui-agentic 同步可见 |
| Task 详情 | status: created, no runs, no approvals |
| Board | 247 chars Markdown |

### 启动中发现并修复

| 问题 | 修复 |
|---|---|
| JSON 文件含 UTF-8 BOM 导致 parse 失败 | readJSON() 统一增加 BOM 剥离 |
| getProjectTasks/getTaskDetail 未用 readJSON | 统一使用 readJSON() |

## 八、测试数据清理

| 操作 | 结果 |
|---|---|
| 删除 data/ai-coding-console/tasks/ | 已删除（含 T-20260705-001） |
| 删除 data/ai-coding-console/board/ | 已删除 |
| 清除 manifest 测试字段 | lastActiveTaskId, lastActivityAt 已移除 |
| 停止 GUI 服务 | node 进程已终止 |
| 最终状态 | 仅 projects-manifest.json 保留真实项目 i-ui-agentic |

## 九、可复现启动步骤

`powershell
cd E:\program\ai-ui-agentic
npm run gui
# 浏览器打开 http://localhost:3456
# 操作完成后: Ctrl+C 停止服务
`

## 十、是否具备进入阶段 D 条件

✅ 具备。GUI 已实际启动并通过全流程验证，数据域干净。

---

## GUI 实际运行验证（2026-07-05 实跑）

| # | 步骤 | 方法 | 结果 |
|---|---|---|---|
| 1 | 项目列表 | GET /api/projects | 1 项目: ai-ui-agentic, AI Memory: True |
| 2 | 项目详情 | GET /api/projects/ai-ui-agentic | status output 462 chars |
| 3 | 空状态 | GET /api/tasks/ai-ui-agentic | 0 tasks |
| 4 | 创建 Task | POST /api/tasks/create | T-20260705-001, "GUI live verification" |
| 5 | CLI 同步 | 	ask list --project ai-ui-agentic | 同步显示 T-20260705-001 |
| 6 | Board | GET /api/board/ai-ui-agentic | 255 chars Markdown |
| 7 | Task 详情 | GET /api/tasks/.../T-20260705-001 | status: created, 0 runs, 0 approvals |
| 8 | 清理 | 删除 tasks/ board/ reports/ + manifest 字段 | 仅 projects-manifest.json 保留 |

启动错误: 无。端口占用: 无。PowerShell 调用: 正常。

可复现启动: 
pm run gui → http://localhost:3456

