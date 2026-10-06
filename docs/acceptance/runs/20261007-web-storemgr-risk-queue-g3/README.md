# StoreManager 风险队列 G3

> 批次：`WEB-BATCH4-STOREMANAGER-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：店长风险队列读取、认领、处置、时间线 PASS
> 日期：2026-10-07
> 上游：`SCN-016`、`BR-029`、`BR-030`、`ANS-BIZ-20261007-023`

## 1. 范围

- 店长账号：`19900000003`（王洪文，emp `1790000000000000103`，store `1790000000000000002`）。
- 后端：`http://127.0.0.1:8090`；前端：`http://127.0.0.1:8080`。
- 页面：`/workbench/risk`（`RiskQueueView.vue`）。
- Provider：`statistic/risk/report`、`risk/item/claim`、`risk/item/assign`、`risk/item/record`、`risk/item/close`、`risk/item/reopen`、`risk/item/log/page`。

## 2. 读取（店长本店范围）

`POST /api/statistic/risk/report`：

```text
totalCount: 37
highCount: 1
items: 37（含严重1、警告多、关注多）
```

店长为 `BusinessAlertContext.requireRole(Boss, Finance, StoreManager)` 允许角色，`visibleProjects` 将结果限制在本门店。实例首条：

```text
ProjectContract-...-AbnormalChangeRate 严重 合同变更率异常 riskId 233363365819318281 Pending
```

## 3. 处置（真实写入）

对风险 `233363365819318281`：

```text
认领 risk/item/claim  -> owner=王洪文（店长），status=Handling
处置 risk/item/record -> status=Handling
```

时间线 `risk/item/log/page`：

```text
认领   王洪文 待响应 -> 处理中 店长认领
处置记录 王洪文 处理中 -> 处理中 已联系客户催收，约定本周回款
```

## 4. 页面

真实店长浏览器打开 `/workbench/risk`：风险队列页渲染，含风险总数/高/中/低 KPI、风险类型分布、清单与「时间线 / 认领 / 指派 / 处置 / 关闭（或重开）」动作。

## 5. 清理

```text
db_risk_item:            37 -> 0
db_risk_disposition_log:  2 -> 0
db_risk_log_evidence:     0
店长口令：已还原，临时口令返回 AUTH_FAILED
```

风险处置单由 `statistic/risk/report` 按实时预警同步生成，测试后删除即回到测试前状态；下次读取会按业务规则重新同步。

## 6. 未覆盖

- 指派/关闭/重开在页面上的真实点击：后端 Provider 已存在并由 `RiskDispositionContext.requireDisposer` 按门店范围校验；本轮实测认领与处置记录。
- TeamLeader 风险队列：`boss.risk` 注册表登记 TeamLeader 可读，但 `statistic/risk/report`/`BusinessAlertContext` 仅允许 Boss/Finance/StoreManager，记 `GAP-WEB-009`。
- 店长本店转交/指派 UI（`customer/owner-change`、`customer/customer/handoff`）：后端已支持店长，前端客户工作面待接。
- 生产环境：未触及。
