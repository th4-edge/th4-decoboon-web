# Web 规范 GAP 台账

> 记录 Web 规范与实现过程中发现、但**必须由业务智能体裁决**的口径冲突。
> 关闭前，Web 不得就冲突项自行选择实现方式。

| 编号 | 主题 | 状态 | 发现日期 | 说明 |
| --- | --- | --- | --- | --- |
| `GAP-WEB-001` | 业主确认主体口径不一致 | **CLOSED** | 2026-10-06 | 按对象分权 |
| `GAP-WEB-002` | 设计师 Excel 式报价字段与写入路径 | **CLOSED** | 2026-10-06 | 按 Q4 冻结 |
| `GAP-WEB-003` | 批量套模板缺少 App 兼容 Provider | **OPEN** | 2026-10-06 | 见下 |
| `GAP-WEB-004` | 空阶段验收服务端门禁 | **OPEN** | 2026-10-06 | 见下 |
| `GAP-WEB-005` | 设计分项「0为赠送」文案与后端门禁冲突 | **CLOSED** | 2026-10-06 | 用户确认 0=赠送 |
| `GAP-WEB-008` | 店长财务只读与 Web 路由/按钮冲突 | **CLOSED** | 2026-10-07 | 已修复并 G3 验证 |
| `GAP-WEB-009` | 风险队列 TeamLeader 读侧缺失 | **OPEN** | 2026-10-07 | 见下 |
| `GAP-WEB-010` | 客户负责人变更原因未落库 | **OPEN** | 2026-10-07 | 见下 |

---

## GAP-WEB-001 · 业主确认主体口径不一致

> **状态：CLOSED（2026-10-06）**
> 裁决依据：`ANS-BIZ-20261006-001`、`DEC-015`
> 授权人：用户（2026-10-06 授权业务智能体裁决）

### 原现象

App 两份产品设计分别规定：

| 来源 | 口径 |
| --- | --- |
| `docs/product/2026-09-21-合同增减项业务流程与交互设计.md` §2.5 | **客户不登录小程序**；客户确认由项目经理/负责人**现场代登记**（拍照 + 签名），不开放客户自助入口 |
| `docs/product/2026-09-21-阶段验收整改闭环业务流程与交互设计.md` §2.3 | 业主确认 / 驳回 **仅业主本人**（授权会话）；**员工不得代录** |

### 裁决结论（按对象分权）

这不是同一对象上的互斥口径，而是两种对象的不同确认方式：

| 对象 | 确认主体 | 证据与留痕 | Web 设计师端 |
| --- | --- | --- | --- |
| 合同变更（增减项） | 客户现场签认，项目经理或授权内部角色代登记 | 签名 + 照片；同时记录客户签认事实与内部操作人 | 只展示状态、签认证据和下一步；不得自建客户自助入口，也不得把代登记伪装成客户自助确认 |
| 阶段验收 / 整改复验 | **仅业主本人** | 业主授权会话；员工不得代确认或代驳回 | 只展示验收状态、证据和整改轮次；不得提供代录按钮 |

### 影响与处置

- 合同变更代登记后进入 `CustomerConfirmed`，由服务端统一触发履约重算；无签认证据不得通过。
- 阶段验收必须等待业主本人确认或驳回；无业主会话时保持 `Pending` 或整改中。
- 两类对象的接口、权限、审计和前端文案必须分开，禁止用“客户确认”一个词混淆。
- `GAP-WEB-002` 与本项均已关闭；Web G1/G1.5 可按已冻结基线继续实现。

---

## GAP-WEB-002 · 设计师 Excel 式报价的可编辑字段与写入路径

> **状态：CLOSED（2026-10-06）**
> 裁决依据：`docs/product/consultations/ANS-BIZ-20261002-002-设计师Excel式报价五问答复.md` **Q4**
> 状态：`approved_for_product_freeze`

### 裁决结论（以 Q4 为准）

设计师在 **Draft** 报价中**可编辑**：

