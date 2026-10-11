# WEB 工作台契约条款（原 `workbench-navigation.json` 的条款化归档）

> **状态：归档条款（人读），已不代表机器契约。**
>
> 2026-10-11 用户裁决（`WEB-PENDING-DECISIONS` / `WEB-前端架构方向-按角色静态化.md`）：
> Web 前端重构**不再需要逻辑注册表**，每个角色沉淀**静态路由 + 静态菜单**，不参与任何运行时判断。
> 因此 `docs/standards/workbench-navigation.json` **已删除**，机器的导航契约改由三份静态源承担：
>
> | 静态源 | 承担什么 | 门禁 |
> | --- | --- | --- |
> | `src/roles/routes.ts` | 每个角色可到达的**路由集合** | `npm run check:workspaces` |
> | `src/roles/workbenchConfig.ts` | 每个角色的**左侧导航** | `npm run check:workbenches` |
> | `src/roles/workbenchHome.ts` | 每个角色的**首页场景卡片**（含场景/锚点/主行动/交接） | `npm run check:workbenches` |
>
> 本文件保留注册表里**没有其他归宿的业务条款**（入站状态、上下文恢复、未保存保护、刷新范围、
> 状态→主行动、空态/异常态、交接对象、业务依据等），供页面实现与验收**人工对照**。
> 归档来源：`docs/standards/workbench-navigation.json` v1（updated 2026-10-11）。
>
> ⚠️ 机器门禁**不再读本文件**。在本文件里改条款不会改变任何门禁结果；
> 要改「排序/入口/落地页」请改上表的三份静态源，要改「业务条款」请走业务裁决并同步本文件。

## 0. 通用条款（原 `registry.workbenches[*]` 的公共约定）

1. **命名**：一级/二级一律**场景语言**，禁止模块 CRUD 命名（如「XX管理」）——违反 `DEC-034` / `BR-030`。
2. **对象优先**：工作台面向**业务对象**（客户/房屋/项目/报价/合同/单据），不面向数据表。
3. **上下文恢复**：进入对象工作面后必须能按深链接恢复（`contextRecovery.deepLink/preserveFilters/preserveScroll/returnToSource` 恒为 `true`）。
4. **未保存保护**：`unsavedChangesGuard=false` 时必须写明理由（`unsavedChangesReason`），否则视为缺陷。
5. **刷新范围**：写成功后按 `reloadScopes` **回读服务端投影**，不得用写响应直接覆盖页面。
6. **不留死链**：入口的落地页必须在本角色静态路由集合内可达；不可达就不展示入口（`EXP-013` / `EXP-022`）。
7. **不伪造数据**：`decisionStatus !== approved` 的场景只展示说明与「待业务确认」，不给入口按钮。

## 1. 一级领域（domains）

| key | 名称 | order |
| --- | --- | --- |
| `today` | 业务工作台 | 0 |
| `customer` | 客户经营 | 1 |
| `project` | 项目工地 | 2 |
| `finance` | 商务财务 | 3 |
| `operation` | 经营分析 | 4 |
| `more` | 更多 | 6 |
| `tools` | 经营与工具 | 5 |

> 注：`domains` 只用于**旧首页卡片的「域 · 组」标签**。该标签现已随卡片固化进 `src/roles/workbenchHome.ts`，
> 领域的结构性约束（≤7 项、必须有 today/customer/project/finance/operation/more）随之退役——
> 导航结构改由**每角色静态菜单**直接表达，不再经过「领域 → 分组 → 工作台」三层推导。

## 2. 二级分组（groups）

| key | 名称 | 所属领域 | order |
| --- | --- | --- | --- |
| `today` | 业务工作台 | 业务工作台 | 0 |
| `customer` | 客户经营 | 客户经营 | 1 |
| `designQuote` | 设计报价 | 客户经营 | 2 |
| `project` | 项目工地 | 项目工地 | 3 |
| `finance` | 商务财务 | 商务财务 | 4 |
| `risk` | 经营风险 | 经营分析 | 5 |
| `more` | 更多 | 更多 | 6 |
| `tools` | 经营与工具 | 经营与工具 | 0 |

## 3. 逐工作台条款（27 项）

### 3.1 `today.mainline` — 业务工作台

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 业务工作台（`today`）· 业务工作台（`today`） |
| 角色 roles（旧注册表口径，已退役） | Boss / StoreManager / TeamLeader / Marketer / Designer / Pm / Finance |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench` |

- **进入场景**：员工登录后查看当前需要处理、风险、超期和上游交接
- **对象锚点**：role queue + selected object
- **主线**：按角色汇总客户、设计报价、项目、财务和经营风险
- **当前工作面**：按角色汇总待办、风险、超期和上游交接
- **主行动**：按分类处理当前事项
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：workbenchQueue / customerId / activePropertyId / projectId / financeObjectType / financeObjectId
- **完成后交接**：进入对应角色工作台或对象工作空间（→ customer.followup / designer.measure / designer.design / designer.quote / designer.contract / pm.project / pm.materialSelection / pm.change / pm.acceptance / finance.receivable / finance.payable / finance.ledger / boss.risk）
- **空态**：当前没有需要我处理的事项
- **异常态**：部分数据暂不可确认时保留恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（业务工作台为聚合入口，不直接承载未保存表单）
- **刷新范围**：customer / property / design / quote / contract / project / receivable / payable
- **业务依据**：DEC-034 / BR-030 / DEC-033 / BR-029
- **备注**：默认落地页。只做分类队列、对象入口和完成后交接；每项进入对象工作面后只消费服务端 allowedActions。

### 3.2 `customer.followup` — 客户跟进

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 客户经营（`customer`）· 客户经营（`customer`） |
| 角色 roles（旧注册表口径，已退役） | Marketer / Designer / StoreManager / TeamLeader / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/customers?activeCustomerId={customerId}&activePropertyId={propertyId}` |

