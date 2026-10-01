# CB AI Redeem Guide

> 适用项目：`E:\program\ai-redeem`
>
> 生成日期：2026-10-01
>
> 依据：项目当前 `README.md` 与仓库现状

## 使用场景

当前任务涉及以下内容时读取本 Guide：

- `ai-redeem` 项目；
- CDK、卡密或兑换流程；
- 兑换网站与购买网站的职责边界；
- 为该项目补充实现、配置、运行或部署说明。

## 已确认项目事实

- `ai-redeem` 是 CDK 卡密兑换网站。
- 本项目负责接收用户输入的 CDK 卡密并完成兑换。
- 购买网站负责商品购买和卡密发放。
- 关联购买网站：`mzmxms/ai-shop`。
- 当前业务链路：购买商品 → 获取 CDK 卡密 → 在本网站兑换。

## 当前仓库状态

- 当前仓库只有 `README.md` 和 Git 元数据。
- 尚未发现业务代码、构建配置、运行入口或测试。
- 尚未确认技术栈、配置项和部署流程。
- 尚未发现 `AGENTS.md`、`PROJECT_MAP.md` 或 `.ai/`。

## 工作边界

- 不根据项目名称猜测技术栈或兑换实现。
- 不把购买网站的商品购买和卡密发放职责放入兑换网站。
- 涉及跨项目链路时，明确区分购买站和兑换站的事实来源。
- 缺少项目上下文文件时直接分析现有内容，不自动创建。
- 新增实现前，以用户当前需求确认兑换对象、兑换结果、接口边界和安全要求。

## 与 AI Shop 的职责边界

`ai-redeem` 只负责兑换侧：

- 接收用户输入的 ChatGPT CDK；
- 校验 CDK、套餐和兑换资格；
- 接收并校验 ChatGPT Session JSON；
- 创建、执行和查询 ChatGPT 兑换任务；
- 处理兑换中的失败、重试、释放和售后状态。

`ai-redeem` 不负责商品展示、购物车、支付、优惠券、商城订单、库存或 CDK 商品发放。

`ai-shop` 负责购买侧：商品、价格、下单、支付、商城订单、库存以及 CDK 生成/发放。两个项目的业务链路是：

```text
ai-shop 购买商品 → 发放 CDK → ai-redeem 输入 CDK + Session JSON → 完成 ChatGPT 兑换
```

跨项目只传递完成业务所需的最小引用信息，例如 CDK 和可选的 `source_order_id`；不得在购买站与兑换站之间复制 Session JSON、Access Token 或其他登录凭证。

## 按需检查

后续仓库出现实际实现后，根据任务需要检查：

- 应用入口和本地运行方式；
- CDK 输入、校验、兑换和结果展示链路；
- 兑换接口、状态和错误处理；
- 与购买网站的数据或接口边界；
- 配置、敏感信息处理、测试和部署方式。

## 已记录竞品

- AutoSub：<https://autosub.site/>
- 官方 API 文档：<https://docs.autosub.site/>
- 第二个竞品：<https://plus.whh985.com/recharge>
- 第三个竞品：<https://jufai66.com/>
- 详细竞品与背景分析：`knowledge/traces/cb-ai-redeem-competitor-and-background-analysis.md`

本文只保存长期可复用的项目入口信息，不记录临时任务状态或未经实现验证的设计。