| 字段 | 说明 |
| --- | --- |
| 工程量 | |
| 工程量公式 | 白名单公式（Q2） |
| 销售侧材料单价 | |
| 人工单价 | |
| 行级优惠 | 行级折扣 |
| 固定总价 | **仅当该行计价模式为 `FixedTotal`** |

**不可编辑 / 不可见**：标准成本、采购执行价、供应商历史价、项目综合成本、毛利率、利润、
服务端计算的正式行金额 / 区域小计 / 总价、已提交 / 已接受 / 已转合同报价。

**全局折扣、税率、最终签约价**：仅 Boss / 店长 / 财务。

### App / Web 写入路径分工（冻结）

| 端 | 入口 | 承载能力 |
| --- | --- | --- |
| App | `quote/line/save`（既有） | **保持现状不变**：仅工程量等既有入参；**不得改其契约、状态机与页面行为** |
| Web | `quote/lines/save`（Web 专用批量） | 工程量、工程量公式、材料价、人工价、固定总价、行级优惠 |

**明确禁止**：

1. 用 App 单行入口 `quote/line/save` 冒充"四项可写"——该入口只接受工程量，
   且会把材料价/人工价按项目库强制覆盖（实测：请求 `materialPrice=999`，实际仍为 6.00，接口不报错）；
2. 让不支持的字段被**静默忽略**——服务端返回成功但字段未生效时，前端不得显示"已保存"。

### 对前次记录的更正

本 GAP 早期版本记为"`quantity_formula` 只有写没有读"，**该结论不成立**，更正如下：

- `quantity_formula` **在 `quote/designer/info` 的投影白名单内**（`Info.java` 的 QuoteLine 允许列表含该字段）；
- 它此前未出现在响应中，是因为数据库 552 行**全部为 NULL**（从未写入），序列化省略了空值；
- 实测写入公式后，重新读取**能正常返回** `quantityFormula`。

### 关联实现

- Web 批量保存：`src/domains/trade/api.ts#saveQuoteLines`
- 只读投影补 `catalogItem`：后端提交 `103f168`
- 空间归属数据完整性：ECD-013，后端提交 `8330cad`

---

## （历史）GAP-WEB-002 早期记录

### 背景

V2 为「Excel 式报价工作区」在后端新增了三项资产，**App 完全未使用**：

| 资产 | 位置 | 证据 |
| --- | --- | --- |
| `quote/lines/save`（批量保存） | `quote/service/lines/batchsave/` | App 只用 `quote/line/save`（单条） |
| `quote/workbook/build`（导出 xlsx） | `quote/service/workbook/build/` | App 无调用 |
| `quote/workbook/import`（导入 xlsx） | `quote/service/workbook/importer/` | App 无调用 |
| `quote_line.quantity_formula` 字段 | 迁移 `69-报价工程量公式.sql` | 注释写明「Web工程量公式（服务端权威计算）」 |

### 用户已明确的方向（2026-10-06）

> **构建 Web 端的核心推动力是：设计师无法在 App 端快捷方便地进行方案报价。**
> 因此**报价是 Web 端的核心**，方案报价页面必须按 V2 的设计报价页面设计，
> **完全保障 V2 设计报价页面的功能被完全复用**。

### 因此本 GAP 的真实问题

不是「要不要做 Excel 报价」（已决定要做），而是：

1. **工程量公式（`=F2*2` 这类）是不是真实设计师需求？** 还是 V2 自造的复杂度？
2. 若是真实需求，**App 是否也需要？** 若需要，该能力应升格为**全局能力**（后端统一实现、两端可用），
   而不是「Web 工程量公式」；若 App 不需要，需说明为什么同一岗位在不同端需要不同的报价能力。
3. `quantity_formula` 字段与 `quote/workbook/*` 路由的**最终定位**：
   - 升格为通用能力（推荐）→ 需重命名/重注释，去掉「Web」前缀，并纳入跨端契约
   - 保持 Web 优先能力 → 需按 `GAP-WEB-003` 的例外治理条件备案

