# 基于人工操作录制制作正式自动化脚本

请基于当前项目现有代码，实现一套“人工示教录制 → 分析操作 → 编写正式脚本 → 自动验证 → 删除录制材料”的开发流程。

## 一、最终目标

录制视频和录制产生的操作信息只是临时开发材料，用于帮助理解：

- 用户真实执行了哪些操作
- 操作顺序是什么
- 页面位于哪个 iframe 或窗口
- 下拉框、按钮、输入框等控件实际如何交互
- 点击或提交后页面发生了什么变化
- 什么页面状态表示操作成功

最终交付物必须是：

1. 可独立运行的正式自动化脚本
2. 必要的配置文件
3. 自动化验证脚本
4. 简短的运行说明
5. 明确的错误诊断信息

正式运行时不得依赖录制视频、人工点击、Playwright Inspector、临时录制文件、固定鼠标坐标或开发人员手动确认。

正式脚本验证通过后，录制视频和临时录制材料可以删除。

## 二、当前项目背景

当前项目共有 9 个步骤，用于新旧系统的 local change 分析。

- Step1：旧系统页面采集
- Step2：新系统页面采集，当前已经正常
- Step3～Step9：依赖 Step1 和 Step2 的结果

本次只处理 Step1。

现有公共流程已经实现并能够正常完成：

1. 启动旧系统浏览器
2. 第一次登录
3. 第二次登录
4. 从导航进入目标 Journey
5. 完成 Customer Search
6. 成功进入目标 Journey 页面

不要修改、重写或破坏以上公共流程。

进入目标 Journey 页面之后，需要：

1. 在客户号下拉框中选择具体客户号
2. 点击 Change
3. 等待业务页面出现
4. 完整执行该 Journey 的业务操作
5. 采集 Step1 数据

当前主要问题是自动化脚本无法稳定完成客户号选择和 Change 操作。

## 三、整体开发流程

```text
自动执行公共流程
→ 进入目标 Journey
→ 开启人工示教录制
→ 用户手动完整操作一次
→ 保存临时录制材料
→ 分析真实操作和页面变化
→ 编写正式自动化脚本
→ 参数化所有测试数据
→ 自动回放验证
→ 连续执行 3 次
→ 保留正式脚本
→ 删除录制视频和临时录制材料
```

录制不是最终功能，不要将录制结果原样作为正式脚本交付。录制结果只能作为分析和编写正式脚本的参考资料。

## 四、第一阶段：审计现有代码

在修改任何文件之前，先完成只读审计。

请找出：

1. Step1 的真实执行入口
2. 公共流程的入口函数
3. 公共流程成功进入 Journey 后的准确代码位置
4. 当前 Journey 专属代码所在位置
5. 当前客户号下拉框处理代码
6. 当前 Change 点击代码
7. Step1 采集函数入口
8. 当前错误发生的位置
9. 哪些文件需要修改
10. 哪些文件明确不应修改

不要修改 Step2、Step3～Step9、登录逻辑、二次登录逻辑、导航逻辑和 Customer Search 公共逻辑。

先输出审计结果和最小修改计划，再开始修改。

## 五、第二阶段：增加人工示教模式

请增加一个专门用于制作脚本的示教模式，例如：

```text
RECORD_JOURNEY=true
```

或者：

```text
--record-journey
```

示教模式开启时：

1. 必须使用 headed 浏览器
2. 自动执行现有公共流程
3. 自动进入目标 Journey
4. 保留现有 browser context、cookie、session 和登录状态
5. 不要重新启动一个未登录的新浏览器
6. 到达 Journey 后允许用户接管浏览器
7. 用户手动完成完整业务流程
8. 保存操作过程所需的临时开发材料
9. 用户完成操作后结束本次录制
10. 不执行正式批量采集

示教过程中需要尽可能记录：

- 页面 URL
- 所有 page
- 所有 iframe
- iframe 的父子关系
- iframe 的 name、id 和 src
- 用户点击的元素
- 用户输入的值
- 下拉框选择行为
- Change 点击行为
- 页面跳转
- iframe 刷新或替换
- Ajax 请求
- 弹窗
- 新窗口
- 成功页面状态
- 页面截图
- 必要的 DOM 快照
- Playwright 生成的 locator 或交互代码

