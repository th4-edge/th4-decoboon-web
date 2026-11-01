# Web 设计师菜单信息架构 · 冻结稿

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 状态：`MENU_IMPLEMENTED`（菜单已落地；页面按菜单逐个改造中）
> 上游：`WEB-DESIGNER-MENU-INFORMATION-ARCHITECTURE.md`（讨论稿）
> 范围：设计师角色侧栏菜单 + 菜单可直达页面；不改业务对象、状态机、金额口径
> 决策依据：`DEC-034` / `BR-030`（一级 ≤7 组、二级场景工作台命名、禁止模块 CRUD 命名）

---

## 1. 裁决记录（本轮已定）

| # | 事项 | 裁决 |
| --- | --- | --- |
| D1 | 菜单方案 | 采用**方案 A** 域/场景两级结构 |
| D2 | 一级分组 | 统一为 **客户经营 / 方案报价 / 项目交付 / 经营与工具** |
| D3 | 命名 | 统一**场景语言**：待我量房 / 待我设计 / 待我报价 / 合同签约 |
| D4 | 选材 / 增减项 / 验收整改 | **2026-10-10 用户修订**：按“项目交付”独立菜单逐项落地；已完成主材选材、增减项、客户意见投诉、整改跟进，项目页内工作区保留为详情/复验承接 |
| D5 | 设计师「待我验收/整改」 | **需要**（覆盖 App 原角色清单不含设计师的差异） |
| D6 | AI 效果图 | **本期纳入**范围 |
| D7 | 客户意见投诉 | **本期纳入**范围 |
| D8 | 报价项目库 / 我的业绩 | **降级到效率工具组**，不与主线场景同级 |

---

## 2. 冻结菜单（本轮 Designer 共 15 项；项目交付按用户要求逐项增加）

```
业务工作台                                  → /designer/workbench

我的客户（一级入口）                        → /designer/my-customers

客户经营
  待我跟进                                  → /designer/customers?surface=followup
  待我量房                                  → /designer/customers?surface=measure

方案报价
  待我设计                                  → /designer/design
  待我报价                                  → /designer/quotes
  合同签约                                  → /designer/contract

项目交付
  项目工地                                  → /designer/projects
  主材选材                                  → /workbench/material-selection
  增减项                                    → /workbench/contract-changes（已有变更单查看）
      （发起/详情：/designer/projects/:projectId/changes；新增入口在项目工地）
  客户意见投诉                              → /workbench/customer-feedback（已有记录处理）
  整改跟进                                  → /workbench/rectification（整改中阶段跟进）

经营与工具
  我的业绩                                  → /designer/performance
  报价项目库                                → /designer/catalog
  客户意见投诉                              → /designer/feedback
```

**项数核算（2026-10-10）**：1（工作台）+ 1（我的客户一级）+ 2（客户经营）+ 3（方案报价）+ 5（项目交付）+ 3（经营与工具）= **15 项**。用户明确要求“增减项 / 客户意见投诉 / 整改跟进”也具备菜单页面；后续每完成一项再增加对应菜单，R4 的“全菜单 ≤12”在本产品决策下调整为待重新评审，不得用“下沉项目页”替代用户指定的菜单入口。

**变更记录（2026-10-09）**：「我的客户」从「客户经营」二级提升为一级入口；「客户经营」下删除「客户诉求」菜单项并下线 `surface=requirement` 页面（客户诉求记录/展示保留在客户 360 与量房页内，不作为独立菜单入口）。

**AI 效果图的处理**：AI 效果图是**依赖方案上下文的生成工具**（要先有设计方案才能生成效果图），不具备独立入口语义，因此**不占菜单项**，作为「待我设计 → 设计工作区」内的主动作 + 独立工作区路由 `/designer/design/:designId/render`。AI 效果图仍不占独立菜单；用户 2026-10-10 已要求项目交付按项增加菜单，因此不能用“菜单数量上限”反向取消已明确要求的业务入口，菜单总数需在后续产品评审中统一重算。

---

## 3. 命名对照（旧 → 新）