### 2026-10-06 实测补充（真实响应）

用真实报价（`Q1790922726872`，67 行）调 `quote/designer/info` 核对，67 行的**字段并集**为：

```text
itemId · space · role · differenceType · differenceStatus · included · discountAmount
· components · type · category · name · unit · quantity · materialPrice · manualPrice
· pricingMode · price · amount · formula · craft · brand · spec · sort
```

**结论：`quantity_formula` 不在返回字段中。**

因此工程量公式当前处于「**只有写、没有读**」的不完整状态：

| 环节 | 状态 |
| --- | --- |
| 数据库 `quote_line.quantity_formula` | ✅ 存在（迁移 69） |
| 批量保存 `quote/lines/save` | ✅ 可写入 |
| 读取 `quote/designer/info` | ❌ **不返回** |
| App 侧 | ❌ 完全未使用 |

> 这意味着 Excel 式报价的"公式"能力**无法端到端闭环**。裁决时必须一并决定：
> 是否补齐读取投影，以及在补之前该功能是否对外可见（否则会出现"能存不能看"的假能力）。

### 影响面

- 报价行是否支持公式化工程量（数据结构）
- 报价能否整表导入/导出（工作流）
- App 与 Web 报价能力是否分叉（跨端一致性）
- 后端是否长期维护一套仅 Web 使用的资产

### 处置

- 状态：`OPEN`，等待 `zhuangdeqing-business` 裁决。
- 关闭前：Web V3 报价**按 V2 功能基线实现**（功能目标已定），但
  **不扩大使用范围**——不新增第三个 Web 专用接口，不改 `quantity_formula` 语义。

---

## GAP-WEB-003 · 批量套模板缺少 App 兼容 Provider

> **状态：OPEN（2026-10-06）**
> 影响：G1.5 / V2 报价功能基线中的「批量套模板」

### 现象

G1.5 与 V2 报价功能基线要求「批量套模板」，但当前 App 与后端没有设计师报价模板的一等对象或 Provider：

- 后端不存在 `QuoteTemplate` 实体、`quote/template/*` Provider 或 App 对 `QuoteTemplate` 的调用点；
- 现有 `PackageTemplate` / `HybridQuoteBuilder` 是套餐报价生成能力，不能直接等同于“设计师自定义报价模板”；
- V2 工程研究中的 `QuoteTemplate` 仍是设计候选，不得把设计草案当作已实现 API。

### 影响

- 无法在不新增 Web 专属 API 的前提下实现真正的“批量套模板”。
- 若用前端复制某份报价行来冒充模板，会绕过模板归属、版本、可用范围、金额与成本口径，禁止。

### 待裁决问题

1. 报价模板是否作为一等业务对象（`QuoteTemplate`）建设，还是复用企业套餐/项目库组合？
2. 模板的归属、可见范围、版本、启停、快照和审计规则是什么？
3. 模板应用后是更新现有 Draft 行，还是生成新版本？失败行如何逐条反馈？

### 处置

- 状态：`OPEN`，需业务/后端先定义 App 兼容 Provider；关闭前 Web 不实现“批量套模板”。
- 当前已实现的 Web 批量能力：表头批量改价、Excel 导入导出、行级版本差异、多行选择删除。
- 多行选择删除复用既有删除 Provider；最终真实落库与可还原验收不依赖本 GAP 关闭。

---

## GAP-WEB-004 · 空阶段验收服务端门禁

> **状态：OPEN（2026-10-06）**
> 影响：阶段验收首次提交

### 现象

`BR-008` 要求“阶段任务全部完成后”才能提交验收。当前后端
`ProjectContext.submitAcceptance` 只检查是否存在未完成任务：

```java
boolean unfinished = tasks.stream().anyMatch(task -> !TaskStatus.Done.equals(task.getStatus()));
```

