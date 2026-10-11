# Web 店长（StoreManager）角色特征与思维定位（S0 前置分析）

> 状态：`S0 前置分析（2026-10-11）`
> 用途：动手前先把「店长是谁、按什么思维判断对错」定住，作为页面、菜单与验收的判据。
> 业务事实源：`zhuangdeqing-business` —— `DEC-032 / BR-028`（BOSS 全角色与一人装企边界）、`DEC-016`（财务边界）、`BR-003`（成本权限）、`BR-010`、`SCN-005`、`docs/product/roles/WEB-ROLE-SCENARIO-MATRIX.md`（StoreManager 行）。
> App 基准：`th4-decoboon-app` `src/roles/permission.ts`（storeManager 能力清单）、`src/roles/catalog.ts`（Tab 映射）。
> 上游规范：`WEB-角色页面开发作业规范.md`（S0/S1）。
> 本文不新增、不修改任何金额、成本、利润、权限或数据范围口径。

---

## 一、一句话定位

> **店长是本店经营结果的第一责任人：他既要看结果（成本与毛利可见），又管资源（指派、交接、开工），但不改账（财务动作只读）。**

与其它角色的分界：

- 与 **Designer**：设计师对「我这一单」负责；店长对「本店这一期」负责。
- 与 **Pm**：Pm 推进单个项目的履约；店长决定**谁去做**（指派设计师/项目经理）并兜本店的经营风险。
- 与 **Finance**：财务改账；店长**能看不能改**（`view:cost` / `view:finance` / `view:payroll` 只读，`act:contractConfirm` / `act:projectCreate` / `act:startStage` 是内部确认类动作）。

---

## 二、与其它角色的差异（思维层）

| 维度 | Designer | Pm | Finance | **StoreManager** |
| --- | --- | --- | --- | --- |
| 空间视角 | `Self`（本人客户） | `Self`（本人项目） | `Company`（全公司汇总） | **`Store`（本店）** |
| 时间视角 | 当下这一单 | 当前阶段 | 期间（账期/月份） | **本店当期经营**（今天 + 本月） |
| 生产什么 | 创造事实（方案/报价） | 推进事实（施工/验收） | 不生产，只核对归档 | **调度资源 + 确认内部节点** |
| 核心动作 | 生成、提交 | 推进、留证 | 核对、核销、出凭证 | **指派、交接、确认签约/立项、开阶段、处置风险** |
| 成本与毛利 | 不可见 | 不可见 | 可见 | **可见**（`view:cost` / `view:catalog-cost`） |
| 财务写入 | — | — | 可写 | **只读**（`view:finance`） |
| 错误代价 | 报价错 → 重报 | 验收错 → 驳回 | 款项错 → 冲正 | **跨店越权 / 指派错人 / 代业主确认** |
| 首屏第一答案 | 这个客户下一步做什么 | 哪个项目要推进 | 今天的钱对不对 | **本店今天最该处理的风险与经营缺口** |

**推论（对页面的直接约束）**：

1. **一切数据范围必须以「本店」为界**；跨店不可见，越权指派必须被拦并给出原因。
2. **成本/毛利可见**是店长的特征能力 → 页面不得因为"非财务角色"就把成本藏掉（这是 Web 侧当前的主要疑点，见清单缺口）。
3. **店长不代业主确认**：他能确认签约/立项/开工，但业主验收确认必须业主本人（小程序）。

---

## 三、店长的四条思维公理（判据 → 约束）

### 公理 1 · 我只看得到本店，也只需要看到本店
- **判据**：数据范围 `Store`；跨店/跨企业一律不可见。
- **约束**：页面筛选与列表不得出现"全部门店"这类无意义选项；跨店反例必须进验收用例；越权指派的失败原因要可读（不是一句"无权限"）。

### 公理 2 · 我要的是「本店经营结论 + 可干预的动作」
- **判据**：店长的首答是**经营缺口与风险**，不是流水台账。
- **约束**：门店视图必须给结论（本店合同额/回款/成本毛利/风险数），而不是把明细全抛给他；每个结论要能下钻到可干预的动作（指派、交接、确认、处置）。

### 公理 3 · 成本与毛利可见，但不得放大
- **判据**：`BR-003` 规定标准采购成本与项目毛利只向 BOSS、店长、财务开放；采购执行价不得被解释为综合成本。
- **约束**：成本/毛利区必须标注口径与"不可外推"；**成本不完整时利润为空**（公理同财务：禁止伪利润）；不得把采购执行价当毛利依据。

### 公理 4 · 我能确认内部节点，但不能替业主确认
- **判据**：`act:contractConfirm` / `act:projectCreate` / `act:startStage` 属店长；业主验收确认必须业主本人（`BLOCKED_OWNER_SESSION`）。
- **约束**：店长页面出现的确认类动作必须区分「内部确认」与「业主确认」；业主侧步骤在 Web 显示责任人与去向，不提供入口。

---

## 四、App 侧店长能力基线（用于对齐）

从 `src/roles/permission.ts` 的 `storeManager` 能力清单提炼（Web 需逐项对齐入口与否）：

| 能力组 | 关键能力 | Web 现状（2026-10-11） |
| --- | --- | --- |
| 客户 | `view:customers`、`act:followCustomer`、`act:scheduleMeasure`、`act:inviteCustomer` | 有本店客户页；跟进/量房入口在客户 360 内 |
| 设计报价 | `view:design`、`edit:quote`、`act:quote`、`act:talk` | 有 `/designer/quotes`（谈单） |
| 合同项目 | `act:contractPrepare`、**`act:contractConfirm`**、**`act:projectCreate`**、**`act:startStage`**、`act:stageNotApplicable` | 合同确认/立项已在「待我签约」修复；开工/判定撤销在 PM 页（店长被路由拒，见缺口） |
| 指派 | **`act:assignDesigner`**、`act:inviteMember` | **无入口**（缺口） |
| 成本 | `view:cost`、`view:catalog-cost`、`edit:catalog` | **Web 未体现**（缺口） |
| 财务 | `view:finance`（只读）、`view:payroll`、`edit:attendance`、`view:commission` | 资金台账/本店薪酬/薪酬工作台已按只读开放；**考勤编辑**无入口（缺口） |
| 其他 | `view:selection-board`、`view:rectify`、`view:notice`、`view:performance` | 选材/整改有；门店经营结果**无页面**（缺口） |

---

## 五、下一步（S1）

页面清单与主链责任矩阵见 `WEB-STOREMANAGER-PAGE-INVENTORY.md`；菜单冻结稿见 `WEB-STOREMANAGER-MENU-FROZEN.md`。
