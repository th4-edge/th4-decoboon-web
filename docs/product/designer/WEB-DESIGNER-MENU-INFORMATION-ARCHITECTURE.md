# Web 设计师菜单信息架构对齐分析（讨论稿）

> 状态：`DISCUSSION_DRAFT`（未冻结、未进入编码）
> 范围：仅 Web 设计师角色的**侧栏菜单信息架构**；不改业务对象、状态机、权限、金额口径与后端 Provider
> 对照基准：App 端设计师角色（`th4-decoboon-app`）与 Web 已冻结决策 `DEC-034` / `BR-030`
> 事实源：App `src/roles/catalog.ts`、`src/roles/permission.ts`、`src/pages.json`；Web `src/roles/workbenchConfig.ts`、`src/core/router/index.ts`、`docs/standards/workbench-navigation.json`

---

## 0. 结论摘要

先说结论，再展开证据：

1. **当前菜单没有承载设计师的全部业务场景。** 菜单只有 7 项，其中「主材选材 / 增减项 / 验收整改 / 量房 / 客户诉求 / 谈单」在 App 端都有明确入口，但在 Web 侧栏里**不可见**——只能从业务工作台的卡片间接跳，或在页面内翻找。
2. **Web 现在有两套菜单来源，而且互相不一致。** 新壳层 `RoleAreaShell → RoleSideNav` 读 `roles/workbenchConfig.ts` 的显式配置；旧布局 `WorkbenchLayout` 读 `workbench-navigation.json` 注册表派生。两者对设计师给出的菜单**不是同一份**。这正是 `navigation.ts` 注释里警告的「第二套静态菜单」问题，只是方向反过来了：注册表更全，显式配置更窄。
3. **命名不符合已冻结决策。** `DEC-034` / `BR-030` 明确要求导航「一级不超过 7 项、二级是场景工作台（待我量房 / 待我收款…），禁止模块 CRUD 命名」。当前用的是「报价工作台 / 合同交接 / 报价项目库 / 项目工地」这类**模块名**，不是场景名。
4. **层级混乱。** 同层里混了三种东西：域（客户经营）、场景（合同交接）、工具（报价项目库）。设计师看到菜单无法判断「哪个是我今天要推进的事」。

**建议方向**：不增加菜单数量，而是**先统一唯一来源，再按「域 → 场景」两级重排，工具类降级收纳**。本文第 6 节给出规则、第 7 节给出两套候选菜单供裁决。

---

## 1. 当前 Web 设计师菜单（实测）

### 1.1 实际生效的菜单

生效链路：`RoleAreaShell.vue` → `RoleSideNav.vue` → `ROLE_WORKBENCH_CONFIGS.Designer.navGroups`。

| 分组 | 菜单项 | 落地路由 | 命名性质 |
| --- | --- | --- | --- |
| 今日 | 业务工作台 | `/designer/workbench` | 域 |
| 客户经营 | 客户与设计 | `/designer/customers` | 对象（客户+房屋+方案混装） |
| 商务 | 报价工作台 | `/designer/quotes` | 模块 |
| 商务 | 合同交接 | `/designer/contract` | 场景 |
| 商务 | 报价项目库 | `/designer/catalog` | 工具 |
| 项目工地 | 项目工地 | `/designer/projects` | 域 |
| 经营 | 我的业绩 | `/designer/performance` | 分析 |

合计：**5 个分组 / 7 个菜单项**。

### 1.2 已建好但不在菜单里的页面

Web 路由里已经有、但侧栏**没有任何入口**的页面：

| 路由 | 页面 | 现在怎么进去 |
| --- | --- | --- |
| `/designer/design` | 设计与方案 | 无入口（与客户页同组件，靠 query 切） |
| `/designer/design/:designId` | 设计工作区 | 只能从工作台卡片跳 |
| `/designer/quotes/:quoteId` | 报价工作区 | 只能从报价列表点进 |
| `/designer/projects/:projectId/materials` | 主材选材工作区 | **只能从业务工作台卡片跳** |
| `/designer/projects/:projectId/changes` | 增减项工作区 | **只能从业务工作台卡片跳** |
| `/designer/projects/:projectId/acceptance` | 阶段验收工作区 | **只能从业务工作台卡片跳** |
| `/messages` | 消息通知 | 顶栏铃铛（不进菜单，合理） |

