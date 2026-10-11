# Web 店长（StoreManager）页面清单与主链责任矩阵

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 状态：`S1 产出（2026-10-11）`
> 依据：`WEB-STOREMANAGER-ROLE-NATURE-AND-MINDSET.md`（S0）、`WEB-角色页面开发作业规范.md`（v1.1，含第 5 类资产 E）、`WEB-ROLE-SCENARIO-MATRIX.md`（StoreManager 行）、`WEB-ALL-ROLE-BUILD-BOARD.md`（Batch 4）
> 范围：店长可达页面清单、现状、主链可达性与缺口。**不新增业务对象、状态、动作、权限或金额口径。**

---

## 一、可达性事实（2026-10-11 代码实测）

**路由守卫事实**：

| 路由组 | `meta.roles` | 店长可否进入 |
| --- | --- | --- |
| `/designer` | `Designer, Boss` | ❌（例外：我先前放行了 `/designer/quotes*`、`/designer/contract*`） |
| `/pm` | `Pm, Boss` | ❌ **完全不可进** |
| `/finance` | `Finance, Boss, StoreManager` | ✅ |
| `/workbench` | 仅 `requiresAuth`，子路由各自声明 | 取决于子路由 |
| `/account`、`/messages` | 仅 `requiresAuth` | ✅ |

**店长可用页面清单**：

| 页面 | 路由 | 类别 | 现状 |
| --- | --- | --- | --- |
| 业务工作台（角色首页） | `/workbench` | A | ✅ 按注册表渲染本店入口卡 |
| 本店客户 | `/workbench/customers` | E | ✅ |
| 待我谈单 | `/designer/quotes` | B/E | ✅ **已可用**（`GAP-WEB-016` 已按选项 1 实现：后端按 Store 范围放行）→ 实测「79 个当前报价」+ 5 类计数 |
| 待我签约 | `/designer/contract` | B/E | ✅ 确认签约/生效已修（`XA-012` 复验通过） |
| 主材选材 | `/workbench/material-selection` | B | ✅ |
| 增减项 | `/workbench/contract-changes` | B | ✅ |
| 客户意见投诉 | `/workbench/customer-feedback` | B | ✅ |
| 整改跟进 | `/workbench/rectification` | B | ✅ |
| 待我处置风险 | `/workbench/risk` | B/E | ✅ |
| 资金台账（只读） | `/finance/ledger` | E | ✅ 只读 |
| 本店薪酬（只读） | `/finance/store-payroll` | E | ✅ 只读 |
| 薪酬工作台（只读） | `/finance/payroll` | A | ✅ 只读（本轮修正入口可见性，见 `EXP-021`） |
| 收付凭证 / 凭证模板（只读） | `/finance/vouchers`、`/finance/voucher-templates` | D | ✅ 可达（菜单未挂） |
| 员工工资/提成/提成调整（只读） | `/finance/employee-*`、`/finance/commission-adjustments` | E | ✅ 可达（菜单未挂） |
| 我的工资条 | `/account/payslips` | D | ✅ 顶栏入口 |
| 个人信息 / 企业信息 / 消息 | `/account/*`、`/messages` | D | ✅ |

**不可达（店长能力需要但路由拒绝）**：`/designer/customers`、`/designer/performance`。
**2026-10-11 更新**：`/pm/workbench` 已按 **A2 裁决放行**（`routes.ts` 的 StoreManager 集合含 `/pm/workbench`，实测可见 **23 个本店项目**，工作台文案已角色化）——不再属于不可达；`/designer/projects` 亦在店长集合内（成员指派入口）。

---

## 二、主链责任矩阵（强制交付物）

| 主链步 | 业务动作 | 责任角色 | 责任端 | 入口页面 | 可达性 | 依据 |
| --- | --- | --- | --- | --- | --- | --- |
| 本店客户跟进 / 邀约量房 | `customer/customer-follow/save`、`customer/customer/measure` | Marketer / 店长 | Web | 本店客户 | ✅ | 场景矩阵 |
| **指派设计师** | `customer/customer/handoff` 等 | 店长 | Web | **无** | **`NO_WEB_ENTRY`** | App `act:assignDesigner`；场景矩阵 Provider |
| 谈单 | `quote/*` | Designer / 店长 | Web | 待我谈单 | ⚠️ `BLOCKED_BIZ_DECISION`（`GAP-WEB-016`） | 店长队列事实源未裁决 |
| 发起合同 | `project/contract/save` | Designer / 店长 | Web | 待我签约 | ✅ | `XA-012` |
| **确认签约 / 确认生效** | `project/contract/update(Signed/Effective)` | **店长 / Boss** | Web | 待我签约 | ✅（已修复并复验） | `XA-012` 修复记录 |
| **项目开工（阶段）** | `project/stage/update(Doing)` | Pm / **店长** / Boss | Web | `/pm/workbench` | ✅ **已放行（A2，2026-10-11）**：店长可进入且可见 23 个本店项目；**开工动作在店长身份下的真实执行待浏览器复验** | App `act:startStage`（2026-09-23 用户裁决） |
| 阶段「本项不涉及」判定/撤销 | `project/stage/update(NotApplicable/Todo)` | Pm / **店长** / Boss | Web | `/pm/workbench` | ✅ **已放行（A2，2026-10-11）**，同上一行 | `GAP-039 / DEC-057` |
| 成员指派（项目经理等） | `project/project/update` | Boss / **本店店长** | Web | 项目工地 · 项目成员 | ✅ **归属已裁决（A3，2026-10-11）**：入口归**店长 / 企业负责人**；`/designer/projects` 在店长集合内（成员指派抽屉） | `XA-016` 修复记录 |
| 主材选材 | `material/selection/save` | 按 `GAP-WEB-019` 待裁决 | Web | 主材选材 | ✅ 页面可达 | `GAP-WEB-019` |
| 增减项 | `project/contract-change/*` | Pm / Designer / Boss / 店长 | Web | 增减项 | ✅ | 注册表 `pm.change` |
| 整改与投诉处理 | `project/acceptance/*`、`project/feedback/update` | 店长 / Pm | Web | 整改跟进 / 客户意见投诉 | ✅ | 注册表 |
| **风险处置** | `statistic/risk/report` + 动作 | 店长 / Boss | Web | 待我处置风险 | ✅ | `GAP-WEB-009` 已 CLOSED |
| 财务只读（台账/凭证/薪酬） | 只读 | 店长 | Web | 资金台账 / 本店薪酬 / 薪酬工作台 | ✅ | `GAP-WEB-008` 已 CLOSED |
| 考勤录入/确认 | `attendance/summary/save|update` | **店长**（App `edit:attendance`）/ Finance | Web | 员工工资页内抽屉 | **`NO_WEB_ENTRY`**（抽屉按钮按 `canWrite` 隐藏，店长看不到） | App 能力；`EXP-021` 同族 |
| 业主确认验收 / 交房 | `project/acceptance/update` | **业主本人** | 小程序 | — | `BLOCKED_OWNER_SESSION` | 审计既有结论 |
| 门店经营结果（本店合同/回款/成本毛利） | `statistic/store/report` | 店长 / Boss | Web | **无页面** | **`NO_WEB_ENTRY`** | App `view:cost`；后端 Provider 存在但 Web 未接 |

