# Web 财务角色页面清单与主链责任矩阵

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 状态：`S1 产出（2026-10-11）`
> 依据：`WEB-角色页面开发作业规范.md`（S1/S2/S3）、`WEB-FINANCE-ROLE-NATURE-AND-MINDSET.md`（财务公理）、`FINANCE-G1-迭代包.md`、`WEB-BATCH3-FINANCE-G1-ACTION-FREEZE.md`、`2026-10-07-企业自定义凭证模板Web-P0研发切片.md`
> 范围：Finance 角色 Web 页面清单、现状、主链可达性与缺口。**不新增业务对象、状态、动作、权限或金额口径。**

---

## 一、角色定位（一句话）

**财务不生产业务事实，只核对、勾稽、归档、呈现别人的事实。** 页面第一性判据是「账实相符、勾稽平衡、口径唯一、可追溯」，不是「好不好用」。
详见 `WEB-FINANCE-ROLE-NATURE-AND-MINDSET.md`。

---

## 二、页面清单（**五类资产**）

> 说明：`WEB-角色页面开发作业规范.md` §2 原定四类（A 角色工作台 / B 场景工作台 / C 对象工作面 / D 承接层与工具页）。
> 财务的核心载体是**专业列表 + 批量 + 对账**，既不是「入站队列驱动的三栏工作台」，也不是「作业层抽屉」。
> 因此本清单**增列第 5 类**：**E 专业列表 / 对账台**，并建议回写规范 §2（见 §五 缺口 1）。

| 类别 | 定义 | 财务实例 |
| --- | --- | --- |
| A 角色工作台 | 角色首页 / 经营总览，回答「今天先做什么」 | 财务工作台 |
| **E 专业列表 / 对账台** | 以**筛选 + 明细 + 批量 + 汇总**为主的专业表格面，回答「这一期的这笔账对不对」 | 应收、应付、收款、付款、工人工资、员工工资、提成、提成调整、退款、供应商往来、资金台账、项目账本 |
| C 对象工作面 | 以对象为中心的深入面 | 项目核算 `/finance/projects/:projectId` |
| D 承接层与单据页 | 抽屉/弹窗/整页单据与文档 | 凭证模板（整页表单）、收付凭证（单据文档） |

### 逐页清单（15 条子路由 / 16 条具名路由）

| # | 页面 | 路由 | 类别 | 菜单入口 | 现状 | 缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 财务工作台 | `/finance/workbench` | A | ✅ 业务工作台 → `/workbench`（非本页） | 已建；`finance/summary/report` | 菜单「业务工作台」指向 `/workbench`，**到不了 `/finance/workbench`** |
| 2 | 应收计划 | `/finance/receivables` | E | ✅ 待我收款 | 已建；应收/收款抽屉 | — |
| 3 | 收款记录 | `/finance/receipts` | E | ❌ | 已建 | 无菜单入口 |
| 4 | 客户退款 | `/finance/refunds` | E | ❌ | 已建 | 无菜单入口 |
| 5 | 应付账款 | `/finance/payables` | E | ✅ 待我付款 | 已建 | — |
| 6 | 付款记录 | `/finance/payments` | E | ❌ | 已建 | 无菜单入口 |
| 7 | 工人工资 | `/finance/salaries` | E | ❌ | 复用 `FinancePayablesView`（`salaryMode`） | 无菜单入口；与「应付账款」同组件，需在 UI 上明确区分 |
| 8 | 供应商往来 | `/finance/partners` | E | ❌ | 已建；`finance/partner-ledger/report` | 无菜单入口 |
| 9 | 资金台账 | `/finance/ledger` | E + 批量 | ⚠️ 「资金台账与凭证」→ `/finance/ledger` | 已建；多选 + 批量出证 | **标签承诺「凭证」但入口到不了凭证页** |
| 10 | 提成负向调整 | `/finance/commission-adjustments` | E | ❌ | 已建 | 无菜单入口（L2 边界内） |
| 11 | 员工工资 | `/finance/employee-salaries` | E | ❌ | 已建；`payroll/*`（`GAP-WEB-006` CLOSED） | 无菜单入口 |
| 12 | 员工提成 | `/finance/employee-commissions` | E | ❌ | 已建 | 无菜单入口 |
| 13 | 项目账本 | `/finance/projects` | A | ❌ | 已建；`finance/project/page|report` | 无菜单入口 |
| 14 | 项目核算 | `/finance/projects/:projectId` | C | ❌（由 13 下钻） | 已建；成本完整度 / 结算 / 质保金 | 无菜单入口（应经 13 下钻，属正常） |
| 15 | 收付凭证 | `/finance/vouchers` | D（单据文档） | ❌ | 已建；`document/voucher/page|report|build` | **无任何角色菜单入口**；未进注册表 |
| 16 | 凭证模板 | `/finance/voucher-templates` | D（整页表单） | ❌ | 已建 + 版式设计器（画布 908 行） | **无任何角色菜单入口**；未进注册表 |

