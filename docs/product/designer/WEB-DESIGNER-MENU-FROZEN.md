# Web 设计师菜单信息架构 · 冻结稿

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
| D4 | 选材 / 增减项 / 验收整改 | **收进项目页**（不占菜单项） |
| D5 | 设计师「待我验收/整改」 | **需要**（覆盖 App 原角色清单不含设计师的差异） |
| D6 | AI 效果图 | **本期纳入**范围 |
| D7 | 客户意见投诉 | **本期纳入**范围 |
| D8 | 报价项目库 / 我的业绩 | **降级到效率工具组**，不与主线场景同级 |

---

## 2. 冻结菜单（4 组 11 项）

```
业务工作台                                  → /designer/workbench

客户经营
  客户与设计                                → /designer/customers
  待我量房                                  → /designer/customers?surface=measure
  客户诉求                                  → /designer/customers?surface=requirement

方案报价
  待我设计                                  → /designer/design
  待我报价                                  → /designer/quotes
  合同签约                                  → /designer/contract

项目交付
  项目工地                                  → /designer/projects
      （页内工作台：项目推进 / 主材选材 / 增减项 / 待我验收·整改）

经营与工具
  我的业绩                                  → /designer/performance
  报价项目库                                → /designer/catalog
  客户意见投诉                              → /designer/feedback
```

**项数核算**：1（工作台）+ 3 + 3 + 1 + 3 = **11 项**，落在 R4「全菜单 ≤12」硬约束内。

**AI 效果图的处理**：AI 效果图是**依赖方案上下文的生成工具**（要先有设计方案才能生成效果图），不具备独立入口语义，因此**不占菜单项**，作为「待我设计 → 设计工作区」内的主动作 + 独立工作区路由 `/designer/design/:designId/render`。若要求必须占菜单项，则本菜单变为 12 项（正好触顶），需明确取舍（见 §8 Q-A）。

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
| — | **待我量房** | 新增（注册表已有 `designer.measure`） |
| — | **待我设计** | 新增（注册表已有 `designer.design`） |
| — | **客户诉求** | 新增 |
| — | **客户意见投诉** | 新增（本期建设） |

---

## 4. 「项目交付」场景下沉规则

菜单只保留 1 项「项目工地」；三个交付场景改为**项目页内的工作台切换**：

| 页内工作台 | 建议路径 | 现状 |
| --- | --- | --- |
| 项目推进 | `/designer/projects?surface=overview` | 已有列表，需加 surface |
| 主材选材 | `/designer/projects?surface=materials` | 工作区已建（`/designer/projects/:id/materials`），缺列表级入口 |
| 增减项 | `/designer/projects?surface=changes` | 工作区已建，缺列表级入口 |
| 待我验收 / 整改 | `/designer/projects?surface=acceptance` | 工作区已建，缺列表级入口 |

**必须同时修掉一个现存缺陷**：业务工作台的三张交付卡片（主材选材 / 增减项 / 验收整改）当前 `route` 全部写成 `/designer/projects`（不带 surface），且 `DesignerProjectsView.vue` 未读取任何 query——即现在**点卡片也不能直达对应工作台**。本次一并修正为上述 surface 路由。

---

## 5. 菜单项实施状态

| 菜单项 | 路由 | 承载页面 | 状态 | 待办 |
| --- | --- | --- | --- | --- |
| 业务工作台 | `/designer/workbench` | `DesignerWorkbenchView` | 已建 | — |
| 客户与设计 | `/designer/customers` | `DesignerCustomersView` | 已建 | — |
| 待我量房 | `/designer/customers?surface=measure` | `DesignerCustomersView` | 页面**不读 surface** | 补 surface 分流 |
| 客户诉求 | `/designer/customers?surface=requirement` | `DesignerCustomersView` | 页面**不读 surface** | 补 surface 分流 |
| 待我设计 | `/designer/design` | 现复用 `DesignerCustomersView` | 语义不符 | 拆出设计列表页 |
| 待我报价 | `/designer/quotes` | `DesignerQuoteListView` | 已建 | 仅改名 |
| 合同签约 | `/designer/contract` | `DesignerContractHandoffView` | 已建 | 仅改名 |
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

1. **注册表 = 唯一事实源**：补入 `designer.catalog`、`designer.performance`、`designer.feedback`、`designer.requirement`、`designer.render` 等缺失条目。
2. **注册表新增导航范围字段**，用来表达「进菜单」与「下沉到项目页」的区别（建议名 `navScope: 'menu' | 'project-surface' | 'hidden'`）：
   - `pm.materialSelection` / `pm.change` / `pm.acceptance` → `project-surface`（设计师侧只在项目页出现，但**对 Pm / Boss / Finance 仍是菜单项**，不能删条目）
   - `designer.measure` / `designer.requirement` → 归入 `customer` 域
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
