# Web Batch 5 TeamLeader G1 动作冻结

> **⛔ 锁定：本文档对应的角色 Web 页面锁定不做（用户裁决 2026-10-11）。**
> TeamLeader 的 Web 页面为**冻结基线**（只允许缺陷修复），**不再排期、不再新增/改造页面**。
> 本文档保留为**当时的过程记录与业务事实**（动作冻结结论、App 依据、角色定位），**不再作为 Web 建设依据**；App 侧能力与业务规则仍然有效。
> 现行范围见 `AGENTS.md`「角色 Web 建设范围（强制）」与 `WEB-ALL-ROLE-BUILD-BOARD.md`。


> 批次：`WEB-BATCH5-TEAMLEADER-20261007`
> 状态：`G1_ACTION_FROZEN`
> 上游：`DEC-016`、`DEC-032`、`DEC-033`、`DEC-034`、`DEC-035`、`BR-028`、`BR-029`、`BR-030`、`GAP-026`、`SCN-001`、`SCN-016`、`T12-BIZ-20261007-006`
> 事实源：`zhuangdeqing-business`（装得清业务智能体）
> 本文件不新增角色、状态、动作、金额、成本或利润口径。

## 1. 角色定位

团队负责人是**本团队范围的负责人能力子集**：

- 数据范围固定为 `Team`（本团队），跨团队一律阻断。
- 具备本团队客户跟进协同、设计师指派（限本团队）与本人负责风险的处置能力。
- **不自动获得财务与利润能力**（BR-028 / 角色矩阵）；成本、利润、毛利率、应付、付款、现金流、工资、提成、公司经营利润一律不可见（`GAP-026` 当前可研发口径）。
- 受限字段未授权时**不生成区块**，不得显示 0，也不得通过筛选、深链接或选择器扩大范围。
- 不拥有客户负责人变更、项目成员切换、任务/阶段推进、施工计划编排等能力。

## 2. 已冻结写动作

| 动作 | 角色 | Provider | 范围约束 |
| --- | --- | --- | --- |
| 指派/改派客户设计师 | TeamLeader / Boss / StoreManager | `customer/customer/handoff` | 团队负责人只能指派**本团队**在职设计师或 BOSS 本人；客户必须已跟进且有房屋 |
| 风险处置（认领/处置记录/关闭/重开/指派） | TeamLeader（本人负责的风险） | `risk/item/claim|record|close|reopen|assign` | `RiskDispositionContext.requireDisposer`：非 Boss/Finance/StoreManager 仅可处置**本人负责**的风险 |

共同边界：

- 数据范围由服务端按登录员工裁决，前端不得传 `teamId/empId` 作为授权依据。
- 写动作必须幂等、留审计、按 `reloadScopes` 回读。
- TeamLeader 不具备 `customer/owner-change`（仅 Boss/StoreManager）。

## 3. 只读能力（生成区块，不生成写入口）

依据 `statistic/team-leader/report`（TeamLeader-only、企业+团队严格限定）与 `GAP-026` 当前可研发口径：

| 面 | 可见 | 不可见 |
| --- | --- | --- |
| 团队概览 | 成员数、业务员/设计师/项目经理数 | 其他团队成员明细 |
| 客户 | 本团队客户、跟进到期/逾期、未指派设计师计数 | 跨团队客户 |
| 报价 | 本团队报价数量、待决策、已接受、报价金额、签约额 | 报价成本明细（受限，见下） |
| 项目 | 本团队项目数量、各状态计数、任务待办/逾期 | 跨团队项目 |
| 合同/回款（GAP-026 已授权部分） | 合同金额、签约额、应收/已收/待收/逾期**状态**（待后端补齐 TeamLeader 读侧） | 应付、付款、现金流 |
| 风险 | 本团队/本人负责的风险（读侧待 `GAP-WEB-009` 裁决） | 跨团队风险 |

**受限字段（不生成区块）**：实际成本、预计成本、利润、毛利率、工资、提成、公司经营利润、应付、付款、现金流（`GAP-026`）。

## 4. 明确拒绝（负向矩阵）

- 财务写动作：`finance/receivable|receipt|payable|payment/save`、`finance/ledger/save|update|delete|correct`、`document/voucher/build` 全部拒绝。
- 客户负责人变更 `customer/owner-change`：仅 Boss/StoreManager，TeamLeader 拒绝。
- 主材选材写入：`DEC-035` 已收回 `Pm/TeamLeader`，只读。
- 项目成员切换、任务/阶段推进、施工计划编排：仅 Boss/StoreManager/Pm（或本项目设计师），TeamLeader 拒绝。
- 跨团队、跨企业、非本团队成员：拒绝。
- 成本/利润/现金流/工资/提成投影：不生成，跨团队不可见。

## 5. 页面批次范围

本批审计/建设团队负责人可见面：

- 团队工作台（今日主线 `today.mainline` + 本团队经营概览）
- 本团队客户（协同、指派本团队设计师）
- 本团队报价/项目只读
- 风险队列（`boss.risk`，待 `GAP-WEB-009` 裁决后开放读侧）
- 全局搜索

不做：TeamLeader 专属财务页、成本/利润区块、跨团队视图、项目写动作。

## 6. 验收门槛

- 正向：本团队设计师指派、本人负责风险处置、本团队经营概览只读。
- 反向：跨团队指派/读取拒绝；客户负责人变更拒绝；财务写拒绝；主材选材写拒绝；项目任务/阶段写拒绝。
- 越权：跨企业、非本团队成员。
- 金额：成本/利润/现金流区块不生成（不是 0）；GAP-026 已授权只读字段与后端一致。
- 页面：真实团队负责人账号、三档分辨率、只读态无写入口。

## 7. 当前不开放

- `GAP-026` 未关闭：TeamLeader 合同金额/签约额明细、应收明细、成本/利润可见性待业务裁决，本批只实现已授权只读字段。
- `GAP-WEB-009` 未关闭：风险队列 TeamLeader 读侧缺失，读侧范围待 `REQ-BIZ-20261007-017` 裁决。
- 团队经营看板的跨类排序与导出限制未裁决，不进入本批。
- 后端 `statistic/team-leader/report` 的 `recentQuotes/recentProjects` 白名单含 `cost`，与 `GAP-026` 受限字段冲突，需在实现前收敛。

## 8. 冻结证据（2026-10-07，本地真实账号）

团队负责人：`19900000009`（测试团队负责人，emp `1790000000000000199`，team `1790000000000000999`）。

```text
statistic/team-leader/report
  teamName=全角色审计测试团队  memberCount=1  customerCount=1
  quoteCount=1  quoteAmount=300000.00  signedAmount=300000.00  projectCount=1
  -> 团队范围只读通过

customer/customer/update (owner-change)  -> 404 客户不存在或无权访问（非本团队/无权限）
finance/receivable/page                  -> 403 当前账号无权执行该操作
```

**发现（后端与 GAP-026 冲突）**：`statistic/team-leader/report` 的 `recentQuotes[*].cost`、`recentProjects[*].cost` 实际返回给团队负责人，属 `GAP-026` 受限字段（实际/预计成本）。实现前必须在后端白名单收敛，前端不得渲染该字段。

**环境提示**：本地 8090 运行实例为主仓库构建，**未包含** `DEC-035`（收回 `Pm/TeamLeader` 选材写入）修复；对团队负责人的选材写入探测被该实例接受。Web 侧已按 `DEC-035` 只读登记，后端新版本上线后需复验负向拒绝。