当阶段没有任何任务时，`unfinished=false`，只要上传现场证据即可推进为 `Pending`。
Web 已在页面层阻断“无任务 / 有未完成任务”的提交，但 App / 其他 Provider 调用仍可能绕过。

### 待裁决问题

1. 无任务阶段是否允许提交验收，还是必须至少存在一项已完成的阶段任务？
2. 若确实允许无任务阶段，是否需要明确的对象类型、状态和证据要求？
3. 后端与 App 是否统一增加 `tasks.isEmpty()` 门禁并补充回归测试？

### 处置

- 状态：`OPEN`，需业务智能体裁决后，由后端/App 统一修正。
- Web 暂按保守口径阻断无任务和未完成任务阶段，不以页面文案替代服务端门禁。
- 关闭前不得宣称“阶段验收提交已完成真实端到端验收”。

---

## GAP-WEB-005 · 设计分项「0为赠送」文案与后端门禁冲突

> **状态：CLOSED（2026-10-06）**
> 裁决依据：**用户明确决策（2026-10-06）**——设计分项允许「0 赠送」，数量为 0；
> 设计分项是 Web 优于 App 的关键能力，可在 App 原有基础上扩展，不受 App 现有功能限定。
> 授权人：用户

### 结论

设计分项**允许数量 0（赠送）**：数量 0 表示赠送，单价仍取项目库基价，金额与成本为 0；
负数一律阻断。该口径在**后端统一实现**（服务端计算，前端不自定义金额语义），两端一致。

### 后端落地（金额口径变更，已全量回归）

把「工程量 > 0」统一放宽为「工程量 >= 0（0=赠送），负数阻断」：

| 位置 | 变更 |
| --- | --- |
| `QuoteCalcContext` | `positive()` → `nonNegative()`（负数阻断）；`amount/cost/calculate/components` 接受 0；`unitPrice` 改为直接取项目库基价，数量 0 不再触发除零 |
| `design/items/save`（`BatchSave`） | 允许 0，负数报「工程量不能为负数」 |
| `quote/lines/save`（`QuoteWorkbookContext`） | 允许 0 |
| `QuoteWorkbookImportContext` | 导入允许 0 |
| `QuoteFormulaContext` | 公式结果允许 0 |

回归：`QuoteCalcContextTest` 新增 0 赠送用例与 unitPrice 零数量用例；`DesignItemBatchSaveTest` 新增 0 赠送落库与负数整批拒绝用例；**全量 `mvn test` 479 项通过**。

### Web 落地（V2 基线复制到 V3）

- Web 设计分项工作区按 V2 复制：**自动保存（防抖）+ `design/items/save` 整表原子提交 + 保存后读回核对 + 草稿缓存/防丢行**；
- 数量输入最小 0，文案「0 表示赠送」；负数在前端即阻断；
- 真实设计师账号实测：新增分项（自动保存落库）→ 数量改 0（DB 数量 0、单价 80 保留、金额 0）→ 删除（DB 归 0），控制台 0 error。

### 边界

- 金额、成本、利润仍由服务端计算；0 赠送不改变「成本完整才给利润」等其他口径。
- 负数永远阻断，不因 0 合法而放开。
- App 文案「0为赠送」现与后端一致，无需再单侧改文案。

---


---

## GAP-WEB-006 · 财务 L2 员工工资与提成 Web 工作台未接入

> **状态：OPEN（2026-10-07）**
> 影响：财务角色完整体系中的 L2 员工工资、提成、考勤与工资条

### 现象

业务事实源已通过 `DEC-017` / `BR-015` 冻结员工工资与提成 P0 口径，但当前 App 财务模块只有 `Payable(Salary)` 工人工资链路，没有与员工工资/提成同等的 App 页面、领域模型和共享 Provider 闭环。

### 影响

