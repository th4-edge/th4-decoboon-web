# 财务角色 · G1 迭代包（Web V3）

> 批次：`FINANCE-G1-20261007`
> 状态：**业务裁决通过 / 产品与研发冻结**
> 业务前置：`ANS-BIZ-20261007-001`、`DEC-016`、`BR-003`、`BR-006`、`BR-015`、`SCN-005`、`SCN-008`、`SOL-002`、`SOL-003`
> 上游能力：App 财务 Tab + `src/domains/finance/*` + 后端既有 `finance/*` / `document/voucher/*` Provider

---

## 1. 边界

| 项 | 内容 |
| --- | --- |
| 角色 | Finance |
| 壳层 | 岗位执行层，独立 `/finance` 工作台 |
| 数据范围 | 服务端按登录员工裁决 Company / Store / Team / Self / 项目参与关系 |
| 本批 L1 | 应收、收款、应付、付款、工人工资、供应商往来、资金台账、项目账本、项目结算、收付凭证与模板 |
| 允许的 Web 提升 | 多列对账、批量筛选、批量选择生成凭证、键盘操作、PDF 预览/打印、跳转项目工作区 |
| 本批不做 | 员工工资/提成、公司净利润、法定会计、税务、社保、完整 HR、银行直连、自由套打 |
| API 原则 | 只复用 App 正在使用的 Provider，不新增 Web 专属 API、字段或算法 |

## 2. 准入三问

1. **谁在什么状态下打开**：财务每日打开 Web，查看待收、逾期、待付、未核销、工资待发放和凭证缺口；项目完工后进入项目结算。
2. **第一个答案**：今天哪些钱必须收、哪些钱必须付、哪些账需要核销/补凭证、项目利润是否完整。
3. **唯一主行动**：按风险优先级处理一笔业务——登记收款/付款、核销、生成凭证或完成项目结算。

## 3. 三个真实租户画像

### A. 单店成长型（10–20 人）

- 使用人：财务主管 李静。
- 特征：老板兼管经营，财务同时做人事费用和项目收付款。
- 入口：财务工作台 → 待收/待付 → 资金台账 → 项目账本。

### B. 2–3 店成长型（20–30 人）

- 使用人：总部财务 陈宁，店长查看本店经营。
- 特征：项目并行、供应商账期分散、月底需要按项目批量出凭证。
- 入口：供应商往来 → 应付 → 付款 → 凭证模板/出凭证。

### C. 小团队兼任型（3–8 人）

- 使用人：老板/设计师兼任财务。
- 特征：没有专职财务，常从 App 看结果，在 Web 做批量对账和归档。
- 入口：财务工作台 → 应收/应付 → 项目账本，使用平台基线凭证。

## 4. 四个核心场景

### 场景 A · 月初催收

- 触发：财务登录发现 3 个项目应收逾期。
- 当前动作：在应收列表按逾期排序，核对合同节点和已收金额。
- 系统下一步：直接登记收款并自动核销，台账同步，可生成收款凭证。
- 异常：接口失败显示“暂不可确认”，保留重试，不用 0 覆盖未知金额。

### 场景 B · 采购到货后的应付与付款

- 触发：材料员确认到货，系统生成供应商应付。
- 当前动作：财务在应付列表按供应商、到期日和紧急程度筛选。
- 系统下一步：安排付款、核销应付、写资金台账，按需生成付款凭证。
- 异常：付款金额超过未付、重复提交、已付清继续付款均被服务端阻断。

### 场景 C · 工资发放

- 触发：工人工资应付到期。
- 当前动作：财务筛选 `工人工资` 应付，安排付款并选择个人工人。
- 系统下一步：核销应付、写台账、生成个人工资凭证；历史付款可补录工人并按原凭证重打。
- 边界：**工人工资链路不等于员工工资/提成。**

### 场景 D · 项目完工结算

- 触发：项目进入完工/待结算。
- 当前动作：财务打开项目账本，核对合同、回款、应付、实际成本与利润。
- 系统下一步：生成/确认结算，结清后关闭；质保金按业务日期释放。
- 异常：成本不完整时利润和毛利率为空，显示“成本未完整”；结算关闭前必须结清应收应付。

## 5. 页面与路由

