# Finance S1 切片：菜单 IA 落地 + 凭证/模板注册验收

- 日期：2026-10-11
- 批次：`FINANCE-S1-SLICE-20261011`
- 范围：财务菜单信息架构落地 + 凭证/模板页注册表接线（低风险结构切片，不含权限与业务口径变更）
- 环境：Web `http://127.0.0.1:8080` + 后端 `http://127.0.0.1:8090`（本地 dev）；账号：财务 吴濛濛 19900000002

## 一、本轮完成

1. 新增 `docs/product/finance/WEB-FINANCE-ROLE-NATURE-AND-MINDSET.md`（角色特征与财务思维定位，S0 前置）。
2. 新增 `docs/product/finance/WEB-FINANCE-PAGE-INVENTORY.md`（16 条路由五类资产分类 + 主链责任矩阵 + 缺口）。
3. 新增 `docs/product/finance/WEB-FINANCE-MENU-FROZEN.md`（菜单冻结稿，裁决 D1–D7）。
4. 新增 `docs/product/finance/WEB-VOUCHER-DESIGNER-GAP-LIST.md`（凭证设计器三道门禁缺口 + 旁路缺口）。
5. `docs/standards/workbench-navigation.json`：
   - `finance.ledger` 标签「资金台账与凭证」→ **「资金台账」**，并把已冻结的 `document/voucher/build` 接入其 `actionPolicyKeys`；
   - **新增 `finance.voucher`**（收付凭证，kind=workspace，补 `stageFocusSource` 与 `primaryActionByState`）；
   - **新增 `finance.voucherTemplate`**（凭证模板，kind=aggregate，与 `designer.template` 同型）。
6. `src/roles/workbenchConfig.ts`：财务菜单由 2 组 4 项财务入口 → **6 组 15 项**；补齐收款记录、付款记录、工人工资、供应商往来、客户退款、**收付凭证、凭证模板**、员工工资、员工提成、提成负向调整、项目账本；「业务工作台」由 `/workbench` 修正为 `/finance/workbench`；移除语义不明的「项目工地」三项（选材/意见投诉/整改）。
7. **事实修正**：`DEF-WEB-005`「出凭证动作未注册」已过期——`document/voucher/build` 已于 **2026-10-10 冻结**；已在 `WEB-治理迁移台账.md` 精确化为「退款 / 薪酬(payroll) / 项目结算三类动作未登记，而页面已实现写入口」。

## 二、门禁

- `npm run type-check` PASS
- `npm run build` PASS
- 九项 `check:*` 全部 PASS
- `check:workbenches`：新增两条目**无告警**；总告警 15 条均为既有项（designer.* / finance.receivable / finance.payable / finance.ledger）

## 三、真实浏览器复验（财务 吴濛濛）

| # | 检查项 | 结果 |
| --- | --- | --- |
| 1 | 登录落地页 | **PASS**：`/finance/workbench`（菜单「业务工作台」已指向财务首页） |
| 2 | 侧栏菜单 | **PASS**：6 组 15 项 —— 业务工作台 / 待我收款 / 收款记录 / 待我付款 / 付款记录 / 工人工资 / 供应商往来 / 资金台账 / 客户退款 / **收付凭证** / **凭证模板** / 员工工资 / 员工提成 / 提成负向调整 / 项目账本 |
| 3 | 「收付凭证」入口 | **PASS**：进入 `/finance/vouchers`，渲染凭证列表、类型/状态筛选与「去资金台账出凭证」，页面含边界说明「不等于法定会计凭证」 |
| 4 | 「凭证模板」入口 | **PASS**：进入 `/finance/voucher-templates`，渲染模板库（我的模板 + 平台基础模板）、快速版式/高级设计器切换、版本信息（工资发放凭证 · 付款单 · V4 · 已发布 V2） |
| 5 | 「资金台账」标签 | **PASS**：标签与入口一致（原「资金台账与凭证」到不了凭证页） |
| 6 | 控制台 | **PASS**：Console Errors 0 / Warnings 0 |
| 7 | 截图 | `finance-voucher-templates-1440.png` |

## 四、本轮新发现（未修，登记）

1. **动作注册覆盖不足（修正后的 `DEF-WEB-005`）**：`business-action-policies.json` 49 条动作中财务仅 **11 条**（应收/收款/应付/付款/台账 4 动作/台账分类 3 动作）；**退款、薪酬(payroll)、项目结算三类动作未登记**，但 `FinanceRefundsView`（登记退款）、`FinanceEmployeeSalariesView`（生成·确认工资单、员工发放）、项目核算（结算）**都已实现写入口** → 契约层面只能显示「待业务确认」。
2. **`MET-005` 同名不同公式**：Web「本月回款」=`monthReceiptAmount` vs App=`monthIncome`（业务库已记录实测 8,780 / 28,130）。
3. **凭证设计器三档 + PDF 回归未完成**（上一轮 run `PARTIAL`），另缺打印分页可视化、列宽拖动、逐行高/合并单元格/上传底图的业务裁决。

## 五、后续

1. 业务裁决：退款 / 薪酬 / 结算动作注册；`MET-005` 口径统一；`GAP-003` 成本利润与报价快照。
2. 凭证设计器：按 `WEB-VOUCHER-DESIGNER-GAP-LIST.md` 补门禁 A/B/C 与三档/PDF 回归。
3. 规范回写建议：`WEB-角色页面开发作业规范.md` §2 增列第 5 类「E 专业列表 / 对账台」。
