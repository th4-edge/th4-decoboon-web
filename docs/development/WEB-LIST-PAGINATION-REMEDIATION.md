# Web 列表分页与汇总数据整改台账

> 依据：`docs/standards/WEB-列表分页与汇总数据规范.md`
> 目标：记录现有页面的分页、服务端筛选、后端汇总和无 N+1 整改状态。

---

## 第一批：资金收付记录页（已完成）

| 页面 | 列表分页 | 服务端筛选 | 汇总接口 | 查询方式 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `/finance/receipts` 收款记录 | 是，服务端 `current/size` | 项目、关键词、门店 | `finance/receipt/report` | 聚合 SQL；列表批量预取关联 | `FinanceStoreScopeHttpAcceptanceTest#receiptAndPaymentListsAndReportsUseTheSameServerScopeAndFilters` |
| `/finance/payments` 付款记录 | 是，服务端 `current/size` | 项目、关键词、门店 | `finance/payment/report` | 聚合 SQL；列表批量预取关联 | 同上；`#transactionReportsUseAggregateQueriesWithoutRowByRowQueries` |

整改结果：

- 移除收款、付款页面通过当前页 `items.reduce` 计算金额的做法；
- 搜索不再只过滤当前页，关键词、项目、门店由服务端同时作用于列表与汇总；
- 汇总卡片固定调用后端 `report`，与列表使用同一权限和筛选范围；
- 汇总接口使用一次聚合查询，测试覆盖两个汇总接口的固定 SQL 条数；
- 列表分页使用稳定次级排序（收款：到账日期 + `receiptId`；付款：付款日期 + `paymentId`）。

---

## 第二批：应收、应付/工人工资、资金台账（已完成）

| 页面 | 列表分页 | 服务端筛选 | 汇总接口 | 查询方式 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `/finance/receivables` 应收计划 | 是，服务端 `current/size` | 项目、类型、状态、关键词、门店 | `finance/receivable/report` | 聚合 SQL；列表批量预取关联 | `FinanceStoreScopeHttpAcceptanceTest#receivablePayableAndLedgerPagesAndReportsUseTheSameServerScopeAndFilters` |
| `/finance/payables`、`/finance/salaries` 应付/工人工资 | 是，服务端 `current/size` | 项目、供应商、类型、状态、紧急、关键词、门店 | `finance/payable/report` | 聚合 SQL；列表批量预取关联 | 同上 |
| `/finance/ledger` 资金台账 | 是，服务端 `current/size` | 项目、方向、分类、日期、关键词、已选流水、门店 | `finance/ledger/report` | 聚合 SQL；列表批量预取关联 | 同上；`#transactionReportsUseAggregateQueriesWithoutRowByRowQueries` |

整改结果：

- 应收、应付、资金台账列表改为服务端 Criteria 分页，不再全量加载后内存筛选；
- 汇总接口使用聚合 SQL，覆盖当前筛选范围内的金额、笔数和风险金额；
- 应收页新增独立 `finance/receivable/report`，不再借用企业级 summary/project report；
- 资金台账“已选记录/已选金额”改由后端按 `ledgerIds` 汇总；
- 列表翻页只刷新列表，统计卡片不随页码变化；
- 汇总失败独立显示“暂不可确认”，不使用 0 兜底。

---

## 第三批：客户退款、员工工资、员工提成（已完成）

| 页面 | 列表分页 | 服务端筛选 | 汇总接口 | 查询方式 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `/finance/refunds` 客户退款 | 是，服务端 `current/size` | 项目、门店 | `finance/refund/report` | 聚合 SQL；列表批量预取关联 | `FinanceStoreScopeHttpAcceptanceTest#refundPayrollAndCommissionPagesUseServerPagingAndReports` |
| `/finance/employee-salaries` 员工工资单 | 是，服务端 `current/size` | 门店 | 页面无金额汇总卡片 | 服务端分页；工资项按单张工资单有界读取 | 同上 |
| `/finance/employee-commissions` 员工提成 | 是，服务端 `current/size` | 门店 | `payroll/commission/report` | 聚合 SQL；列表批量预取关联 | 同上；`#transactionReportsUseAggregateQueriesWithoutRowByRowQueries` |

整改结果：

- 客户退款移除当前页前端求和，增加后端退款汇总和分页控件；
- 员工工资单从固定 `size: 100` 改为服务端分页，切换工资单页时清空旧详情，避免跨页误操作；
- 员工提成移除当前页前端求和，改为后端汇总卡片和服务端分页；
- 退款、提成汇总均使用固定条数聚合查询，纳入无 N+1 查询条数测试。

---

## 第四批：供应商往来（已完成）

| 页面 | 列表分页 | 服务端筛选 | 汇总接口 | 查询方式 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `/finance/partners` 供应商往来 | 是，服务端 `current/size` | 供应商关键词、仅看逾期、门店 | `finance/partner-ledger/report` | 分组聚合 SQL；分页供应商批量回填合作方 | `FinanceStoreScopeHttpAcceptanceTest#partnerLedgerUsesServerPagingFilteringAndAggregateSummary` |

整改结果：

- 新增 `finance/partner-ledger/page`，不再把全部供应商返回前端后筛选；
- 关键词和“仅看逾期”由服务端执行，并同时作用于列表与汇总；
- 应付、已付、待付、逾期、未结清数和最近到期日通过分组聚合查询；
- Web 汇总调用增加 `summaryOnly`，避免同时加载供应商明细行；App 原有 `rows` 契约保留。

---

## 第五批：项目账本（已完成）

| 页面 | 列表分页 | 服务端筛选 | 汇总接口 | 查询方式 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `/finance/projects` 项目账本 | 是，服务端 `current/size` | 项目关键词、全部/资金成本风险/待结算、门店 | `finance/project-ledger/report` | 项目及应收/应付/流水/收付款/结算批量取数；成本批量汇总 | `FinanceStoreScopeHttpAcceptanceTest#projectLedgerUsesServerPagingFiltersAndAggregateSummary`；`#transactionReportsUseAggregateQueriesWithoutRowByRowQueries` |

整改结果：

- 项目账本从全量项目逐项目查询改为项目集合批量读取；
- 风险筛选、待结算筛选、关键词和门店条件全部由服务端执行；
- 增加服务端分页控件；
- 项目汇总卡片改为独立 `finance/project-ledger/report`，与列表使用同一筛选条件；
- 项目成本继续统一使用 `ProjectCostContext`，成本不完整时利润保持 `null`；
- SQL 查询条数测试覆盖项目账本批量汇总，不随项目数逐项查库。

---

## 后续整改优先级

| 状态 | 说明 |
| --- | --- |
| 本轮整改完成 | 资金收付、工资提成、退款、供应商往来、项目账本已纳入规范 |

剩余存量项：

- 员工工资项明细当前按单张工资单有界读取；若后续员工规模超过单张工资单合理上限，再补工资项分页及确认阻断汇总接口。

> 本台账只记录技术整改状态，不新增或修改任何业务金额口径。