> 关键点：**选材、增减项、验收整改这三个高频交付场景，在菜单里是完全隐形的**。用户只有先回业务工作台看卡片才能进去，一旦人已经在「项目工地」页里，就没有横向入口。

### 1.3 第二套来源：注册表（比显式配置更全）

`docs/standards/workbench-navigation.json` 里 `roles` 含 `Designer` 的条目共 **11** 条：

| key | label | 分组 | 优先级 | Web 显式菜单里有没有 |
| --- | --- | --- | --- | --- |
| `today.mainline` | 业务工作台 | today | P0 | ✅ |
| `customer.followup` | 客户跟进 | customer | P0 | ✅（改名「客户与设计」） |
| `designer.measure` | 待我量房 | designQuote | P0 | ❌ |
| `designer.design` | 待我设计 | designQuote | P0 | ❌ |
| `designer.quote` | 待我报价 | designQuote | P0 | ✅（改名「报价工作台」） |
| `designer.contract` | 合同交接 | designQuote | P0 | ✅ |
| `pm.project` | 项目推进 | project | P0 | ✅（改名「项目工地」） |
| `pm.materialSelection` | 待我选材 | project | P0 | ❌ |
| `pm.change` | 待我处理增减项 | project | P0 | ❌ |
| `pm.acceptance` | 待我验收/整改 | project | P0 | ❌ |
| `more.search` | 全局搜索 | more | P1 | ❌ |

反过来，显式配置里有 **2 项注册表没有**：`designer.catalog`（报价项目库）、`designer.performance`（我的业绩）。

**两个来源的差集就是当前菜单问题的根：注册表有 5 个设计师场景没进菜单，显式配置有 2 个工具/分析项不在注册表。**

---

## 2. App 端设计师功能全清单（基准）

### 2.1 底部 Tab（`ROLE_TABS.designer`）

`工作台 · 设计 · 报价 · 项目 · 我的`

### 2.2 首页快捷入口（`ROLE_ACTIONS.designer`，按代码顺序）

1. 待我设计
2. 待我报价
3. 合同签约
4. 客户诉求
5. 我的客户
6. 报价池
7. 设计业绩
8. 消息通知

> 代码里还留了一条历史结论：「设计师高频动作排序：先阶段待办，再对象和工具；不新增业务动作」。

### 2.3 我的页「经营工具」（按角色开放）

报价项目库（只读）· 主材选材跟进 · 客户意见投诉 · 消息通知 / 使用帮助 / 联系客服

### 2.4 页面级能力（`INTERNAL_MATRIX.designer` 权限 + 子包页面）

| 业务域 | App 页面 | 设计师能力 |
| --- | --- | --- |
| 客户 | `customer/list · detail · portrait-edit · tag-manage · flow · follow · measure-workbench · measure · measure-record · property-edit · wechat-record` | `view:customers`、`act:followCustomer`、`act:convertCustomer`、`act:recordWechat`、`act:recordVisit`、`act:scheduleMeasure` |
| 设计 | `design/list（设计转化）· requirements（客户诉求）· scheme（设计方案）· ai-generation（AI 效果图）· talk（谈单 PPT）· workbench` | `view:design`、`edit:design`、`act:talk` |
| 报价 | `quote/list（方案报价）· detail · edit · adjust · quote-confirm · package-manage · catalog/manage · catalog/import · workbench` | `view:quote`、`view:catalog`（只读）、`edit:quote`、`act:quote` |
| 合同 | `project/sign-workbench · contract` | `view:contract`、`act:contractPrepare`（**只发起/登记，不确认生效**） |
| 项目 | `project/list · detail · plan · members · album · selection · selection-board · journey · change* · accept/edit · material-plan*` | `view:myProjects`、`edit:project`、`edit:plan`、`act:report` |
| 选材 | `project/selection · selection-item · selection-board` | 选材跟进（角色清单放行） |
| 增减项 | `project/change · change-workbench · change-create · change-detail` | `view:contract` + 项目域 |
| 验收整改 | `project/accept/edit · rectify-board` | 「整改跟进」**不含设计师**（`RECTIFY_FOLLOW_ROLES` 无 designer），阶段验收由 Pm/业主主责 |
| 业绩 | `statistic/performance（我的业绩）` | `view:performance`、`view:commission` |
| 消息 | `message/list` | `view:notice` |
| 意见投诉 | `project/feedback-list · feedback-edit` | `act:issue` |