如果现有 Playwright API 无法直接在已登录页面中生成完整 codegen，请使用当前项目中最可行的等效方案。

核心要求是：用户可以在已登录的 Journey 页面操作，可以记录真实操作路径，可以识别 iframe 和页面变化，不要求用户重新登录，并且不破坏现有公共流程。

## 六、第三阶段：分析录制材料

用户完成操作后，请分析录制材料，并明确：

1. 客户号下拉框位于哪个 page 或 iframe
2. 是否存在多层 iframe
3. 下拉框是原生 select、自定义下拉框、input + popup、table 模拟下拉或其他组件
4. 用户实际如何展开下拉框
5. 用户实际如何选择客户号
6. 客户号选中后页面有什么状态变化
7. Change 按钮位于哪个 page 或 iframe
8. Change 的真实点击方式
9. 点击 Change 后是否发生页面跳转、iframe reload、iframe 替换、局部刷新、Ajax 请求、新窗口或 URL 变化
10. 什么元素或页面状态表示业务页面已经成功加载
11. 后续业务流程的完整操作顺序
12. 哪些操作属于误点或录制噪音
13. 哪些操作必须保留
14. 哪些数据需要参数化

不要只描述视频内容，必须将录制内容转化为可用于编写正式自动化脚本的技术结论。

## 七、第四阶段：编写正式 Journey 脚本

根据录制分析结果，重新编写正式自动化脚本。不要直接复制录制代码作为最终代码。

建议结构：

```javascript
async function runJourneyFlow(page, options) {
  const { customerNo, journeyName, inputData } = options;

  await selectCustomer(page, customerNo);
  await clickChange(page);
  await waitForBusinessPage(page);
  await executeBusinessFlow(page, inputData);
}
```

正式脚本必须满足：

1. 客户号通过参数传入
2. Journey 名称通过参数或配置传入
3. 业务输入值通过参数或配置传入
4. 不允许硬编码测试客户号
5. 不允许硬编码账号和密码
6. 不允许保存 session、cookie 或 token 到代码仓库
7. 优先使用 Locator 和 FrameLocator
8. 不保存容易失效的 ElementHandle
9. Change 前后如 iframe 被替换，必须重新定位
10. 每个关键步骤必须有状态校验
11. 不依赖录制视频
12. 不依赖人工点击
13. 不依赖 Inspector
14. 不依赖固定鼠标坐标
15. 不使用大量固定 timeout

定位规则优先级：稳定的 name、label、role、稳定文本、data 属性、业务属性，最后才是稳定 CSS。

应尽量避免超长绝对 CSS、动态 id、无意义的 nth()、依赖页面位置的 XPath、固定坐标点击和只通过 sleep 等待。

## 八、Change 步骤专项要求

正式脚本必须证明以下状态成立：

```text
客户号下拉框已找到
→ 正确客户号已选中
→ Change 按钮已找到
→ Change 已成功触发
→ 页面或 iframe 已发生预期变化
→ 业务页面已真正加载
```

必须实现：

1. 下拉框存在性验证
2. 下拉框可见性验证
3. 客户号选项存在性验证
4. 客户号选中后的状态验证
5. Change 按钮可操作验证
6. Change 点击后的响应验证
7. 业务页面加载完成验证

点击 Change 后，不要继续使用可能已经失效的旧 frame 或 element。如 iframe 发生 reload 或替换，必须重新获取 FrameLocator。

不要只使用固定等待时间，应等待业务页面特有元素、文本、表单、标题或稳定状态出现。

## 九、录制代码清理要求

请清理用户误点、重复点击、重复 fill、无意义 focus、鼠标移动记录、临时等待、不稳定 locator、固定客户号、固定测试数据，以及与 Journey 无关的公共操作。

录制结果中的业务顺序可以参考，但最终代码必须重新组织为：

```text
selectCustomer()
clickChange()
waitForBusinessPage()
executeBusinessFlow()
collectStep1Data()
captureDiagnostics()
```