| 旧菜单名 | 新菜单名 | 依据 |
| --- | --- | --- |
| 报价工作台 | **待我报价** | D3 场景语言 |
| 合同交接 | **合同签约** | D3；对应设计师 `act:contractPrepare`（发起/登记，不确认生效） |
| 客户与设计 | 客户与设计 | 保留（对象域命名，非模块） |
| 项目工地 | 项目工地 | 保留（域） |
| 我的业绩 | 我的业绩 | 保留，降级到效率工具组（D8） |
| 报价项目库 | 报价项目库 | 保留，降级到效率工具组（D8） |
| — | **待我跟进** | 新增（2026-10-09，注册表新增 `designer.followup`） |
| — | **待我量房** | 新增（注册表已有 `designer.measure`） |
| — | **待我设计** | 新增（注册表已有 `designer.design`） |
| — | **客户意见投诉** | 新增（本期建设） |

> 2026-10-09：**客户诉求** 菜单项已下线（原为新增项），其记录与展示收敛到客户 360 与量房页内。

---

## 4. 「项目交付」菜单与对象内工作区分工（2026-10-10 用户修订）

菜单按用户要求逐步增加“项目交付”独立入口；项目页内工作区继续作为对象上下文中的逐项处理面。当前已落地：

| 页内工作台 | 建议路径 | 现状 |
| --- | --- | --- |
| 项目推进 | `/designer/projects` | 已有项目工地入口 |
| 主材选材 | `/workbench/material-selection` | **本轮已落地**：跨项目队列 → `/designer/projects/:projectId/materials` 逐项代录 |
| 增减项 | `/workbench/contract-changes` | **本轮已落地**：项目工地列表 → 项目 Hero → 已有变更单列表；点击进入详情；新增入口在项目工地 |
| 客户意见投诉 | `/workbench/customer-feedback` | **本轮已落地**：项目工地 → 项目 Hero → 已有意见/投诉列表 → 处理回复抽屉 |
| 整改跟进 | `/workbench/rectification` | **本轮已落地**：整改中项目 → 项目 Hero → 整改中阶段列表 → 阶段验收工作区复验 |

**变更记录（2026-10-10）**：用户明确要求主材选材、增减项、客户意见投诉、整改跟进具备菜单页面，并按项逐个实现。四个项目交付菜单均已落地。

---

## 5. 菜单项实施状态

| 菜单项 | 路由 | 承载页面 | 状态 | 待办 |
| --- | --- | --- | --- | --- |
| 业务工作台 | `/designer/workbench` | `DesignerWorkbenchView` | 已建 | — |
| 我的客户（一级入口） | `/designer/my-customers` | `DesignerMyCustomersView` | 已建 | — |
| 待我跟进 | `/designer/customers?surface=followup` | `DesignerFollowUpTasksView` | 三栏工作台已建 | 真实凭证 E2E / T06 |
| 待我量房 | `/designer/customers?surface=measure` | `DesignerMeasureTasksView` | 三栏工作台已建 | 真实凭证 E2E / T06 |
| 待我设计 | `/designer/design` | 现复用 `DesignerCustomersView` | 语义不符 | 先按 `WEB-DESIGNER-PENDING-DESIGN-OPTIMIZATION-BRIEF.md` 做结构优化，再评估是否拆独立组件 |
| 待我报价 | `/designer/quotes` | `DesignerQuoteListView` | 三栏工作台已建（2026-10-09 重建：草稿/驳回优先队列、报价动作待裁决仅展示、接受后交接合同工作台） | 真实凭证 E2E |
| 合同签约 | `/designer/contract` | `DesignerContractHandoffView` | 三栏工作台已建（2026-10-09 重建：报价→合同队列、唯一主行动=发起合同、确认签约/生效只读展示） | 真实凭证 E2E |
| 项目工地 | `/designer/projects` | `DesignerProjectsView` | 无工作台切换 | 补 4 个 surface |
| 我的业绩 | `/designer/performance` | `DesignerPerformanceView` | 已建 | 仅分组调整 |
| 报价项目库 | `/designer/catalog` | `DesignerCatalogView` | 已建 | 仅分组调整 |
| 客户意见投诉 | `/designer/feedback` | — | 未建 | 新建页面 |

### 5.1 本期新建页面（含后端就绪情况）

| 页面 | 后端支持 | 结论 |
| --- | --- | --- |
| 客户意见投诉 | `project/feedback/page`、`project/feedback/update` **已存在** | 只需 Web 前端 |
| AI 效果图工作区 | `design/generation/page · info · build · update` **已存在** | 只需 Web 前端 |
| 待我设计列表页 | `design/schemes` 已有 Provider | 只需 Web 前端 + 路由拆分 |

---

## 6. 菜单唯一来源改造（R1）