**可达性统计**：16 条具名路由中，**菜单可达 3 条**（应收/应付/台账），**1 条指向共享工作台首页**（业务工作台），**12 条无菜单入口**。
**权限事实**：`/finance` 组 `meta.roles = ['Finance','Boss','StoreManager']`，子路由未额外收窄 → 凭证/模板页**是可达的**，问题是「没人挂入口」，不是「进不去」。

---

## 三、与 G1 迭代包/设计冻结的差距

| G1 冻结项 | 现状 | 结论 |
| --- | --- | --- |
| 12 个页面（工作台/应收/收款/应付/工资/付款/供应商/台账/项目账本/项目核算/凭证/凭证模板）三档渲染 PASS | `20261007-finance-role-web` run 记录 12 路由 PASS、控制台 0 error | ✅ 已达（但为 2026-10-07 基线） |
| 「员工工资/提成」属 `GAP-WEB-006` 边界 | 已 CLOSED，`payroll/*` 接通 | ✅ |
| 台账/凭证**动作注册** | `DEF-WEB-005` 原描述已过期：`document/voucher/build` **已于 2026-10-10 冻结**；真实缺口是退款/薪酬/结算三类动作未登记 | ⚠️ 需精确化后继续跟踪（见缺口 6） |
| 凭证模板 P0：平台模板只读 + 复制/编辑/发布/停用 + 版本不可变 | 已接入版本/发布/停用；**任意坐标、上传底图、三档+PDF 回归未完成** | ⚠️ 部分 |
| 财务菜单信息架构 | 只有 3 个财务入口 + 3 个项目工地入口 | ❌ 未按财务形态设计（见菜单冻结稿） |

---

## 四、主链责任矩阵（强制交付物）

> 断点类型：`NO_WEB_ENTRY` / `ROLE_GUARD_DENIED` / `BLOCKED_OWNER_SESSION` / `BLOCKED_PROVIDER` / `BLOCKED_BIZ_DECISION` / `API_SIMULATED`。