> 注意：App 里 **AI 效果图 / 谈单 PPT / 套餐模板** 属于设计域与报价域页面。其中 **套餐模板是 BOSS 专属**（`role === 'boss'`），设计师无此入口——Web 不需要为设计师补。

---

## 3. 覆盖度对照（App → Web）

图例：✅ 菜单直达 ｜ 🟡 需经卡片/页面内跳转 ｜ ❌ 完全缺失

| # | 设计师业务场景 | App 入口 | App 权限 | Web 现有落点 | Web 菜单可达 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 业务总览 | Tab 工作台 | — | `/designer/workbench` | ✅ | 达标 |
| 2 | 我的客户 | 首页「我的客户」 | `view:customers` | `/designer/customers` | ✅ | 达标 |
| 3 | 客户跟进/微信/到访 | 客户详情 | `act:followCustomer` 等 | 客户页内 | 🟡 | 可接受（对象页内） |
| 4 | 量房排期与登记 | `measure-workbench · measure` | `act:scheduleMeasure` | 客户页 `surface=measure` | 🟡 | **场景无独立入口** |
| 5 | 客户诉求 | 首页「客户诉求」 | `edit:design` | 客户页内 | 🟡 | **场景无独立入口** |
| 6 | 设计方案 | 设计 Tab | `view:design/edit:design` | `/designer/design/:id` | 🟡 | **列表入口缺失** |
| 7 | 谈单 PPT | `design/talk` | `act:talk` | 设计工作区内 | 🟡 | 可接受 |
| 8 | AI 效果图 | `design/ai-generation` | `edit:design` | 无 | ❌ | **Web 未建设** |
| 9 | 报价工作台 | 首页「待我报价」 | `view:quote/edit:quote` | `/designer/quotes` | ✅ | 达标（命名待改） |
| 10 | 报价池/历史版本 | 首页「报价池」 | `view:quote` | 报价页内筛选 | 🟡 | 可接受 |
| 11 | 报价项目库 | 我的页经营工具 | `view:catalog`（只读） | `/designer/catalog` | ✅ | 达标 |
| 12 | 合同发起/登记 | 首页「合同签约」 | `act:contractPrepare` | `/designer/contract` | ✅ | 达标（命名待改） |
| 13 | 项目推进 | Tab 项目 | `view:myProjects` | `/designer/projects` | ✅ | 达标（命名待改） |
| 14 | 主材选材 | 我的页「主材选材跟进」 | 角色放行 | `/designer/projects/:id/materials` | 🟡 | **场景无独立入口** |
| 15 | 增减项 | 项目域 | `view:contract` | `/designer/projects/:id/changes` | 🟡 | **场景无独立入口** |
| 16 | 阶段验收/整改 | 项目域 | 非设计师主责 | `/designer/projects/:id/acceptance` | 🟡 | **场景无独立入口** |
| 17 | 我的业绩 | 首页「设计业绩」 | `view:performance` | `/designer/performance` | ✅ | 达标 |
| 18 | 消息通知 | 首页「消息通知」 | `view:notice` | `/messages` | ✅（顶栏） | 达标 |
| 19 | 意见投诉 | 我的页「客户意见投诉」 | `act:issue` | 无 | ❌ | **Web 未建设** |
| 20 | 全局搜索 | — | — | 顶栏搜索 | ✅（顶栏） | 达标 |

**覆盖统计**：20 个场景中，**菜单直达 9 项（45%）**，**需要二次跳转 9 项（45%）**，**完全缺失 2 项（10%）**。

