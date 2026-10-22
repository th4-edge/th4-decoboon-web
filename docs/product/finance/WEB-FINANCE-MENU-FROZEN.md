# Web 财务角色菜单信息架构 · 冻结稿

> 状态：`MENU_FROZEN（2026-10-11）`
> 上游：`WEB-FINANCE-PAGE-INVENTORY.md`、`WEB-FINANCE-ROLE-NATURE-AND-MINDSET.md`、`FINANCE-G1-迭代包.md`
> 决策依据：`DEC-034 / BR-030`（一级 ≤7 组、场景语言、禁模块 CRUD 命名）、`WEB-角色页面开发作业规范.md` §3 S1、EXP-013（入口可执行性三查）
> 范围：Finance 角色侧栏菜单与可直达页面。**不改业务对象、状态机、权限与金额口径。**

---

## 一、现状菜单（2026-10-11 实测）

```text
今日
  业务工作台                    → /workbench                  ← 到不了 /finance/workbench
商务财务
  待我收款                      → /finance/receivables
  待我付款                      → /finance/payables
  资金台账与凭证                → /finance/ledger             ← 标签承诺「凭证」，入口到不了凭证页
项目工地
  主材选材                      → /workbench/material-selection    ← 财务视角的采购协同（保留待议）
  客户意见投诉                  → /workbench/customer-feedback     ← 财务角色为何在此？语义待议
  整改跟进                      → /workbench/rectification         ← 同上
```

**问题诊断**

| # | 问题 | 严重度 |
| --- | --- | --- |
| P1 | **收付凭证、凭证模板无任何入口**（财务最核心的归档能力不可发现） | 高 |
| P1 | 「资金台账与凭证」标签与入口不一致 | 中 |
| P2 | 「业务工作台」指向共享 `/workbench`，到不了财务自己的首页 | 中 |
| P2 | 一级分组「项目工地」下挂 3 项非财务主链入口（选材/意见投诉/整改），与财务的**专业列表**形态不匹配 | 中 |
| P2 | 12/16 条财务路由无菜单入口（收款记录、付款记录、退款、工人工资、员工工资、提成、提成调整、供应商往来、项目账本、项目核算、凭证、凭证模板） | 高（可发现性） |

---

## 二、财务菜单的设计原则（区别于 Designer/Pm）

1. **按「钱的两条腿 + 归档」组织，不按对象域组织**：收（应收→收款→台账）与付（应付→付款→台账）是两条腿，凭证与结算是归档与收口。
2. **批量与对账入口要显性**：财务 Web 的价值是批量核销、批量出证、多列对账——入口必须能到达这些操作面。
3. **「待我X」为主，专业列表为辅**：与 Designer/Pm 一致用场景语言，但财务的「待我X」是**待收/待付/待核销/待出证**，而非「待我量房」式对象队列。
4. **不做会计语义**：不出现「记账凭证/科目/借贷/报表」（公理 7）。

---

## 三、冻结菜单（本期）

```text
今日
  业务工作台                    → /finance/workbench        （财务自己的首页，修正现指向）

客户
  客户                          → /workbench/customers       （2026-10-22 DEC-080：客户经营权限与BOSS/店长对齐）

资金收付
  待我收款                      → /finance/receivables
  收款记录                      → /finance/receipts
  待我付款                      → /finance/payables
  付款记录                      → /finance/payments
  工人工资                      → /finance/salaries

往来与账本
  供应商往来                    → /finance/partners
  资金台账                      → /finance/ledger
  客户退款                      → /finance/refunds

凭证与归档
  收付凭证                      → /finance/vouchers          （新增入口）
  凭证模板                      → /finance/voucher-templates （新增入口）

薪酬（L2）
  员工工资                      → /finance/employee-salaries
  员工提成                      → /finance/employee-commissions
  提成负向调整                  → /finance/commission-adjustments

项目核算
  项目账本                      → /finance/projects
```

**项数核算**：1（今日）+ 5（资金收付）+ 3（往来与账本）+ 2（凭证与归档）+ 3（薪酬）+ 1（项目核算）= **15 项 / 6 个一级分组**，满足 `DEC-034`「一级 ≤7 组」。

**项目核算下钻**：`/finance/projects/:projectId` 不经菜单，由「项目账本」下钻进入（符合对象工作面惯例）。

### 裁决记录

