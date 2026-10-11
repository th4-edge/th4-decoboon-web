# Web 项目经理（Pm）页面清单与主链责任矩阵

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 状态：`S1 产出（2026-10-11）`
> 依据：`WEB-角色页面开发作业规范.md`（S1/S2/S3）、`WEB-BATCH2-PM-G1-迭代包.md`、`WEB-BATCH2-PM-G1.5-设计冻结.md`、`DEC-033 / BR-029`、`DEC-034 / BR-030`、`docs/standards/APP-能力与理念研究.md`（§4.2 链路 C/D）
> 范围：Pm 角色的 Web 页面清单、现状、主链可达性与缺口。**不新增业务对象、状态、动作、权限或金额口径。**

---

## 一、角色定位（App 对齐）

| 项 | 结论 |
| --- | --- |
| 做 | 项目 / 阶段 / 任务 / 日报的推进，节点留证，现场动态，材料状态，提交验收，履约业绩 |
| 不做 | 获客、客户转交、报价编辑；不代业主确认验收；不碰资金结算与全局经营数据 |
| 数据来源 | **`Project.manager = 当前员工`** 反向确定项目范围（不是通用 `Self`，也不是按客户负责人/报价创建人套用） |
| 主链 | 合同生效生成项目 → 指派项目经理 → **开工（阶段）** → 任务执行与留证 → 现场汇报 → **提交阶段验收** → 业主确认/驳回 → 整改与复验 → 竣工验收 → 交房 |

---

## 二、页面清单（四类资产）

> 分类口径见 `WEB-角色页面开发作业规范.md` §2。现状列为 2026-10-11 实测。

| # | 页面 | 路由 | 类别 | 现状 | 缺口 |
| --- | --- | --- | --- | --- | --- |
| 1 | 项目经理工作台（项目队列 + 当前项目工作面） | `/pm/workbench` | **A + C**（单页承担两类） | 已建；阶段/任务/日报/验收只读 + 阶段开工/撤销判定/任务推进 | 待按 §2 拆分为 A 工作台与 C 项目工作面，或明确「单页合规」的裁决 |
| 2 | 阶段验收工作区 | `/pm/projects/:projectId/acceptance` | C | 复用 `DesignerAcceptanceView.vue` | 文案与角色不符（XA-018）；Pm 专属视角未固化 |
| 3 | 主材选材（队列） | `/workbench/material-selection` | B | 已有页面 | **路由 `meta.roles` 不含 `Pm`**，注册表 `pm.materialSelection.roles` 也不含 `Pm` → 菜单不可挂（`GAP-WEB-019`） |
| 4 | 增减项（队列/详情） | `/workbench/contract-changes` | B | 已有页面，roles 含 `Pm` | 无（Pm 可用） |
| 5 | 整改跟进 | `/workbench/rectification` | B | 已有页面，roles 含 `Pm` | 无 |
| 6 | 客户意见投诉 | `/workbench/customer-feedback` | B | 已有页面，roles 含 `Pm` | 无（Pm 为履约沟通场景） |
| 7 | 项目日报 / 现场汇报 | 项目工作面内区块 | D | 只读展示 | Pm 侧「提交现场汇报」动作未登记（只读可用） |
| 8 | 履约业绩 | 待定 | A | **未建** | App 有「履约业绩」，Web 未规划（本期不做，登记） |

**类别合规提示**：第 1 项同时承担 A（角色工作台）与 C（对象工作面），违反 §2「禁止一个路由兼做两类」。本期先以「拆分或裁决」二选一登记，不在未裁决前改动。

---

## 三、G1.5 冻结设计 vs 实现（差距检查）

| G1.5 冻结项 | 实现现状 | 结论 |
| --- | --- | --- |
| 一级导航 5 项（今日工作 / 项目工地 / 待我选材 / 待我处理增减项 / 待我验收·整改） | 实际 2 组 5 项，其中「增减项」指向 `/pm/workbench?surface=changes`，`PmWorkbenchView` **不消费 `surface`** → 死参数 | ❌ 需修（本次修） |
| 「待我选材」入口 | 菜单缺失；且路由/注册表 roles 均不含 Pm | ❌ 阻塞（`GAP-WEB-019`） |
| 选中项目写回 URL：`/pm/projects?projectId=...` | 实现为 `/pm/workbench?projectId=...`（已能刷新恢复） | ⚠️ G1.5 的 URL 写法已被实现取代，按实现为准并更新注册表 |
| `PmLayout.vue` 独立壳层 | 未建，统一用 `RoleAreaShell` + `workbenchConfig`（DEC-034 后的壳层收敛） | ✅ 结论：独立壳层已被统一壳层方案取代，G1.5 该条作废 |
| 新增 `PmWorkbenchView.vue` | 已建 | ✅ |
| 任务/阶段 pending 动作显示「待业务确认」 | 实现已接入阶段开工/撤销判定/任务开始·完成·重开（后端 Provider 可用） | ⚠️ 页面文案仍写「未冻结，当前只读」，与事实不符（XA-018） |

---

## 四、主链责任矩阵（强制交付物）

