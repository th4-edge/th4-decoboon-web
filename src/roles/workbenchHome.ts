/**
 * 角色首页「场景工作台」**静态清单**（每个角色一份，显式枚举、无运行时判断）。
 *
 * 架构口径（用户裁决 2026-10-11，见 `docs/standards/WEB-前端架构方向-按角色静态化.md`）：
 * Web 端重构后**不再需要逻辑注册表**。每个角色沉淀自己的**静态路由**（`src/roles/routes.ts`）、
 * **静态菜单**（`src/roles/workbenchConfig.ts`）与**静态首页入口清单**（本文件）。
 * 三者都不参与任何运行时判断（不按 `roles: []` 过滤、不做按角色的深链接解析、不查表兜底）。
 *
 * 因此本文件是首页卡片的**唯一数据源**：`WorkbenchHomeView` 直接取
 * `HOME_WORKBENCHES[角色]` 渲染，`PmWorkbenchView` 直接取 `HOME_WORKBENCHES.Pm`。
 *
 * 维护规则（改这里之前先读）：
 * 1. **一份数据只属于一个角色**：同名 key 在不同角色下是**两条独立数据**，可各自改标签与落地页，
 *    不需要（也不允许）再抽公共「注册表 + 角色过滤」。
 * 2. **`to` 必须是该角色静态路由集合里真实可达的路径**（`src/roles/routes.ts`）。当前 7 个角色的
 *    每条 `to` 都已逐一核对可达；`null` 表示本角色无落地页，卡片不展示「进入」按钮。
 * 3. **不伪造数据**：`decisionStatus !== 'approved'` 的卡片只展示场景说明与「待业务确认」，
 *    不展示入口（`EXP-013`）。
 * 4. 本清单由 `check:workbenches` 门禁校验（key 唯一、`to` 在本角色路由内、菜单 key 一致）。
 *    历史数据来自已删的 `docs/standards/workbench-navigation.json`（2026-10-11 退场），
 *    **不要**再从注册表生成或回填。
 *
 * 与菜单的关系：菜单（`workbenchConfig.ts`）是**左侧导航**的结构；本文件是**首页卡片**的内容。
 * 两者刻意分开：首页卡片带场景说明/对象锚点/交接，菜单只有标签与路径；同一 key 在两边都应存在，
 * 差异由门禁报告（`npm run audit:menus`）指出，而不是靠运行时逻辑抹平。
 */
import type { EmployeeRole } from '@/domains/identity/model'

export type HomeWorkbenchPriority = 'P0' | 'P1' | 'P2'
export type HomeWorkbenchDecision = 'approved' | 'pending_business_review'

export interface HomeWorkbenchEntry {
  /** 稳定 key，与 `src/roles/workbenchConfig.ts` 的菜单项 key 同名，便于门禁对照。 */
  key: string
  /** 卡片标题。 */
  label: string
  /** 卡片左上角「域 · 组」的域标签。 */
  domainLabel: string
  /** 卡片左上角「域 · 组」的组标签。 */
  groupLabel: string
  /** 进入场景说明（什么状态下该来这里）。 */
  scenario: string
  /** 对象锚点：进来后手里拿着什么对象。 */
  objectAnchor: string
  /** 当前任务：这个工作台主推的唯一动作。 */
  mainAction: string
  /** 完成后交接：做完之后去哪里。 */
  handoff: string
  priority: HomeWorkbenchPriority
  decisionStatus: HomeWorkbenchDecision
  /** 落地路径；`null` 表示本角色无落地页，卡片不展示入口。 */
  to: string | null
}

const e = (entry: HomeWorkbenchEntry): HomeWorkbenchEntry => entry

/**
 * 逐角色静态首页入口清单。**数组顺序即展示顺序**（首页不再做任何排序）。
 *
 * 当前顺序 = 迁移前的既有顺序：先按 `priority`（P0 → P1 → P2），同优先级内按标签中文排序。
 * 这是**行为保持**的迁移结果，不是刻意设计的产品顺序。
 * 待裁决：是否改为「意图顺序」（① 需要我处理 → ② 推进中的对象 → ③ 经营结论/只读/工具/自助）。
 * 因为本文件已改为人工维护，顺序若要按意图固化，应在下一次首页打磨轮一次性重排并回归截图。
 */
