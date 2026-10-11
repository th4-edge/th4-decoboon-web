# Web 业务员「签约后流转」（只读项目面）（M-4）

> 阶段：**S5 实现** ｜ 批次：**M-4** ｜ 日期：2026-10-11
> 页面：`/workbench/my-projects` ｜ 组件：`src/views/workbench/MarketerProjectsView.vue`
> 上游：`WEB-MARKETER-APP-FUNCTION-MAP.md`（§6 批次）、`WEB-MARKETER-MENU-FROZEN.md`
> App 对应：首页快捷「签约后流转」→ `pages/project/list` + `subpackages/project/pages/detail`（`view:myProjects`）

> **本批完成后，业务员冻结菜单的 6 项 / 4 组目标态全部落地。**

## 一、只读到什么程度：**严格照 App 的加载范围，而不是照"能看到什么"**

App 项目详情对业务员有一处**显式短路**（`subpackages/project/pages/detail.vue`）：

```js
if (role.value === 'marketer') {
  reports.value = []; members.value = []
  acceptances.value = []; feedbacks.value = []; rectifyItems.value = []
  return          // ← 现场日报 / 成员 / 验收 / 意见投诉 / 整改 一律不加载
}
```

**它加载的只有** `info + stages + tasks`。所以本页也只呈现这三样：

| 呈现 | 内容 |
| --- | --- |
| 项目列表 | 项目名 / 编号 / 客户 / 地址 · 状态 · 当前阶段 · 进度 · **合同额** |
| 项目详情（只读抽屉） | 基础事实（客户/地址/面积/合同额/设计师/项目经理/履约负责人/开工日）+ **施工阶段**（状态/实际开始/实际完成）+ **施工任务**（状态/负责人/计划完成） |

**不生成区块**：现场日报、项目成员管理、验收、意见投诉、整改、增减项（App 对业务员不加载）。

## 二、金额边界：本轮最需要克制的地方（含一处 App 侧口径差异）

| 字段 | 业务员是否展示 | 依据 |
| --- | --- | --- |
| **合同额** | ✅ 展示 | 与「我的业绩」的签约金额同族，App 业绩页对业务员明示 |
| 已收工程款、回款率 | ❌ **不展示** | 业务员无 `view:finance`；App 详情页也用 `canViewFinance` 门禁 |
| 实际成本、毛利、毛利率 | ❌ **绝不展示** | `BR-006` 硬红线；不是显示 0，是不生成区块 |

> ⚠️ **登记一处 App 侧口径差异（不自行裁决）**：App **项目列表页**把「合同 / 已收 / 回款率」**无条件渲染**（`pages/project/list.vue` 无 `can()` 判断），
> 而其**同一 App 的项目详情页**用 `canViewFinance` 门禁合同额。两处不一致。
> Web 侧取**更严的一侧**（详情页口径）：业务员看合同额、不看已收与回款率，并在此登记待业务澄清。

## 三、不做（App 对业务员均有门禁）

| 不做 | App 依据 |
| --- | --- |
| 邀请业主加入项目 | `canInviteOwner = role !== 'marketer' && can('act:inviteCustomer')` —— 注意 `act:inviteCustomer` 在能力矩阵里**声明给了业务员**，但 App 页面**显式排除** |
| 现场汇报 | `canReport = role !== 'marketer' && ...` |
| 开工 / 阶段判定 / 任务推进 / 成员切换 | `canOpenStage` / `canEditTask` / `canSwitchMember` 业务员均不满足 |

## 四、本轮的重要修正：**能力矩阵声明 ≠ 页面实际门禁**（第二次同类发现）

M-3 发现「`view:commission` 已声明但全仓无入口」；本轮发现**更强的一类**：

> `act:inviteCustomer`（邀请客户）**在能力矩阵里明确给了业务员**，但 App 页面写着 `role !== 'marketer'` —— **页面门禁比能力矩阵更严**。

**因此判据要再收紧一层**：

```text
能力矩阵（permission.ts）      → "这个角色原则上被允许什么"
页面实际门禁（各页面的 can() / role 判断） → "这个角色实际能用什么"   ← 以这一层为准
```

> 只读能力矩阵会**放宽**（把没有入口的当功能，如提成）；只读页面门禁才准。
> 这与 `EV-RD-045`（只读 Web 快照→低估）、`EV-RD-048`（只读能力矩阵→高估）合起来是同一条纪律的三次不同表现：**证据要看"最贴近执行的那一层"**。

## 五、零新 Provider

| 需要 | Web 现有 |
| --- | --- |
| 项目列表 | `projectApi.listProjects`（服务端按本人客户裁剪，App 2026-10-07 已验证） |
| 项目详情 | `projectApi.projectInfo` |
| 施工阶段 | `projectApi.listStages` |
| 施工任务 | `projectApi.listTasks` |

状态中文**不自己写映射**：一律用 `BusinessStateTag` + 注册表（`object-key="project"|"projectStage"|"projectTask"`）——这是项目内状态展示的单一来源（设计师项目页同款）。

## 六、验证与待复验

代码层：`vue-tsc` 干净 · `build` PASS · 九项 `check:*` 全 PASS · 静态源实测 Marketer **菜单 6 项 / 4 组 · 首页卡片 7 条 · 路由 16 条**全部可达 ✅（= 冻结目标态）。

**待浏览器复验**（仍 BLOCKED）：

1. 业务员看到的项目列表是否**只有本人客户**的项目（跨业务员项目不应出现）；
2. 详情抽屉只出现「阶段 / 任务」，**没有**日报/成员/验收/投诉区块；
3. 金额只出现合同额，**没有**已收/回款率/成本/毛利；
4. 三档（1440/1280/1024）无横向溢出、控制台 0 error。

## 七、批次进度：业务员入口结构完成

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| M-1 | 「我的客户」补 8 动作 + 客户池筛选 | ✅ |
| M-2 | 「我的预约量房」 | ✅ |
| M-3 | 「我的业绩」 | ✅ |
| **M-4** | **「签约后流转」（本文档）** | ✅ |
| M-5 | 经营与工具只读（报价项目库/模板）+ 内容任务 | ⏳ 待核（提成已修正为"无 App 入口"，属业务澄清） |
