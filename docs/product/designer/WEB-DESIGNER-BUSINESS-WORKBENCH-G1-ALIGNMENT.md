# Web 设计师业务工作台 G1 对齐稿

> 批次：`WEB-DESIGNER-BUSINESS-WORKBENCH-G1-20261008`
> 状态：`IMPLEMENTED_PENDING_E2E_AND_T06`
> 角色范围：首期仅 `Designer`
> 页面范围：全局可见名称“今日工作 / 今日主线”调整为“业务工作台”；设计师默认首页改为角色业务总览
> 后端范围：新增设计师首页聚合 Provider，SQL 聚合先行，禁止 N+1
> 业务事实源：全局 `zhuangdeqing-business`
> 关联事实：`DEC-034`、`BR-030`、`BR-005`、`SCN-007`、`SCN-017`、`CAP-002`、`MET-001`、`DEC-036`、`BR-031`、`DEC-037`、`BR-032`
> 本稿不新增或修改业务对象、状态、动作、角色、权限、金额、成本、利润口径。

---

## 1. 产品意图

当前“今日工作”实际展示的是工作台注册表中的工程字段：

- 对象锚点
- 当前任务
- 完成后去向
- 业务裁决状态

这些字段对研发治理有价值，但不是设计师打开首页时最需要的答案。

本次对齐后的核心判断：

```text
业务工作台 = 角色经营与工作总览
先告诉使用者：有哪些工作要展开、各有多少、分布在哪里、最近趋势如何
再让他进入对应的场景工作台处理具体对象
```

业务工作台不替代量房、设计、报价、合同、项目、选材、增减项和验收工作台，也不把对象明细重新堆回首页。

## 2. 首屏设计意图

| 问题 | 冻结答案 |
| --- | --- |
| 页面类型 | 角色业务总览页 |
| 谁在什么状态下打开 | 设计师登录后，需要快速判断当前工作量、风险和业务趋势 |
| 第一眼要得到的答案 | 我现在有哪些工作要展开，每项有多少，最近业务走势如何 |
| 页面唯一主行动 | 从工作量最高的场景卡进入对应业务工作台 |
| 信息优先级 | 1. 当前工作总览；2. 场景卡片数量；3. 趋势与阶段分布 |
| 与 App 的差异 | 业务口径一致；Web 提供更适合宽屏的角色总览、趋势和多维对比 |
| 不做什么 | 不展示对象锚点、当前任务、完成后去向等工程元数据；不在首页做对象 CRUD |

## 3. 真实业务场景

### 场景 A：10–20 人单店成长装企

- 使用人：设计师董夏鹏。
- 触发事件：周一上午登录 Web，需要安排本周设计转化工作。
- 当前动作：先看业务工作台，发现待量房 4、待设计 2、待报价 1、待客户确认 2、合同交接 1。
- 系统下一步：设计师点“待我量房”进入量房工作台；完成后下游设计工作台出现对应客户和房屋。
- 异常处理：报价统计读取失败时，仅该卡显示“暂不可确认”；其他成功卡片保留；不得把失败显示为 0。
- 验收结果：不搜索客户即可进入正确工作面，卡片数量与数据库和对应工作台一致。

### 场景 B：20–30 人多店、多项目并行装企

- 使用人：设计师周敏，同时参与多个门店和正在施工项目。
- 触发事件：需要判断项目选材、增减项和验收工作是否积压。
- 当前动作：从业务工作台查看待选材、增减项和验收/整改数量，并查看近 30 天报价提交和客户接受趋势。
- 系统下一步：点击项目类卡片进入对应项目工作台，项目上下文明确，不需要重新搜索。
- 异常处理：项目参与关系或部分数据不可确认时，卡片显示“暂不可确认”并保留进入风险说明的路径。
- 验收结果：跨门店但未参与的项目不得计入；本人参与项目按项目维度去重计数。

## 4. 导航与页面范围

### 4.1 菜单命名

| 项目 | 当前 | 目标 |
| --- | --- | --- |
| 可见名称 | 今日工作 / 今日主线 | 业务工作台 |
| 路由 | `/designer/workbench` | 保持不变 |
| 工作台 key | `today.mainline` | 保持不变 |
| 页面标题 | 今日工作 | 业务工作台 |

本次只改变使用者可见命名和页面任务，不改变路由、权限体系和工作台注册 key。

### 4.2 页面结构

自上而下固定为：

