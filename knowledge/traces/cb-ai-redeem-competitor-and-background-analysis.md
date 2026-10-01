# CB AI Redeem 竞品与背景分析

> 分析对象：`E:\program\ai-redeem`
>
> 竞品：AutoSub（`https://autosub.site/`）
>
> 生成日期：2026-10-01
>
> 分析版本：V1 / 公开资料事实盘点

## 一、分析范围与资料来源

本次只分析公开可访问的竞品页面和官方 API 文档，并结合本机 `ai-redeem` 仓库当前 README。

已使用资料：

- [AutoSub 产品页面](https://autosub.site/)
- [AutoSub API 指南](https://docs.autosub.site/)
- [AutoSub v1.1.0 更新说明](https://docs.autosub.site/9254861m0)
- [AutoSub v1.1.2 更新说明](https://docs.autosub.site/9254859m0)
- [AutoSub v1.1.3 更新说明](https://docs.autosub.site/9254858m0)
- [AutoSub v1.1.4 更新说明](https://docs.autosub.site/9298203m0)
- 本机 `E:\program\ai-redeem\README.md`

说明：本次抓取时产品首页返回 403，首页信息使用搜索索引中的公开摘要；官方 API 文档和版本更新页面可正常读取。竞品服务端实现、数据库和部署环境不可见。

## 二、当前 ai-redeem 背景

根据本机 README，`ai-redeem` 的定位是 CDK 卡密兑换网站：

- 用户在本网站输入 CDK 卡密并完成兑换；
- 购买网站负责商品购买和卡密发放；
- 关联购买网站为 `mzmxms/ai-shop`；
- 已确认的业务链路为：购买商品 → 获取 CDK 卡密 → 在本网站兑换。

当前仓库只有 README 和 Git 元数据，尚未确认业务代码、技术栈、运行入口、配置项或部署流程。因此以下竞品内容是外部参考事实，不是当前 `ai-redeem` 已有能力，也不是已批准的产品需求。

## 三、AutoSub 已确认的产品形态

公开产品摘要显示，AutoSub 将兑换流程呈现为分步自助流程：

1. 选择 ChatGPT 或 Claude；
2. 校验 CDK；
3. 校验账号；
4. 确认兑换；
5. 展示兑换结果。

产品页面还公开展示“官方渠道”“极速到账”“失败可退”等信任和结果承诺。上述内容只代表公开页面文案，不代表其真实履约能力或法律承诺。

## 四、AutoSub 公开 API 流程

官方 API 指南列出 6 个公开接口，统一使用 `POST` 和 JSON 请求体：

| 阶段 | 接口 | 公开作用 |
|---|---|---|
| 1 | `/api/v1/sub/verifyCdk` | 校验并短期锁定 CDK，返回 `activation_token` |
| 2 | `/api/v1/sub/precheckAccount` | 预检 ChatGPT/Claude 账号和兑换资格 |
| 3 | `/api/v1/sub/redeem` | 提交兑换任务 |
| 4 | `/api/v1/sub/redeemResult` | 使用查询令牌轮询异步结果 |
| 5 | `/api/v1/sub/queryOrder` | 按一个或多个 CDK 查询最近订单 |
| 6 | `/api/v1/sub/queryBilling` | 查询 ChatGPT 账号账单信息 |

文档明确区分 HTTP 状态和业务状态：正常业务响应通常为 HTTP 200，响应体中的 `code=200` 表示业务成功，`code=0` 表示业务失败；限流和安全服务不可用分别可能返回 429 和 503。

## 五、公开版本演进

### v1.1.0：多服务商

AutoSub 从单一 ChatGPT 兑换扩展到 ChatGPT 与 Claude：

- 新增 `provider`，公开值包括 `openai` 和 `claude`；
- `verifyCdk` 支持 `expected_provider`；
- Claude 预检需要同时携带 CDK 和 `activation_token`；
- 订单结果增加服务商和支付确认状态；
- `payment_result_checking=true` 表示支付结果仍在确认中，不应直接当作失败。

来源：[v1.1.0 更新说明](https://docs.autosub.site/9254861m0)。

### v1.1.2：账单查询和维护状态

- 增加独立的 `queryBilling` 账单查询接口；
- 账单查询有请求大小和公开限流说明；
- 兑换服务维护中以业务失败信息返回；
- 账单字段允许订阅、支付方式和客户信息为空。

来源：[v1.1.2 更新说明](https://docs.autosub.site/9254859m0)。

### v1.1.3：兑换流程幂等恢复

- `verifyCdk` 增加可选 `request_nonce`；
- 同一 CDK 和同一 nonce 在锁定有效期内重试，可以恢复原锁定；
- 返回 `resumed` 说明是否恢复已有锁定；
- 恢复不会延长原锁定有效期。

来源：[v1.1.3 更新说明](https://docs.autosub.site/9254858m0)。

### v1.1.4：登录态刷新

- `precheckAccount` 可能返回 `refreshed_token`；
- 调用方收到后需要使用新 token 继续 `redeem`；
- 文档要求相关响应使用 `no-store`，并且不要把 token 写入日志、分析事件或错误上报。

来源：[v1.1.4 更新说明](https://docs.autosub.site/9298203m0)。

## 六、与当前 ai-redeem 的事实对照

| 维度 | AutoSub 公开事实 | 当前 ai-redeem 已知事实 |
|---|---|---|
| 产品形态 | 自助式 CDK 兑换页面 | 目标是 CDK 兑换网站 |
| 服务商 | ChatGPT、Claude | 未确认支持哪些服务商 |
| 兑换步骤 | CDK 校验 → 账号预检 → 提交 → 轮询 | README 只确认存在兑换，不含实现细节 |
| 订单查询 | 支持按 CDK 查询订单 | 未确认是否需要订单查询 |
| 账单查询 | 有独立 ChatGPT 账单能力 | 未确认是否属于项目范围 |
| 失败处理 | 业务错误、维护、支付确认中、重试状态 | 未确认错误模型和状态模型 |
| 幂等 | 使用 `request_nonce` 恢复锁定 | 未确认是否需要或采用相同机制 |
| 购买站关系 | 兑换站与购买/发卡站分离 | README 已确认关联 `mzmxms/ai-shop` |

## 七、可作为背景参考的产品能力主题

以下主题可以作为后续需求讨论的背景问题，但当前不能直接视为实现要求：

- CDK 校验与短期锁定；
- 账号资格预检；
- 多服务商识别和一致性校验；
- 异步兑换与结果轮询；
- 订单查询和售后查询；
- 刷新、重复提交和网络重试下的幂等恢复；
- 支付结果确认中的中间状态；
- 登录态、刷新 token 和缓存安全；
- 兑换站与购买/发卡站之间的职责分离。

这些主题需要结合用户目标、`ai-redeem` 后续代码和 `Dujiao-Next` 实际接口再确认。

## 八、无法确认的内容

- AutoSub 的真实后端实现、数据库结构和部署架构；
- AutoSub 的真实价格、成本、退款规则和履约数据；
- AutoSub 是否自建支付、账号处理和 CDK 生成系统；
- AutoSub 页面公开文案与实际服务质量是否一致；
- `ai-redeem` 最终支持的服务商、产品类型、登录态格式和订单模型；
- `ai-redeem` 与 `Dujiao-Next` 最终采用的接口、签名、状态和安全协议；
- 任何竞品公开文档之外的内部能力。

## 九、第二个竞品：plus.whh985.com

### 9.1 可直接确认的页面信息

访问地址：<https://plus.whh985.com/recharge>

页面标题为 `Recharge Portal · ChatGPT 充值站`。从页面前端公开资源可以确认，它是一个面向 ChatGPT 账号的 CDK 充值/升级门户，至少包含：

- ChatGPT Go、Plus、Pro、Team、Enterprise 等套餐识别或展示；
- 单笔充值和批量充值两种模式；
- “验证卡密 → 提交 Session → 完成”的三步流程；
- 输入 CDK 后自动识别套餐；
- 通过 ChatGPT Session JSON 识别账号并提交充值任务；
- 异步队列处理、任务号、预计完成时间和进度查询；
- 卡密任务状态查询与取消；
- 卡密刷新/换码相关入口。

页面文案还声称 Session 仅用于本次充值、任务完成后不会留存；这是产品公开声明，不等同于后端实现已被验证。

### 9.2 公开前端暴露的接口与状态

从页面公开 JavaScript 资源中可见以下接口路径：

| 接口 | 可推断职责 |
|---|---|
| `/api/v1/recharge/verify-cdk` | 验证 CDK、识别套餐并检查当前状态 |
| `/api/v1/recharge/check-subscription` | 检查目标 ChatGPT 账号当前订阅 |
| `/api/v1/recharge/create-task` | 创建充值任务 |
| `/api/v1/recharge/queue-status` | 查询队列/任务状态 |
| `/api/v1/recharge/queue-events` | 获取队列事件或实时状态 |
| `/api/v1/recharge/cancel-task` | 取消尚未开始处理的任务 |
| `/api/v1/recharge/refresh-cdk` | 处理卡密刷新或换码 |

这些是前端资源暴露的路径和文案推断，未通过实际提交请求验证参数、鉴权和后端行为。

### 9.3 与 AutoSub 的差异观察

| 维度 | AutoSub | plus.whh985.com/recharge |
|---|---|---|
| 主要输入 | CDK + 账号预检信息 | CDK + ChatGPT Session JSON |
| 账号识别 | 官方文档公开了账号预检与 Token 刷新 | 前端文案显示通过 Session JSON 识别账号 |
| 执行模式 | 异步兑换并轮询结果 | 异步充值队列并查询进度 |
| 批量能力 | 当前公开资料重点是单笔 API 流程 | 页面明确提供批量 CDK + Session 配对提交 |
| 任务取消 | 公开资料强调状态查询 | 页面暴露取消任务入口，并限制在未开始任务 |
| 产品对象 | ChatGPT、Claude | 前端资源主要展示 ChatGPT 套餐 |

### 9.4 对 ai-redeem 的背景参考价值

这个竞品提示后续分析时需要单独关注：

- CDK 校验和套餐识别是否应与实际充值任务分离；
- 账号凭证输入、短期使用、脱敏和日志隔离；
- 异步队列、任务号、进度查询和失败恢复；
- 单笔与批量兑换是否属于同一业务边界；
- 可取消任务、换码/刷新 CDK 和售后状态处理；
- 购买/发卡站与充值/兑换站之间如何划分职责。

这些仅作为竞品背景观察，不直接构成 `ai-redeem` 的实现要求。

## 十一、第三个竞品：jufai66.com

### 11.1 可直接确认的产品形态

访问地址：<https://jufai66.com/>

页面标题为 `会员自助充值`，页面品牌文案包含 `JUFGPT 安全兑换中心`。公开页面展示的是 ChatGPT 会员自助开通/充值流程，主要步骤为：

- 输入充值 CDK；
- 读取 ChatGPT 登录态；
- 展示充值结果。

页面支持或展示 ChatGPT Plus、Pro 等套餐，并明确提供：

- 单笔充值；
- 批量充值；
- 卡密查询；
- 使用教程；
- 充值记录；
- 卡密更换/销毁并生成新卡密。

### 11.2 公开页面暴露的流程特点

- CDK 格式提示包含 `PLUS`、`PRO5`、`PRO20`、`C250`、`C500` 前缀及 16 位字母数字；
- Session JSON 需要包含 `user`、`account` 和 `accessToken`；
- 页面会解析并展示充值邮箱、充值套餐；
- 批量模式将卡密与 Session 成对处理，后台按设定线程并发执行；
- 页面说明只有充值成功才消耗卡密，明确失败时释放卡密并允许更换 Session 重试；
- 卡密查询页面支持批量查询输入，但当前页面文案显示批量查询按钮可能暂未开放；
- 页面包含“卡密销毁更换”流程，最多输入 10 个卡密。

### 11.3 公开前端资源中的接口路径

从页面公开 HTML/JavaScript 中可以看到以下接口路径：

| 接口 | 可推断职责 |
|---|---|
| `/api/voucher/status` | 查询一个或多个卡密状态 |
| `/api/redeem/session_check` | 校验 Session 与卡密是否匹配 |
| `/api/redeem/submit` | 提交充值任务 |
| `/api/redeem/status` | 按 `rid` 查询充值结果 |
| `/api/redeem/intake_status` | 查询接收/处理状态 |
| `/api/redeem/retry` | 使用重试凭证重新执行任务 |
| `/api/redeem/recover` | 恢复未完成的任务 |
| `/api/redeem/input_prepare` / `/api/redeem/input_cancel` | 批量输入流程的准备与取消 |
| `/api/voucher/replace/auth` / `/api/voucher/replace/execute` | 卡密更换授权与执行 |

以上是公开前端代码暴露出的路径和页面语义推断，未提交真实卡密、Session 或订单请求，因此不确认其参数、鉴权和后端实际行为。

### 11.4 与前两个竞品的观察差异

| 维度 | AutoSub | plus.whh985.com | jufai66.com |
|---|---|---|---|
| 账号凭证 | API 文档描述压缩后的登录态 token | Session JSON | Session JSON |
| 批量能力 | 当前公开资料重点是单笔 API | 页面支持批量充值 | 页面支持批量并发充值 |
| 卡密状态 | 校验、锁定、订单查询 | 验证、队列、取消、刷新 | 查询、释放、重试、换码 |
| 结果处理 | 异步兑换 + 轮询 | 队列任务 + 进度查询 | 任务状态 + 重试/恢复 |
| 产品范围 | ChatGPT、Claude、Codex Credits 公开文档 | 前端主要展示 ChatGPT | 页面主要展示 ChatGPT Plus/Pro |

### 11.5 对 ai-redeem 的背景参考价值

该竞品补充了几个值得后续确认的业务问题：

- 卡密成功消耗、失败释放、重试和换码之间的状态机；
- 批量充值中卡密与账号 Session 的配对关系；
- Session 邮箱识别与套餐识别的前置校验；
- 任务恢复和重试凭证是否需要独立设计；
- 卡密查询、充值记录和售后换码是否属于兑换项目本身。

这些内容仍然只是竞品背景，不直接构成 `ai-redeem` 的实现要求。

## 十二、AutoSub API 文档当前可见性

之前找到的 AutoSub API 文档入口仍然是：<https://docs.autosub.site/>。本次直接访问时，文档根路径和此前记录的具体页面返回了 404/超时，暂时无法通过直接打开页面确认内容。

但搜索索引最近仍保留了这些页面的公开摘要，包括 6 个接口的 API Guide，以及 v1.1.0、v1.1.2、v1.1.3、v1.1.4 更新说明和 `redeemResult` 页面。因此之前记录的文档不是凭空推测，而是基于此前可见页面和当前搜索索引；不过当前应标注为“直接页面暂时不可访问，搜索索引仍可见”，不能把它当作当前在线可验证的稳定文档入口。

## 十三、结论

AutoSub 当前公开形态已经形成“卡密锁定、账号预检、异步兑换、结果轮询、订单查询”的完整兑换流程，并通过 `provider`、幂等 nonce、刷新 token 和中间状态处理扩展了多服务商与异常恢复能力。

对 `ai-redeem` 而言，目前最重要的背景事实仍然是：它尚未有已确认的实现，且需要与独立购买/发卡项目保持职责边界。AutoSub 的公开 API 适合作为竞品观察样本，不应直接复制为 `ai-redeem` 的架构或需求。