## 十、错误诊断

正式脚本执行失败时，需要自动保存：

- Journey 名称
- customerNo
- 失败步骤
- 当前 page URL
- 当前 page 数量
- 所有 frame 的 URL 和 name
- 失败 locator
- 当前截图
- 当前 DOM 快照
- 错误堆栈
- 失败时间
- Change 前后页面状态

关键日志示例：

```text
[Journey] 已进入目标 Journey
[Journey] 已定位客户号下拉框
[Journey] 已选择客户号
[Journey] 客户号选中状态验证通过
[Journey] 已点击 Change
[Journey] 等待业务页面
[Journey] 业务页面加载完成
[Journey] 开始执行业务流程
[Journey] 开始采集 Step1
```

## 十一、正常运行模式

示教模式关闭后，正式运行模式必须自动执行公共流程、进入目标 Journey、选择客户号、点击 Change、等待业务页面、完成业务流程并执行 Step1 采集，全程不需要人工操作，不打开 Inspector，也不读取录制视频。

建议结构：

```javascript
await runLegacyCommonFlow(page, config);

if (recordMode) {
  await recordJourneyDemonstration(page, config);
  return;
}

await runJourneyFlow(page, {
  customerNo: config.customerNo,
  journeyName: config.journeyName,
  inputData: config.inputData
});

await collectStep1Data(page, config);
```

## 十二、自动化验收

### 测试一：单次自动回放

完全关闭浏览器并重新启动，不得人工干预。必须自动完成公共流程、进入 Journey、选择客户号、点击 Change、加载业务页面、完整业务流程和 Step1 采集。

### 测试二：连续稳定运行

同一个 Journey 连续运行 3 次。只有 3 次都不需要人工操作、都成功点击 Change、进入业务页面、完成业务流程，并且 Step1 输出结构一致，才算通过。

### 测试三：不同测试数据

至少使用两个不同的 customerNo 或输入数据运行，验证正式脚本不是只对录制时的固定数据有效。

## 十三、录制材料删除规则

录制视频和临时录制材料只能在以下条件全部满足后删除：

1. 正式脚本已经完成
2. 自动回放成功
3. 连续运行 3 次成功
4. 不同测试数据验证成功
5. Step1 输出结果正确
6. 正式脚本已经提交到代码仓库
7. 必要的错误诊断已实现

满足以上条件后，可以删除录制视频、临时截图、原始录制代码、临时 DOM 文件、临时操作日志和开发阶段中间材料。

不要删除正式 Journey 脚本、配置文件、自动测试、README、必要运行日志和故障诊断机制。

临时录制目录建议：

```text
tmp/recordings/<journey-name>/
```

最终正式脚本建议目录：

```text
journeys/<journey-name>/
  flow.ts
  config.ts
  flow.spec.ts
  README.md
```

## 十四、最终输出要求

完成后请输出：

1. Step1 的真实入口
2. 公共流程结束位置
3. 示教模式入口
4. 录制材料保存位置
5. 录制分析结论
6. 正式脚本保存位置
7. 客户号参数化方式
8. Change 自动化实现方式
9. Change 后业务页面成功判定
10. 修改过的文件
11. 自动回放命令
12. 连续 3 次测试结果
13. 不同数据测试结果
14. Step1 输出验证结果
15. 已删除的录制材料
16. 仍需保留的正式文件
17. 尚未解决的问题

## 十五、重要限制

- 录制只是制作脚本的临时工具
- 最终交付物必须是正式脚本
- 正式脚本不得依赖录制视频
- 不要修改已经正常工作的 Step2
- 不要重写现有公共流程
- 不要创建重复登录逻辑
- 不要要求用户在正式运行时手动操作
- 不要使用录制视频代替自动化实现
- 不要通过大量 timeout 掩盖问题
- 不要将录制生成代码原样投入正式运行
- 必须先分析，再编写正式脚本
- 修改范围尽可能小
- 脚本验证完成前不得删除录制材料
- 脚本验证完成后应删除录制视频和临时材料
