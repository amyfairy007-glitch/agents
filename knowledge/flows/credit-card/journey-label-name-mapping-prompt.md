# Journey Label → Legacy Name 映射提示词

你现在要处理一个已经完成初步迁移的 React journey。

本任务只做一件事：

> 以当前 React journey 中已经存在的 `label` 为入口，回到旧 AngularJS journey 中找到对应元素原始定义的 `name`，建立 `label ↔ name` 映射。

不要做其他迁移治理。

---

## 一、任务输入

执行前确认以下对象：

1. 当前 React 项目
2. 旧 AngularJS 项目
3. 当前 market（如果有）
4. 当前 journey

如果这些信息已经在当前上下文中明确，不要重复询问。

默认只处理当前 journey。

不要扫描全部项目。
不要处理其他 journey。
不要处理其他 market，除非当前 journey 明确依赖。

---

## 二、唯一目标

从当前 React journey 中提取现有 `label`，然后到旧 AngularJS journey 中寻找对应 UI 元素，提取旧系统定义的 `name`。

最终只建立：

```text
label → name
```

例如：

```text
Basic Information → tab1
Account Details → tab2
Customer Name → customerName
```

---

## 三、本轮只关心两个字段

只关心：

- `label`
- `name`

不要分析：

- API
- 数据来源
- validation
- required
- submit
- event
- ng-click
- ng-model
- loading
- error
- route
- buildRequest
- disabled
- readOnly
- defaultValue
- options
- formatter
- CSS
- 组件规范
- React 最佳实践
- 标准仓库写法

除非为了确认某个 label 对应哪个旧元素，必须做最小范围定位，否则不要扩展分析范围。

---

## 四、执行顺序

### Step 1：读取当前 React journey

找到当前 journey 中所有用户可见的 `label`。

包括但不限于：

- tab label
- form label
- field label
- section label
- panel label
- button label
- table header label
- modal label/title
- 页面中其他有明确 label 定义的 UI 元素

只记录当前 React 真实存在的 label。

不要自己补充页面上不存在的 label。

### Step 2：逐个 label 回查旧 AngularJS journey

对每一个 React label：

1. 在旧 AngularJS 当前 journey 中查找相同 label。
2. 如果 label 不是直接字符串，而是常量 / strings / i18n key，则继续追到实际对应定义。
3. 找到对应 UI 元素后，读取它旧系统中的 `name`。
4. 建立 `label → name` 映射。

不要因为变量名看起来相似就直接认定匹配。
优先依据 label 对应关系和当前 journey 中的位置/上下文确认。

---

## 五、匹配规则

### 1. 唯一明确匹配

旧系统中找到唯一对应元素，并且存在明确 `name`。

输出：

```text
FOUND
```

### 2. 找不到旧 name

如果能找到 label，但该元素没有 `name` 定义，输出：

```text
NO_NAME
```

不要自己创造 name。

### 3. 完全找不到对应元素

输出：

```text
NOT_FOUND
```

不要猜。

### 4. 一个 label 对应多个可能 name

输出：

```text
AMBIGUOUS
```

并列出候选 name。

不要擅自选择一个。

### 5. label 文本存在轻微差异

例如：

- 大小写不同
- 冒号不同
- 空格不同
- 文案前后有少量固定修饰

可以作为候选匹配，但必须确认页面位置和语义一致后才能标记 FOUND。

如果无法确认，标记 AMBIGUOUS。

---

## 六、严格禁止

本轮禁止：

1. 禁止修改 React 代码。
2. 禁止修改旧 AngularJS 代码。
3. 禁止补 validation。
4. 禁止补 API。
5. 禁止重构组件。
6. 禁止修改 label。
7. 禁止 AI 自己生成 name。
8. 禁止依据 React 当前变量名反推旧 name 并当成事实。
9. 禁止因为“看起来应该叫这个”就填 name。
10. 禁止扩大为完整 journey 迁移审计。

本轮只做映射提取。

---

## 七、输出格式

只输出一张主表：

| label | name |
|---|---|
| Basic Information | tab1 |
| Account Details | tab2 |
| Customer Name | customerName |
| Example Missing | NOT_FOUND |
| Example No Name | NO_NAME |
| Example Ambiguous | AMBIGUOUS: nameA / nameB |

不要在主表中增加 API、类型、validation、路径等额外列。

---

## 八、证据要求

虽然最终主表只保留 `label` 和 `name` 两列，但每个 FOUND 结果必须来自旧 AngularJS 真实代码。

执行过程中必须实际定位旧系统定义，不能只根据 React 代码猜测。

如果无法在旧代码中确认，则不能输出确定 name。

---

## 九、完成标准

当前 journey 完成条件：

1. React 当前 journey 中所有已有 label 都被检查。
2. 每个 label 都有一个结果：
   - 真实 name
   - NOT_FOUND
   - NO_NAME
   - AMBIGUOUS
3. 没有任何 AI 自造 name。
4. 没有处理当前 journey 之外的内容。
5. 没有做 label/name 之外的迁移治理。

完成后停止，不要自动进入 validation、API、submit 或其他迁移步骤。

---

## 十、重复执行方式

这个提示词用于一个 journey 一个 journey 执行。

每次只替换当前目标：

```text
market: <当前 market>
journey: <当前 journey>
```

然后重新执行同样流程。

不要把多个 journey 合并成一次大扫描。