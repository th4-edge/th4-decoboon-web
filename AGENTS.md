# AGENTS.md — th4-decoboon-web

装得清 · 家装企业全角色 Web 经营工作台。本工程为 2026-10-06 起的重建版。

## 第一性依据（必读）

| 文档 | 地位 |
| --- | --- |
| `docs/standards/WEB-建设核心思路.md` | 四条公理，不可协商 |
| `docs/standards/WEB-开发规范.md` | Web 开发唯一总纲 |
| `docs/standards/WEB-业务选择器与表单设计规范.md` | 业务选择器、表单、单据化录入的唯一执行规范 |
| `docs/standards/WEB-业务概念全生命周期规范.md` | 业务概念注册、选择器、已选回显、枚举中文与自动门禁的唯一治理规范 |
| `docs/standards/WEB-业务状态机与闭环一致性规范.md` | 客户、房屋、项目、报价、合同、账务、验收等状态机与闭环一致性的唯一治理规范 |
| `docs/standards/WEB-业务动作与闭环注册规范.md` | 业务动作、权限、前置条件、幂等、审计和跨对象刷新范围的唯一治理规范 |
| `docs/standards/WEB-业务指标与权限注册规范.md` | 经营指标公式、缺失值、角色数据范围、敏感字段和权限边界的唯一治理规范 |
| `docs/standards/WEB-业务页面系统注册规范.md` | 页面状态、字段格式、页面任务、组件行为和验收场景的唯一治理规范 |
| `docs/standards/APP-能力与理念研究.md` | 上游依据：App 的角色闭环、交互理念、状态与路由地图 |
| 全局技能 `zhuangdeqing-business` | 业务事实唯一来源 |

**业务对象、状态、角色权限、数据范围、金额/成本/利润口径只以上述业务事实源为准；本工程不新增、不修改任何业务口径。**

## 表单与选择器总规范（强制）

所有 Web 表单、业务对象选择器、抽屉、弹窗、单据和结果确认界面，必须遵循 `docs/standards/WEB-业务选择器与表单设计规范.md`、`docs/standards/WEB-业务概念全生命周期规范.md`、`docs/standards/WEB-业务状态机与闭环一致性规范.md`、`docs/standards/WEB-业务动作与闭环注册规范.md`、`docs/standards/WEB-业务指标与权限注册规范.md` 和 `docs/standards/WEB-业务页面系统注册规范.md`。新页面先走 T15/T16/T17 和业务裁决；存量页面按 `docs/development/WEB-FORM-PICKER-INVENTORY.md` 和 `docs/development/WEB-FORM-PICKER-REMEDIATION-PLAN.md` 分批升级。每次改动后必须运行 `npm run check:forms`、`npm run check:concepts`、`npm run check:states`、`npm run check:actions`、`npm run check:metrics`、`npm run check:permissions` 与 `npm run check:page-system`。

---

## 业务裁决先行（强制）

后续任何 Web 新增页面、角色工作台、业务流程、接口消费或交互改版，编码前必须先向 `zhuangdeqing-business` 提交 `T05` 研发咨询单，取得 `T06` 业务咨询答复或 `T12` 业务裁决与研发交接单后，才能进入产品规划和研发。裁决未完成时只允许调研、证据整理和需求澄清，不得先写业务页面或用前端兜底代替业务结论。

---


## 业务对象专用选择器（强制）

所有业务对象选择必须遵循业务智能体 `DEC-021` / `BR-019`、`DEC-023` / `BR-021`、`DEC-024` / `BR-022`、`DEC-025` / `BR-023`、`DEC-026` / `BR-024`、`DEC-028` / `BR-026`：

- 新选择器或改版必须先填写 `T15-业务概念选择器设计评审单`；涉及表单时同时填写 `T16-表单分区与结果确认评审单`；稳定单据动作还要填写 `T17-单据化表单评审单`，取得 `T06/T12` 裁决后才能研发。

- 不是一个统一业务对象选择器；项目、客户、房屋、账务分类、报价分项、工人、供应商、员工、应收、应付各自按业务模型构建专用选择器。
- 统一的是选择入口、搜索分页、选择/清除、回传、失败恢复、上下文联动和服务端复核。
- 项目参考 App 财务项目选择器并采用 Web 引导式布局：左侧门店/设计师/项目经理，顶部状态/来源，主区项目卡片；打开即展示，搜索仅作精细查找。
- 客户与房屋保留多房屋关系，业务需要房屋时显式选择。
- 账务分类必须使用树形选择，禁止 `children` 扁平化为普通列表。
- 报价分项参考 `DesignCatalogPicker.vue`：分类树、品牌/系列/规格、区域、多选数量。
- 低层远程选择壳只负责加载/分页/错误/回传；不得承载项目、分类、报价分项等业务语义。
- Element Plus 使用简体中文 locale，日期、月份、星期和默认文案不得出现英文。

## 四条公理

1. **App 为准**——业务逻辑、状态、动作、权限结论以 App 为准，Web 不得自创。
2. **不新开 API**——只消费 App 已在使用的 Provider；需要新数据回到 App 与后端决策。
3. **不复刻 App**——业务语义跟 App 走，交互形态按电脑端重新设计（批量/对账/并行/键盘/密度）。
4. **禁止堆砌与 CRUD**——不允许功能菜单堆砌，不允许从后端模型推导增删改查页面。

## 项目智能体

| 智能体 | 职责 |
| --- | --- |
| `decoboon-web-frame` | 页面该不该做、原型选择、电脑端交互提升；守禁止堆砌与 CRUD |
| `decoboon-web-parity` | 业务逻辑、动作、状态、权限、Provider 与 App 对齐；守不新开 API |
| `decoboon-web-acceptance` | 真实浏览器三档验收、权限负向、状态完整、金额口径、反模式排查 |

## 安全底线

- **禁止发布生产**：`scripts/deploy-web.sh` 为拒绝执行的守卫；线上 Web 源码在
  `../th4-decoboon-web-v1v2-archive`。切换条件见 `docs/operations/DEPLOY-BOUNDARY.md`。
- **App 线上兼容优先**：共享后端只做向后兼容的加法，不得改变 App 已依赖的路由、参数、
  字段语义、状态机与金额口径。

## 停用内容

2026-10-06 停用的首版 5 个智能体与 9 份规范见 `_停用/20261006/`，仅作参考。
