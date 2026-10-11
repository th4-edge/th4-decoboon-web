# Web 全角色前端框架与业务工作台 G1

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 批次：`WEB-ROLE-FRAMEWORK-G1-20261008`
> 状态：`APPROVED_FOR_IMPLEMENTATION`
> 设计基准：`output/workbench-review/设计师业务工作台-高保真.html`
> 业务依据：`DEC-034 / BR-030`、`workbench-navigation.json`、七类员工角色固定矩阵
> 改造驱动：现有规范只能约束业务事实、安全、权限和可验收性，不能满足产品体验要求；高保真产品交互是本轮 Web 改造的目标。
> 本稿只定义框架、交互和后端数据契约，不直接实现业务代码。
> 高保真稿中的演示数据、环比、排序、动作和队列均不得直接作为生产事实。

## 0. 已确认决策（2026-10-08）

1. 采用“统一壳层 + 角色配置 + 统一业务工作台骨架”。
2. 七个角色的 KPI、主链、卡片按当前建议矩阵继续展开。
3. Today Queue 独立 Provider，不混入首页 Report。
4. 图表使用本地 ECharts，禁止 CDN 外链。
5. 第一实施目标为 Designer 业务工作台；其他角色先共享统一壳层。

---

## 1. 冻结方向

采用方向 A：

```text
统一角色壳层
+ 角色化侧边栏
+ 全角色通用业务工作台结构
+ 角色专属数据配置
+ 后端聚合 Report API
+ 统一状态、交互和响应式规则
```

不采用“把高保真 HTML 的模拟数据直接搬进页面”的方式。

业务工作台必须满足：

1. 第一眼看到角色当前工作总量。
2. 第二眼看到角色主链当前推进状态。
3. 能按业务场景进入对应工作台。
4. 能看到真实趋势、风险或转化漏斗。
5. 能直接处理最优先的入站对象。
6. 所有数字、动作、排序和权限由服务端决定。

## 2. 统一壳层

### 2.1 布局

