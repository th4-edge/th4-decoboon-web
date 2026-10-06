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
| `customer/customer/page` | Marketer/Designer 客户 | `src/pages/customer/list.vue`, `src/domains/crm/api.ts` | `APPROVED` |
| `customer/customer-follow/page` | Marketer 跟进 | `src/pages/customer/list.vue`, `src/subpages/customer/detail.vue` | `APPROVED` |
| `customer/customer-follow/save` | Marketer 跟进 | `src/subpackages/customer/pages/follow.vue` | `APPROVED` |
| `design/*` | Designer 设计 | `src/subpackages/design/pages/workbench.vue`, 已有 Designer G1 证据 | `APPROVED` |
| `quote/*` | Designer 报价 | `src/subpackages/quote/pages/workbench.vue`, 已有 Designer G1 证据 | `APPROVED` |
| `project/project/page` | Pm/Designer/Finance | `src/pages/project/list.vue`, `src/domains/project/api.ts` | `APPROVED` |
| `project/project/info` | Pm/Finance | `src/subpackages/project/pages/detail.vue`, `src/domains/project/api.ts` | `APPROVED` |
| `finance/*` | Finance | `src/pages/finance/index.vue`, `src/subpackages/finance/pages/*.vue`, 已有财务 G1 证据 | `APPROVED` |
| `document/voucher/*` | Finance 凭证 | `src/subpackages/finance/pages/vouchers.vue`, 已有凭证设计与 G1 证据 | `APPROVED` |

## 3. 处理纪律

- 未找到 App 调用点时，保持 `BLOCKED_PROVIDER`，不得进入 G1 冻结。
- Provider 只在 Web 出现时，先回到 App 与后端决策，不在 Web 私开。
- Provider 返回字段不足时，由后端在 App 兼容语义下补齐，不由 Web 本地拼业务口径。
- 每个批次交付前，更新对应 Provider 行为 `APPROVED` 或 `BLOCKED_PROVIDER`。