export const HOME_WORKBENCHES: Record<EmployeeRole, HomeWorkbenchEntry[]> = {
  Boss: [
    e({
      key: 'store.overview',
      label: '本店经营结果',
      domainLabel: '经营分析',
      groupLabel: '经营风险',
      scenario: '店长查看本店客户、报价、项目、任务与成员构成，并定位今天可直接干预的事项',
      objectAnchor: 'store + recent customers/projects',
      mainAction: '查看事实并进入对应场景工作台处理',
      handoff: '进入本店客户/风险/项目工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/store-overview'
    }),
    e({
      key: 'boss.risk',
      label: '待我处置风险',
      domainLabel: '经营分析',
      groupLabel: '经营风险',
      scenario: '负责人查看风险、超期、待审批、异常或跨角色交接',
      objectAnchor: 'risk queue + selected customer/project',
      mainAction: '按分类处置当前事项',
      handoff: '进入对应角色工作台或对象工作空间',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/risk'
    }),
    e({
      key: 'finance.payable',
      label: '待我付款',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '应付待付、部分、逾期或待核销',
      objectAnchor: 'project + payable',
      mainAction: '登记付款并核销',
      handoff: '台账、成本、项目核算相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/payables'
    }),
    e({
      key: 'designer.followup',
      label: '待我跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '预约量房前客户存在逾期、今日、3 天内或未安排的下次跟进，需要当前设计师处理',
      objectAnchor: 'customer + activeProperty',
      mainAction: '写跟进并根据结果安排下一次跟进或转入量房',
      handoff: '跟进后按真实结果进入量房工作台或继续客户经营',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/followup'
    }),
    e({
      key: 'designer.measure',
      label: '待我量房',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '房屋待量房或量房中，需要当前责任人推进',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一量房动作',
      handoff: '量房完成后进入设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/measure'
    }),
    e({
      key: 'designer.contract',
      label: '待我签约',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '合同待签约、已签约未生效或需要交接',
      objectAnchor: 'customer + quote + contract',
      mainAction: '执行当前状态唯一合同交接动作',
      handoff: '合同生效后进入项目工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/contract'
    }),
    e({
      key: 'designer.design',
      label: '待我设计',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '设计需求存在，方案待推进或待完成',
      objectAnchor: 'customer + activeProperty + design',
      mainAction: '执行当前状态唯一设计动作',
      handoff: '方案达到可报价条件后进入报价工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/design'
    }),
    e({
      key: 'finance.receivable',
      label: '待我收款',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '应收待收、部分、逾期或待核销',
      objectAnchor: 'project + receivable',
      mainAction: '登记收款并核销',
      handoff: '台账、凭证、项目回款相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/receivables'
    }),
    e({
      key: 'designer.quote',
      label: '待我谈单',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '报价草稿、待客户决策或驳回改版需要当前角色处理',
      objectAnchor: 'customer + activeProperty + quote',
      mainAction: '执行当前状态唯一报价动作',
      handoff: '客户接受后进入合同工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/quotes'
    }),
    e({
      key: 'customer.followup',
      label: '客户跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '客户需要跟进、建档或邀约量房',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一跟进动作',
      handoff: '量房完成后进入量房/设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/customers'
    }),
    e({
      key: 'team.overview',
      label: '团队经营概览',
      domainLabel: '业务工作台',
      groupLabel: '业务工作台',
      scenario: '团队负责人查看本团队客户、报价、项目、任务与通知的只读经营事实',
      objectAnchor: 'team + recent customers',
      mainAction: '查看事实并进入对应场景工作台',
      handoff: '进入本团队客户或项目工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/team-overview'
    }),
    e({
      key: 'pm.project',
      label: '项目推进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '项目准备、进行、暂停或验收阶段需要当前角色推进',
      objectAnchor: 'project + projectStage',
      mainAction: '推进当前阶段/任务',
      handoff: '进入选材、增减项、验收或财务工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/projects'
    }),
    e({
      key: 'pm.change',
      label: '增减项',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '客户已完成线下确认并形成增减项变更单后，设计师/授权角色查看项目工地中的已有变更单并进入详情推进',
      objectAnchor: 'project + contract + contractChange + contractChangeItem',
      mainAction: '查看项目已有增减项并进入变更单详情',
      handoff: '点击变更单进入详情；新增增减项从项目工地对应项目发起',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/contract-changes'
    }),
    e({
      key: 'pm.acceptance',
      label: '整改跟进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验',
      objectAnchor: 'project + projectStage + acceptance + acceptanceRound',
      mainAction: '查看整改中阶段并进入阶段验收工作区提交复验',
      handoff: '提交复验后由业主本人确认或再次驳回；员工不得代业主确认',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/rectification'
    }),
    e({
      key: 'pm.materialSelection',
      label: '主材选材',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '签约后客户已确认主材选择，需由设计师逐项代录并交付财务下单；已进入采购的换材改走增减项',
      objectAnchor: 'project + contractLine + materialSelection + materialPlan',
      mainAction: '逐项现场代录选材并保存交付财务下单',
      handoff: '交付后由财务决定供应商、价格和数量；已进入采购的换材走增减项',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/material-selection'
    }),
    e({
      key: 'finance.ledger',
      label: '资金台账',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款后需要对账、查看流水或生成凭证',
      objectAnchor: 'project + ledger + voucher',
      mainAction: '查看流水并处理对账或凭证',
      handoff: '凭证归档、项目核算相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/ledger'
    }),
    e({
      key: 'finance.storePayroll',
      label: '本店薪酬',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '店长需要查看本店员工工资构成（应发、扣款、实发与工资项状态）',
      objectAnchor: 'storePayrollItem（门店范围内的员工工资项）',
      mainAction: '查看本店员工工资构成；确认类动作不在此页',
      handoff: '叶子页：本店薪酬为门店经营结果投影，无下游工作台；明细疑问回到员工工资单与考勤事实核对',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/store-payroll'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉并提交处理回复',
      handoff: '提交回复后等待业主确认关闭；员工不能代业主关闭',
      priority: 'P1',
      decisionStatus: 'pending_business_review',
      // 未裁决：员工在意见/投诉里的动作范围未定（GAP-WEB-015）。落地页已实现（/workbench/customer-feedback），
      // 裁决前**不给入口**（卡片只显示「待业务确认」），因此这里必须为 null 而不是把路径写成数据。
      to: null
    }),
    e({
      key: 'finance.voucherTemplate',
      label: '凭证模板',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '企业需要按自己的版式套打业务凭证，或使用平台行业基础模板',
      objectAnchor: 'voucherTemplate（平台基础模板 / 企业模板 / 版本）',
      mainAction: '复制平台模板并按企业版式发布新版本',
      handoff: '发布后由 finance.ledger / finance.voucher 按发布版本生成凭证；模板修改不回溯历史凭证',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/voucher-templates'
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'finance.voucher',
      label: '收付凭证',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款或手工记账后需要生成、预览、打印归档业务凭证',
      objectAnchor: 'voucher + ledger + project',
      mainAction: '预览、打印或归档当前业务凭证',
      handoff: '台账与项目核算投影刷新；凭证归档供对账留档',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/vouchers'
    }),
    e({
      key: 'finance.payroll',
      label: '薪酬工作台',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '财务需要一屏看清本月薪酬走到哪一步：待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数',
      objectAnchor: 'payrollWorkbenchReport（按周期）',
      mainAction: '按报告指向的下一步进入员工工资页处理当前周期薪酬',
      handoff: '进入员工工资/员工提成/提成负向调整/本店薪酬工作面',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/payroll'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  StoreManager: [
    e({
      key: 'store.overview',
      label: '本店经营结果',
      domainLabel: '经营分析',
      groupLabel: '经营风险',
      scenario: '店长查看本店客户、报价、项目、任务与成员构成，并定位今天可直接干预的事项',
      objectAnchor: 'store + recent customers/projects',
      mainAction: '查看事实并进入对应场景工作台处理',
      handoff: '进入本店客户/风险/项目工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/store-overview'
    }),
    e({
      key: 'boss.risk',
      label: '待我处置风险',
      domainLabel: '经营分析',
      groupLabel: '经营风险',
      scenario: '负责人查看风险、超期、待审批、异常或跨角色交接',
      objectAnchor: 'risk queue + selected customer/project',
      mainAction: '按分类处置当前事项',
      handoff: '进入对应角色工作台或对象工作空间',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/risk'
    }),
    e({
      key: 'designer.contract',
      label: '待我签约',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '合同待签约、已签约未生效或需要交接',
      objectAnchor: 'customer + quote + contract',
      mainAction: '执行当前状态唯一合同交接动作',
      handoff: '合同生效后进入项目工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/contract'
    }),
    e({
      key: 'designer.quote',
      label: '待我谈单',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '报价草稿、待客户决策或驳回改版需要当前角色处理',
      objectAnchor: 'customer + activeProperty + quote',
      mainAction: '执行当前状态唯一报价动作',
      handoff: '客户接受后进入合同工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/quotes'
    }),
    e({
      key: 'customer.followup',
      label: '客户跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '客户需要跟进、建档或邀约量房',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一跟进动作',
      handoff: '量房完成后进入量房/设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/customers'
    }),
    e({
      key: 'pm.project',
      label: '项目推进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '项目准备、进行、暂停或验收阶段需要当前角色推进',
      objectAnchor: 'project + projectStage',
      mainAction: '推进当前阶段/任务',
      handoff: '进入选材、增减项、验收或财务工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/pm/workbench'
    }),
    e({
      key: 'pm.change',
      label: '增减项',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '客户已完成线下确认并形成增减项变更单后，设计师/授权角色查看项目工地中的已有变更单并进入详情推进',
      objectAnchor: 'project + contract + contractChange + contractChangeItem',
      mainAction: '查看项目已有增减项并进入变更单详情',
      handoff: '点击变更单进入详情；新增增减项从项目工地对应项目发起',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/contract-changes'
    }),
    e({
      key: 'pm.acceptance',
      label: '整改跟进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验',
      objectAnchor: 'project + projectStage + acceptance + acceptanceRound',
      mainAction: '查看整改中阶段并进入阶段验收工作区提交复验',
      handoff: '提交复验后由业主本人确认或再次驳回；员工不得代业主确认',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/rectification'
    }),
    e({
      key: 'pm.materialSelection',
      label: '主材选材',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '签约后客户已确认主材选择，需由设计师逐项代录并交付财务下单；已进入采购的换材改走增减项',
      objectAnchor: 'project + contractLine + materialSelection + materialPlan',
      mainAction: '逐项现场代录选材并保存交付财务下单',
      handoff: '交付后由财务决定供应商、价格和数量；已进入采购的换材走增减项',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/material-selection'
    }),
    e({
      key: 'finance.ledger',
      label: '资金台账',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款后需要对账、查看流水或生成凭证',
      objectAnchor: 'project + ledger + voucher',
      mainAction: '查看流水并处理对账或凭证',
      handoff: '凭证归档、项目核算相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/ledger'
    }),
    e({
      key: 'finance.storePayroll',
      label: '本店薪酬',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '店长需要查看本店员工工资构成（应发、扣款、实发与工资项状态）',
      objectAnchor: 'storePayrollItem（门店范围内的员工工资项）',
      mainAction: '查看本店员工工资构成；确认类动作不在此页',
      handoff: '叶子页：本店薪酬为门店经营结果投影，无下游工作台；明细疑问回到员工工资单与考勤事实核对',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/store-payroll'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉并提交处理回复',
      handoff: '提交回复后等待业主确认关闭；员工不能代业主关闭',
      priority: 'P1',
      decisionStatus: 'pending_business_review',
      // 未裁决：员工在意见/投诉里的动作范围未定（GAP-WEB-015）。落地页已实现（/workbench/customer-feedback），
      // 裁决前**不给入口**（卡片只显示「待业务确认」），因此这里必须为 null 而不是把路径写成数据。
      to: null
    }),
    e({
      key: 'finance.voucherTemplate',
      label: '凭证模板',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '企业需要按自己的版式套打业务凭证，或使用平台行业基础模板',
      objectAnchor: 'voucherTemplate（平台基础模板 / 企业模板 / 版本）',
      mainAction: '复制平台模板并按企业版式发布新版本',
      handoff: '发布后由 finance.ledger / finance.voucher 按发布版本生成凭证；模板修改不回溯历史凭证',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/voucher-templates'
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'finance.voucher',
      label: '收付凭证',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款或手工记账后需要生成、预览、打印归档业务凭证',
      objectAnchor: 'voucher + ledger + project',
      mainAction: '预览、打印或归档当前业务凭证',
      handoff: '台账与项目核算投影刷新；凭证归档供对账留档',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/vouchers'
    }),
    e({
      key: 'finance.payroll',
      label: '薪酬工作台',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '财务需要一屏看清本月薪酬走到哪一步：待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数',
      objectAnchor: 'payrollWorkbenchReport（按周期）',
      mainAction: '按报告指向的下一步进入员工工资页处理当前周期薪酬',
      handoff: '进入员工工资/员工提成/提成负向调整/本店薪酬工作面',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/payroll'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  // ⚠️ **锁定角色：TeamLeader 的 Web 页面锁定不做**（用户裁决 2026-10-11）。
  // 以下内容为**冻结基线**：只允许缺陷修复，不得新增/改造页面、菜单项或首页卡片，也不得为它排期。
  // App 侧 TeamLeader 能力与业务规则仍然有效；Boss 作为能力超集仍涵盖团队负责人能力（≠ TeamLeader 本人有 Web 页面）。
  TeamLeader: [
    e({
      key: 'boss.risk',
      label: '待我处置风险',
      domainLabel: '经营分析',
      groupLabel: '经营风险',
      scenario: '负责人查看风险、超期、待审批、异常或跨角色交接',
      objectAnchor: 'risk queue + selected customer/project',
      mainAction: '按分类处置当前事项',
      handoff: '进入对应角色工作台或对象工作空间',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/risk'
    }),
    e({
      key: 'customer.followup',
      label: '客户跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '客户需要跟进、建档或邀约量房',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一跟进动作',
      handoff: '量房完成后进入量房/设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/team-customers'
    }),
    e({
      key: 'team.overview',
      label: '团队经营概览',
      domainLabel: '业务工作台',
      groupLabel: '业务工作台',
      scenario: '团队负责人查看本团队客户、报价、项目、任务与通知的只读经营事实',
      objectAnchor: 'team + recent customers',
      mainAction: '查看事实并进入对应场景工作台',
      handoff: '进入本团队客户或项目工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/team-overview'
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  Marketer: [
    e({
      key: 'customer.measure',
      label: '我的量房',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '本人客户的量房事项：未预约、已预约、待派单与逾期（App 侧业务员首页快捷「我的量房」）',
      objectAnchor: 'customer + activeProperty + measure',
      mainAction: '预约或调整量房时间',
      handoff: '量房结论由指定设计师完成；指派设计师由店长或企业负责人执行，不在业务员范围',
      priority: 'P0',
      decisionStatus: 'approved',
      // 消费 App 已在用的 statistic/boss/measure/report（非新开接口）；服务端按角色裁剪为本人客户。
      to: '/workbench/measure'
    }),
    e({
      key: 'customer.followup',
      label: '客户跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '客户需要跟进、建档或邀约量房',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一跟进动作',
      handoff: '量房完成后进入量房/设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/my-customers'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，查看与本人在跟进客户相关的已有记录（App 侧业务员具备 view:feedback）',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉与处理进展',
      handoff: '处理进展由项目相关员工在小程序侧推进；业务员在 Web 只读查看',
      priority: 'P1',
      decisionStatus: 'approved',
      // 页面已存在（/workbench/customer-feedback，DesignerCustomerFeedbackView）；业务员角色天然只读。
      // 「受理/回复/关闭」动作是否向业务员开放待 GAP-WEB-015 裁决——只读查看不受该裁决影响。
      to: '/workbench/customer-feedback'
    }),
    e({
      key: 'marketer.performance',
      label: '我的业绩',
      domainLabel: '经营与工具',
      groupLabel: '经营与工具',
      scenario: '本人客户转化结论：本月录入/量房率/跟进、阶段结构、黄金期分布、同岗排名与最近客户（App 侧业务员首页快捷「我的业绩」）',
      objectAnchor: 'marketer + period（业务员本人 + 统计周期）',
      mainAction: '看结论并进入需要推进的客户或报价',
      handoff: '从结论进入「我的客户」对应阶段继续推进',
      priority: 'P1',
      decisionStatus: 'approved',
      // 消费 App 已在用的 statistic/marketer/report（非新开接口）；只读结论，前端不做金额/比率/排名计算。
      to: '/workbench/my-performance'
    }),
    e({
      key: 'pm.project',
      label: '签约后流转',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '本人客户签约立项后的项目进展（只读）：施工阶段与任务状态（App 侧业务员首页快捷「签约后流转」）',
      objectAnchor: 'project + projectStage + projectTask',
      mainAction: '查看阶段与任务进度',
      handoff: '只读跟踪；开工、任务、阶段与成员调整由项目经理/店长/企业负责人执行',
      priority: 'P1',
      decisionStatus: 'approved',
      // 只读面：App 项目详情对业务员只加载 info + stages + tasks（日报/成员/验收/投诉不加载）。
      // 金额只展示合同额；已收/回款率/成本/毛利均不生成区块（业务员无 view:finance，成本属 BR-006 红线）。
      to: '/workbench/my-projects'
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  Designer: [
    e({
      key: 'designer.followup',
      label: '待我跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '预约量房前客户存在逾期、今日、3 天内或未安排的下次跟进，需要当前设计师处理',
      objectAnchor: 'customer + activeProperty',
      mainAction: '写跟进并根据结果安排下一次跟进或转入量房',
      handoff: '跟进后按真实结果进入量房工作台或继续客户经营',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/followup'
    }),
    e({
      key: 'designer.measure',
      label: '待我量房',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '房屋待量房或量房中，需要当前责任人推进',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一量房动作',
      handoff: '量房完成后进入设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/measure'
    }),
    e({
      key: 'designer.contract',
      label: '待我签约',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '合同待签约、已签约未生效或需要交接',
      objectAnchor: 'customer + quote + contract',
      mainAction: '执行当前状态唯一合同交接动作',
      handoff: '合同生效后进入项目工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/contract'
    }),
    e({
      key: 'designer.design',
      label: '待我设计',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '设计需求存在，方案待推进或待完成',
      objectAnchor: 'customer + activeProperty + design',
      mainAction: '执行当前状态唯一设计动作',
      handoff: '方案达到可报价条件后进入报价工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/design'
    }),
    e({
      key: 'designer.quote',
      label: '待我谈单',
      domainLabel: '客户经营',
      groupLabel: '设计报价',
      scenario: '报价草稿、待客户决策或驳回改版需要当前角色处理',
      objectAnchor: 'customer + activeProperty + quote',
      mainAction: '执行当前状态唯一报价动作',
      handoff: '客户接受后进入合同工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/quotes'
    }),
    e({
      key: 'customer.followup',
      label: '客户跟进',
      domainLabel: '客户经营',
      groupLabel: '客户经营',
      scenario: '客户需要跟进、建档或邀约量房',
      objectAnchor: 'customer + activeProperty',
      mainAction: '执行当前状态唯一跟进动作',
      handoff: '量房完成后进入量房/设计工作台',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/my-customers'
    }),
    e({
      key: 'pm.project',
      label: '项目推进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '项目准备、进行、暂停或验收阶段需要当前角色推进',
      objectAnchor: 'project + projectStage',
      mainAction: '推进当前阶段/任务',
      handoff: '进入选材、增减项、验收或财务工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/designer/projects'
    }),
    e({
      key: 'pm.change',
      label: '增减项',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '客户已完成线下确认并形成增减项变更单后，设计师/授权角色查看项目工地中的已有变更单并进入详情推进',
      objectAnchor: 'project + contract + contractChange + contractChangeItem',
      mainAction: '查看项目已有增减项并进入变更单详情',
      handoff: '点击变更单进入详情；新增增减项从项目工地对应项目发起',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/contract-changes'
    }),
    e({
      key: 'pm.acceptance',
      label: '整改跟进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验',
      objectAnchor: 'project + projectStage + acceptance + acceptanceRound',
      mainAction: '查看整改中阶段并进入阶段验收工作区提交复验',
      handoff: '提交复验后由业主本人确认或再次驳回；员工不得代业主确认',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/rectification'
    }),
    e({
      key: 'pm.materialSelection',
      label: '主材选材',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '签约后客户已确认主材选择，需由设计师逐项代录并交付财务下单；已进入采购的换材改走增减项',
      objectAnchor: 'project + contractLine + materialSelection + materialPlan',
      mainAction: '逐项现场代录选材并保存交付财务下单',
      handoff: '交付后由财务决定供应商、价格和数量；已进入采购的换材走增减项',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/material-selection'
    }),
    e({
      key: 'designer.catalog',
      label: '报价项目库',
      domainLabel: '经营与工具',
      groupLabel: '经营与工具',
      scenario: '设计师按类型、分类、品牌和规格查询可用报价项目，核对销售价构成',
      objectAnchor: '报价项目库条目',
      mainAction: '查询并核对报价项目，进入使用该项目的设计或报价工作面',
      handoff: '选中项目后回到设计方案或报价工作面引用',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/designer/catalog'
    }),
    e({
      key: 'designer.template',
      label: '方案模版',
      domainLabel: '经营与工具',
      groupLabel: '经营与工具',
      scenario: '设计师沉淀常用房型的区域骨架、报价分项与工程量公式，新建设计方案时一键起稿',
      objectAnchor: '设计模版 + 模版版本',
      mainAction: '新建/编辑并发布模版，或实例化到设计方案',
      handoff: '选中模版后进入方案报价工作区调整区域尺寸',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/designer/templates'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉并提交处理回复',
      handoff: '提交回复后等待业主确认关闭；员工不能代业主关闭',
      priority: 'P1',
      decisionStatus: 'pending_business_review',
      // 未裁决：员工在意见/投诉里的动作范围未定（GAP-WEB-015）。落地页已实现（/workbench/customer-feedback），
      // 裁决前**不给入口**（卡片只显示「待业务确认」），因此这里必须为 null 而不是把路径写成数据。
      to: null
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'designer.performance',
      label: '我的业绩',
      domainLabel: '经营与工具',
      groupLabel: '经营与工具',
      scenario: '设计师复盘本人客户、报价、签约与交付结果，定位当前经营动作',
      objectAnchor: '设计师本人 + 业绩周期',
      mainAction: '查看业绩结论并进入需要推进的报价或项目',
      handoff: '从业绩结论进入对应的报价、合同或项目工作面',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/designer/performance'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  Pm: [
    e({
      key: 'pm.project',
      label: '项目推进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '项目准备、进行、暂停或验收阶段需要当前角色推进',
      objectAnchor: 'project + projectStage',
      mainAction: '推进当前阶段/任务',
      handoff: '进入选材、增减项、验收或财务工作面',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/pm/workbench'
    }),
    e({
      key: 'pm.change',
      label: '增减项',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '客户已完成线下确认并形成增减项变更单后，设计师/授权角色查看项目工地中的已有变更单并进入详情推进',
      objectAnchor: 'project + contract + contractChange + contractChangeItem',
      mainAction: '查看项目已有增减项并进入变更单详情',
      handoff: '点击变更单进入详情；新增增减项从项目工地对应项目发起',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/contract-changes'
    }),
    e({
      key: 'pm.acceptance',
      label: '整改跟进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验',
      objectAnchor: 'project + projectStage + acceptance + acceptanceRound',
      mainAction: '查看整改中阶段并进入阶段验收工作区提交复验',
      handoff: '提交复验后由业主本人确认或再次驳回；员工不得代业主确认',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/rectification'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉并提交处理回复',
      handoff: '提交回复后等待业主确认关闭；员工不能代业主关闭',
      priority: 'P1',
      decisionStatus: 'pending_business_review',
      // 未裁决：员工在意见/投诉里的动作范围未定（GAP-WEB-015）。落地页已实现（/workbench/customer-feedback），
      // 裁决前**不给入口**（卡片只显示「待业务确认」），因此这里必须为 null 而不是把路径写成数据。
      to: null
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
  Finance: [
    e({
      key: 'finance.payable',
      label: '待我付款',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '应付待付、部分、逾期或待核销',
      objectAnchor: 'project + payable',
      mainAction: '登记付款并核销',
      handoff: '台账、成本、项目核算相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/payables'
    }),
    e({
      key: 'finance.receivable',
      label: '待我收款',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '应收待收、部分、逾期或待核销',
      objectAnchor: 'project + receivable',
      mainAction: '登记收款并核销',
      handoff: '台账、凭证、项目回款相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/receivables'
    }),
    e({
      key: 'pm.acceptance',
      label: '整改跟进',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '阶段验收被业主驳回后，项目处于整改中，需要查看问题、责任人、截止日期并进入同一验收工作区提交复验',
      objectAnchor: 'project + projectStage + acceptance + acceptanceRound',
      mainAction: '查看整改中阶段并进入阶段验收工作区提交复验',
      handoff: '提交复验后由业主本人确认或再次驳回；员工不得代业主确认',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/workbench/rectification'
    }),
    e({
      key: 'finance.ledger',
      label: '资金台账',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款后需要对账、查看流水或生成凭证',
      objectAnchor: 'project + ledger + voucher',
      mainAction: '查看流水并处理对账或凭证',
      handoff: '凭证归档、项目核算相关投影刷新',
      priority: 'P0',
      decisionStatus: 'approved',
      to: '/finance/ledger'
    }),
    e({
      key: 'finance.storePayroll',
      label: '本店薪酬',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '店长需要查看本店员工工资构成（应发、扣款、实发与工资项状态）',
      objectAnchor: 'storePayrollItem（门店范围内的员工工资项）',
      mainAction: '查看本店员工工资构成；确认类动作不在此页',
      handoff: '叶子页：本店薪酬为门店经营结果投影，无下游工作台；明细疑问回到员工工资单与考勤事实核对',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/store-payroll'
    }),
    e({
      key: 'designer.feedback',
      label: '客户意见投诉',
      domainLabel: '项目工地',
      groupLabel: '项目工地',
      scenario: '业主在小程序提交意见或投诉后，项目相关员工查看已有记录并提交处理回复',
      objectAnchor: 'project + customerFeedback',
      mainAction: '查看已有意见投诉并提交处理回复',
      handoff: '提交回复后等待业主确认关闭；员工不能代业主关闭',
      priority: 'P1',
      decisionStatus: 'pending_business_review',
      // 未裁决：员工在意见/投诉里的动作范围未定（GAP-WEB-015）。落地页已实现（/workbench/customer-feedback），
      // 裁决前**不给入口**（卡片只显示「待业务确认」），因此这里必须为 null 而不是把路径写成数据。
      to: null
    }),
    e({
      key: 'finance.voucherTemplate',
      label: '凭证模板',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '企业需要按自己的版式套打业务凭证，或使用平台行业基础模板',
      objectAnchor: 'voucherTemplate（平台基础模板 / 企业模板 / 版本）',
      mainAction: '复制平台模板并按企业版式发布新版本',
      handoff: '发布后由 finance.ledger / finance.voucher 按发布版本生成凭证；模板修改不回溯历史凭证',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/voucher-templates'
    }),
    e({
      key: 'more.search',
      label: '全局搜索',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '用户需要精确查找客户、房屋、项目、报价、合同、单据或工作台',
      objectAnchor: 'selected object',
      mainAction: '定位对象/入口',
      handoff: '进入对应对象工作空间',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/workbench'
    }),
    e({
      key: 'finance.voucher',
      label: '收付凭证',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '收付款或手工记账后需要生成、预览、打印归档业务凭证',
      objectAnchor: 'voucher + ledger + project',
      mainAction: '预览、打印或归档当前业务凭证',
      handoff: '台账与项目核算投影刷新；凭证归档供对账留档',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/vouchers'
    }),
    e({
      key: 'finance.payroll',
      label: '薪酬工作台',
      domainLabel: '商务财务',
      groupLabel: '商务财务',
      scenario: '财务需要一屏看清本月薪酬走到哪一步：待发应付、待确认考勤、各状态工资单数、待发提成与工资条发布数',
      objectAnchor: 'payrollWorkbenchReport（按周期）',
      mainAction: '按报告指向的下一步进入员工工资页处理当前周期薪酬',
      handoff: '进入员工工资/员工提成/提成负向调整/本店薪酬工作面',
      priority: 'P1',
      decisionStatus: 'approved',
      to: '/finance/payroll'
    }),
    e({
      key: 'account.payslip',
      label: '我的工资条',
      domainLabel: '更多',
      groupLabel: '更多',
      scenario: '员工需要查看自己已发放的工资条与收入明细',
      objectAnchor: 'payslip（本人）',
      mainAction: '查看本人已发放工资条明细',
      handoff: '叶子页：员工自助查看；明细疑问回到企业薪酬事实核对，员工不可自助更正',
      priority: 'P2',
      decisionStatus: 'approved',
      to: '/account/payslips'
    }),
  ],
}

/** 取某角色的静态首页清单；角色缺省或未登记时返回空数组（不猜、不回落其他角色）。 */
export function homeWorkbenchesOf(role: EmployeeRole | null | undefined): HomeWorkbenchEntry[] {
  return role ? (HOME_WORKBENCHES[role] ?? []) : []
}
