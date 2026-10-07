# Web 全角色回归（7 角色入口与权限边界）

> 批次：`WEB-ALL-ROLE-REGRESSION-20261007`
> 类型：`REAL_ACCOUNT_MATRIX`
> 状态：7 角色登录、客户范围、财务读、风险读、组织报表边界 全部符合预期 PASS
> 日期：2026-10-07

## 1. 账号

| 角色 | 手机号 | 企业 |
| --- | --- | --- |
| Boss | 19900000001 | 1790000000000000001 |
| StoreManager | 19900000003 | 同 |
| TeamLeader | 19900000009 | 同 |
| Marketer | 19900000004 | 同 |
| Designer | 19900000005 | 同 |
| Pm | 19900000007 | 同 |
| Finance | 19900000002 | 同 |

## 2. 回归矩阵（真实账号 API）

| 角色 | 登录 | `customer/customer/page` | `finance/receivable/page` | `statistic/risk/report` | `statistic/organization/report` |
| --- | --- | --- | --- | --- | --- |
| Boss | OK | 可见（Company） | 可见 | 可见 | 可见 |
| StoreManager | OK | 可见（Store） | 可见（本店只读） | 可见（本店） | 403 |
| TeamLeader | OK | 可见（Team） | 403 | 403（`GAP-WEB-009`） | 403 |
| Marketer | OK | 可见（Self） | 403 | 403 | 403 |
| Designer | OK | 可见（Self/参与） | 403 | 403 | 403 |
| Pm | OK | 可见（参与） | 403 | 403 | 403 |
| Finance | OK | 可见（Company） | 可见 | 可见 | 403 |

结论：

- 客户列表对所有角色返回其数据范围（Company/Store/Team/Self/参与），未出现越权可见。
- 财务读严格等于 `FinanceAccessContext.requireReader`（Boss/Finance/StoreManager）。
- 风险读严格等于 `BusinessAlertContext.requireRole`（Boss/Finance/StoreManager）；TeamLeader 缺读侧即 `GAP-WEB-009`。
- 组织报表仅 Boss 可读。

## 3. 凭证处理

Finance 账号原口令非本回归统一口令，临时置为统一口令完成回归后**已还原原 hash**，临时口令返回 `AUTH_FAILED`。其余 6 个账号使用既有本地测试口令，未改动。

## 4. 本轮未覆盖

- 各角色浏览器三档分辨率的完整页面回归（历史批次已分别覆盖 Designer/Pm/Finance/StoreManager/TeamLeader/Marketer/Boss）。
- 金额/成本口径的逐页核对（由各角色批次 G3 覆盖）。
- `GAP-WEB-009/010/011/012`、`GAP-026` 裁决后的复验。
- 生产环境：未触及。
