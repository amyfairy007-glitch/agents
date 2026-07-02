# 多 Session 协同工具：完整实施提示词

你现在要在“个人AI工具库”中正式实现一个可复用的【多 Session 协同工具】。

目标不是后台盲跑，也不是只创建子 session。

我要的最终体验是：

- 我在一个总控 OpenCode session 中描述任务。
- 总控可以为同一个任务创建多个 task session。
- 第一版固定验证：1 个总控 + 2 个 task session。
- task session 可以慢慢启动和执行，但总控不能被卡住。
- 我需要随时查看每个 task session 的：
  - 是否已创建
  - 当前状态
  - 当前正在做什么
  - 最后输出
  - 是否等待输入/授权
  - 是否完成或失败
  - 最终结果和交接内容
- 不要求自动弹出多个桌面窗口。
- 允许 task session 运行在 OpenCode 的 session / child session / server session 机制中。
- 关键是：总控不阻塞，我能实时查看子任务进度和结果。

---

## 一、先做事实审计，不要凭空假设

先检查当前本机 OpenCode 的真实版本、CLI 能力、session 创建方式、本地 server/web/API 能力。

重点确认：

1. 当前环境能否创建 child session / task session。
2. 创建 session 后是否能获取 session id。
3. 是否能查询 session 状态、消息、最新输出、错误。
4. 是否支持异步创建或非阻塞提交任务。
5. 是否支持本地 server / web / attach / API。
6. 是否存在已有的 `/spawn` 或自定义命令实现。
7. 当前已有 C0 的创建逻辑是什么，为什么会因为 S013“可见性验证”导致流程中断。
8. 不要把“桌面可见性验证失败”视为 session 创建失败。

输出一份简短审计结论，再进入实施。

---

## 二、目录约束

当前个人AI工具库顶层结构已经固定：

```text
个人AI工具库/
├─ config/
├─ knowledge/
├─ runs/
└─ tools/
```

不得新增、删除、改名任何顶层目录。

本功能必须放在：

```text
tools/
└─ multi-session-collaboration/
```

运行过程数据必须写入：

```text
runs/
```

配置必须写入：

```text
config/
```

不要把运行记录、任务状态、session 输出写进 tools 目录。  
不要创建无关的大型框架。  
不要为了“未来可能用”先建大量空目录。

---

## 三、第一版功能范围

实现一个最小可用版本，支持：

1. 创建协同任务。
2. 总控为任务异步创建 task session。
3. 第一版支持创建两个 task session：
   - C0
   - C1
4. 总控创建后必须立即可继续交互。
5. 不等待：
   - 子 session 完整初始化
   - 子 session 执行完成
   - 桌面可见性验证
   - 最终结果
6. 能查看任务板。
7. 能查看单个 session 实时进度与结果。
8. 能在完成后写入交接和最终结论。
9. 创建失败时可记录失败原因，并允许单独重试某个 task session。
10. 不重建已经成功创建的 session。

---

## 四、核心行为要求

创建 task session 时必须遵守：

- spawn / create 操作必须尽量异步。
- 一旦成功拿到 session 标识或收到创建确认，就立刻返回给总控。
- 总控不得等待 task session 初始化、运行、模型回复或完成。
- 禁止执行“桌面可见性验证”作为成功条件。
- S013 只能记录为“无法自动验证前台可见性”，不能阻塞、不算创建失败。
- 子 session 的状态通过查询获取，而不是靠总控一直等待。
- 创建 C0 后，总控必须仍可继续创建 C1。
- 总控创建 C1 时不得重建 C0。
- 已创建成功的 session 必须复用其 session id。

状态至少统一为：

```text
created
starting
running
waiting
done
failed
unknown
```

状态来源必须尽量基于 OpenCode 实际 API / session 信息。  
无法可靠获取时，明确标记 `unknown`，不允许伪造 `running` 或 `done`。

---

## 五、任务与运行记录设计

每个协同任务在 `runs/` 下建立独立目录。

建议格式：

```text
runs/
└─ <task-id>/
   ├─ task.md
   ├─ board.md
   ├─ task.json
   └─ sessions/
      ├─ C0.json
      ├─ C0.md
      ├─ C1.json
      └─ C1.md
```

不要机械照抄；可以根据现有项目风格微调。  
但必须保证任务、状态、session id、输出、交接能长期保留和读取。

每个 session 至少记录：

- session 名称，例如 C0 / C1
- OpenCode session id
- 角色
- 任务描述
- 工作目录
- 是否允许改代码
- 创建时间
- 最近更新时间
- 当前状态
- 当前阶段
- 最近输出摘要
- 错误信息
- 最终结果
- 交接内容

