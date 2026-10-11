# Web 项目经理（Pm）菜单信息架构 · 冻结稿

> 状态：`MENU_FROZEN（2026-10-11）`
> 上游：`WEB-PM-PAGE-INVENTORY.md`、`WEB-BATCH2-PM-G1-迭代包.md`、`WEB-BATCH2-PM-G1.5-设计冻结.md`
> 决策依据：`DEC-034 / BR-030`（一级 ≤7 组、二级场景工作台命名、禁止模块 CRUD 命名）、`WEB-角色页面开发作业规范.md` §3 S1
> 范围：Pm 角色侧栏菜单与菜单可直达页面。**不改业务对象、状态机、权限与金额口径。**

---

## 一、App 端 Pm 基准（只读参照）

| 维度 | App 事实 |
| --- | --- |
| 底部 Tab | 工作台 / 客户 / 项目 / 我的 |
| 首页能力 | 本人负责项目聚合、待办与风险 |
| 主链（§4.2 链路 C/D） | 阶段开工 → 任务开始/完成申请验收 → 现场汇报（照片，可同步业主）→ 提交阶段验收 → 业主确认/驳回 → 整改复验 |
| 做 | 项目/阶段/任务/日报推进、节点留证、现场动态、材料状态、提交验收、履约业绩 |
| 不做 | 获客、客户转交、报价编辑、代业主确认、资金结算 |

**Web 差异定位**：Pm 在 Web 上是**多项目并行**场景（同时在管 10+ 项目），因此 Web 以「项目队列 + 当前项目工作面」为主，而非复刻 App 的单项目详情页。

---

## 二、现状菜单（2026-10-11 实测）

```text
今日
  业务工作台                    → /workbench
项目工地
  项目推进                      → /pm/workbench
  增减项                        → /pm/workbench?surface=changes   ← 死参数，页面不消费 surface
  客户意见投诉                  → /workbench/customer-feedback
  整改跟进                      → /workbench/rectification
```

实测问题：

| # | 问题 | 严重度 | 说明 |
| --- | --- | --- | --- |
| P1 | 「增减项」指向 `?surface=changes` 死参数 | 中 | `PmWorkbenchView` 不读 `surface`，点击后页面无任何变化；真实承载页是 `/workbench/contract-changes`（roles 已含 `Pm`） |
| P1 | 缺「主材选材」菜单 | 中 | G1.5 冻结过该入口；但路由 `meta.roles` 与注册表 `pm.materialSelection.roles` **均不含 `Pm`** → 直接补菜单会造成死链（`GAP-WEB-019`） |
| P2 | 一级分组只有「今日 / 项目工地」两组，其余场景混在域下 | 低 | 与 `DEC-034` 的「域 + 主链场景」结构不符 |
| P2 | 命名混装：「项目推进」（场景）×「客户意见投诉」（对象/模块）×「整改跟进」（动作） | 低 | 需统一为场景语言 |
| P3 | 注册表 `pm.project.deepLink` 指向 `/designer/projects`（设计师页面） | 中 | 注册表与实现不一致；Pm 的项目工作面实际是 `/pm/workbench` |

---

## 三、冻结菜单（本期）

```text
今日
  业务工作台                                → /workbench          （共享角色工作台首页，按注册表渲染入口卡）

项目履约
  项目推进                                  → /pm/workbench
  待我验收/整改                             → /workbench/rectification

材料与变更
  增减项                                    → /workbench/contract-changes
  （主材选材：本期不挂菜单，待 GAP-WEB-019 裁决后补）

履约协同
  客户意见投诉                              → /workbench/customer-feedback
```

**项数核算**：1（今日）+ 2（项目履约）+ 1（材料与变更）+ 1（履约协同）= **5 项**，一级分组 4 组，满足 `DEC-034`「一级 ≤7 组」。**不新增未注册的菜单 key**（复用 `today.mainline` / `pm.project` / `pm.acceptance` / `pm.change` / `designer.feedback`）。

### 裁决记录

| # | 事项 | 裁决 | 依据 |
| --- | --- | --- | --- |
| D1 | 一级结构 | 采用「业务工作台 + 域/场景两级」 | `DEC-034 / BR-030` |
| D2 | 「项目推进」承载页 | 保持 `/pm/workbench`（G1.5 曾写 `/pm/projects`，实现已取代；**按实现为准**，注册表同步） | 实现事实 + 本轮复验 |
| D3 | 「增减项」承载页 | 改为 `/workbench/contract-changes`，删除死参数 `surface=changes` | S1 准出「每个菜单项都能指出承载页面与路由」 |
| D4 | 「主材选材」 | **本期不挂菜单**：路由与注册表 roles 均不含 `Pm`，与后端 `materialplans/update`（Boss/Pm/Finance）冲突 → 先裁决 `GAP-WEB-019`，裁决前不新增死链 | `WEB-角色页面开发作业规范.md` §6.2 |
| D5 | 「待我验收/整改」命名 | 统一为场景语言（原「整改跟进」） | `DEC-034 / BR-030` |
| D6 | 履约业绩 | 本期不做（Web 未规划对应页面） | 缺口 9 |

---

## 四、命名对照（旧 → 新）

| 旧 | 新 | 依据 |
| --- | --- | --- |
| 项目工地（一级组） | 项目履约 | 场景语言，避免域/模块命名 |
| 整改跟进 | 待我验收/整改 | `DEC-034` 场景命名 |
| 增减项 → `/pm/workbench?surface=changes` | 增减项 → `/workbench/contract-changes` | 消除死参数 |
| （无） | 材料与变更（一级组） | 承载增减项；主材选材待裁决 |
| 客户意见投诉（留在项目工地组） | 客户意见投诉（归入履约协同组） | 分组语义归位 |

---

## 五、菜单与对象内工作区的分工

| 菜单项 | 菜单页职责（队列） | 对象内工作区职责（逐项处理） |
| --- | --- | --- |
| 项目推进 | 本人项目队列、状态筛选、风险排序 | `/pm/workbench?projectId=` 当前项目工作面：阶段/任务/日报/验收事实与主行动 |
| 待我验收/整改 | 整改中阶段队列 | 进入 `/pm/projects/:projectId/acceptance` 提交复验 |
| 增减项 | 项目级增减项队列 | 变更单详情、重算与客户签认（按后端规则） |
| 客户意见投诉 | 意见/投诉队列 | 处理回复抽屉 |

---

## 六、实施状态

| 菜单项 | 路由 | 承载页面 | 状态 |
| --- | --- | --- | --- |
| 业务工作台 | `/pm/workbench` | `PmWorkbenchView` | 已建 |
| 项目推进 | `/pm/workbench` | `PmWorkbenchView` | 已建 |
| 待我验收/整改 | `/workbench/rectification` | `WorkbenchRectificationView` | 已建（roles 含 Pm） |
| 增减项 | `/workbench/contract-changes` | `WorkbenchContractChangesView` | 已建（roles 含 Pm）；菜单指向本次修正 |
| 客户意见投诉 | `/workbench/customer-feedback` | `WorkbenchCustomerFeedbackView` | 已建（roles 含 Pm） |
| 主材选材 | — | — | **待裁决**（`GAP-WEB-019`） |

---

## 七、本次不做

1. 不新增页面与路由（除修正既有菜单指向）。
2. 不改任何 `meta.roles` 与权限矩阵（主材选材的 Pm 入口属权限裁决，登记后处理）。
3. 不新增业务对象、状态、动作与金额口径。
4. 不把 `/pm/workbench` 拆分为 A/C 两页（结构合规问题单独登记，避免与 S3 迭代包冲突）。