1. 身份与数据范围：姓名、角色、门店/团队、数据范围、最后更新时间。
2. 当月概览：在途客户、本月报价金额、本月签约金额。
3. 业务工作卡：九个场景入口，统一 `Icon + 名称 + 数量 + 一句话说明 + 入口`。
4. 多维趋势：近 30 天业务趋势 + 当前工作分布。
5. 数据状态：正常、部分确认、失败、刷新时间和恢复路径。

### 4.3 九张业务卡与图标

| 卡片 | Dashboard metric key | 工作台 key / 入口语义 | Icon 建议 | 卡片主数量 |
| --- | --- | --- | --- | --- |
| 待我量房 | `designerMeasurePendingCount` | `designer.measure` | `Location` | 待处理房屋数 |
| 待我设计 | `designerDesignPendingCount` | `designer.design` | `Picture` | 待推进房屋数 |
| 待我报价 | `designerQuoteActionCount` | `designer.quote`，仅草稿/需调整 | `Tickets` | 需要设计师动作的报价数 |
| 待客户确认 | `pendingQuoteDecisionCount` | `designer.quote`，仅待客户确认 | `ChatDotRound` | 等待客户决策的报价数 |
| 合同交接 | `designerContractHandoffCount` | `designer.contract` | `DocumentChecked` | 待交接合同数 |
| 项目推进 | `designerProjectActiveCount` | `pm.project` | `OfficeBuilding` | 参与中的项目数 |
| 待我选材 | `designerMaterialSelectionPendingCount` | `pm.materialSelection` | `Goods` | 待选材项目数 |
| 增减项 | `designerContractChangePendingCount` | `pm.change` | `EditPen` | 有待办增减项的项目数 |
| 验收/整改 | `designerAcceptancePendingCount` | `pm.acceptance` | `CircleCheck` | 待推进验收/整改项目数 |

> 说明：项目类卡片的主数量按“项目”去重，卡内细分展示材料计划、增减项或验收单数量，避免一个项目有多个计划/单据时重复放大项目数。

## 5. 卡片数量口径

所有 SQL 均必须带：

```text
com_id = 当前登录员工所属企业
```

所有设计师归属均从登录员工推导，不接受前端传入 `companyId`、`designerId` 或 `empId`。

### 5.1 待我量房

- 主对象：房屋 `Property`。
- 入站状态：`PendingMeasure`、`Measuring`。
- 归属：`customer.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT property_id)`。
- 细分：`待安排`、`量房中`。
- 说明：同一房屋存在多条量房记录时只计一次。

### 5.2 待我设计

- 主对象：房屋 `Property`。
- 入站条件：房屋已量房且设计尚未完成；无有效设计，或存在状态为 `Draft`、`Ready`、`Presented` 的设计。
- 归属：`customer.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT property_id)`。
- 细分：`待创建方案`、`设计中`、`待谈单`、`已讲解`。
- 说明：`Selected`、`Archived` 不计入待我设计；一个房屋多个版本只计一次。

### 5.3 待我报价

- 主对象：报价 `Quote`。
- 入站状态：`Draft`、`Rejected`。
- 归属：`quote.emp_id = 当前员工`。
- 主数量：`COUNT(DISTINCT quote_id)`。
- 细分：`草稿`、`需调整`。
- 说明：这两类需要设计师继续动作；`Submitted` 单独进入“待客户确认”卡；`Superseded` 不计入。

### 5.4 待客户确认

- 主对象：报价 `Quote`。
- 入站状态：`Submitted`。
- 归属：`quote.emp_id = 当前员工`。
- 主数量：`COUNT(DISTINCT quote_id)`。
- 细分：按停留天数分为 `3 天内`、`3–6 天`、`7 天及以上`。
- 说明：该卡代表等待客户决策并需要设计师跟进，不代表设计师可代替客户确认。

### 5.5 合同交接

- 主对象：合同 `ProjectContract`。
- 入站状态：`PendingSign`、`Signed`。
- 归属：合同关联客户的当前设计师为当前员工。
- 主数量：`COUNT(DISTINCT contract_id)`。
- 细分：`待签约`、`已签约未生效`。
- 说明：`Effective`、`Active` 不进入待交接卡片。

### 5.6 项目推进

- 主对象：项目 `Project`。
- 入站状态：`Preparing`、`Ongoing`、`Suspended`、`Accepting`。
- 归属：`project.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT project_id)`。
- 细分：各项目状态数量。

### 5.7 待我选材