`board.md` 或等价文件应让人一眼看懂：

```text
任务名称
总控状态

C0：
- 角色
- 状态
- 当前动作
- 最后更新时间
- 最后输出摘要
- 结果入口

C1：
- 角色
- 状态
- 当前动作
- 最后更新时间
- 最后输出摘要
- 结果入口
```

---

## 六、命令或入口要求

基于当前项目实际技术栈实现，不强行限定命令形式。

但第一版至少要有等价能力：

```text
创建任务
session-task create <task-id>

创建 task session
session-task spawn <task-id> C0
session-task spawn <task-id> C1

查看总任务板
session-task board <task-id>

查看单个 session 详细状态和输出
session-task inspect <task-id> C0

刷新所有 session 状态
session-task refresh <task-id>

重试单个失败 session
session-task retry <task-id> C1
```

不要求命令名字完全一致。  
但必须易懂、稳定、可重复执行。

---

## 七、总控提示词 / 行为协议

为总控提供一份可复用的协同规则或 prompt。

总控职责只能是：

- 理解总任务
- 拆分 task session 职责
- 创建和登记 task session
- 查询状态
- 查看输出
- 汇总结果
- 决定后续任务

总控不得：

- 同步等待 task session 执行完成
- 因桌面可见性校验失败而中断
- 因一个 task session 慢启动就停止处理其他任务
- 重复创建已存在的 C0/C1
- 编造 task session 状态或结果
- 把“创建成功”和“任务完成”混为一谈

task session 初始任务必须自动带入：

- 当前 task id
- 自己的角色
- 自己负责范围
- 不负责范围
- 输出要求
- 完成后要写入的交接信息
- 当前运行记录路径

不要求我手动进入每个 session 再登记一次。

---

## 八、可见性与查看方式

我主要需要知道子任务进程和结果。

优先实现：

- task board 可查看所有 session 状态
- 可查看每个 session 的最新输出
- 可查看最终结果
- 可查看失败原因
- 可查看是否长时间无更新
- 可通过 OpenCode 原生 Web / session tree / attach / API 进入真实 session 时，提供对应入口或说明

如果当前 OpenCode 支持本地 Web 或 session tree：

- 不要重新造一个复杂前端。
- 直接复用现有能力作为“查看真实输出”的入口。
- 协同工具只负责把 task id、session id、状态、摘要组织好。

如果没有可靠 Web/API：

- 先实现 CLI board + 运行记录轮询。
- 不要伪造实时能力。
- 明确标注哪些是实时查询、哪些只是最后一次已知状态。

---

## 九、性能与稳定性要求

当前问题是新开 OpenCode 很慢，而且总控会被卡住。

实施时必须优先解决：

1. 不为每个 task session重复启动整套不必要的 OpenCode 进程。
2. 优先复用当前 OpenCode server / session 服务能力。
3. spawn 必须与后续执行解耦。
4. 创建一个 task session 的慢初始化不能阻塞总控。
5. 多个创建动作允许串行提交，但总控必须可继续响应。
6. 不要瞬间暴力创建大量 session。
7. 第一版默认最多 2 个 task session。
8. 失败必须可重试，重试不得影响其他 session。
9. 所有异常必须落入运行记录。
10. 不要为了优化而取消状态、输出和结果可见性。

---

## 十、代码与安全限制

- 先阅读现有仓库结构和已有实现。
- 尽量复用已有命令、脚本、配置、日志格式。
- 不修改无关工具。
- 不删除现有内容。
- 不要引入重量级依赖，除非现有能力无法满足且说明原因。
- 不要直接执行危险 Git 操作。
- 不要修改用户业务项目代码。
- 本次只实现个人AI工具库里的协同能力。
- 所有新增文件都必须有明确作用。
- 完成后给出文件清单和每个文件用途。

---

## 十一、验收场景

完成后必须按以下场景真实验证：

1. 创建一个测试任务 `TEST-MULTI-001`。
2. 总控创建 C0。
3. C0 创建后，总控应能立即继续接收命令。
4. 总控继续创建 C1。
5. C0 和 C1 都能在 board 中显示。
6. C0、C1 即使启动慢，也不会阻塞总控。
7. board 可以看到各自状态和最后输出。
8. 任选一个 session，能查看详细信息。
9. 模拟一个失败 session，验证 retry 只重试该 session。
10. 总控可以汇总 C0、C1 的结果。
11. 所有记录均写入 `runs/TEST-MULTI-001/`。
12. 不依赖桌面前台可见性校验。

最终输出必须包含：

- 审计结论
- 实施方案
- 实际创建/修改的文件列表
- 使用方法
- 验收结果
- 当前已知限制
- 后续可扩展项，但不要现在提前实现