- **进入场景**：客户需要跟进、建档或邀约量房
- **对象锚点**：customer + activeProperty
- **主线**：客户 -> 房屋 -> 量房 -> 设计 -> 报价 -> 合同 -> 项目
- **当前工作面**：客户 360、跟进、房屋、阶段轨道、时间线
- **主行动**：执行当前状态唯一跟进动作
- **动作策略键**：follow/save / measure
- **入站状态**：`customer`（intention / following / pendingMeasure）
- **上下文键**：customerId / activePropertyId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `customer.intention` → 写跟进｜动作 `follow/save`｜裁决 pending_business_review｜可作主行动 否
  - `customer.following` → 写跟进｜动作 `follow/save`｜裁决 pending_business_review｜可作主行动 否
  - `customer.pendingMeasure` → 安排量房｜动作 `measure`｜裁决 pending_business_review｜可作主行动 否
- **完成后交接**：量房完成后进入量房/设计工作台（→ designer.measure / designer.design）
- **空态**：当前没有需要我跟进的客户
- **异常态**：客户未分配、房屋未建档或规则未命中时显示待补充/待业务确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：customer / property / design
- **业务依据**：DEC-034 / BR-030 / BR-005 / SCN-001
- **备注**：客户是共同对象锚点；多房屋必须显式选择 activeProperty。未冻结动作只能显示待业务确认，不得成为可执行主行动。

### 3.3 `designer.followup` — 待我跟进

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 客户经营（`customer`）· 客户经营（`customer`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/followup?activeCustomerId={customerId}&activePropertyId={propertyId}` |

- **进入场景**：预约量房前客户存在逾期、今日、3 天内或未安排的下次跟进，需要当前设计师处理
- **对象锚点**：customer + activeProperty
- **主线**：客户 -> 房屋 -> 量房 -> 设计 -> 报价 -> 合同 -> 项目
- **当前工作面**：客户事实、房屋、最近跟进、唯一主行动与完成回读
- **主行动**：写跟进并根据结果安排下一次跟进或转入量房
- **动作策略键**：follow/save / customer/basic-update / customer/wechat / customer/visit / customer/dormant / customer/resume / measure
- **入站状态**：`customer`（intention / following）
- **上下文键**：customerId / activePropertyId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `customer.intention` → 写跟进｜动作 `follow/save`｜裁决 approved｜可作主行动 是
  - `customer.following` → 写跟进｜动作 `follow/save`｜裁决 approved｜可作主行动 是
- **完成后交接**：跟进后按真实结果进入量房工作台或继续客户经营（→ designer.measure / designer.design）
- **空态**：当前没有需要我跟进的客户
- **异常态**：客户不可见、跟进事实读取失败或规则未命中时显示待补充/暂不可确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：customer / customerFollow / property / notice / workbenchQueue
- **业务依据**：DEC-034 / BR-030 / BR-005 / SCN-014
- **备注**：客户是队列锚点，activeProperty 仅在有房屋时显式选择；待跟进口径只纳入 New/Following，Dormant 排除，状态和下一动作仍由服务端返回。

### 3.4 `designer.measure` — 待我量房

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 客户经营（`customer`）· 设计报价（`designQuote`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Marketer / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/measure?activeCustomerId={customerId}&activePropertyId={propertyId}` |

- **进入场景**：房屋待量房或量房中，需要当前责任人推进
- **对象锚点**：customer + activeProperty
- **主线**：客户 -> 房屋 -> 量房 -> 设计 -> 报价 -> 合同 -> 项目
- **当前工作面**：量房安排、量房结果、量房记录
- **主行动**：执行当前状态唯一量房动作
- **动作策略键**：measure / measure/save
- **入站状态**：`property`（pendingMeasure / measuring）
- **上下文键**：customerId / activePropertyId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `property.pendingMeasure` → 安排量房｜动作 `measure`｜裁决 pending_business_review｜可作主行动 否
  - `property.measuring` → 登记量房结论｜动作 `measure/save`｜裁决 pending_business_review｜可作主行动 否
- **完成后交接**：量房完成后进入设计工作台（→ designer.design）
- **空态**：当前没有待我处理的量房
- **异常态**：未选房屋、规则未命中或量房数据不可确认时显示待补充/待业务确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：property / customer / design
- **业务依据**：DEC-034 / BR-030 / BR-005 / SCN-001
- **备注**：量房工作台是站台，不是量房记录表；未选房屋不得默认第一条。

### 3.5 `designer.design` — 待我设计

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 客户经营（`customer`）· 设计报价（`designQuote`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/design/{designId}?activeCustomerId={customerId}&activePropertyId={propertyId}` |

- **进入场景**：设计需求存在，方案待推进或待完成
- **对象锚点**：customer + activeProperty + design
- **主线**：客户 -> 房屋 -> 量房 -> 设计 -> 报价 -> 合同 -> 项目
- **当前工作面**：设计诉求、方案、版本、设计事实
- **主行动**：执行当前状态唯一设计动作
- **动作策略键**：design/scheme/save / design/scheme/build
- **入站状态**：`design`（draft / ready / presented）
- **上下文键**：customerId / activePropertyId / designId / designVersion
- **完成后交接**：方案达到可报价条件后进入报价工作台（→ designer.quote）
- **空态**：当前没有待我设计的房屋
- **异常态**：无量房、无诉求或方案规则未命中时显示待补充/待业务确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：design / property / customer / quote
- **业务依据**：DEC-034 / BR-030 / BR-005 / SCN-002
- **备注**：设计工作台只进入设计工作面；未冻结设计动作不得成为可执行主行动。

### 3.6 `designer.quote` — 待我谈单

| 项 | 值 |
| --- | --- |
| 类型 kind | `workspace` |
| 领域 · 分组 | 客户经营（`customer`）· 设计报价（`designQuote`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Boss / StoreManager |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/quotes/{quoteId}?activeCustomerId={customerId}&activePropertyId={propertyId}&version={version}` |