```text
┌──────────────────────────────────────────────────────────────┐
│ 侧边栏 236px │ 顶栏 64px                                    │
│              ├──────────────────────────────────────────────┤
│ 品牌         │ 面包屑      搜索      通知      用户身份      │
│ 角色范围     ├──────────────────────────────────────────────┤
│ 导航分组     │ 页面内容区 max-width 1400px                  │
│ 业务入口     │ Header → KPI → Pipeline → Cards → Charts     │
│ 退出         │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 2.2 壳层视觉

| 区域 | 规范 |
| --- | --- |
| 侧边栏宽度 | `236px` |
| 侧边栏背景 | 深墨绿/品牌深色，和内容区形成稳定分区 |
| 顶栏高度 | `64px`，`position: sticky; top: 0` |
| 内容区 | `max-width: 1400px`，水平居中，左右 `32px` |
| 页面背景 | `$bg-page` |
| 卡片 | 白底、`1px` 边框、`16px` 圆角、轻阴影 |
| 栅格 | KPI 3 列；工作卡 3 列；图表 1.55fr / 1fr |
| 响应式 | `1240px` 卡片降 2 列，`1024px` 侧栏收起，`720px` 单列 |

### 2.3 侧边栏

侧边栏分两层：

```text
一级：角色业务域 / 分组标题
二级：场景工作台 / 对象入口
```

每个二级入口包含：

```text
Icon + 中文名称 + 可选徽标
```

交互要求：

- 默认：低对比文字。
- Hover：浅色背景，文字提亮。
- Active：品牌色实底，白色文字，左侧无额外边框。
- Focus-visible：品牌色外环。
- 徽标：只能由服务端事实计算，不使用装饰性数字。
- 侧栏可滚动，品牌和退出固定。
- `<=1024px` 不直接消失，改为抽屉式菜单，由顶栏按钮打开。

### 2.4 顶栏

顶栏固定包含：

1. 面包屑：当前一级域 / 当前页面。
2. 全局搜索：搜索客户、房屋、项目、报价、合同、单据和工作台。
3. 通知入口：未读数由服务端返回。
4. 用户身份：姓名、角色、数据范围、所属企业/门店。

顶栏不重复显示页面标题，页面标题只由内容区 `PageHeader` 承载。

### 2.5 页面 Header

`PageHeader` 统一包含：

```text
标题
副标题
待处理总数 / 当前范围说明
数据更新时间
刷新动作
```

要求：

- 标题只出现一次。
- “待处理总数”与“在管/在途/全量”统计分开。
- 数据更新时间来自服务端 `generatedAt`。
- 刷新时不清空已有数据，保留旧值并显示刷新态。

## 3. 全角色工作台矩阵

> 下列为框架级定义；具体业务公式仍需按角色分批业务裁决。

### 3.1 Boss

- 入口：`/workbench`
- 数据范围：`Company`
- 侧栏：业务工作台、客户经营、项目工地、商务财务、经营分析、更多。
- KPI 建议：本月签约额、本月回款、在管项目、风险与待确认。
- 主链建议：客户 → 商机 → 报价 → 合同 → 项目 → 回款/利润。
- 工作卡：风险、客户转化、项目履约、商务财务、组织效能。
- 图表：经营漏斗、资金趋势、风险分布。
- 队列：跨类风险与需负责人决策事项。
- 边界：不替代业主验收；一人装企岗位视角不能伪造操作人。

### 3.2 StoreManager

- 入口：`/workbench`
- 数据范围：`Store`
- 侧栏：业务工作台、客户经营、项目工地、商务财务、经营分析。
- KPI 建议：本店在途客户、本月签约、待签约、风险/逾期、回款。
- 主链建议：客户 → 量房 → 设计报价 → 合同 → 项目。
- 工作卡：客户跟进、待报价、合同交接、项目推进、选材、增减项、风险。
- 图表：门店转化漏斗、风险队列、项目阶段分布。
- 队列：本店跨角色风险与需店长处理事项。
- 边界：本店范围，不自动获得公司经营全权。

### 3.3 TeamLeader

- 入口：`/workbench`
- 数据范围：`Team`
- 侧栏：业务工作台、客户经营、项目工地、团队经营。
- KPI 建议：团队在途客户、团队签约、转化率、在管项目、逾期/风险。
- 主链建议：客户建档 → 跟进 → 量房 → 报价 → 合同。
- 工作卡：客户跟进、待报价、风险、团队经营概览。
- 图表：团队漏斗、人员负载、逾期风险。
- 队列：团队异常、待接管和待协调事项。
- 边界：不默认获得公司财务全权限。

### 3.4 Marketer

- 入口：`/workbench`
- 数据范围：`Self`
- 侧栏：业务工作台、客户经营、更多。
- KPI 建议：我的客户、今日待跟进、待量房、本月新增、阶段转化。
- 主链建议：客户建档 → 跟进 → 约量房 → 交接设计师。
- 工作卡：客户跟进、待量房、客户池。
- 图表：跟进趋势、客户阶段分布、量房转化。
- 队列：今日跟进、逾期未跟进、待交接量房。
- 边界：不参与设计报价决策；不得自助改派设计师。

### 3.5 Designer

- 入口：`/designer/workbench`
- 数据范围：`Self`
- 侧栏：业务工作台、客户与设计、报价工作台、合同交接、项目工地、报价项目库、我的业绩。
- KPI：在途客户、本月报价金额、本月签约金额。
- 主链：量房 → 设计 → 报价 → 合同交接。
- 工作卡：待我量房、待我设计、待我报价、待客户确认、合同交接、项目推进、待我选材、增减项、验收/整改。
- 额外聚合卡：工地全景，明确为“在管项目”，不进入待处理总数。
- 图表：方案报价主链转化漏斗、当前工作分布。
- 队列：今日主线 Top 3，按服务端优先级返回。
- 边界：不签署/生效合同，不代替业主确认验收，不看成本利润。

### 3.6 Pm

- 入口：`/pm/workbench`
- 数据范围：项目参与与本人项目。
- 侧栏：业务工作台、项目工地、更多。
- KPI 建议：在管项目、本周节点、逾期任务、待验收/整改、材料风险。
- 主链建议：项目准备 → 施工 → 阶段验收 → 整改 → 结算。
- 工作卡：项目推进、待我选材、增减项、验收/整改、项目风险。
- 图表：项目阶段分布、周计划/节点排布、逾期与整改趋势。
- 队列：今日施工、逾期任务、材料风险、待整改/复验。
- 边界：不改设计价格和财务归属，不代替业主确认验收。

### 3.7 Finance

- 入口：`/finance/workbench`
- 数据范围：`Company`
- 侧栏：业务工作台、商务财务、经营分析、更多。
- KPI 建议：本月回款、待收款、本月付款、资金余额、成本完整性/风险。
- 主链建议：合同 → 应收 → 收款 → 台账/凭证；并行应付 → 付款。
- 工作卡：待我收款、待我付款、待我选材、资金台账与凭证、风险。
- 图表：现金流趋势、应收应付账龄、逾期分布。
- 队列：逾期应收、逾期应付、待核销、待生成凭证。
- 边界：金额、成本、利润按财务权限开放；设计师和 PM 默认无成本利润区块。

## 4. 统一业务工作台结构

全角色共用同一个页面骨架，不允许每个角色重新发明一套：

```text
PageHeader
-> KPI Row
-> Mainline Pipeline
-> Workcard Groups
-> Conversion / Distribution Charts
-> Today Queue
```

### 4.1 KPI Row

每个角色 3–4 个 KPI。

统一字段：

```text
key
label
value
unit
comparisonValue
comparisonRate
comparisonState（up/down/flat/unavailable）
comparisonLabel
missingReason
```

规则：

- 无基期时显示“暂无基期”，不显示 0%。
- 无权限时不生成该 KPI，不显示遮罩值。
- 金额使用等宽数字和统一金额格式。
- 高保真中的环比、同比数值在真实后端支持前不得展示。

### 4.2 Mainline Pipeline

每个角色一条主链，当前阶段只有一个高亮主行动。

统一字段：

```text
stageKey
label
count
rate
description
state（done/current/pending）
route
blockedReason
```

交互：

- 点击当前阶段进入对应工作台。
- 已完成阶段可查看历史对象。
- 未满足前置条件的下游阶段不可执行，只能查看原因。
- 阶段名称不写死为项目阶段，必须来自角色主链配置或服务端配置。

### 4.3 Workcard Groups

工作卡不再平铺成一个大杂烩，按角色业务域分组：

```text
客户经营 · 待我处理
项目工地 · 在管推进
商务财务 · 待我处理
经营分析 · 风险与结果
```

每张卡：

```text
Icon
标题
一句话说明
主数量
细分数量
风险/提醒
主行动入口
```

规则：

- 卡片主数量是“需要进入该场景工作的对象数”，不是所有可查看数据量。
- 细分数量与主数量口径必须一致，不能出现 `1 + 4 + 9 > 13` 却无解释。
- 项目类卡片主数量按项目去重，细分可显示单据数。
- 纯查看型聚合卡标识为“在管/全景”，不进入待处理总数。

### 4.4 Conversion Funnel

漏斗必须由服务端计算：

```text
stage
stageCount
conversionRate
previousStageCount
exclusionReason
```

禁止：

- 前端自行用卡数量拼转化率。
- 用 Submitted 代替 Accepted。
- 用演示口径伪装正式经营指标。
- 无业务公式的比率直接展示。

### 4.5 Today Queue

首页必须提供“我先做什么”的入站队列，建议每个角色返回 Top 3–5。

统一字段：

```text
queueKey
objectType
objectId
customerId
propertyId
projectId
title
subtitle
stateKey
stateLabel
ownerName
nextActionKey
nextActionLabel
route
priority
dueAt
stayDays
riskLevel
allowed
blockReason
```

规则：

- 优先级由服务端计算，前端不按文案排序。
- 动作必须来自服务端允许动作。
- 无权限动作不出现，或显示为不可执行并给出原因。
- 设计师合同事项不能出现“跟进签约”，只能出现“查看交接/提醒负责人”。

## 5. 后端 API 升级契约

### 5.1 路由

每个角色一个专用首页 Report：

```text
statistic/workbench/boss/report
statistic/workbench/store-manager/report
statistic/workbench/team-leader/report
statistic/workbench/marketer/report
statistic/workbench/designer/report
statistic/workbench/pm/report
statistic/workbench/finance/report
```

角色只由登录员工推导，不接受前端传 `role`、`companyId`、`empId`。

### 5.2 统一响应模型

```text
RoleWorkbenchReport
  role
  roleName
  employeeId
  employeeName
  companyId
  storeId
  teamId
  dataScope
  generatedAt
  period
  status
  summary[]
  pipeline[]
  cardGroups[]
  cards[]
  charts[]
  queue[]
  warnings[]