> 填写口径见 `WEB-角色页面开发作业规范.md` §6.1。断点类型：`NO_WEB_ENTRY` / `ROLE_GUARD_DENIED` / `BLOCKED_OWNER_SESSION` / `BLOCKED_PROVIDER` / `BLOCKED_BIZ_DECISION` / `API_SIMULATED`。

| 主链步 | 业务动作 | 责任角色 | 责任端 | 入口页面 | 可达性 | 依据 |
| --- | --- | --- | --- | --- | --- | --- |
| 合同确认生效 → 生成项目 | `project/contract/update(Effective)` | Boss / StoreManager | Web | 待我签约 | 可达（已修复并复验） | `XA-012` 修复记录 |
| 指派项目经理 | `project/project/update` | Boss / 本门店 StoreManager | Web | 项目工地 · 项目成员 | 可达（已修复并复验） | `XA-016` 修复记录 |
| 开工（阶段） | `project/stage/update(Doing)` | Boss / StoreManager / Pm | Web | `/pm/workbench` 开启阶段 | 可达 | 后端 `Update.call` |
| 判定/撤销「本项不涉及」 | `project/stage/update(NotApplicable / Todo)` | Boss / StoreManager / Pm | Web | `/pm/workbench` 阶段行 | 可达（本轮修复） | `GAP-039 / DEC-057` |
| 任务开始 / 提交验收 / 完成 / 重开 | `project/task/*` | Pm（项目参与） | Web | `/pm/workbench` 任务行 | 可达 | 后端任务 Provider |
| 现场汇报 | `project/report/*` | Pm | Web | 无 | **`NO_WEB_ENTRY`**（只读可见，提交入口未登记） | G1 迭代包 §5「待补齐动作注册」 |
| 提交阶段验收 | `project/acceptance/save` | Pm / 项目参与 Designer；Boss | Web | `/pm/projects/:id/acceptance` | 可达（审计实测 PASS） | `BR-008` |
| 确认 / 驳回验收 | `project/acceptance/update` | **业主本人** | 小程序 | — | `BLOCKED_OWNER_SESSION`（员工侧一律 403） | 审计实测 |
| 主材选材 | `material/selection/save` | Pm（App 口径：材料状态） | Web | — | **`ROLE_GUARD_DENIED`**：前端路由与注册表 roles 均不含 `Pm` | `GAP-WEB-019` 待裁决 |
| 增减项 | `project/contract-change/*` | Pm / Designer / Boss / StoreManager | Web | `/workbench/contract-changes` | 可达 | 注册表 `pm.change` |
| 竣工保洁验收 → 交房 | `project/acceptance/save` + 业主确认 | Pm + 业主 | Web + 小程序 | `/pm/projects/:id/acceptance` | 部分可达（Web 到「提交验收待业主确认」为止） | `BLOCKED_OWNER_SESSION` |

**结论**：Pm 主链在 Web 端的两个断点是 **①现场汇报无提交入口**、**②主材选材被角色门禁拒绝**；其余步骤可达。

---

## 五、缺口清单（按优先级）

| # | 缺口 | 类型 | 处置 |
| --- | --- | --- | --- |
| 1 | Pm 增减项菜单指向死参数 `/pm/workbench?surface=changes` | 缺陷 | **本次修**：改为真实页面 `/workbench/contract-changes` |
| 2 | 注册表 `pm.project.deepLink` 指向 `/designer/projects`（设计师页面）；`notes` 与 `primaryActionByState.label` 使用设计师视角文案 | 缺陷 | **本次修**：改为 `/pm/workbench` 与 PM 视角 |
| 3 | 验收工作区文案写「设计师可提交验收」，实际提交人是项目经理 | 缺陷（XA-018） | **本次修**：按角色渲染 |
| 4 | 项目经理工作台文案写「任务/阶段动作注册未冻结，当前只读」，与已可用动作不符 | 缺陷（XA-018） | **本次修**：改为与事实一致的说明 |
| 5 | 主材选材：注册表/前端 roles 给 Designer+StoreManager，后端 `materialplans/update` 只给 Boss+Pm+Finance；Pm 拿不到入口 | 权限三方不一致 | **登记裁决** `GAP-WEB-019`（不得自行改权限） |
| 6 | 现场汇报无 Web 提交入口 | `NO_WEB_ENTRY` | 登记，待 S3 迭代包确认动作注册后实现 |
| 7 | 阶段计划生成不合理（不涉及首阶段 / 1 天工期 / 权重失真） | 数据口径 | 登记裁决 `GAP-WEB-015`（已有，保持 OPEN） |
| 8 | 第 1 项页面同时承担 A+C 两类资产 | 结构合规 | 登记，拆分或裁决二选一 |
| 9 | 履约业绩页未建 | 能力缺口 | 本期不做，登记 |

---

## 六、下一步

1. **S2 注册表冻结**：按本清单更新 `workbench-navigation.json` 的 `pm.*`（deepLink、notes、primaryActionByState 视角、`contextKeys`）。
2. **S3 迭代包增补**：把「现场汇报提交」与「主材选材 Pm 入口」写入 Pm G1 迭代包，取得 `T06/T12` 后实现。
3. **S5 实现切片（本次先做低风险三项）**：缺口 1–4。
4. **S8 复验**：真实 Pm 账号跑「开工 → 任务 → 提交验收 → 驳回 → 复验」，与 App 事实对账。