**结论（2026-10-11 复校）**：店长主链原有 **5 个断点**，**现存 2 个**——①**指派设计师无入口**（`GAP`/B2 待拍）；②**考勤编辑入口被写权限隐藏**（`NO_WEB_ENTRY`，B1 待拍）。
已消除：③门店经营结果无页面 → **已实现**（`/workbench/store-overview`）；④项目开工/阶段撤销被路由拒 → **已按 A2 放行**；⑤项目成员指派入口不可达 → **已按 A3 归属店长/负责人**（`/designer/projects` 在店长集合内）。谈单队列 `GAP-WEB-016` 亦已按 Store 范围放行实现。

---

## 三、缺口清单（按用户价值排序）

| # | 缺口 | 类型 | 处置 |
| --- | --- | --- | --- |
| 1 | ~~门店经营结果无页面~~ | ✅ **已实现（2026-10-11）** | `/workbench/store-overview` + `store.overview`；**未占用裁决**（边界由接口事实推导：接口不含成本/毛利与完整性标记 → 不展示成本）。证据 `docs/acceptance/runs/20261011-storemgr-store-overview/` |
| 2 | **指派设计师无 Web 入口** | `NO_WEB_ENTRY` | 需确认 Provider 与动作注册（App `act:assignDesigner`）；先登记 |
| 3 | ~~项目开工/阶段撤销对店长不可达~~ | ~~`ROLE_GUARD_DENIED`~~ | **已关闭（A2，2026-10-11）**：店长可进 `/pm/workbench`（实测 23 个本店项目），文案已角色化；开工动作的真实执行待浏览器复验 |
| 4 | **项目成员指派入口在店长不可进的页面**（`/designer/projects` 的「项目成员」卡） | `ROLE_GUARD_DENIED` | 同上；`requireMemberEditor` 明确含本店店长 |
| 5 | **考勤编辑对店长不可见**（抽屉按钮 `v-if="canWrite"` 隐藏，而 App 给店长 `edit:attendance`） | 能力不一致 | 与 `EXP-021` 同族；需按「能否进入/能否写」分别判定后修 |
| 6 | 注册表 deepLink **对店长不可解析**：`customer.followup → /designer/customers`（店长被拒）、`pm.project → /pm/workbench`（店长被拒） | 结构性 | **登记结构性问题**：同一 workbench 被多角色共用时，单一 `deepLink` 无法对所有角色成立（`EXP-013` 三查 ③ 的放大形态） |
| 7 | 店长菜单「项目推进」指向 `/workbench?surface=project`，而 `WorkbenchHomeView` **不消费 `surface`** → 点了没反应 | 死参数 | ✅ **本轮已修**（移除该项，不留死链） |
| 8 | ~~谈单队列事实源与后端角色门禁冲突~~ | 已解决 | ✅ `GAP-WEB-016` 已按选项 1 实现（Store 范围放行），2026-10-11 复核通过 |
| 9 | 门店数据范围未证实（财务轮次遗留） | 待验 | 需多门店样本 |
| 10 | 场景矩阵把 `GAP-WEB-008` 标为 OPEN，实际已 CLOSED | 台账过期 | ✅ 本轮已修正（`EXP-015`） |

---

## 四、下一步

1. **本轮修**：缺口 7（死参数）；缺口 10（台账过期标注）。
2. **登记待裁决**：缺口 3、4（店长能否进 `/pm` 与项目成员指派入口）、缺口 5（考勤入口）、缺口 1、2（门店经营页、指派设计师入口需要业务/产品确认 Provider 与动作注册）。
3. **结构性问题**：缺口 6 的 deepLink 多角色解析，建议作为规范级改动（`workbench-navigation.json` 支持按角色 deepLink 或由前端按角色解析）。