```

### 5.3 聚合 SQL 原则

- 每个角色、每个领域使用固定条数聚合 SQL。
- 卡片数量、漏斗存量、转化率、环比、逾期、队列优先级全部服务端计算。
- 不加载全量实体后在 Java 循环统计。
- 循环体内零查询。
- 不使用列表长度作为总数。
- 数据范围 `com_id` 最左，按角色追加 `store_id/team_id/emp_id/project participation`。
- 目标：核心首页 P95 ≤ 500ms；10 倍数据量下 SQL 条数不增长。

### 5.4 队列与动作

Today Queue 不能只有展示字段，必须返回：

```text
allowedActions[]
primaryActionKey
primaryActionLabel
blockedReason
route
reloadScopes
```

如果队列接口无法一次返回，可拆成：

```text
statistic/workbench/{role}/report
statistic/workbench/{role}/queue
```

但必须先确认是否会影响首屏请求数和性能。

## 6. 交互规范

### 6.1 状态

每个数据区域必须具备：

```text
loading
empty
error
partial
stale
unauthorized
expired
success
```

空态使用“插画 + 原因 + 下一步入口”，禁止只写“暂无数据”。

### 6.2 动效

- 视图切换：180ms 淡入上移。
- 卡片 hover：轻微上移，不夸张。
- 数字滚动：仅在初次加载时执行，刷新时不重复动画。
- 图表动画：520ms 以内。
- `prefers-reduced-motion` 全部禁用。

### 6.3 键盘与可访问性

- 导航、卡片、队列行、按钮均可键盘聚焦。
- `Enter` / `Space` 可进入卡片或选中行。
- 焦点必须可见。
- 颜色不能单独表达状态。
- 正文不得小于 13px，辅助信息不得小于 12px；高保真中 11px 仅允许用于徽标、角标或头像字母。

### 6.4 Toast / 模态

- 信息型操作使用 info toast。
- 成功操作使用 success toast。
- 风险和中止使用 warn toast。
- 删除、退出、批量操作、权限变更、资金动作必须二次确认。
- 确认弹层支持遮罩、取消、危险按钮红色实底。

## 7. 图表实现决策

高保真稿使用 ECharts CDN。生产实现不直接依赖 CDN。

建议：

1. 优先复用项目内已选图表方案。
2. 若采用 ECharts，改为本地依赖并锁定版本，禁止外链。
3. 轻量漏斗/趋势图可以继续使用项目自有 SVG 组件。
4. 图表只消费后端已计算的数值，不在前端做经营公式。

## 8. 分批实施顺序

### 批次 1：壳层 + Designer 业务工作台

- 统一 `RoleWorkbenchShell`。
- 统一侧栏、顶栏、PageHeader、KPI、Pipeline、WorkCard、Funnel、Today Queue。
- 先以 Designer 做完整样板。
- 扩展 `statistic/workbench/designer/report`。

### 批次 2：Pm + Finance

- 复用同一壳层与页面骨架。
- 分别定义项目履约和财务首页指标。
- 每个角色单独做权限负向和资金/成本边界。

### 批次 3：Marketer + StoreManager + TeamLeader

- 补客户经营、门店和团队视角。
- 统一客户池、量房、报价、合同和风险队列。

### 批次 4：Boss

- 汇总经营、风险、组织和资金。
- 处理一人装企岗位视角切换。

### 批次 5：多页设计稿

- 客户与设计、报价工作台、合同交接、项目工地、选材、增减项、验收、项目库、业绩。
- 每页继续按对象工作空间规范落地，不把首页卡片复制成 CRUD 列表。

## 9. 需要确认的项

1. 是否认可“统一壳层 + 角色配置 + 统一业务工作台骨架”的实现方式。
2. 每个角色的 KPI、主链和卡片是否先由我给出第一版推荐矩阵。
3. Today Queue 是合并在 Report 内，还是单独 Provider。
4. 图表采用本地 ECharts，还是继续自有 SVG 组件。
5. 设计师之后的下一个角色是 Pm、Finance，还是先完成全部 Shell 再逐角色填充。

---

## 10. 当前实施进度

2026-10-08 已完成：

- 统一壳层 `RoleAreaShell` 与七角色导航配置。
- 深色侧栏、顶栏搜索、通知、用户菜单、响应式抽屉。
- Designer 业务工作台接入高保真卡片、主链步骤、KPI 对比、当前工作分布和独立 Today Queue。
- 本地 ECharts 已接入，采用动态加载，避免全量打入首屏。
- 后端：
  - `statistic/workbench/designer/report` 增加 `pipeline` 与 KPI comparison；
  - 新增 `statistic/workbench/designer/queue/list` 独立 Today Queue Provider。
- 前端 `build`、9 项治理门禁、三档浏览器结构复核通过。

仍需后续：

- 登录后真实 HTTP 端到端。
- 七个角色工作台内容逐批落地。
- 生产 DDL/发布另行审批。
