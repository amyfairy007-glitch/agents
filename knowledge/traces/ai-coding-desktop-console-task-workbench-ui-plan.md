# 多项目 AI Coding 桌面控制台 — 任务驱动三栏工作台 UI 重构计划

> 生成日期：2026-07-05
> 前置：阶段 C.5 GUI 已完成，阶段 D Adapter 计划已就绪
> 当前：只出计划，不实施
> 定位：从项目 Dashboard 转向任务驱动三栏工作台

---

## 一、当前 GUI 保留清单

| 保留 | 说明 |
|---|---|
| `server.js` | Node HTTP 服务，全部 API 端点 |
| `console.ps1` | CLI 入口，所有命令逻辑 |
| `data/ai-coding-console/` | 数据域，manifest + tasks |
| `npm run gui` | 启动方式不变 |
| `index.html` + `app.js` | 重写为三栏布局，保留现有 CSS 基础 |
| `apiGet()` / `apiPost()` | 前端 API 层保留 |
| Modal / 确认弹窗 | 保留 `showModal()` / `confirmModal()` |
| 0 npm 依赖 | 不变 |

| 废弃 | 原因 |
|---|---|
| 页面式路由 (`#/projects/:id/tasks/:taskId`) | 改为三栏同屏，无需页面跳转 |
| `renderNav()` 导航栏标签 | 项目在左栏，Task 在中栏，无需顶部导航 |
| 独立 Board 页面 | Board 内容作为右栏 Tab 或折叠面板嵌入 |
| 独立 Project Detail 页面 | Git/AGENTS.md/.ai/ 移入左栏项目抽屉 |

---

## 二、三栏工作台信息架构

```
┌──────────┬──────────────────┬──────────────────────────────┐
│  左栏     │     中栏          │          右栏                │
│ Projects │     Tasks         │      Task Workspace          │
│ 260px    │     300px         │       flex: 1                │
├──────────┼──────────────────┼──────────────────────────────┤
│          │                  │                               │
│ Project1 │ [+ New Task]     │  Task Title                   │
│ Project2 │                  │  Status: created              │
│ (select) │ T-001 created    │  Description: ...             │
│          │  title...        │                               │
│          │ T-002 plan_approved│  No runs yet.                │
│          │  title...        │                               │
│          │                  │  [Approve Plan] (if applicable)│
│          │                  │  [Review] [Close]             │
│          │                  │                               │
├──────────┼──────────────────┼──────────────────────────────┤
│ [footer] │                  │                               │
└──────────┴──────────────────┴──────────────────────────────┘
```

### 列宽

| 列 | 宽度 | 调整 |
|---|---|---|
| 左栏 | 260px | 固定，不缩放 |
| 中栏 | 300px | 固定，不缩放 |
| 右栏 | flex: 1 | 剩余宽度 |

### 可拖拽分隔

第一版不做。列宽固定。后续可加 CSS `resize`。

---

## 三、左栏：项目区

### 内容

```
┌─ Projects ────────────────────┐
│                                │
│ ● ai-ui-agentic        [▾]   │  ← 选中高亮
│   E:\program\ai-ui-agentic    │
│   main · agents.git           │
│                                │
│ ○ (other project)             │
│   path...                     │
│                                │
├────────────────────────────────┤
│ No more projects              │
│ Use CLI: project add --path   │
└────────────────────────────────┘
```

### 交互

| 操作 | 行为 |
|---|---|
| 点击项目名 | 中栏加载该项目的 Task 列表 |
| 点击 `[▾]` | 展开项目详情抽屉（Git、AGENTS.md、.ai/） |
| 刷新 | 左栏列表来自 `GET /api/projects` |
| 加载时 | 显示 loading 占位 |
| 空状态 | "No projects. Use CLI: project add --path <dir>" |

### 每个项目的显示信息

| 字段 | 来源 |
|---|---|
| ID + displayName | manifest |
| 根路径（截断） | manifest.rootPath |
| Git 分支 + remote（缩略） | manifest.gitRemote + (后续 status API) |
| 选中状态 | `activeProjectId` |

