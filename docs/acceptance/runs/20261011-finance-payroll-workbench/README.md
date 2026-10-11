# 薪酬工作台（Web）· 上线验收

- 日期：2026-10-11
- 批次：`FINANCE-PAYROLL-WORKBENCH-20261011`
- 来源：`docs/product/finance/APP-FINANCE-AND-PAYROLL-DEEP-ANALYSIS.md` §7 缺口 3（价值最高、接口已有）
- 环境：Web `http://127.0.0.1:8080` + 后端 `http://127.0.0.1:8090`（本地 dev）；账号：财务 吴濛濛 19900000002

## 一、目标

对齐 App `payroll/workbench.vue`：让财务**一屏看清「这个月的薪酬走到哪一步」**——而不是先进工资单列表再自己数。

## 二、实现

| 产物 | 内容 |
| --- | --- |
| 新页面 | `src/views/finance/FinancePayrollWorkbenchView.vue`，路由 `/finance/payroll`（name `finance-payroll`） |
| 新接口 | `financeApi.payrollWorkbench(period)` → `payroll/workbench/report`（Web 首次接入） |
| 新模型 | `PayrollWorkbenchReport`（字段与 App `normalizeWorkbench` 同源） |
| 注册表 | 新增 `finance.payroll`（kind=aggregate，deepLink `/finance/payroll?period={period}`，含 `reloadScopes` / `contextRecovery`） |
| 菜单 | 财务「薪酬」组新增「薪酬工作台」并置顶 |
| 口径统一 | `PAYROLL_SHEET_STATUS_META` + `payrollSheetStatusLabel/Tone` 入 `domains/finance/meta.ts`；`FinanceEmployeeSalariesView` 的本地状态映射改为消费共享口径（**去掉第二套**） |

页面结构（对齐 App 的 IA）：

1. **Hero 第一答案**：`{period} 待发员工薪酬`（大字）+ 周期选择 + 三个副格（已释放未发提成 / 待发布工资条 / 本周期工资单是否已生成 · 已发放张数）；
2. **最新工资单兜底卡**（与 App 同判据：`currentPeriodHasSheet=false` 且 `latestSheetPeriod ≠ period`）：显示最近一次周期 / 状态 / 实发，给「查看最近工资单」「全部工资单」；
3. **四类进度计数**：待确认考勤 / 工资单草稿 / 待发放工资单（已确认+部分发放）/ 已发布工资条（副：待发布 N）；
4. **薪酬入口**：员工工资（考勤/薪酬方案/员工发放均在此页统一承接）、员工提成、提成负向调整、本店薪酬（店长视角）。

**Web 取舍（已在页面上显式声明）**：App 把考勤、薪酬方案、员工发放做成独立页；Web 收在「员工工资」页内承接，**不单列菜单**——避免四个菜单项指向同一页面，同时不让用户误以为功能缺失。

**口径纪律**：金额与计数全部取服务端报告；`latestSheetStatus` 走 `enumKey()`（小写 key）映射，未登记状态显示「待业务确认」（`ANT-010`）。

## 三、门禁

`type-check` PASS；`build` PASS；`check:workbenches` / `check:workspaces` / `check:page-system` / `check:forms` / `check:states` / `check:actions` 全 PASS。

## 四、真实浏览器复验（财务 吴濛濛）