- **进入场景**：报价草稿、待客户决策或驳回改版需要当前角色处理
- **对象锚点**：customer + activeProperty + quote
- **主线**：客户 -> 房屋 -> 设计 -> 报价 -> 合同 -> 项目
- **当前工作面**：报价明细、版本、金额、客户反馈
- **主行动**：执行当前状态唯一报价动作
- **动作策略键**：quote/save / quote/lines/save / quote/submit
- **入站状态**：`quote`（draft / submitted / rejected）
- **上下文键**：customerId / activePropertyId / quoteId / quoteVersion / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `quote.draft` → 继续编辑并提交｜动作 `quote/submit`｜裁决 pending_business_review｜可作主行动 否
  - `quote.submitted` → 等待客户决策｜动作 `—`｜裁决 pending_business_review｜可作主行动 否
  - `quote.rejected` → 修订后重报｜动作 `quote/submit`｜裁决 pending_business_review｜可作主行动 否
- **完成后交接**：客户接受后进入合同工作台（→ designer.contract）
- **空态**：当前没有待我处理的报价
- **异常态**：版本冲突、金额规则未命中或客户反馈缺失时显示暂不可确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：quote / design / contract / project
- **业务依据**：DEC-034 / BR-030 / BR-005 / SCN-002
- **备注**：报价工作区必须保留客户、房屋、报价版本和返回上下文；未冻结报价动作只能显示待业务确认。

### 3.7 `designer.contract` — 待我签约

| 项 | 值 |
| --- | --- |
| 类型 kind | `workspace` |
| 领域 · 分组 | 客户经营（`customer`）· 设计报价（`designQuote`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Boss / StoreManager |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/contract?customerId={customerId}&quoteId={quoteId}&contractId={contractId}` |

- **进入场景**：合同待签约、已签约未生效或需要交接
- **对象锚点**：customer + quote + contract
- **主线**：报价 -> 合同 -> 签约 -> 生效 -> 项目
- **当前工作面**：合同交接、签约、生效前置
- **主行动**：执行当前状态唯一合同交接动作
- **动作策略键**：project/contract/save / project/contract/*
- **入站状态**：`contract`（pendingSign / signed）
- **上下文键**：customerId / activePropertyId / quoteId / contractId / returnWorkbench / returnScroll
- **完成后交接**：合同生效后进入项目工作台（→ pm.project）
- **空态**：当前没有待交接合同
- **异常态**：Signed 未 Effective 时不得创建项目；规则未命中显示待业务确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：contract / quote / project / receivable / customer
- **业务依据**：DEC-034 / BR-030 / SCN-002
- **备注**：合同工作台必须区分 Signed 与 Effective；未冻结合同动作不得成为可执行主行动。

### 3.8 `pm.project` — 项目推进

| 项 | 值 |
| --- | --- |
| 类型 kind | `object` |
| 领域 · 分组 | 项目工地（`project`）· 项目工地（`project`） |
| 角色 roles（旧注册表口径，已退役） | Pm / Boss / StoreManager / Designer |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/pm/workbench` |

