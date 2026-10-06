# TeamLeader 团队概览与本团队指派 G3

> 批次：`WEB-BATCH5-TEAMLEADER-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：团队经营概览只读、本团队客户、指派本团队设计师（真实 UI 写入并回滚）PASS
> 日期：2026-10-07
> 上游：`GAP-026`、`DEC-016`、`DEC-034`、`BR-028`、`BR-030`

## 1. 范围

- 团队负责人：`19900000009`（测试团队负责人，emp `1790000000000000199`，team `1790000000000000999`）。
- 新增页面：`/workbench/team-overview`（`TeamOverviewView.vue`）、`/workbench/team-customers`（`TeamCustomerView.vue`），角色 `Boss / TeamLeader`。
- Provider：`statistic/team-leader/report`、`customer/customer/page`、`customer/customer/handoff`、`user/employee/page`。

## 2. 团队经营概览（只读）

页面渲染 `全角色审计测试团队`，KPI：团队成员、本团队客户、跟进逾期、报价数量、本团队项目、任务待办；金额事实仅「报价金额 / 已接受报价金额 / 签约额」。

`GAP-026` 受限字段处理：

- API 映射层显式**剔除** `recentQuotes[*].cost`、`recentProjects[*].cost`，受限字段不进入前端模型。
- 页面不生成成本、利润、毛利率、应付、付款、现金流、工资、提成区块。
- 页面文案明确「成本、利润、应付、付款、现金流、工资与提成区块不生成」。

## 3. 本团队客户与指派（真实 UI 写入并回滚）

页面 `/workbench/team-customers` 展示本团队客户 `昭青内容演示客户`（施工中）。

指派测试（团队临时加入设计师以覆盖真实路径，全部回滚）：

```text
前置：team 1790000000000000999 仅有 TeamLeader（无团队设计师）
临时：董夏鹏(0105) team_id -> 1790000000000000999（测试后还原 NULL）
UI：本团队客户 -> 指派设计师 -> 选择 activeProperty(昭青云著8栋1802) -> 选择「董夏鹏 · 设计师」-> 确认
结果：cust_customer.designer_id 0106 -> 0105
回滚：designer_id -> 0106，handed_off_at -> NULL，董夏鹏 team_id -> NULL
```

空团队时下拉不含跨团队设计师，并提示「本团队暂无在职设计师，无法指派；跨团队设计师不可选」。

## 4. 负向

```text
/workbench/risk            -> /forbidden 无权访问（GAP-WEB-009：TeamLeader 风险读侧缺失）
finance/receivable/page    -> 403 当前账号无权执行该操作
customer/customer/update   -> 404 客户不存在或无权访问（负责人变更不属 TeamLeader）
customer/customer/handoff  -> 仅可选本团队设计师（跨团队不可选）
```

## 5. 清理

```text
客户 designer_id、handed_off_at 还原；董夏鹏 team_id 还原 NULL；团队恢复 1 名成员
未重置凭证（使用既有本地测试账号）
```

## 6. 未覆盖

- 风险队列读侧：`GAP-WEB-009` 待 `REQ-BIZ-20261007-017` 裁决。
- 成本字段越界：`GAP-WEB-011` 后端 `statistic/team-leader/report` 仍返回 cost，前端已剔除，待后端收敛。
- `GAP-026` 合同金额/应收明细可见性未裁决，本批只实现已授权聚合字段。
- 生产环境：未触及。
