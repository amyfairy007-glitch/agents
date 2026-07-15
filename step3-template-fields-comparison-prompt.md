# 严格参考现有模板修复 Step3 的 Fields 对比逻辑

请只处理当前项目中的 Step3，并严格参考我提供的现有模板。

目标不是重新设计一套新的对比逻辑，而是：

1. 读取模板中的现有实现
2. 提取模板已经使用的字段对比规则
3. 将这些规则复用到当前 Step3
4. 只调整当前 Step3 中“误比较字段内容”的问题
5. 不改变模板原有结构、风格和输出形式

## 当前步骤关系

- Step1：旧系统采集结果
- Step2：新系统采集结果
- Step3：对比 Step1 和 Step2

Step1 和 Step2 已经正常。

本次只修改 Step3。

不要修改：

- Step1
- Step2
- Step8
- Step9
- 其他已经正常运行的步骤
- 现有公共流程

## 当前问题

当前 Step3 不仅比较 fields，还比较了字段实际内容，例如：

- value
- currentValue
- selectedValue
- selectedText
- input 当前值
- textarea 内容
- 客户姓名
- 客户号
- 地址
- 金额
- 日期
- 页面动态文本
- 业务数据
- innerText
- textContent
- innerHTML
- 其他运行时内容

正确需求是：

> Step3 只比较 fields 的结构和定义，不比较字段当前承载的数据内容。

## 模板路径

请先根据实际项目填写：

```text
参考模板：<模板文件或模板目录路径>
当前实现：<当前 Step3 文件路径>
```

如果路径不明确，请先在项目中搜索最接近的成熟 Step3 或字段对比实现，并说明选择依据。

## 模板优先原则

请先只读分析我提供的模板，并提取以下内容：

1. 模板的 Step3 或对比入口
2. 模板读取旧系统和新系统结果的位置
3. 模板中 fields 的真实数据路径
4. 模板使用的字段匹配规则
5. 模板允许比较的字段属性
6. 模板明确忽略的属性
7. 模板如何判断：新增字段、缺失字段、字段属性变化、字段重命名
8. 模板的输出格式
9. 模板使用的辅助函数
10. 模板是否先标准化 fields 再比较
11. 模板是否对完整 JSON 做 deep diff
12. 模板如何处理 options 和字段顺序

不要在分析模板之前自行设计新规则。

## 规则提取要求

请输出一份“模板规则清单”，包括：

### 字段匹配规则

按模板真实代码列出优先级，例如：business key、name、id、label、section + label，以及模板实际使用的其他规则。

不要根据通用经验补充模板中不存在的规则。

### 允许比较的字段属性

只列出模板真实比较的属性，例如：name、label、type、controlType、required、readonly、disabled、maxLength、options、section、order。

以模板代码为准，不要擅自扩展。

### 必须忽略的内容

根据模板现有过滤逻辑，以及当前需求，确保以下动态内容不得进入 diff：

- value
- currentValue
- selectedValue
- selectedText
- displayValue
- input 当前内容
- textarea 当前内容
- 客户数据
- 页面动态文本
- innerText
- textContent
- innerHTML
- outerHTML
- timestamp
- session
- token
- 运行时生成数据

如果模板原本已经过滤这些内容，请复用原逻辑。

如果模板漏掉其中一部分，只允许做最小补充，不要重写整个对比模块。

## 修改 Step3 的原则

当前 Step3 必须尽量复用模板：

- 相同的函数结构
- 相同的命名方式
- 相同的数据标准化方式
- 相同的字段匹配规则
- 相同的输出格式
- 相同的错误处理方式
- 相同的测试风格

如果当前 Step3 和模板不同，请明确列出差异，并只做必要修改。

不要：

- 重新设计架构
- 引入新的比较框架
- 增加模板没有的复杂匹配算法
- 修改 Step1 或 Step2 输出
- 对完整 JSON 直接做 deep diff
- 为 Step9 做同步修改
- 扩大修改范围

## Step3 正确行为

Step3 应执行：

```text
读取 Step1
→ 读取 Step2
→ 按模板提取 fields
→ 按模板标准化 fields
→ 按模板匹配字段
→ 只比较字段定义
→ 输出模板格式的差异结果
```

字段实际内容不同，不应产生差异。

例如，旧系统：

```javascript
{
  name: "customerName",
  label: "Customer Name",
  type: "text",
  value: "Amy"
}
```

新系统：

```javascript
{
  name: "customerName",
  label: "Customer Name",
  type: "text",
  value: "John"
}
```

预期：无字段差异。

但如果旧系统 `required=false`，新系统 `required=true`，则应记录 required 变化。

## 必须增加或复用的测试

请优先复用模板已有测试。

至少验证：

1. fields 相同、value 不同：预期无差异
2. fields 相同、selectedValue 不同：预期无差异
3. 页面动态文本不同：预期无差异
4. 新系统新增字段：预期记录新增字段
5. 新系统缺失字段：预期记录缺失字段
6. required 变化：预期只记录 required
7. options 定义变化：预期按模板规则记录变化
8. 输入完全相同：预期无差异

## 工作步骤

请严格按以下顺序执行：

### 第一步：只读模板

不要修改代码。

输出：模板入口、模板调用链、模板 fields 路径、模板字段白名单、模板忽略列表、模板字段匹配规则、模板输出结构、模板测试覆盖、模板中可直接复用的函数。

### 第二步：对比当前 Step3

输出：当前 Step3 与模板的差异、当前 Step3 为什么会比较字段内容、哪些 key 被错误纳入比较、哪些模板逻辑当前没有复用、最小修改范围。

### 第三步：修改 Step3

只修改必要文件。

优先调用模板已有公共函数、复制模板成熟逻辑到同一公共位置，并保持模板代码风格。

禁止整段重写，除非当前 Step3 完全不存在可复用结构，并且必须说明原因。

### 第四步：测试

运行模板已有测试和 Step3 相关测试。

重点证明：value 不进入 diff、selectedValue 不进入 diff、动态文本不进入 diff、字段定义变化仍然能被识别。

## 最终输出

请最终输出：

1. 使用了哪个模板文件
2. 模板中的 Step3 或对比入口
3. 从模板提取出的完整规则
4. 模板允许比较的字段属性
5. 模板忽略的动态属性
6. 当前 Step3 的问题根因
7. 当前 Step3 与模板的差异
8. 修改过的文件
9. 复用或新增的函数
10. 测试结果
11. 一个 fields 相同但 value 不同、最终无 diff 的真实示例
12. 尚未解决的问题

## 重要限制

- 模板是唯一优先参考
- 不要凭空设计新规则
- 只修改 Step3
- 不修改 Step1、Step2、Step8、Step9
- 不改变模板输出结构
- 不扩大修改范围
- 不对完整 JSON 做 deep diff
- 只比较 fields 的结构和定义
- 动态业务内容必须排除
- 先分析模板，再修改代码
