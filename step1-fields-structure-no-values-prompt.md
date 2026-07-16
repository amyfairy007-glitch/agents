# 修复 Step1：完整采集 Fields 结构，不采集 Values

请只修复当前项目中 Step1 的字段结构采集问题。

## 一、当前事实

- Step1 已经可以通过录制方式完成旧系统的登录、导航、客户号选择和 Change。
- Step2 可以稳定提取 16 个字段。
- Step1 当前输出只能稳定提取 1 个字段。
- Step3 已经或正在调整为只比较 fields，不比较 values。
- 当前主要问题是 Step1 没有向 Step3 提供完整的旧系统字段结构。

当前结果类似：

```text
oldFieldCount: 1
newFieldCount: 16
```

这说明 Step3 即使只比较 fields，仍然会因为 Step1 字段采集不足而产生大量错误差异。

## 二、本次目标

完整采集旧系统业务页面中的 fields 结构，但不要采集字段当前 value、客户业务数据或页面动态内容。

正确流程：

```text
完成公共流程
→ 选择客户号
→ 点击 Change
→ 等待业务页面加载
→ 重新获取最新 page 和 iframe
→ 扫描所有业务字段
→ 标准化 fields
→ 输出 Step1 fields 结果
```

## 三、本次修改范围

只修改 Step1 的字段采集及必要辅助文件。

不要修改：

- Step2
- Step3
- Step4～Step9
- 登录流程
- 二次登录流程
- 导航流程
- Customer Search
- 录制流程
- 已经正常工作的公共流程

不要通过硬编码 Repayment Schedule 或某一个 Journey 的字段解决问题。

必须实现通用的旧系统字段结构采集。

## 四、第一阶段：只读审计

修改前先输出：

1. Step1 的真实执行入口。
2. Step1 点击 Change 后从哪个 page 或 iframe 开始采集。
3. Change 后 iframe 是否 reload、替换或重新创建。
4. 当前采集函数扫描了哪些 frame。
5. 当前采集函数使用了哪些 selector。
6. 是否只扫描了 input。
7. 是否遗漏 select、textarea、checkbox、radio 或自定义控件。
8. 是否只扫描了一个 section 或 container。
9. 当前为什么最终只生成 1 个 field。
10. Step1 fields 在输出 JSON 中的真实路径。
11. 计划修改的文件。
12. 明确不会修改的文件。

先审计，再修改。

## 五、Change 后必须重新获取页面上下文

点击 Change 后，不要复用之前保存的：

- Frame
- FrameLocator
- Locator
- ElementHandle
- 旧 DOM 引用

原因：

- iframe 可能刷新
- iframe 可能被替换
- DOM 可能重建
- 旧引用可能已经失效

必须在业务页面加载后重新读取：

```javascript
const frames = page.frames();
```

并记录：

- frame name
- frame URL
- parent frame
- 每个 frame 找到的字段数量

如果存在多层 iframe，必须扫描真实业务 frame。

## 六、字段采集范围

至少检查以下控件：

```text
input
select
textarea
checkbox
radio
button（仅在模板将其视为业务字段时）
具有明确 label 的自定义表单控件
```

对于 input，应识别常见类型：

```text
text
number
date
email
tel
password
checkbox
radio
hidden
submit
button
```

hidden、submit、button 是否作为 field 输出，应遵循成熟模板规则。

不要因为 selector 只匹配一种控件而遗漏其他字段。

## 七、Fields 白名单输出

每个字段只允许输出结构信息。

建议标准结构：

```javascript
{
  fieldKey: "",
  name: "",
  id: "",
  label: "",
  type: "",
  controlType: "",
  required: false,
  readonly: false,
  disabled: false,
  maxLength: null,
  minLength: null,
  min: null,
  max: null,
  pattern: null,
  multiple: false,
  options: [],
  section: "",
  group: "",
  order: null,
  visible: true
}
```

最终字段白名单必须根据当前项目和成熟模板的真实结构确定。

未进入白名单的属性不得进入正式 Step1 fields 输出。

## 八、明确禁止采集或输出的 Values

以下内容不得进入正式 fields 结果：

- value
- currentValue
- defaultValue 中的业务数据
- selectedValue
- selectedText
- displayValue
- input 当前内容
- textarea 当前内容
- 客户号
- 客户姓名
- 地址
- 电话
- 邮箱实际值
- 金额实际值
- 日期实际值
- 账户余额
- 页面动态提示
- 业务结果文本
- innerText
- textContent
- innerHTML
- outerHTML
- 完整 DOM
- screenshot 内容
- customerData
- request / response 中的客户数据
- timestamp
- session
- token
- cookie
- runtimeData
- 随机生成内容

调试信息可以单独保存，但不能混入正式 Step1 fields 输出。

## 九、Label 提取规则

请根据成熟模板提取 label 的真实规则。

常见来源包括：

1. `label[for]`
2. 父级或相邻 label
3. table 中左侧单元格
4. fieldset / legend
5. aria-label
6. aria-labelledby
7. placeholder（仅在无其他 label 时，并且模板允许）
8. 自定义组件中的稳定业务文本

不要使用字段当前 value 作为 label。