---

## 四、中栏：Task 列表

### 内容

```
┌─ Tasks ───────────────────────┐
│ [+ New Task]                   │
├────────────────────────────────┤
│ T-001  created                 │
│ 分析项目结构                    │
│ 2026-07-05                     │
│ ─────────────────────────────  │
│ T-002  plan_approved           │
│ 实现用户登录                    │
│ 2026-07-05                     │
│ ─────────────────────────────  │
│ No tasks yet                   │
│ [Create your first task]       │
└────────────────────────────────┘
```

### 交互

| 操作 | 行为 |
|---|---|
| 点击 Task | 右栏加载该 Task 详情 |
| `[+ New Task]` | 弹出创建 modal |
| 刷新 | 左栏切换项目时自动刷新 |
| 空状态 | 居中 "No tasks yet" + 新建入口 |

### 分组

第一版按状态分组（created / planning / plan_approved / completed），每组折叠/展开。不实现拖拽看板。

---

## 五、右栏：Task 工作区

### 无 Run 状态（阶段 D 前）

```
┌─ Task: T-001 ─────────────────┐
│ 分析项目结构                    │
│ Status: created                 │
│ Created: 2026-07-05 12:00      │
│                                 │
│ ─── Description ───            │
│ 分析项目整体架构并给出改进建议    │
│                                 │
│ ─── Runs ───                   │
│ No runs yet.                    │
│ [Dispatch] (Phase D)            │
│                                 │
│ ─── Approvals ───              │
│ No approvals yet.               │
│                                 │
│ ─── Actions ───                │
│ [Approve Plan] (disabled)      │
│ [Review] (disabled)            │
│ [Close] (disabled)             │
└────────────────────────────────┘
```

### 有 Run 时（未来阶段 D）

```
│ ─── Runs ───                   │
│ R-001  plan  completed  2026-07-05 │
│   Agent: opencode              │
│   Session: ses_xxx...          │
│   Artifacts: plan.md (2.3KB)  │
│ [View Output] [Cancel]         │
│                                 │
│ ─── Agent Output ───           │
│ [plan.md content rendered]     │
│                                 │
│ ─── Actions ───                │
│ [Approve Plan] ✓               │
│ [Dispatch Build] (next)        │
```

---

## 六、项目详情抽屉

点击左栏项目旁的 `[▾]` 按钮展开：

```
┌─ Project Detail ──────────────┐
│ × Close                        │
│                                 │
│ Path: E:\program\ai-ui-agentic │
│                                 │
│ Git:                            │
│   Branch: main                  │
│   Remote: github.com/amyfair... │
│   Status: Clean                 │
│                                 │
│ AGENTS.md: Present (4.3 KB)     │
│                                 │
│ AI Memory (.ai/):               │
│   ✓ business-context.md         │
│   ✓ current-state.md            │
│   ✓ decisions.md                │
│                                 │
│ Registered: 2026-07-04          │
│ Status: registered              │
└─────────────────────────────────┘
```

数据源：`GET /api/projects/:id`

---

## 七、状态与错误处理

### 加载状态

| 场景 | 展示 |
|---|---|
| 左栏 projects 加载中 | 骨架占位 or "Loading..." |
| 中栏 tasks 加载中 | "Loading tasks..." |
| 右栏 task 加载中 | "Loading..." |
| API 失败 | 红色 error 条 + "Retry" 按钮 |

### 空状态

| 场景 | 展示 |
|---|---|
| 无项目 | 左栏底部 "No projects. Use CLI..." |
| 无 Task | 中栏空状态居中 + "Create your first task" |
| 右栏无选中 Task | "Select a task from the list" |

### 错误恢复

| 错误 | 行为 |
|---|---|
| 服务未启动 | "Server not running. Run: npm run gui" |
| API 500 | "Unexpected error. Try again." |
| JSON 解析失败 | "Data format error. Check server logs." |