补充事实：三个项目交付场景的卡片路由都指向 `/designer/projects`（无 `surface` 参数），且 `DesignerProjectsView.vue` 未读取任何 query —— 即目前**连「点卡片直达对应工作台」也没做到**。

---

## 4. 问题诊断（按严重度）

### P0-1 两套菜单来源，且不一致
- `RoleAreaShell` 走 `workbenchConfig.ts`（手写），`WorkbenchLayout` 走 `workbench-navigation.json`（注册表）。
- 注册表里 `designer.measure / designer.design / pm.materialSelection / pm.change / pm.acceptance` 5 项**在生效菜单里看不到**；`designer.catalog / designer.performance` 只在手写配置里。
- 后果：任何一处改动都不会同步，菜单会持续漂移；这也是「页面已建好、菜单里没有」反复出现的结构性原因。

### P0-2 交付场景在菜单中隐形
- **主材选材 / 增减项 / 验收整改** 是设计师在项目阶段的高频场景，现在只能从业务工作台卡片进。
- 用户在「项目工地」页处理完一个工地后，想切到「选材」必须回首页。

### P1-1 命名违反已冻结决策（DEC-034 / BR-030）
- 决策要求二级用「场景工作台」命名（待我量房 / 待我收款 / 待我选材）。
- 现状是模块名：「报价工作台」「合同交接」「报价项目库」「项目工地」。
- 后果：菜单回答的是「系统有哪些模块」，而不是「我今天要推进什么」。

### P1-2 层级混装
- 「客户经营」（域）、「合同交接」（场景）、「报价项目库」（工具）并列在侧栏同级，语义不齐。
- 工具类（项目库）和分析类（业绩）占用与场景同等的视觉权重，稀释主线。

### P2-1 一级分组语义偏工程
- 当前分组名（今日 / 客户经营 / 商务 / 项目工地 / 经营）里，「商务」「今日」偏抽象；设计师的第一动作是「量房 → 设计 → 报价 → 合同」这条主链，菜单没有把主链表达出来。

### P2-2 与业务工作台的六个阶段不对齐
- 业务工作台的主链是「量房 → 设计 → 报价 → 合同」，卡片分「客户经营」「项目工地」两组。
- 菜单没有沿用这套分组，导致「工作台看到的」和「菜单里点的」是两套心智模型。

---

## 5. 菜单设计思路（建议规则）

先定规则，再排菜单。以下 8 条建议冻结为设计师（并推广到全角色）的菜单规则：

| 规则 | 内容 | 理由 |
| --- | --- | --- |
| R1 唯一来源 | 菜单**只能**来自 `workbench-navigation.json` 注册表，手写配置仅允许覆盖「显示名」和「排序」，不得增删项 | 消除双来源漂移 |
| R2 两级结构 | 一级 = 业务域（≤5 组），二级 = 场景工作台 | 先域后场景，符合心智 |
| R3 场景命名 | 二级一律「待我 X / X 工作台」等业务语言，禁止「XX管理 / XX模块 / XX库」 | 对齐 DEC-034 / BR-030 |
| R4 数量约束 | 一级 ≤5 组；每组二级 ≤4 项；**全菜单可见项 ≤12** | 「菜单不能太多」 |
| R5 对象不进菜单 | 客户详情、房屋、报价单、项目详情等**对象实例**一律不进菜单，只在列表页内 | 菜单承载场景，不承载数据 |
| R6 工具降级 | 项目库、模板、报表等工具/分析类进「效率工具」或页面内入口，不与主线场景同级 | 保护主线权重 |
| R7 待办优先 | 「待我 X」只有在**存在对象队列**时才出现；纯目录页用域名 | 避免空壳入口 |
| R8 与工作台同源 | 菜单分组必须等于业务工作台的卡片分组（客户经营 / 项目工地 + 商务） | 工作台与菜单同一套心智 |

> 关于 R4 的取舍：**「全菜单 ≤12 项」是硬约束，覆盖度靠「场景下沉到对象页」而不是「堆菜单项」解决。**

---

## 6. 候选菜单

