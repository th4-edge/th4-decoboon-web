# Web 店长（StoreManager）菜单信息架构 · 冻结稿

> 状态：`MENU_FROZEN（2026-10-11）`
> 上游：`WEB-STOREMANAGER-ROLE-NATURE-AND-MINDSET.md`、`WEB-STOREMANAGER-PAGE-INVENTORY.md`
> 决策依据：`DEC-034 / BR-030`（一级 ≤7 组、场景语言、禁模块 CRUD 命名）、`EXP-013`（入口可执行性三查）、`EXP-021`（入口可见性取决于能否进入）
> 范围：店长侧栏菜单与可直达页面。**不改业务对象、状态机、权限与金额口径。**

---

## 一、现状菜单（2026-10-11 实测）

```text
今日
  业务工作台          → /workbench
客户经营
  客户跟进            → /workbench/customers
  待我谈单            → /designer/quotes
  待我签约            → /designer/contract
项目工地
  项目推进            → /workbench?surface=project   ← 死参数：页面不消费 surface
  主材选材            → /workbench/material-selection
  增减项              → /workbench/contract-changes
  客户意见投诉        → /workbench/customer-feedback
  整改跟进            → /workbench/rectification
商务财务
  资金台账            → /finance/ledger
  本店薪酬            → /finance/store-payroll
经营风险
  待我处置风险        → /workbench/risk
```

问题：①「项目推进」死参数；②缺门店经营结果入口；③缺指派设计师入口；④薪酬/考勤/凭证等只读能力散落未挂；⑤一级分组「项目工地」对店长是**履约域**，但店长在项目上主要是**干预与兜底**，命名偏执行。

---

## 二、店长菜单的设计原则

1. **按「本店经营三件事」组织**：客户与谈单（拉）、履约与风险（兜）、经营与用工（算）。
2. **结论优先**：一级入口优先给"结论页"（经营结果、风险），明细页在二级。
3. **不挂不可达**：凡路由对该角色拒绝的入口一律不挂（`EXP-013` ③）。
4. **只读能力也要有入口**：能看不能改的能力（财务只读、薪酬只读）应可发现——入口可见性取决于「能否进入」（`EXP-021`）。

---

## 三、冻结菜单（本期）

```text
今日
  业务工作台              → /workbench

本店客户
  本店客户                → /workbench/customers
  待我谈单                → /designer/quotes
  待我签约                → /designer/contract

本店履约
  主材选材                → /workbench/material-selection
  增减项                  → /workbench/contract-changes
  整改跟进                → /workbench/rectification
  客户意见投诉            → /workbench/customer-feedback

本店经营
  待我处置风险            → /workbench/risk
  资金台账（只读）        → /finance/ledger
  本店薪酬（只读）        → /finance/store-payroll
  薪酬与考勤（只读）      → /finance/payroll

（预留，等裁决后挂）
  门店经营结果            → 待新增页面（statistic/store/report 已存在）
  指派设计师              → 待确认 Provider
  我的工资条              → /account/payslips 已在顶栏，不重复
```

**项数核算**：1 + 3 + 4 + 4 = **12 项 / 4 个一级分组**，满足 `DEC-034`「一级 ≤7 组」。

### 裁决记录

| # | 事项 | 裁决 | 依据 |
| --- | --- | --- | --- |
| D1 | 「项目推进 → `/workbench?surface=project`」 | **移除**：页面不消费 `surface`（死参数），且店长没有门店项目队列页 → 不留死链 | `EXP-013` ②③ |
| D2 | 「客户跟进」命名 | 改为 **「本店客户」**（范围语言，对齐 `view:customers` + Store 范围） | `DEC-034` 场景/范围语言 |
| D3 | 一级分组命名 | 「客户经营 / 项目工地 / 商务财务 / 经营风险」→ **「本店客户 / 本店履约 / 本店经营」** + 今日 | 店长视角是"本店"，且原「项目工地」对店长偏执行语义 |
| D4 | 只读能力入口 | 财务只读、本店薪酬、薪酬与考勤**都给入口**（菜单标签标注「只读」） | `EXP-021`：能进入即可见 |
| D5 | 是否挂 `/pm/*` | **不挂**：`/pm` 路由 `meta.roles` 不含店长；且 App 给店长的 `act:startStage` 与路由冲突属**待裁决**（见缺口 3） | `EXP-013` ③ |
| D6 | 指派设计师 / 门店经营结果 | **本期不挂**（无 Provider 确认 / 无页面）→ 登记缺口，裁决后补 | 缺口 1、2 |
| D7 | 菜单 key | 复用已注册 key（`customer.followup`/`designer.quote`/`designer.contract`/`pm.materialSelection`/`pm.change`/`pm.acceptance`/`designer.feedback`/`boss.risk`/`finance.ledger`/`finance.storePayroll`/`finance.payroll`）；**不新增未注册 key** | S1 准出 |

---

## 四、命名对照（旧 → 新）

| 旧 | 新 | 依据 |
| --- | --- | --- |
| 客户经营（组） | 本店客户（组） | 范围语言 |
| 客户跟进 | 本店客户 | 同上 |
| 项目工地（组） | 本店履约（组） | 店长在本店项目上的角色是履约兜底 |
| 商务财务 + 经营风险（两组） | 本店经营（组） | 合并"经营结论 + 只读财务"，避免两组都是零散入口 |
| 资金台账 | 资金台账（只读） | 显式只读，避免误以为可改账 |
| 本店薪酬 | 本店薪酬（只读） | 同上 |
| （无） | 薪酬与考勤（只读） | 店长有 `view:payroll`；考勤编辑入口缺口另记 |
| 项目推进 | **移除** | 死参数 + 无承载页 |

---

## 五、实施状态

| 菜单项 | 路由 | 承载页面 | 状态 |
| --- | --- | --- | --- |
| 业务工作台 | `/workbench` | `WorkbenchHomeView` | 已建 |
| 本店客户 | `/workbench/customers` | `StoreCustomerView` | 已建 |
| 待我谈单 | `/designer/quotes` | `DesignerQuoteListView` | 已建（队列受 `GAP-WEB-016` 阻塞） |
| 待我签约 | `/designer/contract` | `DesignerContractHandoffView` | 已建（确认签约/生效已修） |
| 主材选材 | `/workbench/material-selection` | 选材工作台 | 已建（口径待 `GAP-WEB-019`） |
| 增减项 | `/workbench/contract-changes` | `WorkbenchContractChangesView` | 已建 |
| 整改跟进 | `/workbench/rectification` | `WorkbenchRectificationView` | 已建 |
| 客户意见投诉 | `/workbench/customer-feedback` | `WorkbenchCustomerFeedbackView` | 已建 |
| 待我处置风险 | `/workbench/risk` | `WorkbenchRiskView` | 已建 |
| 资金台账（只读） | `/finance/ledger` | `FinanceLedgerView` | 已建 |
| 本店薪酬（只读） | `/finance/store-payroll` | `FinanceStorePayrollView` | 已建（本轮新增） |
| 薪酬与考勤（只读） | `/finance/payroll` | `FinancePayrollWorkbenchView` | 已建（本轮新增） |

---

## 六、本次不做

1. 不改任何 `meta.roles`（店长能否进 `/pm`、项目成员指派入口属裁决项）；
2. 不新增页面（门店经营结果、指派设计师待裁决）；
3. 不新增业务对象、状态、动作与金额口径；
4. 不把"门店经营结果"用 `/workbench` 卡片冒充（无页面即不挂）。