- **进入场景**：项目准备、进行、暂停或验收阶段需要当前角色推进
- **对象锚点**：project + projectStage
- **主线**：项目 -> 阶段 -> 任务 -> 材料/变更/验收/财务
- **当前工作面**：项目事实、任务、阶段、风险
- **主行动**：推进当前阶段/任务
- **动作策略键**：project/task/* / project/stage/* / project/project/update
- **入站状态**：`project`（preparing / ongoing / suspended / accepting）
- **上下文键**：activeProjectId / activeStageId / status / keyword
- **状态 → 主行动**：
  - `project.preparing` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
  - `project.ongoing` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
  - `project.suspended` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
  - `project.accepting` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
  - `project.finished` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
  - `project.settled` → 按服务端状态视图显示当前项目推进点；Pm 由本人负责或项目参与关系确定范围｜动作 `—`｜裁决 approved｜可作主行动 否
- **完成后交接**：进入选材、增减项、验收或财务工作面（→ pm.materialSelection / pm.change / pm.acceptance / finance.receivable / finance.payable）
- **空态**：当前没有待我推进的项目
- **异常态**：项目阶段未映射或任务数据不可确认时显示待业务确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：project / projectStage / projectTask / contractChange / acceptance / receivable / payable
- **业务依据**：DEC-034 / BR-030 / SCN-003 / SCN-004
- **备注**：项目阶段名称和状态必须读取 ProjectStage，不写死固定阶段；Pm 的项目工作面在 /pm/workbench（项目队列 + 当前项目工作面），阶段/任务/验收动作以服务端 nextAction 与动作策略为准；不得使用设计师项目页面 /designer/projects 作为 Pm 入口。

### 3.9 `pm.materialSelection` — 主材选材

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 项目工地（`project`）· 项目工地（`project`） |
| 角色 roles（旧注册表口径，已退役） | Designer / StoreManager / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/material-selection?projectId={projectId}` |

- **进入场景**：签约后客户已确认主材选择，需由设计师逐项代录并交付财务下单；已进入采购的换材改走增减项
- **对象锚点**：project + contractLine + materialSelection + materialPlan
- **主线**：项目 -> 主材选材 -> 交付财务 -> 采购 -> 到场
- **当前工作面**：待选材项目队列、选材进度、合同主材分项、材料计划锁定状态
- **主行动**：逐项现场代录选材并保存交付财务下单
- **动作策略键**：material/selection/save
- **入站状态**：`project`（ongoing / accepting）
- **上下文键**：projectId / propertyId / contractId / contractLineId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `materialSelection.notStarted` → 开始逐项主材选材｜动作 `material/selection/save`｜裁决 pending_business_review｜可作主行动 否
  - `materialSelection.selected` → 交付财务下单｜动作 `material/selection/save`｜裁决 approved｜可作主行动 是
- **完成后交接**：交付后由财务决定供应商、价格和数量；已进入采购的换材走增减项（→ finance.payable / pm.change / pm.project）
- **空态**：当前数据范围内没有尚未完成选材的在跑项目
- **异常态**：合同未配置主材分项、材料已进入采购、分项暂不可确认或规则未命中时显示阻断原因和恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：materialSelection / materialPlan / contractLine / project / workbenchQueue / notice
- **业务依据**：DEC-034 / BR-030 / DEC-056 / DEC-035 / BR-004 / BR-009 / SCN-006
- **备注**：角色范围按用户 2026-10-11 裁决：**设计师 / 店长 / 企业负责人**；Pm 与 Finance 不在范围内。「逐项现场代录选材」为设计师主行动；店长与负责人按门店/企业范围查看与处理。后端 `project/service/materialplans/update` 的角色范围需同步为同一集合（当前为 Boss/Pm/Finance，见后端交付项）。

### 3.10 `pm.change` — 增减项

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 项目工地（`project`）· 项目工地（`project`） |
| 角色 roles（旧注册表口径，已退役） | Pm / Designer / Boss / StoreManager |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/contract-changes?projectId={projectId}` |

- **进入场景**：客户已完成线下确认并形成增减项变更单后，设计师/授权角色查看项目工地中的已有变更单并进入详情推进
- **对象锚点**：project + contract + contractChange + contractChangeItem
- **主线**：项目 -> 客户线下确认 -> 增减项单 -> BOSS/财务审批 -> 履约重算
- **当前工作面**：项目工地、项目 Hero、已有变更单列表、审批状态和生效影响
- **主行动**：查看项目已有增减项并进入变更单详情
- **动作策略键**：project/contract-change/batch-save / project/contract-change/update / project/contract-change/cancel
- **入站状态**：`contractChange`（pending）
- **上下文键**：projectId / contractId / changeId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `contractChange.pending` → 查看变更单详情｜动作 `project/contract-change/update`｜裁决 approved｜可作主行动 是
  - `contractChange.customerConfirmed` → 查看生效结果｜动作 `project/contract-change/update`｜裁决 approved｜可作主行动 否
- **完成后交接**：点击变更单进入详情；新增增减项从项目工地对应项目发起（→ pm.project / finance.receivable / finance.payable）
- **空态**：当前项目暂无增减项
- **异常态**：无生效合同、来源剩余不可确认、客户确认证据缺失或并发冲突时显示阻断原因和恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：contractChange / contract / project / projectTask / materialPlan / receivable / cost / workbenchQueue / notice
- **业务依据**：DEC-034 / BR-030 / DEC-041 / DEC-055 / BR-035 / BR-041 / SCN-004
- **备注**：菜单页只查看已有变更单；新增入口在项目工地。审批仅 Boss/Finance，审批通过即生效。

### 3.11 `pm.acceptance` — 整改跟进

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 项目工地（`project`）· 项目工地（`project`） |
| 角色 roles（旧注册表口径，已退役） | Pm / Designer / Boss / StoreManager / Finance |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/rectification?projectId={projectId}&stageId={stageId}` |

- **进入场景**：阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验
- **对象锚点**：project + projectStage + acceptance + acceptanceRound
- **主线**：项目 -> 阶段验收驳回 -> 整改 -> 同一验收单复验 -> 业主确认
- **当前工作面**：整改中项目、阶段、轮次、问题、整改责任人、整改截止与逾期天数
- **主行动**：查看整改中阶段并进入阶段验收工作区提交复验
- **动作策略键**：project/acceptance/save
- **入站状态**：`acceptance`（rejected）
- **上下文键**：projectId / stageId / acceptanceId / roundId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `acceptance.rejected` → 进入阶段验收工作区提交复验｜动作 `project/acceptance/save`｜裁决 approved｜可作主行动 是
- **完成后交接**：提交复验后由业主本人确认或再次驳回；员工不得代业主确认（→ pm.project / finance.receivable）
- **空态**：当前没有整改中的阶段
- **异常态**：项目不可见、轮次不可确认、责任人或截止日期缺失时显示阻断原因和恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：acceptance / projectStage / projectTask / project
- **业务依据**：DEC-034 / BR-030 / BR-008 / SCN-010 / DEC-044
- **备注**：整改复用同一阶段、同一张验收单和不限次数轮次；菜单页只跟进，复验证据在同一阶段验收工作区提交。

### 3.12 `finance.receivable` — 待我收款

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/receivables?projectId={projectId}&receivableId={receivableId}` |

- **进入场景**：应收待收、部分、逾期或待核销
- **对象锚点**：project + receivable
- **主线**：项目 -> 应收 -> 收款 -> 核销 -> 台账/凭证
- **当前工作面**：金额、到期、核销、收款记录
- **主行动**：登记收款并核销
- **动作策略键**：finance/receivable/save / finance/receipt/save
- **入站状态**：`receivable`（pending / partial / overdue）
- **上下文键**：projectId / receivableId / receiptId / returnWorkbench / returnScroll
- **完成后交接**：台账、凭证、项目回款相关投影刷新（→ finance.ledger）
- **空态**：当前没有待收款
- **异常态**：项目、金额或期间不可确认时显示暂不可确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：receivable / receipt / ledger / project
- **业务依据**：DEC-034 / BR-030 / MET-005 / MET-006
- **备注**：应收收款写动作只属于 Finance/Boss；StoreManager 如需查看财务应按只读权限进入账本投影，不在此队列获得写动作。

### 3.13 `finance.payable` — 待我付款

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/payables?projectId={projectId}&payableId={payableId}` |

- **进入场景**：应付待付、部分、逾期或待核销
- **对象锚点**：project + payable
- **主线**：项目 -> 应付 -> 付款 -> 核销 -> 台账/成本
- **当前工作面**：金额、到期、核销、付款记录
- **主行动**：登记付款并核销
- **动作策略键**：finance/payable/save / finance/payment/save
- **入站状态**：`payable`（pending / partial / overdue）
- **上下文键**：projectId / payableId / paymentId / returnWorkbench / returnScroll
- **完成后交接**：台账、成本、项目核算相关投影刷新（→ finance.ledger / pm.project）
- **空态**：当前没有待付款
- **异常态**：金额、成本口径或期间不可确认时显示暂不可确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：payable / payment / ledger / project / cost
- **业务依据**：DEC-034 / BR-030 / MET-006
- **备注**：应付付款写动作只属于 Finance/Boss；StoreManager 只读边界不得扩展为付款主行动。

### 3.14 `finance.ledger` — 资金台账

| 项 | 值 |
| --- | --- |
| 类型 kind | `workspace` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss / StoreManager |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/ledger?projectId={projectId}&ledgerId={ledgerId}` |

- **进入场景**：收付款后需要对账、查看流水或生成凭证
- **对象锚点**：project + ledger + voucher
- **主线**：收付款 -> 台账 -> 凭证 -> 项目核算
- **当前工作面**：台账流水、凭证、对账
- **主行动**：查看流水并处理对账或凭证
- **动作策略键**：finance/ledger/save / finance/ledger/update / finance/ledger/delete / finance/ledger/correct / document/voucher/build
- **入站状态**：`receivable`（received / closed）；`payable`（paid / closed）
- **上下文键**：projectId / ledgerId / voucherId / returnWorkbench / returnScroll
- **完成后交接**：凭证归档、项目核算相关投影刷新（→ pm.project）
- **空态**：当前没有需要核对的流水
- **异常态**：凭证规则、期间或金额不可确认时显示暂不可确认
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（台账与凭证为只读/生成动作，不承载未保存草稿切换）
- **刷新范围**：receivable / payable / ledger / voucher / project
- **业务依据**：DEC-034 / BR-030 / BR-018 / MET-006
- **备注**：Finance/Boss 可记账、更正、作废或冲正重记；StoreManager 只读。凭证生成 `document/voucher/build` 已于 2026-10-10 冻结（roles Finance/Boss、幂等：同一来源流水组合重打返回原凭证号），本工作台为其唯一接线入口；未选择有效流水前该动作不得作为主行动。

### 3.15 `boss.risk` — 待我处置风险

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 经营分析（`operation`）· 经营风险（`risk`） |
| 角色 roles（旧注册表口径，已退役） | Boss / StoreManager / TeamLeader |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/risk` |

- **进入场景**：负责人查看风险、超期、待审批、异常或跨角色交接
- **对象锚点**：risk queue + selected customer/project
- **主线**：风险/待办 -> 对象事实 -> 指派/审批/推进 -> 下游工作台
- **当前工作面**：风险原因、对象事实、责任人、处置动作
- **主行动**：按分类处置当前事项
- **动作策略键**：project/project/update / customer/designer-handoff / customer/owner-change
- **入站状态**：（空）
- **上下文键**：riskType / customerId / activePropertyId / projectId / returnWorkbench / returnScroll
- **完成后交接**：进入对应角色工作台或对象工作空间（→ pm.project / designer.quote / finance.receivable）
- **空态**：当前没有待我处置风险
- **异常态**：部分数据暂不可确认时保留恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：customer / project / quote / contract / receivable / payable / cost
- **业务依据**：DEC-034 / BR-030 / DEC-032 / BR-028
- **备注**：负责人工作台只执行既有 allowedActions；合同、金额、退款、验收、权限和删除必须下钻并进入安全门。 已实现风险队列页 /workbench/risk（Boss/Finance/StoreManager 可读；店长限本店）。

### 3.16 `more.search` — 全局搜索

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 更多（`more`）· 更多（`more`） |
| 角色 roles（旧注册表口径，已退役） | Boss / StoreManager / TeamLeader / Marketer / Designer / Pm / Finance |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench` |

- **进入场景**：用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台
- **对象锚点**：selected object
- **主线**：跨对象精确查找
- **当前工作面**：搜索结果、对象摘要和入口
- **主行动**：定位对象/入口
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：进入对应对象工作空间（→ today.mainline / customer.followup / designer.measure / designer.design / designer.quote / designer.contract / pm.project / pm.materialSelection / pm.change / pm.acceptance / finance.receivable / finance.payable / finance.ledger / boss.risk）
- **空态**：输入关键词、客户、项目或单据编号开始查找
- **异常态**：无结果或权限不足时说明原因和可返回路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（全局搜索是聚合查找入口，不直接承载未保存表单）
- **刷新范围**：（空）
- **业务依据**：DEC-034 / BR-030
- **备注**：低频精确入口；搜索结果不得替代工作台待办队列。

### 3.17 `team.overview` — 团队经营概览

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 业务工作台（`today`）· 业务工作台（`today`） |
| 角色 roles（旧注册表口径，已退役） | Boss / TeamLeader |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/team-overview` |

- **进入场景**：团队负责人查看本团队客户、报价、项目、任务与通知的只读经营事实
- **对象锚点**：team + recent customers
- **主线**：本团队客户 -> 报价 -> 合同 -> 项目 -> 任务
- **当前工作面**：本团队经营概览、成员表现与最近客户
- **主行动**：查看事实并进入对应场景工作台
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：进入本团队客户或项目工作面
- **空态**：本团队暂无客户、报价或项目数据
- **异常态**：部分数据暂不可确认时保留恢复路径；受限财务字段不生成区块
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（团队经营概览为只读聚合入口，不承载未保存表单）
- **刷新范围**：customer / quote / project / tasks
- **业务依据**：DEC-034 / BR-030 / BR-028 / GAP-026
- **备注**：团队负责人只读；成本/利润/应付/付款/现金流/工资/提成区块不生成（GAP-026）。

### 3.18 `designer.performance` — 我的业绩

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 经营与工具（`tools`）· 经营与工具（`tools`） |
| 角色 roles（旧注册表口径，已退役） | Designer |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/performance` |

- **进入场景**：设计师复盘本人客户、报价、签约与交付结果，定位当前经营动作
- **对象锚点**：设计师本人 + 业绩周期
- **主线**：本人客户 -> 报价 -> 签约 -> 项目交付 -> 业绩复盘
- **当前工作面**：本月经营摘要、签约排名、方案报价主链、趋势与工作分布
- **主行动**：查看业绩结论并进入需要推进的报价或项目
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：从业绩结论进入对应的报价、合同或项目工作面（→ designer.quote / designer.contract / pm.project）
- **空态**：当前周期还没有可归因的业绩事实
- **异常态**：业绩数据不可确认时显示可重试错误，禁止用 0 冒充
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（只读聚合页，不接受用户编辑）
- **刷新范围**：designerPerformance / quote / project / customer
- **业务依据**：DEC-034 / BR-030
- **备注**：仅展示本人数据范围；成本、毛利、利润和回款口径不在此页自行推导。

### 3.19 `designer.catalog` — 报价项目库

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 经营与工具（`tools`）· 经营与工具（`tools`） |
| 角色 roles（旧注册表口径，已退役） | Designer |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/catalog` |

- **进入场景**：设计师按类型、分类、品牌和规格查询可用报价项目，核对销售价构成
- **对象锚点**：报价项目库条目
- **主线**：项目库查询 -> 核对项目规格与销售价 -> 进入设计或报价工作区
- **当前工作面**：类型、分类、品牌、系列、规格、关键词筛选与项目详情
- **主行动**：查询并核对报价项目，进入使用该项目的设计或报价工作面
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：选中项目后回到设计方案或报价工作面引用（→ designer.design / designer.quote）
- **空态**：当前筛选条件下没有报价项目
- **异常态**：项目库不可确认时显示可重试错误，不伪装为空列表
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（只读聚合页，不接受用户编辑）
- **刷新范围**：catalog
- **业务依据**：DEC-034 / BR-030
- **备注**：设计师只读；标准成本、采购执行价、供应商历史价和项目利润不对外开放。

### 3.20 `designer.template` — 方案模版

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 经营与工具（`tools`）· 经营与工具（`tools`） |
| 角色 roles（旧注册表口径，已退役） | Designer |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/designer/templates` |

- **进入场景**：设计师沉淀常用房型的区域骨架、报价分项与工程量公式，新建设计方案时一键起稿
- **对象锚点**：设计模版 + 模版版本
- **主线**：方案模版 -> 区域骨架 + 分项公式 -> 实例化到设计方案 -> 调尺寸 -> 基础分项报价
- **当前工作面**：我的方案库、模版版本内容、区域与分项
- **主行动**：新建/编辑并发布模版，或实例化到设计方案
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：templateId / versionId / propertyId / activePropertyId
- **完成后交接**：选中模版后进入方案报价工作区调整区域尺寸（→ designer.design / designer.quote）
- **空态**：还没有方案模版，从「新建模版」沉淀第一个常用房型
- **异常态**：模版服务不可用时显示可重试错误，不伪装成空列表
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：designTemplate / design / quote
- **业务依据**：BR-040 / DEC-050 / DEC-034 / BR-030
- **备注**：模版与价格无关，不承载任何价格字段；公式统一专业变量，禁用单元格引用；本期仅 Web，App 无入口。

### 3.21 `designer.feedback` — 客户意见投诉

| 项 | 值 |
| --- | --- |
| 类型 kind | `queue` |
| 领域 · 分组 | 项目工地（`project`）· 项目工地（`project`） |
| 角色 roles（旧注册表口径，已退役） | Designer / Boss / StoreManager / Finance / Pm |
| 优先级 | P1 |
| 裁决状态 | pending_business_review |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/customer-feedback?projectId={projectId}&feedbackId={feedbackId}` |

- **进入场景**：业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复
- **对象锚点**：project + customerFeedback
- **主线**：项目 -> 客户意见投诉 -> 员工处理回复 -> 业主关闭
- **当前工作面**：项目工地、项目 Hero、意见投诉列表、现场说明、处理回复和承诺解决时间
- **主行动**：查看已有意见投诉并提交处理回复
- **动作策略键**：project/feedback/update
- **入站状态**：`customerFeedback`（submitted / processing / escalated / resolved）
- **上下文键**：projectId / feedbackId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `customerFeedback.submitted` → 提交处理回复｜动作 `project/feedback/update`｜裁决 pending_business_review｜可作主行动 是
  - `customerFeedback.processing` → 提交处理回复｜动作 `project/feedback/update`｜裁决 pending_business_review｜可作主行动 是
  - `customerFeedback.escalated` → 提交处理回复｜动作 `project/feedback/update`｜裁决 pending_business_review｜可作主行动 是
  - `customerFeedback.resolved` → 等待业主关闭｜动作 `project/feedback/update`｜裁决 pending_business_review｜可作主行动 否
- **完成后交接**：提交回复后等待业主确认关闭；员工不能代业主关闭（→ pm.project）
- **空态**：当前项目暂无客户意见投诉
- **异常态**：项目不可见、记录已关闭、无处理权限或数据暂不可确认时显示阻断原因和恢复路径
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要
- **刷新范围**：customerFeedback / project / workbenchQueue / notice
- **业务依据**：DEC-034 / BR-030 / DEC-044 / BR-028
- **备注**：业主提交和关闭；员工只查看并提交处理回复。财务角色只读。Web 暂不暴露处理中/升级等未由 App 口径确认的状态动作。

### 3.22 `finance.voucher` — 收付凭证

| 项 | 值 |
| --- | --- |
| 类型 kind | `workspace` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss / StoreManager |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/vouchers?voucherId={voucherId}&projectId={projectId}` |

- **进入场景**：收付款或手工记账后需要生成、预览、打印归档业务凭证
- **对象锚点**：voucher + ledger + project
- **主线**：收款/付款/手工流水 -> 业务凭证 -> 项目核算
- **当前工作面**：凭证列表、来源流水、模板版本、打印/归档
- **主行动**：预览、打印或归档当前业务凭证
- **动作策略键**：document/voucher/build
- **入站状态**：`voucher`（active / voided）
- **上下文键**：voucherId / projectId / returnWorkbench / returnScroll
- **状态 → 主行动**：
  - `voucher.active` → 预览、打印或归档当前业务凭证｜动作 `—`｜裁决 approved｜可作主行动 否
  - `voucher.voided` → 已作废凭证仅可查看与留档，不得重打为有效凭证｜动作 `—`｜裁决 approved｜可作主行动 否
- **完成后交接**：台账与项目核算投影刷新；凭证归档供对账留档（→ finance.ledger / finance.voucherTemplate）
- **空态**：当前筛选下没有业务凭证；未生成凭证时请先在资金台账选择有效流水生成
- **异常态**：来源流水、模板版本或金额不可确认时显示暂不可确认，不得伪造凭证号或文件
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（凭证为生成/打印/归档动作，不承载未保存草稿切换）
- **刷新范围**：voucher / ledger / project
- **业务依据**：DEC-034 / BR-030 / DEC-020 / BR-006 / BR-018 / ANS-BIZ-20261007-003 / SCN-013
- **备注**：业务凭证=款项收付单据打印稿，用于企业留档，**不属于会计记账凭证**（GAP-022）。模板不计算、不覆盖金额；重打同一来源组合返回同一凭证号。出凭证动作由 finance.ledger 的批量选择触发，本页负责查看/打印/归档。

### 3.23 `finance.voucherTemplate` — 凭证模板

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss / StoreManager |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/voucher-templates?templateId={templateId}` |

- **进入场景**：企业需要按自己的版式套打业务凭证，或使用平台行业基础模板
- **对象锚点**：voucherTemplate（平台基础模板 / 企业模板 / 版本）
- **主线**：平台基础模板 -> 复制为企业草稿 -> 编辑 -> 发布不可变版本 -> 凭证按发布版本生成
- **当前工作面**：模板库、受控版式设计器、版本历史
- **主行动**：复制平台模板并按企业版式发布新版本
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：templateId / templateType / returnWorkbench / returnScroll
- **完成后交接**：发布后由 finance.ledger / finance.voucher 按发布版本生成凭证；模板修改不回溯历史凭证（→ finance.ledger / finance.voucher）
- **空态**：还没有企业模板，可从平台行业基础模板复制一份开始
- **异常态**：模板版本冲突时提示重新读取，不覆盖已发布版本
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=true／返回来源=true
- **未保存保护**：需要（版式设计器承载未保存的模板草稿，切换模板前必须确认）
- **刷新范围**：voucherTemplate / voucher
- **业务依据**：DEC-034 / BR-030 / DEC-020 / BR-006 / BR-018 / GAP-022 / SCN-013
- **备注**：kind=aggregate：模板库是管理面，不含业务入站队列（与 designer.template 同型）。平台基础模板只读；企业模板草稿可改、发布版本不可变；必填字段由服务端发布校验。模板是款项打印载体，不是法定会计凭证。

### 3.24 `finance.storePayroll` — 本店薪酬

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss / StoreManager |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/store-payroll` |

- **进入场景**：店长需要查看本店员工工资构成（应发、扣款、实发与工资项状态）
- **对象锚点**：storePayrollItem（门店范围内的员工工资项）
- **主线**：工资单确认 -> 本店员工工资项 -> 门店薪酬结果
- **当前工作面**：本店员工工资明细（只读）
- **主行动**：查看本店员工工资构成；确认类动作不在此页
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：叶子页：本店薪酬为门店经营结果投影，无下游工作台；明细疑问回到员工工资单与考勤事实核对
- **空态**：暂无本店工资记录；工资单确认后本店员工明细会显示在这里
- **异常态**：数据范围或薪酬事实不可确认时显示暂不可确认，不用 0 或空数组冒充
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（本店薪酬为只读结果投影，不承载未保存草稿切换）
- **刷新范围**：employeePayrollItem / employeePayrollSheet
- **业务依据**：DEC-034 / BR-030 / BR-015
- **备注**：口径与 App `store-payroll.vue` 一致：仅显示本店员工工资构成，范围由服务端按登录员工裁决。工资单确认动作仅企业负责人可执行（DEC-046 APP-PAY-03/08），本页只读。

### 3.25 `account.payslip` — 我的工资条

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 更多（`more`）· 更多（`more`） |
| 角色 roles（旧注册表口径，已退役） | Boss / StoreManager / TeamLeader / Marketer / Designer / Pm / Finance |
| 优先级 | P2 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/account/payslips` |

- **进入场景**：员工需要查看自己已发放的工资条与收入明细
- **对象锚点**：payslip（本人）
- **主线**：工资单确认 -> 发放完成 -> 工资条对员工可见
- **当前工作面**：本人已发放工资条（应发/扣款/实发）
- **主行动**：查看本人已发放工资条明细
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正
- **空态**：暂无已发放工资条；工资单确认并发放完成后才会出现
- **异常态**：薪酬数据不可确认时显示暂不可确认并保留重试，不伪造明细
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（我的工资条为员工只读自助页，不承载未保存草稿切换）
- **刷新范围**：payslip
- **业务依据**：DEC-034 / BR-030 / BR-015
- **备注**：等价于 App `view:ownPayslip` + `my-payroll.vue`：**仅展示实际发放完成**的工资条；未发放的工资单对员工不可见。数据范围由服务端按登录员工裁决（本人）。

### 3.26 `finance.payroll` — 薪酬工作台

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 商务财务（`finance`）· 商务财务（`finance`） |
| 角色 roles（旧注册表口径，已退役） | Finance / Boss / StoreManager |
| 优先级 | P1 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/finance/payroll?period={period}` |

- **进入场景**：财务需要一屏看清本月薪酬走到哪一步：待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数
- **对象锚点**：payrollWorkbenchReport（按周期）
- **主线**：考勤确认 -> 薪酬方案 -> 工资单草稿 -> 确认 -> 发放 -> 工资条发布
- **当前工作面**：薪酬周期报告与薪酬入口
- **主行动**：按报告指向的下一步进入员工工资页处理当前周期薪酬
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：进入员工工资/员工提成/提成负向调整/本店薪酬工作面（→ finance.storePayroll）
- **空态**：当前周期暂无工资单时给出「最近一次工资单」兜底入口，不自动补建
- **异常态**：薪酬报告不可确认时显示暂不可确认并保留重试，不用 0 冒充
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（薪酬工作台为只读报告页，不承载未保存草稿切换）
- **刷新范围**：payrollWorkbench / employeePayrollSheet / payslip / employeeCommission
- **业务依据**：DEC-034 / BR-030 / BR-015
- **备注**：对齐 App `payroll/workbench.vue`：待发员工薪酬为第一答案 + 最新工资单兜底 + 四类进度计数 + 薪酬入口。Web 取舍：考勤/薪酬方案/员工发放收在「员工工资」页内承接，不单列菜单。金额与计数全部取服务端报告；状态未登记显示「待业务确认」（ANT-010）。

### 3.27 `store.overview` — 本店经营结果

| 项 | 值 |
| --- | --- |
| 类型 kind | `aggregate` |
| 领域 · 分组 | 经营分析（`operation`）· 经营风险（`risk`） |
| 角色 roles（旧注册表口径，已退役） | Boss / StoreManager |
| 优先级 | P0 |
| 裁决状态 | approved |
| 旧 deepLink（已退役，现取各角色静态清单的 `to`） | `/workbench/store-overview` |

- **进入场景**：店长查看本店客户、报价、项目、任务与成员构成，并定位今天可直接干预的事项
- **对象锚点**：store + recent customers/projects
- **主线**：本店客户 -> 报价 -> 合同 -> 项目 -> 任务
- **当前工作面**：本店经营概览、可干预事项、设计师业绩与最近事实
- **主行动**：查看事实并进入对应场景工作台处理
- **动作策略键**：（空）
- **入站状态**：（空）
- **上下文键**：—
- **完成后交接**：进入本店客户/风险/项目工作面（→ customer.followup / boss.risk）
- **空态**：本店暂无客户、报价或项目数据
- **异常态**：部分数据暂不可确认时保留恢复路径；成本与毛利区块不生成
- **上下文恢复**：深链接=true／保留筛选=true／保留滚动=true／保留草稿=false／返回来源=true
- **未保存保护**：不需要（门店经营概览为只读聚合入口，不承载未保存表单）
- **刷新范围**：customer / quote / project / projectTask
- **业务依据**：DEC-034 / BR-030 / DEC-016 / BR-003
- **备注**：只读聚合，数据源 `statistic/store/report`，服务端按门店数据范围裁剪。**该 Provider 不返回成本、毛利与成本完整性标记**，页面因此不生成成本/毛利区块（BR-003 要求采购执行价不得被解释为综合成本）；如需展示成本毛利，需后端先提供成本完整性投影。状态与来源一律用服务端中文名，前端不做本地映射。

## 4. 与静态源的分工（避免二次来源）

| 内容 | 唯一来源 | 说明 |
| --- | --- | --- |
| 某角色**能不能进**某页面 | `src/roles/routes.ts` | 登录后只装载该角色的路由集合；越权 URL 落 `/forbidden` 或 404 |
| 某角色的**左侧菜单** | `src/roles/workbenchConfig.ts` | 静态显式（key/label/path），不查表 |
| 某角色**首页卡片** | `src/roles/workbenchHome.ts` | 静态显式（含场景/锚点/主行动/交接/落地页） |
| 卡片与菜单的**一致性** | `npm run check:workbenches` | 三源交叉校验，漂移即失败 |
| **落地页可达性** | `npm run check:workspaces` | 每个入口的 `to` 必须在同角色静态路由内解析到真实记录 |
| **业务条款**（本文件 §0/§3） | 本文件 + 业务裁决 | 人读对照，机器不读 |

---

维护纪律（`WEB-角色页面开发作业规范.md` §9.5）：本文件是从注册表**归档**而来，
不得再被当成「新增工作台要先登记」的入口；新增场景工作台 = 改三份静态源 + 追加本节条款。