label 需要标准化：

- 去除首尾空格
- 合并连续空格
- 去除非业务性冒号
- 统一必要的大小写或标点差异

## 十、Options 采集规则

对于 select 或自定义下拉框，可以采集选项定义：

```javascript
[
  { value: "A", label: "Active" },
  { value: "I", label: "Inactive" }
]
```

不得采集当前选中状态：

```text
selectedValue
selectedText
value
```

如果 options 顺序没有业务意义，应按照成熟模板规则进行标准化排序。

## 十一、字段去重规则

正式输出前需要去重，但不能错误合并不同字段。

去重优先依据：

1. 稳定业务 key
2. 稳定 name
3. 稳定 id
4. frame + section + label
5. frame + controlType + label

禁止仅因为以下属性相同就合并：

- type 相同
- label 相同但 section 不同
- controlType 相同
- 当前 value 相同

必须记录字段来源：

- 所在 frame
- 所在 section
- DOM 顺序

## 十二、业务页面加载成功判定

在开始采集前，必须证明业务页面已经真正加载。

优先使用：

- 业务页面特有标题
- 特有表单
- 特有 section
- 特有 table
- 最新 iframe URL
- 最新 iframe 中的稳定字段数量
- 页面 loading 状态结束

不要只使用固定等待：

```javascript
await page.waitForTimeout(5000);
```

可以有短暂等待辅助，但不能作为唯一成功条件。

## 十三、调试信息

失败时自动输出：

- Journey 名称
- 当前 page URL
- 所有 frame URL
- 所有 frame name
- frame 父子关系
- 每个 frame 的字段数量
- 当前使用的 selector
- 当前截图
- DOM 快照
- 最终输出字段清单
- 被排除的动态 key
- 错误堆栈

日志示例：

```text
[Step1] Change 已点击
[Step1] 已重新获取最新 frame
[Step1] Frame A 找到 0 个字段
[Step1] Frame B 找到 12 个字段
[Step1] 去重前字段数：14
[Step1] 去重后字段数：12
[Step1] 已排除 value、selectedValue 和动态内容
[Step1] fields 输出完成
```

## 十四、必须增加的测试

### 测试一：多种控件

页面包含：

- input
- select
- textarea
- checkbox
- radio

预期：

```text
所有符合规则的字段均被采集
```

### 测试二：字段有 value

页面字段存在客户姓名或金额 value。

预期：

```text
字段结构被采集，但 value 不进入正式输出
```

### 测试三：selectedValue

下拉框存在当前选中值。

预期：

```text
options 定义可保留，selectedValue 不输出
```

### 测试四：iframe 替换

点击 Change 后业务 iframe 被替换。

预期：

```text
Step1 重新获取最新 frame，并从新 frame 采集字段
```

### 测试五：多 section

字段分布在多个 section。

预期：

```text
所有 section 都被扫描
```

### 测试六：重复字段

不同 frame 或 section 中存在相同 label。

预期：

```text
不会错误合并不同字段
```

### 测试七：动态内容污染

输入中包含：

- value
- innerText
- timestamp
- customerData
- token

预期：

```text
以上内容不进入正式 fields 输出
```

### 测试八：Step3 兼容

Step1 和 Step2 字段结构相同，但当前 value 不同。

预期：

```text
Step3 无字段差异
```

## 十五、验收标准

只有满足以下条件才算完成：

1. Step1 不再只输出 1 个字段。
2. Step1 输出字段数量与旧页面实际字段数量基本一致。
3. Step1 能扫描最新业务 iframe。
4. Step1 能采集 input、select、textarea、checkbox、radio 等控件。
5. Step1 不输出字段当前 values。
6. Step1 不输出客户业务数据。
7. Step1 fields 结构稳定。
8. Step3 可以使用 Step1 和 Step2 的 fields 进行比较。
9. 字段结构相同但 values 不同时，不产生差异。
10. 所有测试通过。
11. Step2 和其他正常步骤未被修改。

## 十六、最终输出

请最终输出：

1. Step1 当前只输出 1 个字段的根因。
2. Change 后实际使用的 page / iframe。
3. 扫描到的全部 frame 清单。
4. 每个 frame 找到的字段数量。
5. 原采集 selector。
6. 修改后的采集规则。
7. 最终字段白名单。
8. 明确排除的 values 和动态 key。
9. 字段去重规则。
10. 修改过的文件。
11. 新增测试文件。
12. 所有测试结果。
13. Step1 最终字段数量。
14. 一个字段存在 value、但正式输出不包含 value 的真实示例。
15. 明确确认 Step2、Step3 和其他步骤未被修改。
16. 尚未解决的问题。

## 十七、重要限制

- 不要修改 Step2。
- 不要修改 Step3。
- 不要修改 Step4～Step9。
- 不要修改登录、导航、Customer Search 和录制流程。
- 不要硬编码某个 Journey 的字段。
- 不要通过固定返回值伪造字段数量。
- 不要用完整 DOM 作为正式 fields 输出。
- 不要把 value 和客户数据写入正式输出。
- 必须重新获取 Change 后的最新 frame。
- 必须先审计，再修改。
- 修改范围尽可能小。