| 路由 | 页面原型 | 唯一主行动 | App 对应 |
| --- | --- | --- | --- |
| `/finance/workbench` | A 决策页 | 下钻风险并处理下一笔 | `pages/finance/index` |
| `/finance/receivables` | D 专业列表 | 维护应收节点 / 登记收款 | `finance/receivables` |
| `/finance/receipts` | D 专业列表 | 核对回款与凭证 | `finance/receipts` |
| `/finance/payables` | D 专业列表 | 创建应付 / 安排付款 | `finance/payables` |
| `/finance/salaries` | D 专业列表 | 工人工资应付与付款 | `finance/payables?type=salary` |
| `/finance/payments` | D 专业列表 | 核对付款、补录工人 | `finance/payments` |
| `/finance/partners` | D 专业列表 | 对供应商往来与账期 | `finance/partners` |
| `/finance/ledger` | D 专业列表 + 批量 | 记账 / 更正 / 批量出凭证 | `finance/ledger` |
| `/finance/projects` | D 专业列表 | 进入项目核算 | `finance/projects` |
| `/finance/projects/:projectId` | C 对象工作空间 | 推进结算或处理项目资金 | `finance/project` |
| `/finance/vouchers` | F 单据文档 | 预览/打印/归档凭证 | `finance/vouchers` |
| `/finance/voucher-templates` | E 表单抽屉（整页） | 套用并保存企业模板 | `finance/voucher-templates` |

## 6. 桌面端信息优先级

1. **结论**：待收/逾期、待付/逾期、本月现金流、成本完整度、项目利润完整度。
2. **行动**：逾期催收、到期付款、待补工人、未出凭证、待结算项目。
3. **证据**：业务明细、项目、客户/供应商、款项记录、台账、PDF 与留痕。

## 7. 复用与组件策略

- 复用现有 `PanelCard`、`MoneyText`、`StatusTag`、`EmptyState`、`SkeletonBlock`、`CostIncompleteValue`。
- 页面壳层不创建第二套状态标签、空态或金额格式器。
- 表格使用 Element Plus `el-table`；凭证工作区使用多选 + 行选择保留策略。
- 表单使用 `el-drawer`，避免把专业列表改造成 CRUD 页面。
- 所有业务金额显示使用服务端字段；页面只做格式化，不做正式口径计算。

## 8. Provider 对齐矩阵

| Web 能力 | 既有 Provider | App 调用点 |
| --- | --- | --- |
| 财务总览 | `finance/summary/report` | `finance/index.vue` |
| 项目账本 | `finance/project/page`、`finance/project/report` | `finance/projects.vue`、`finance/project.vue` |
| 应收 | `finance/receivable/page/save/update` | `finance/receivables.vue`、`finance/entry.vue` |
| 收款 | `finance/receipt/page/save` | `finance/receipts.vue`、`finance/entry.vue` |
| 应付 | `finance/payable/page/report/save/update` | `finance/payables.vue`、`finance/entry.vue` |
| 付款 | `finance/payment/page/save/update` | `finance/payments.vue`、`finance/entry.vue` |
| 供应商往来 | `finance/partner-ledger/report` | `finance/partners.vue` |
| 资金台账 | `finance/ledger/page/report/save/update/delete/correct` | `finance/ledger.vue`、`finance/entry.vue` |
| 凭证 | `document/voucher/page/report/build` | `finance/vouchers.vue`、`finance/ledger.vue` |
| 凭证模板 | `document/template/page/save`、`document/baseline/list` | `finance/voucher-templates.vue`、`finance/voucher-template.vue` |
| 结算 | `finance/settlement/page/save/update/retention-release` | `finance/project.vue` |

## 9. 验收门槛

- 正向：应收节点 → 收款 → 台账 → 凭证；应付 → 付款 → 台账 → 凭证。
- 正向：项目账本成本完整时显示利润；成本不完整时显示“成本未完整”且利润为空。
- 反向：重复收付款、超额核销、已结清重复付款、重复凭证、重复结算必须被服务端拒绝。
- 权限：非财务角色不可进入财务路由；服务端继续拦截跨企业、跨店、跨项目和越权数据。
- 凭证：同笔重打同号；合并只允许同一对方 + 同一项目 + 同款项类型；无模板时回退平台基线。
- 渲染：1440 / 1280 / 1024 三档真实浏览器检查；不得只以 type-check 代替页面验收。