- 主对象：项目 `Project`。
- 入站条件：存在主材计划处于 `Planned`，且项目处于 `Ongoing` 或 `Accepting`。
- 归属：`project.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT project_id)`。
- 细分：待选材材料计划数量、待客户确认数量。
- 说明：选材确认后材料计划进入 `ReadyToOrder`，不再计入“待我选材”。

### 5.8 增减项

- 主对象：项目 `Project`。
- 入站条件：存在合同变更单状态为 `Pending` 或 `Approved`。
- 归属：`project.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT project_id)`。
- 细分：待审批、审批通过待客户确认、项目数。
- 说明：客户已确认、驳回、取消的变更不计入待处理数量。

### 5.9 验收/整改

- 主对象：项目 `Project`。
- 入站条件：存在验收单状态为 `Pending` 或 `Rejected`，或存在阶段状态为 `Accepting`。
- 归属：`project.designer_id = 当前员工`。
- 主数量：`COUNT(DISTINCT project_id)`。
- 细分：待验收、整改中、待复验。
- 说明：已确认验收不计入；同一项目多个阶段只计项目一次，细分保留阶段/验收单数量。

## 6. 当月概览指标

### 6.1 在途客户

```text
count distinct customer_id
where customer.designer_id = 当前员工
  and customer.status in (New, Following, PendingMeasure, Quoted)
```

用途：表达当前仍在设计转化链路中的客户规模，不混入已签约、履约和质量历史客户。

### 6.2 本月报价金额

```text
sum(quote.amount)
where quote.emp_id = 当前员工
  and quote.submitted_at in 当前自然月
  and quote.status not in (Draft, Superseded)
```

用途：表达本月已形成客户可见报价的金额规模，不把草稿和历史替代版本计入。

### 6.3 本月签约金额

```text
sum(contract.current_amount)
where contract 关联客户的当前设计师 = 当前员工
  and contract.business_origin = New
  and contract.signed_at in 当前自然月
  and status 属于有效签约后状态
```

用途：沿用经营指标字典“签约额”的金额口径，只按设计师归属追加筛选；不得自行改金额公式。

> 上述三项指标在实现前必须同步登记到 `docs/standards/business-metric-definitions.json`，否则前端不得正式展示。

## 7. 趋势与多维数据

### 7.1 近 30 天业务趋势

固定为滚动 30 天，按 `Asia/Shanghai` 日期分组，缺失日期由服务端补 0。

| 趋势 key | 口径 | 事件时间 |
| --- | --- | --- |
| `designerMeasureCompletedDailyCount` | 当前设计师归属房屋完成量房数 | `measure.completed_at`，为空时回退 `measure.measure_time` |
| `designerQuoteSubmittedDailyCount` | 当前设计师提交报价数 | `quote.submitted_at` |
| `designerQuoteAcceptedDailyCount` | 当前设计师报价被客户接受数 | `quote.accepted_at` |
| `designerContractEffectiveDailyCount` | 当前设计师所属客户合同生效数 | `contract.effective_at` |

任何趋势点读取失败时，该系列返回“暂不可确认”，不得用 0 补齐失败数据；成功读取后的真实 0 才显示 0。

### 7.2 当前工作分布

直接使用九张业务卡的主数量生成横向或纵向条形图，不额外查询明细。

图表只负责比较数量，不承担进入对象工作面的动作；点击图表不替代卡片入口。

## 8. 后端 Provider 契约

### 8.1 路由

```text
statistic/workbench/designer/report
```

命名遵循：

```text
statistic.service.workbench.designer.report.Report
statistic.service.workbench.designer.report.support.Report
```

要求：

- 接口继承 `Provider<Employee, DesignerWorkbenchReport>` 与 `Security`。
- 实现类使用 `@Service("statistic/workbench/designer/report")`。
- 使用 `@Scope(ScopeTypes.PROTOTYPE)`。
- 使用 `@Transactional(readOnly = true)`。
- 只接受 `@User Employee employee`，不接受前端传入角色和主键。
- 首期仅允许 `EmployeeRole.Designer`；其他角色返回权限错误。
- 返回具体模型 `DesignerWorkbenchReport`，不返回 `Map`、DTO 或 VO。

### 8.2 逻辑响应结构