- Web 不能复用稳定的 App Provider，也无法在不新增 Web 专属接口的前提下实现员工工资与提成页面。
- 若把现有工人工资 `Payable(Salary)` 冒充员工工资，会违反分链、成本归属和敏感权限规则。
- 本批财务 G1 只能覆盖 App 已实现的 L1 财务闭环；L2 必须在 Backend/App 先形成共享能力后再进入 Web。

### 待裁决与前置

1. 员工薪酬方案、考勤、工资单、工资项、提成明细和工资条是否需要独立 Backend Provider。
2. App 是否先完成员工工资/提成的同等业务页面与服务端闭环。
3. 工资敏感字段、成本归属、退款/跨期负向调整的跨端读取投影何时冻结。

### 处置

- 状态：`OPEN`，等待 Backend/App 共享能力就绪后，再由业务智能体裁决 Web 工作台。
- 当前 Web 仅提供 `工人工资` 链路；页面明确“员工工资/提成不在本批范围”。
- 不新增 Web 专属工资 API、字段、算法或假数据。

---

## GAP-WEB-007 · 存量业务对象选择器迁移未完成

> **状态：IN_PROGRESS（2026-10-07）**
> 影响：Web 各角色已有页面中仍可能使用普通下拉或一次性列表承载远程业务对象
> 盘点：`docs/development/WEB-FORM-PICKER-INVENTORY.md`
> 升级计划：`docs/development/WEB-FORM-PICKER-REMEDIATION-PLAN.md`

### 现状

`DEC-021` / `BR-019` 已冻结业务对象专用选择器规范，`DEC-022` / `BR-020` 进一步冻结 Web 项目选择器引导式布局。本批已将财务表单中的项目、应收、应付、工人切换为对象专用选择器，账务分类切换为树形选择器；其他角色和存量区域尚未完成全量审计。

### 处置

- 新页面和新字段立即使用对应业务对象的专用选择器；只有枚举或稳定封闭字典可使用普通下拉。
- 项目、客户/房屋、账务分类、报价分项、工人、供应商、员工、应收应付分别表达自身业务模型。
- 统一的是选择入口、搜索分页、选择/清除、失败恢复、上下文联动和服务端复核，不是统一列表外观。
- 存量页面按角色/业务主链分批审计，不允许通过临时放大 `size` 绕过规范。
- 关闭条件：App/Web 业务对象选择入口完成清单化审计，存量高风险入口迁移并完成权限、分页、搜索、清除和上下文切换验收。


---

## GAP-WEB-008 · 店长财务只读与 Web 路由/按钮冲突

> **状态：CLOSED（2026-10-07）**
> 关闭证据：`docs/acceptance/runs/20261007-web-storemgr-finance-readonly-g3/`
> 影响：StoreManager 本店财务只读面
> 上游：`FinanceAccessContext.requireReader`（含 StoreManager）、`BR-003`、`BR-029`、`WEB-ROLE-SCENARIO-MATRIX` 店长行

### 现象

业务已冻结「店长财务只读」：后端 `FinanceAccessContext.requireReader(Boss, Finance, StoreManager)`，`resolveProject` 将店长限制在本店项目，店长可读本店应收/应付/收付款/台账/凭证，并可见本店成本与毛利。

Web 侧存在两处冲突：

1. 路由 `/finance` 的 `meta.roles = ['Finance','Boss']`，且守卫中 `!['Finance','Boss'].includes(role) && isFinanceArea(path)` 直接跳 `forbidden`，店长被整体挡在财务区之外；
2. 店长导航 `ROLE_NAV_KEYS.StoreManager` 却包含 `finance`（指向 `/finance/workbench`），入口可见但进入即被拒；
3. 财务各视图（应收/应付/收款/付款/台账）未按角色裁剪写按钮，若放开路由，店长会看到本不该有的写入口。

### 影响与处置