| # | 事项 | 裁决 | 依据 |
| --- | --- | --- | --- |
| D1 | 「业务工作台」指向 | 由 `/workbench` 改为 **`/finance/workbench`** | 入口可执行性三查 ①：角色首页应落在本角色页面 |
| D2 | 「资金台账与凭证」 | **拆为「资金台账」**（`/finance/ledger`）+ 新增「收付凭证」（`/finance/vouchers`） | 三查 ②：标签与入口必须一致 |
| D3 | 收付凭证 / 凭证模板 | **补入口**。两页 `meta.roles` 已含 Finance（可达），仅缺入口，属结构缺陷而非权限问题 | 三查 ③ + `2026-10-07 凭证模板 P0` §7 权限（BOSS/店长/财务可编辑） |
| D4 | 一级分组 | 采用「今日 / 资金收付 / 往来与账本 / 凭证与归档 / 薪酬 / 项目核算」，按**钱的两条腿 + 归档**组织 | 本文件 §2 原则 1 |
| D5 | 原「项目工地」三项（选材/意见投诉/整改） | **本期从财务菜单移除**；选材若确为财务采购协同场景，另立「采购协同」组并需业务裁决，不在本期擅自挂回 | EXP-013 ③：职责不清的不挂入口 |
| D6 | 员工工资/提成/提成调整 | 归入独立一级组「薪酬（L2）」，与 `DEC-016` L2 边界一致 | `DEC-016` L2、`BR-015` |
| D7 | 菜单项数下限 | 不设上限（现 15 项），但**每项必须有真实承载页且本角色可达**；不新增死链 | S1 准出 |

---

## 四、命名对照（旧 → 新）

| 旧 | 新 | 依据 |
| --- | --- | --- |
| 业务工作台 → `/workbench` | 业务工作台 → `/finance/workbench` | 角色首页归位 |
| 资金台账与凭证 → `/finance/ledger` | 资金台账 → `/finance/ledger`；收付凭证 → `/finance/vouchers` | 标签-入口一致 |
| （无） | 凭证与归档（一级组） | 承载凭证与模板 |
| （无） | 收款记录 / 付款记录 / 供应商往来 / 客户退款 / 工人工资 / 项目账本 / 员工工资 / 员工提成 / 提成负向调整 | 让已有页面可发现 |
| 项目工地（一级组，含选材/意见投诉/整改） | 移除（选材待业务裁决后另立组） | 语义归位 |

---

## 五、菜单与页面内工作区的分工

| 菜单项 | 菜单页职责 | 页面内/承接层职责 |
| --- | --- | --- |
| 待我收款 | 应收队列（按逾期/到期排序） | 应收节点维护抽屉、**登记收款并核销**抽屉 |
| 待我付款 | 应付队列（按供应商/到期排序） | 应付维护抽屉、**登记付款并核销**抽屉 |
| 资金台账 | 流水列表 + 多选 + 汇总 | **批量生成凭证**、手工记账、更正/作废/冲正 |
| 收付凭证 | 凭证列表（类型/状态筛选） | 凭证预览、打印/重打（只读）、归档 |
| 凭证模板 | 平台基础模板 + 我的模板 | 复制、编辑（版式设计器）、发布、停用、版本历史 |

---

## 六、实施状态

| 菜单项 | 路由 | 承载页面 | 状态 |
| --- | --- | --- | --- |
| 业务工作台 | `/finance/workbench` | `FinanceWorkbenchView` | 已建（入口本次修正） |
| 待我收款 | `/finance/receivables` | `FinanceReceivablesView` | 已建 |
| 收款记录 | `/finance/receipts` | `FinanceReceiptsView` | 已建（本次补入口） |
| 待我付款 | `/finance/payables` | `FinancePayablesView` | 已建 |
| 付款记录 | `/finance/payments` | `FinancePaymentsView` | 已建（本次补入口） |
| 工人工资 | `/finance/salaries` | `FinancePayablesView`（`salaryMode`） | 已建（本次补入口） |
| 供应商往来 | `/finance/partners` | `FinancePartnersView` | 已建（本次补入口） |
| 资金台账 | `/finance/ledger` | `FinanceLedgerView` | 已建 |
| 客户退款 | `/finance/refunds` | `FinanceRefundsView` | 已建（本次补入口） |
| 收付凭证 | `/finance/vouchers` | `FinanceVouchersView` | 已建（本次补入口；出凭证动作待 `DEF-WEB-005`） |
| 凭证模板 | `/finance/voucher-templates` | `FinanceVoucherTemplatesView` | 已建（本次补入口） |
| 员工工资 | `/finance/employee-salaries` | `FinanceEmployeeSalariesView` | 已建（本次补入口） |
| 员工提成 | `/finance/employee-commissions` | `FinanceEmployeeCommissionsView` | 已建（本次补入口） |
| 提成负向调整 | `/finance/commission-adjustments` | `FinanceCommissionAdjustmentsView` | 已建（本次补入口） |
| 项目账本 | `/finance/projects` | `FinanceProjectsView` | 已建（本次补入口） |

---

## 七、本次不做

1. 不改任何 `meta.roles` 与权限矩阵（凭证/模板页已对 Finance 可达，无需改权限）。
2. 不新增业务对象、状态、动作与金额口径；不实现「出凭证」动作（`DEF-WEB-005` 未裁决）。
3. 不重排页面内部结构（专业列表形态改造属后续批次）。
4. 不把「选材/意见投诉/整改」擅自挂回财务菜单（业务语义待裁决，见 D5）。