```json
{
  "role": "Designer",
  "employeeId": 10001,
  "employeeName": "董夏鹏",
  "companyId": 1790000000000000001,
  "storeId": 90001,
  "dataScope": "Self",
  "generatedAt": "2026-10-08T10:30:00",
  "month": "2026-10",
  "trendStart": "2026-09-09",
  "trendEnd": "2026-10-08",
  "status": "ready",
  "summary": [
    { "key": "designerInProgressCustomerCount", "value": 12, "unit": "count" },
    { "key": "designerMonthQuoteAmount", "value": 328000, "unit": "money" },
    { "key": "designerMonthSignedAmount", "value": 188000, "unit": "money" }
  ],
  "cards": [
    {
      "key": "designerMeasurePendingCount",
      "count": 4,
      "riskCount": 1,
      "status": "ready",
      "breakdown": [
        { "key": "pendingMeasure", "count": 3 },
        { "key": "measuring", "count": 1 }
      ]
    }
  ],
  "charts": [
    {
      "key": "designer.businessTrend",
      "type": "line",
      "series": [
        {
          "key": "designerMeasureCompletedDailyCount",
          "points": [
            { "date": "2026-09-09", "value": 1 },
            { "date": "2026-09-10", "value": 0 }
          ]
        }
      ]
    },
    {
      "key": "designer.workDistribution",
      "type": "bar",
      "series": [
        { "key": "designer.measure", "value": 4 },
        { "key": "designer.design", "value": 2 }
      ]
    }
  ],
  "warnings": []
}
```

### 8.3 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `role` | String | 固定为 `Designer`，由服务端推导 |
| `employeeId` / `employeeName` | Long / String | 当前登录员工，不接受前端传入 |
| `companyId` / `storeId` | Long | 当前员工归属，由服务端读取 |
| `dataScope` | String | 首期固定 `Self` |
| `generatedAt` | LocalDateTime | 服务端生成时间 |
| `month` | String | 当前自然月，格式 `yyyy-MM` |
| `trendStart` / `trendEnd` | LocalDate | 滚动 30 天窗口，闭区间 |
| `status` | Enum | `ready` / `partial` |
| `summary[].key` | String | 稳定指标 key，前端负责中文名和单位展示 |
| `summary[].value` | Number | 数量或金额；失败时由 `status` 表达，不能用 0 伪装 |
| `cards[].key` | String | 必须与 `business-metric-definitions.json` 中登记的 Dashboard metric key 一致 |
| `cards[].count` | Integer | 卡片主数量；正常态必须为真实数量 |
| `cards[].riskCount` | Integer | 超期或高风险数量，可选 |
| `cards[].breakdown[]` | Array | 卡片细分数量，不替代主数量 |
| `charts[].series[].points[]` | Array | 趋势点；日期和服务端值一一对应 |
| `warnings[]` | Array | 部分确认、规则未映射和失败说明 |

前端不从后端获取 Icon、中文菜单名和路由；这些继续以 Web 工作台注册表、Dashboard 卡片配置和页面配置为唯一来源，通过稳定 metric key 关联。

## 9. SQL 与性能契约

### 9.1 取数原则

1. 卡片计数直接在数据库聚合，不先加载实体列表。
2. 趋势直接在数据库按时间聚合。
3. Java 只组装固定大小的聚合结果，不在循环内查库。
4. 不返回全量客户、报价、项目、材料计划或验收单。
5. 不使用列表长度代替服务端总数。
6. 不允许出现 `for each object -> query` 或 `IN` 分批逐条查询。

### 9.2 查询组织

首选两组聚合 SQL：

```text
卡片计数：UNION ALL 各 key 的 COUNT 子查询
趋势数据：UNION ALL 各事件按日期分组的 COUNT 子查询
```

如果 MySQL 执行计划或可维护性明显不佳，可以拆成有限条数、固定数量的领域聚合 SQL，但必须满足：

- SQL 条数不随业务数据量增长；
- 每条 SQL 返回聚合行，不返回业务实体；
- 所有查询保留 `com_id` 和角色数据范围；
- 所有参数使用绑定参数，不拼接前端字符串。

### 9.3 性能验收

- 端到端 P95 目标：≤ 500ms。
- 10 倍数据量下 SQL 条数不增长。
- 端到端 SQL 条数目标：≤ 10 条。
- 先测量首屏 TTFB、响应体大小、服务端耗时和 SQL 执行时间，再决定是否优化。
- 不在未测量前添加缓存、宽表或定时任务。

## 10. 权限与安全