---

## 八、现有 API 到三栏的映射

| URL hash | 旧页面 | 新位置 |
|---|---|---|
| `#/` | Projects list | 左栏 |
| `#/projects/:id` | Project detail | 左栏抽屉 |
| `#/projects/:id/tasks` | Task list | 中栏 |
| `#/projects/:id/tasks/:tid` | Task detail | 右栏 |
| `#/projects/:id/board` | Board view | 右栏 Tab（"Board"） |

所有 API 不变，仅前端渲染位置改变。路由简化为 `#` 后可选初始选中项目/Task。

---

## 九、阶段 D 未来增量

右栏预留插槽（不实现）：

| 组件 | 位置 |
|---|---|
| Agent 选择器 | 右栏顶部（默认 "OpenCode"） |
| [Dispatch Plan] 按钮 | Runs 区域上方 |
| 实时输出面板 | "Agent Output" 区域（`plan.md` 内容渲染） |
| Run 状态指示器 | Runs 列表每行 |
| [Cancel Run] 按钮 | 正在运行的 Run 行 |
| [Approve Plan] 就绪指示 | 从 disabled → active 的条件 |

上述全部通过现有 `run.json` 字段驱动，不新增 OpenCode 专属 UI。

---

## 十、实施拆分

| 步骤 | 内容 | 提交 |
|---|---|---|
| 1 | 重写 `index.html`：三栏 CSS layout | refactor: 三栏工作台 layout |
| 2 | 重写 `app.js` 左栏 + 中栏逻辑 | feat: 左栏项目列表 + 中栏任务列表 |
| 3 | 重写 `app.js` 右栏任务工作区 | feat: 右栏任务详情 + 操作按钮 |
| 4 | 项目详情抽屉 | feat: 项目详情抽屉 |
| 5 | 状态、空态、错误处理 | fix: 三栏状态与错误处理 |
| 6 | 清理旧路由代码 | chore: 移除旧导航 |

---

## 十一、验证方案

```powershell
npm run gui
# 浏览器打开 http://localhost:3456

# 验证：
# 1. 三栏同屏渲染
# 2. 左栏选中项目 → 中栏显示 tasks
# 3. 中栏选中 task → 右栏显示详情
# 4. 创建新 task → 中栏刷新
# 5. approve/review/close 确认弹窗
# 6. 项目详情抽屉展开/关闭
# 7. 空状态正确展示
# 8. API 错误展示可读消息
# 9. 0 npm 新增依赖
```

---

## 十二、不变更边界

| 不改 | 位置 |
|---|---|
| server.js API 端点 | 全保留 |
| console.ps1 逻辑 | 全保留 |
| data/ai-coding-console/ 结构 | 全保留 |
| 0 npm 依赖 | 全保留 |
| 顶层目录 | 全保留 |
| 外部项目 | 全保留 |
| npm run gui 启动 | 全保留 |

---

## 十三、风险与待确认项

| 风险 | 级别 | 说明 |
|---|---|---|
| app.js 300+ 行需重写 80% | 🟡 中 | 保留 apiGet/apiPost/modal 函数，其余重写 |
| 三栏 CSS 在小屏幕下溢出 | 🟢 低 | 固定左 260 + 中 300 = 560px，最小宽度 ~800px 即可 |
| board 内容从独立页移入右栏 Tab | 🟢 低 | board 仍是 Markdown 纯文本渲染，不复杂 |

| 序号 | 待确认 |
|---|---|
| 1 | Task 列表是否按状态分组（需额外 UI），还是平铺（更简单）？建议第一版平铺 |
| 2 | 右栏底部 board Tab 是否需要？建议第一版不实现 board Tab，右栏仅 Task 详情 |

---

> **新布局**: 左 260px 项目 · 中 300px Tasks · 右 flex 工作区
> **保留**: server.js API / console.ps1 / .json 数据 / 弹窗 / 0 依赖
> **未来 Agent 输出**: 右栏 Runs 区域 → Agent Output 面板