**核实后的准确结论（修正讨论稿）**：`WorkbenchLayout.vue` 与 `sidebarNavForRole` **没有任何路由引用，已是死代码**；六个角色入口全部使用 `RoleAreaShell`。因此：

- **唯一生效来源 = `roles/workbenchConfig.ts`**（本次菜单即按此落地）
- 注册表 `workbench-navigation.json` 现在的真实用途只剩：① `RoleSideNav` 在配置未显式给 label/path 时的回退查询；② `/workbench` 首页卡片与 `WorkbenchEntryCard` 的元数据
- 所以讨论稿里说的「双来源漂移」实际形态是：**注册表里的设计师条目（待我量房/待我设计/待我选材/待我处理增减项/待我验收整改）从来没有出现在侧栏**，而侧栏用的是手写项——两者都真实存在，只是一条链路已废弃

因此收口动作简化为：

1. **注册表 = 唯一事实源**：补入 `designer.catalog`、`designer.performance`、`designer.feedback`、`designer.render` 等缺失条目。
2. **注册表新增导航范围字段**，用来表达「进菜单」与「下沉到项目页」的区别（建议名 `navScope: 'menu' | 'project-surface' | 'hidden'`）：
   - `pm.materialSelection` / `pm.change` / `pm.acceptance` → `project-surface`（设计师侧只在项目页出现，但**对 Pm / Boss / Finance 仍是菜单项**，不能删条目）
   - `designer.measure` → 归入 `customer` 域（`designer.requirement` 随客户诉求页面下线移除）
3. **手写配置降级为「显示名 + 排序覆盖表」**，禁止增删项；缺失即报错而不是静默忽略。

> 若不做第 2 点的字段区分，就只能在手写配置里删项——等于把双来源问题从「不一致」转成「一边失效」，不算解决。

---

## 7. 风险与前置

| # | 风险 / 前置 | 说明 | 处理 |
| --- | --- | --- | --- |
| K1 | 设计师「待我验收/整改」与 App 角色清单不一致 | App `RECTIFY_FOLLOW_ROLES` 不含 designer，验收主责为 Pm/业主 | 数据层已就绪（`designerAcceptancePendingCount` 已按 pending/rejected/accepting 出数）；**需确认后端数据权限对设计师放行提交动作**，否则菜单入口会得到空数据 |
| K2 | surface 分流缺失 | 量房 / 诉求 / 设计三个入口现在会落到同一个客户列表 | 菜单上线前必须先补 surface，否则是**假入口** |
| K3 | 项目页工作台切换缺失 | 三个交付场景「收进项目页」但目前项目页没有任何切换能力 | 与 K2 同批实施 |
| K4 | ~~效率工具组命名待定~~ | 已裁决为「经营与工具」 | 已关闭 |
| K5 | AI 效果图依赖方案上下文 | 无方案时无内容 | 工作区需带方案上下文与空态 |
| K6 | 权限先行 | 上述均为「暴露已有能力」，**不新增角色与权限** | 若确需放开新能力，按权限变更流程单独走 |

---

## 8. 待确认（2 个微决策，不影响主线）

两项均已裁决（2026-10-08）：

- **Q-A｜AI 效果图 → 不占菜单项**（已定）。作为「待我设计 → 设计工作区」内的主动作与独立工作区路由。
- **Q-B｜第 4 组组名 → 「经营与工具」**（已定）。组内：我的业绩 / 报价项目库 / 客户意见投诉。

---

## 9. 实施顺序建议（确认后执行）

1. **收口来源**：注册表补条目 + `navScope` 字段 + 手写配置降级为覆盖表（§6）
2. **修假入口**：`DesignerCustomersView` 补 surface（量房 / 诉求）、`DesignerProjectsView` 补 4 个 surface，并修正业务工作台三张卡片路由
3. **拆设计列表**：`/designer/design` 独立成设计转化列表页
4. **改名与分组**：按 §2 / §3 落地菜单
5. **新建两个页面**：客户意见投诉、AI 效果图工作区（按 §5.1）
6. **回归**：1440/1280/1024/768 无横向溢出、控制台 0 error、菜单项与页面可达性逐条实测

---

## 10. 本次不做

- 不新增/修改业务对象、状态机、角色与权限定义。
- 不修改后端 Provider 逻辑（仅消费已存在的 `project/feedback/*` 与 `design/generation/*`）。
- 不改业务工作台已冻结的卡片口径。