| 项 | 首期规则 |
| --- | --- |
| 角色 | 仅 `Designer` 正常调用 |
| 数据范围 | `Self`；客户、报价、合同按当前设计师归属；项目按 `project.designer_id` |
| 跨企业 | 所有 SQL 强制 `com_id = 当前员工企业` |
| 前端参数 | 不接收 `companyId`、`empId`、`designerId`、`storeId` 作为信任输入 |
| Boss | 当前路由允许 Boss，但本 API 不默认把 Boss 当公司全量设计师；Boss 视角需要单独业务裁决 |
| 金额 | 只展示设计师可见的报价金额和签约金额；不展示成本、利润、毛利率 |
| 失败 | 整体失败返回错误；允许部分确认时必须显式返回 `partial`，不得显示伪完成 |

## 11. UI 状态

| 状态 | 表现 |
| --- | --- |
| loading | 骨架屏，不显示上一轮旧数字冒充当前值 |
| ready | 展示真实卡片数量、概览和趋势 |
| empty | 九张卡数量均为 0 时显示“当前暂无待展开工作”，趋势仍可展示 |
| partial | 仅失败卡片显示“暂不可确认”，成功卡片保留 |
| error | 页面级错误说明、刷新动作和恢复路径 |
| unauthorized | 明确无权限，不泄露其他角色或其他设计师数据 |
| stale | 显示最后更新时间；刷新后替换旧数字 |

## 12. 验收场景

### 12.1 数据正确性

- 每张卡数量与对应工作台列表的服务端总数一致。
- 同一客户、房屋、项目存在多条记录时不重复计数。
- 未参与项目不进入项目类卡片。
- 其他设计师、其他门店、其他企业数据不得进入。
- 趋势日期边界、时区和缺失日期补 0 正确。
- 金额指标与月报/经营指标口径一致，不改公式。

### 12.2 权限负向

- Marketer、Pm、Finance、StoreManager、TeamLeader 首期调用设计师 API 返回无权限。
- 设计师不能通过参数查看其他设计师的数据。
- 跨企业调用不泄露任何数量、金额或趋势。

### 12.3 性能

- 用 10 倍合成数据验证 SQL 条数不增长。
- 使用真实浏览器观察首屏，记录 TTFB、响应体大小、P95 和服务端 SQL 统计。
- 任一优化若 L4 改善但 L1 未改善，按 `DEC-037` 回滚。

### 12.4 真实渲染

- 至少验证 `1440×900`、`1280×800`、`1024×768` 三档分辨率。
- 每张卡必须显示 Icon 和数字。
- 卡片键盘可达、焦点可见、状态不只靠颜色表达。
- 页面不出现对象锚点、当前任务、完成后去向等工程字段。

## 13. 待业务确认项

以下问题在实现前需要 `T05/T06` 或用户确认，不自行选择省事版本：

1. 设计师归属优先级：`customer.designer_id`、`property.designer_id`、`quote.emp_id` 不一致时以谁为准？
   - 推荐：售前客户/房屋按 `customer.designer_id`；报价按 `quote.emp_id`；项目按 `project.designer_id`。
2. `待我设计`是否包含“无量房但已分配设计师”的房屋？
   - 推荐：不包含，必须先完成量房事实。
3. `待我选材`是否只按 `MaterialPlanStatus.Planned` 计数？
   - 推荐：是；已确认、可下单、已下单、到场均不进入“待我选材”。
4. `增减项`主数量按项目还是按变更单？
   - 推荐：主数量按项目，细分为变更单数量。
5. Boss 打开设计师业务工作台时的数据范围如何处理？
   - 推荐：首期不允许通过 Boss 身份伪造 Designer 数据；待岗位视角规则冻结后单独实现。

## 14. 下一步执行顺序

1. 本稿卡片、指标和趋势已登记；Boss 视角已按用户决定暂缓，其余按方案 A 先实现。
2. 已完成页面任务、15 个新增指标和 `designer.workbench.view` 权限登记，9 项治理门禁通过。
3. 已提交 `REQ-BIZ-20261008-001`，问题不超过 5 个。
4. 后端 Provider 与 Web 业务工作台已实现，等待真实登录后的 HTTP 端到端和业务验收。
4. 后端实现 `statistic/workbench/designer/report`，先写聚合 SQL 和查询统计。
5. 前端实现业务工作台页面，移除工程字段主视觉，接入新 Provider。
6. 真实浏览器、权限负向、SQL 统计、三档分辨率和跨端口径验证。
7. 通过后再扩展 Pm、Finance、Boss 等其他角色首页 API。