| # | 检查项 | 期望（来自接口） | 实际 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | 菜单入口 | — | 财务菜单出现「薪酬工作台」 | ✅ |
| 2 | `/finance/payroll`（默认本月 2026-10） | `pendingEmployeePayableAmount=0`、`pendingPayslipCount=0`、`currentPeriodHasSheet=true`、`paidSheetCount=1`、`publishedPayslipCount=1` | Hero「2026-10 待发员工薪酬 ¥0.00」+「待发布工资条 0」+「本周期工资单 已生成·已发放 1 张」；KPI：待确认考勤 0 / 工资单草稿 0 / 待发放 0 / 已发布工资条 1 | ✅ 逐项一致 |
| 3 | 兜底判据（2026-10 有工资单） | `currentPeriodHasSheet=true` → 不显示兜底卡 | 未出现「当前周期暂无工资单」 | ✅ 与 App 同判据 |
| 4 | 深链接 `?period=2026-09` | `currentPeriodHasSheet=false`、`latestSheetPeriod=2026-12` | Hero「2026-09 … 本周期工资单 未生成」；**兜底卡出现**：「最近一次：2026-12 · 实发 11800 · 草稿」+ 两个动作 | ✅ 深链接周期恢复 + 兜底路径正确 |
| 5 | `?period=2026-12` | `draftSheetCount=1` | KPI「工资单草稿 1」；兜底卡不出现（该周期已有工资单） | ✅ 一致 |
| 6 | 状态中文口径 | `latestSheetStatus` 为枚举对象 `{name:草稿,key:Draft}` | 页面显示「**草稿**」（非 `[object Object]`、非 `Draft`） | ✅ |
| 7 | 布局 | — | 1440 无横向溢出（`scrollWidth - clientWidth = 0`） | ✅ |
| 8 | 控制台 | — | Errors 0 / Warnings 0 | ✅ |

截图：`payroll-workbench-2026-12-1440x900.png`、`payroll-workbench-2026-09-fallback-1440x900.png`。

## 五、补验：三档 + 店长视角（2026-10-11 追加）

### 5.1 三档分辨率（含兜底卡状态，压测 `#extra` 按钮组最宽的场景）

| 分辨率 | 横向溢出 | 兜底卡 | KPI | 控制台 |
| --- | --- | --- | --- | --- |
| 1440×900 | 0 | ✅ 渲染 | 4 | 0 error |
| 1280×800 | 0 | ✅ 渲染 | 4 | 0 error |
| 1024×768 | 0 | ✅ 渲染 | 4 | 0 error |

截图：`payroll-workbench-fallback-1440x900.png` / `-1280x800.png` / `-1024x768.png`（均取 `?period=2026-09` 的兜底态）。

### 5.2 店长视角（`StoreManager` 19900000003）

- 页面可达，报告返回成功（非 403），只读标识「本店财务只读」出现；
- **发现并修正一处实现与 App 能力不一致**：原实现用 `v-if="canWrite"` 隐藏入口按钮 → 店长能看到「员工工资 / 员工提成 / 提成负向调整」三行却**没有进入按钮**（点不动的死行）。但 App 给店长的能力包含 **`view:payroll` + `edit:attendance`**，且 Web `/finance/*` 路由本就对店长开放 → **能进入就不该把入口藏掉**。
- 修正：入口按钮不再按 `canWrite` 隐藏，改为「能打开本页即可进入目标页」，写动作由目标页与服务端裁剪；并补一条只读说明取代原空态。复验：店长四行入口（含本店薪酬）均有「进入」；点「进入」落到 `/finance/employee-salaries` 并显示「本店财务只读」→ **导航放行、写入受限**，与 App 能力一致。
- **数据范围未证实**：店长与财务取到的 2026-10 报告数值完全相同（`paidSheetCount=1 / publishedPayslipCount=1`）。本地租户只有一家门店，**无法区分「门店范围已生效」与「门店范围未生效」**，需多门店样本才能证伪 → 登记为待验项，不宣称已通过。

## 六、未覆盖（如实登记）

- **待发员工薪酬非 0 的场景**：本地数据该值恒为 0（无已确认待发工资单），故「非零金额渲染」未取到样本。
- **门店数据范围**：同上（需多门店样本）。
- 员工提成 / 提成负向调整两个入口的跳转未逐一点击复验（菜单与路由已可达；本轮点了「员工工资」一条）。
- **员工提成 / 提成负向调整 / 员工工资** 三个入口的跳转未逐一实测（菜单已可达，本轮聚焦工作台本体）。
- **待发员工薪酬非 0 的场景**：本地数据该值恒为 0（无已确认待发工资单），故「非零金额渲染」未取到样本。

## 七、后续

1. 补三档与店长视角复验；
2. 财务第二批剩余：口径释义区块（先确认 Web 侧指标字典 Provider 是否存在）、资金闭环图；
3. Boss 侧薪酬入口是否单列（现 Boss 菜单无任何薪酬项）——需产品确认。
