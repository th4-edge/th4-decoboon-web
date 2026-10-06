# 装得清 Web Provider 与 App 调用点映射

> 批次：`WEB-ALL-ROLE-B0-20261007`
> 规则：Web 不新增专属业务 API；每个 Provider 必须能映射到 App 调用点。

## 1. 映射字段

| 字段 | 说明 |
| --- | --- |
| Provider | 完整路由 |
| Web 页面 | 消费页面或工作区 |
| App 调用点 | App 页面、模块或 api 文件 |
| 业务对象 | 主对象与关联对象 |
| 角色 | 允许角色 |
| 数据范围 | Company / Store / Team / Self / ProjectParticipant |
| 金额影响 | 是否碰钱 |
| 状态动作 | 读取或写入 |
| 结论 | `APPROVED` / `BLOCKED_PROVIDER` / `PENDING_REVIEW` |

## 2. 已知映射

| Provider | Web 页面/域 | App 调用点 | 结论 |
| --- | --- | --- | --- |
| `customer/customer/page` | Marketer/Designer 客户 | 待逐项审计 | `PENDING_REVIEW` |
| `customer/customer-follow/page` | Marketer 跟进 | 待逐项审计 | `PENDING_REVIEW` |
| `customer/customer-follow/save` | Marketer 跟进 | 待逐项审计 | `PENDING_REVIEW` |
| `design/*` | Designer 设计 | 已有 Designer G1 证据 | `PENDING_REVIEW` |
| `quote/*` | Designer 报价 | 已有 Designer G1 证据 | `PENDING_REVIEW` |
| `project/project/page` | Pm/Designer/Finance | 待逐项审计 | `PENDING_REVIEW` |
| `project/project/info` | Pm/Finance | 待逐项审计 | `PENDING_REVIEW` |
| `finance/*` | Finance | 已有财务 G1 证据 | `PENDING_REVIEW` |
| `document/voucher/*` | Finance 凭证 | 已有凭证设计与 G1 证据 | `PENDING_REVIEW` |

## 3. 处理纪律

- 未找到 App 调用点时，保持 `BLOCKED_PROVIDER`，不得进入 G1 冻结。
- Provider 只在 Web 出现时，先回到 App 与后端决策，不在 Web 私开。
- Provider 返回字段不足时，由后端在 App 兼容语义下补齐，不由 Web 本地拼业务口径。
- 每个批次交付前，更新对应 Provider 行为 `APPROVED` 或 `BLOCKED_PROVIDER`。