- 店长与业务要求的「本店财务只读」不一致：应能进入本店财务只读面，且无写按钮。
- 处置方向（待本批研发实现，不改业务口径）：财务区允许 StoreManager 进入只读态；写按钮按动作注册表角色裁剪；越权写仍由后端 `requireEditor` 兜底拒绝。
- 关闭条件：店长可进入本店财务只读页；应收/应付/收款/付款/台账/凭证无写入口；跨店对象返回无权；后端越权写被拒。

### 实证（2026-10-07）

真实店长账号 `19900000003`（王洪文，store `1790000000000000002`）登录后：

```text
工作台导航出现「商务财务 建设中」入口
直接访问 /finance/workbench -> 重定向 /forbidden，页面「无权访问该页面」
```

临时口令已还原，原 hash 恢复后临时口令返回 `AUTH_FAILED`；本轮未产生业务写入。

### 关闭记录（2026-10-07）

- `/finance` 路由放行 `StoreManager`，`isFinanceArea` 守卫同步放行。
- 新增 `src/domains/finance/access.ts`，财务视图按 `canWrite` 裁剪写入口；店长只读态显示「本店财务只读」。
- 凭证模板 `voucherTemplate.manage` 对店长保持开放。
- 店长令牌直调 `finance/receipt/save`、`finance/ledger/save`、`document/voucher/build` 均 403，无业务写入。
- 未覆盖：跨店负向（本地测试企业单门店）、店长风险队列与转交/指派 UI（后续批次）。

---

## GAP-WEB-009 · 风险队列 TeamLeader 读侧缺失

> **状态：OPEN（2026-10-07）**
> 影响：TeamLeader 负责人风险队列
> 上游：`SCN-016`（适用角色含 TeamLeader）、`workbench-navigation.json#boss.risk`（roles 含 TeamLeader）、`BR-030`

### 现象

`workbench-navigation.json` 的 `boss.risk` 登记读取角色为 `Boss / StoreManager / TeamLeader`，`SCN-016` 适用角色也含团队负责人；`RiskDispositionContext.requireDisposer` 允许非管理角色处置**本人负责**的风险。

但读侧 `BusinessAlertContext.report` 仅 `requireRole(Boss, Finance, StoreManager)`，TeamLeader 调用 `statistic/risk/report` 会被拒绝，因此 TeamLeader 无法进入风险队列。

### 影响与处置

- TeamLeader 的「处理本团队当前风险」缺少读侧 Provider，现有 `boss.risk` 入口对 TeamLeader 不可用。
- 需业务/后端裁决 TeamLeader 风险可见范围（本团队 vs 本人负责）并补齐读侧；在此之前 Web 风险队列路由仅对 Boss/Finance/StoreManager 开放。
- 关闭条件：TeamLeader 可读取被裁决范围内的风险清单，且动作权限与 `requireDisposer` 一致。
- 已提交业务裁决：`REQ-BIZ-20261007-017`（业务智能体目录）。

---

## GAP-WEB-010 · 客户负责人变更原因未落库

> **状态：OPEN（2026-10-07）**
> 影响：客户负责人变更审计留痕
> 上游：`business-action-policies.json#customer/owner-change`（前置条件「必须明确变更原因」、审计含「原因」）

### 现象

Web 动作注册表要求 `customer/owner-change` 变更前二次确认并留「原因 + 原负责人 + 新负责人 + 操作人 + 时间」。

实际后端 `customer/customer/update`（`Update.java`）只有 `customerId` 与 `ownerId` 等业务字段，**没有 reason 入参**，也未写独立变更审计；店长实际只能更新 owner，原因无处提交、无处留痕。

### 影响与处置

- 与冻结动作的幂等/审计要求不一致：变更事实存在，但「原因」未持久化。
- 处置方向：后端补 `reason` 入参与变更审计（或由既有审计通道承载），Web 再补原因输入框；在补齐前 Web 不伪造原因留痕。
- 关闭条件：负责人变更可提交原因并在审计/时间线中可查，且与原/新负责人、门店、团队、操作人、时间一致。
- 已提交业务裁决：`REQ-BIZ-20261007-017`（业务智能体目录）。