| 主链步 | 业务动作 | 责任角色 | 责任端 | 入口页面 | 可达性 | 依据 |
| --- | --- | --- | --- | --- | --- | --- |
| 合同确认生效 | `project/contract/update(Effective)` | Boss / StoreManager | Web | 待我签约 | 可达（已修复并复验） | `XA-012` |
| 维护应收节点 | `finance/receivable/save` | Finance / Boss | Web | 应收计划 | 可达 | `G1 动作冻结` |
| **登记客户收款并核销** | `finance/receipt/save` | Finance / Boss | Web | 应收计划 · 登记收款 | 可达（幂等，禁超额） | `G1 动作冻结` |
| 收款落台账 | 系统写 `Ledger(Receipt)` | — | 服务端 | 资金台账 | 可达（只读可见） | `finance/ledger/page` |
| **手工记账**（无来源事实） | `finance/ledger/save` | Finance / Boss | Web | 资金台账 · 手工记账 | 可达（限杂费/费用/其他收入/调拨） | 公理 1 |
| 更正/作废/冲正 | `finance/ledger/update|delete|correct` | Finance（更正）/**Boss（作废、冲正）** | Web | 资金台账 | 可达 | `G1 动作冻结` |
| **出凭证** | `document/voucher/build` | Finance / Boss | Web | 资金台账（多选批量出证）→ 收付凭证 | **可达**：动作政策已于 **2026-10-10 冻结**（幂等：同一来源流水组合重打返回原凭证号）；本次已把它接入 `finance.ledger.actionPolicyKeys` | `business-action-policies.json`、`DEC-020 / BR-018` |
| **凭证模板维护** | `document/voucher-template/save|update` + `document/baseline/list` | Boss / StoreManager / Finance | Web | 凭证模板（**无菜单入口**） | 可达（入口未挂） | `DEC-020 / BR-018` |
| 生成应付 | `finance/payable/save` | Finance / Boss | Web | 应付账款 | 可达 | `G1 动作冻结` |
| **登记付款并核销** | `finance/payment/save` | Finance / Boss | Web | 应付账款 · 登记付款 | 可达（幂等，禁超付） | `G1 动作冻结` |
| 员工工资确认/发放 | `payroll/sheet`（生成/确认）、员工发放 | **Boss 确认 → Finance 发放** | Web | 员工工资 | ⚠️ **动作未登记**：页面已接 `payroll/*` 并实现生成/确认/发放，但 `business-action-policies.json` **无 payroll 动作** → 按规范只能显示「待业务确认」 | `BR-015`；`DEF-WEB-005` 家族 |
| 项目结算 | `finance/settlement/save|update` | Finance / Boss | Web | 项目核算 | ⚠️ **动作未登记**（Provider 在 G1 迭代包已列，动作政策表无条目）→ 显示「待业务确认」 | `FINANCE-G1 §4 场景 D`；`DEF-WEB-005` 家族 |
| 质保金释放 | `finance/settlement/retention-release` | Finance / Boss | Web | 项目核算 | ⚠️ **动作未登记**（同上） | 同上 |
| 登记客户退款 | `finance/refund/*`（页面已实现「登记退款」） | Finance / Boss | Web | 客户退款 | ⚠️ **动作未登记**（页面有写入口，注册表无条目） | `DEF-WEB-005` 家族 |

**结论（2026-10-11 修正）**：

1. 「出凭证」**不是断点**——`document/voucher/build` 已于 2026-10-10 冻结，`DEF-WEB-005` 的原始描述（动作注册缺口）**已过期**；剩余工作是把它接线到注册表（本次已做）并补真实验证。
2. 真正的断点是 **动作注册表覆盖不足**：`business-action-policies.json` 的 49 条动作里只有 **11 条财务动作**（应收 save / 收款 save / 应付 save / 付款 save / 台账 save·update·delete·correct / 台账分类 save·update·delete）；**退款、薪酬（payroll）、项目结算三类动作未登记**，而这三种页面**都已经实现了写入口**（`FinanceRefundsView`「登记退款」、`FinanceEmployeeSalariesView` 生成/确认工资单 + 员工发放、项目核算结算）。
   → 按规范，这三类动作在契约层面只能显示「待业务确认」，属于**页面已实现、契约未登记**的错位，是 `DEF-WEB-005` 的真实内容。
3. 凭证与模板页**可达但不可发现**（无菜单入口），本次已补。

---

## 五、缺口清单（按财务风险排序）

| # | 缺口 | 违反 | 处置 |
| --- | --- | --- | --- |
| 1 | ~~四类资产分类缺「E 专业列表 / 对账台」~~ | 规范完备性 | ✅ **已处置**：`WEB-角色页面开发作业规范.md` 升 **v1.1**，§2 增列第 5 类 **E 专业列表 / 对账台** |
| 2 | **收付凭证 / 凭证模板无任何角色菜单入口**（16 条路由中 12 条无入口） | 入口可执行性三查 ③ | 本次菜单冻结 + 落地 |
| 3 | 菜单「资金台账与凭证」**标签承诺凭证、入口到不了凭证页** | 入口可执行性三查 ② | 本次修正 |
| 4 | 「业务工作台」指向共享 `/workbench`，**到不了 `/finance/workbench`** | 入口可执行性三查 ① | 本次修正（或明确 `/workbench` 为财务首页的裁决） |
| 5 | 凭证/模板页**未进 `workbench-navigation.json`** | 治理（无契约即无门禁） | 本次 S2 注册 |
| 6 | **动作注册覆盖不足**：退款、薪酬（payroll）、项目结算三类动作未登记，但页面已实现写入口 → 契约层面只能「待业务确认」。注：出凭证动作已于 2026-10-10 冻结，不属此列 | 公理 6 + 契约一致性 | 按 `BR-015 / DEC-020` 补注册（业务裁决后）；补齐前相关按钮按规范显示待业务确认 |
| 7 | `MET-005` **同名不同公式**（Web `monthReceiptAmount` vs App `monthIncome`） | 公理 5 | 业务裁决（`MET-005` 已有待确认项） |
| 8 | `GAP-003` 财务总览成本利润与报价快照不一致 | 公理 4/5 | 业务裁决 |
| 9 | 凭证设计器三档 + PDF 回归未完成；任意坐标/上传底图未做 | 公理 6 | 见 `WEB-VOUCHER-DESIGNER-GAP-LIST.md` |
| 10 | 工人工资与应付账款**共用同一组件**（`salaryMode`），需在 UI 明确区分用途 | 公理 1 | 本次菜单冻结中命名与分组区分 |

---

## 六、下一步

1. **S1 菜单冻结**：见 `WEB-FINANCE-MENU-FROZEN.md`（本次产出）。
2. **S2 注册表冻结**：新增 `finance.voucher` / `finance.voucherTemplate` 等条目。
3. **S5 低风险切片**：菜单落地（缺口 2/3/4）。
4. **凭证设计器**：按 `WEB-VOUCHER-DESIGNER-GAP-LIST.md` 补齐门禁与回归。