### 方案 A（推荐）：域 + 主链场景，5 组 11 项

```
业务工作台                      → /designer/workbench

客户经营
  客户与设计                    → /designer/customers
  待我量房                      → /designer/customers?surface=measure
  客户诉求                      → /designer/customers?surface=requirement

方案报价
  待我设计                      → /designer/design
  待我报价                      → /designer/quotes
  合同签约                      → /designer/contract

项目交付
  项目工地                      → /designer/projects
  主材选材                      → /designer/projects?surface=materials
  增减项                        → /designer/projects?surface=changes
  验收/整改                     → /designer/projects?surface=acceptance

经营与工具
  我的业绩                      → /designer/performance
  报价项目库                    → /designer/catalog
```

- 优点：完整覆盖 App 的 12 个核心场景；命名全部业务化；与工作台主链（客户经营 / 项目工地）对齐。
- 代价：11–12 项，接近上限；「项目交付」组 4 项。
- 关键前置：**选材/增减项/验收需要项目列表页支持 `surface` 参数**，不然会落到项目列表而非对应工作台。

### 方案 B（更精简）：4 组 8 项 + 场景下沉

```
业务工作台                      → /designer/workbench

我的主线
  待我量房                      → /designer/customers?surface=measure
  待我设计                      → /designer/design
  待我报价                      → /designer/quotes

对象与交付
  客户与设计                    → /designer/customers
  项目工地                      → /designer/projects
  合同签约                      → /designer/contract

效率工具
  我的业绩                      → /designer/performance
  报价项目库                    → /designer/catalog
```

- 做法：**主材选材 / 增减项 / 验收整改不再单独占菜单**，改为「项目工地」页内的**工作台切换（Segmented）**，与 App 的 project detail 内部 Tab 一致。
- 优点：菜单只有 8 项，主线极清晰；与「菜单不能太多」最贴合。
- 代价：三个交付场景的入口深度 +1 层；用户必须先选项目再切工作台。

### 方案对比

| 维度 | A | B |
| --- | --- | --- |
| 菜单项数 | 11 | 8 |
| 主线清晰度 | 中高 | 高 |
| 交付场景可达性 | 高（一级直达） | 中（需先进项目） |
| 与 App 一致性 | 高 | 中高 |
| 实施成本 | 需列表页支持 surface | 需项目页支持工作台切换 |

**个人建议**：**先做 A 的命名与分组（成本低、立即补全覆盖），把「是否进一步收敛到 B」作为第二次裁决**。理由是当前问题是「覆盖不全 + 命名不对」，A 能一次解决；B 的进一步收敛需要项目页改造，建议单独评估。

---

## 7. 待裁决问题（请逐条给结论）

| # | 问题 | 选项 |
| --- | --- | --- |
| Q1 | 是否确认「菜单唯一来源 = 注册表」，删掉手写菜单项（保留显示名/排序覆盖）？ | 是 / 否 |
| Q2 | 选材 / 增减项 / 验收整改：进菜单（方案 A）还是收进项目页工作台切换（方案 B）？ | A / B |
| Q3 | 命名是否统一改为场景语言（待我量房 / 待我设计 / 待我报价 / 合同签约）？ | 是 / 否 |
| Q4 | 「报价项目库」「我的业绩」是否降级到「效率工具」组？ | 是 / 否 |
| Q5 | 一级分组是否统一为「客户经营 / 方案报价 / 项目交付 / 经营与工具」四类？ | 是 / 否 |
| Q6 | AI 效果图、客户意见投诉这两项 Web 尚未建设，本期是否纳入范围？ | 纳入 / 暂缓 |
| Q7 | 设计师是否需要「待我验收/整改」？（App 的整改跟进角色清单**不含**设计师，验收主责为 Pm/业主） | 需要 / 不需要 |

---

## 8. 本次不做的事

- 不新增或修改业务对象、状态机、动作、角色、权限。
- 不修改后端 Provider、数据库或迁移。
- 不改动业务工作台已冻结的结构与卡片口径。
- 在 Q1–Q7 未裁决前，不进入菜单编码。
