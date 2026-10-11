# Web Batch 2 Pm G1 迭代包

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 批次：`WEB-BATCH2-PM-20261007`
> 状态：`G1_FROZEN`，G1.5 待冻结
> 业务依据：`DEC-002 / DEC-033 / DEC-034`、`BR-008 / BR-009 / BR-029 / BR-030`、`SCN-009 / SCN-010 / SCN-018`
> 研发交接：`T12-BIZ-20261007-005 / T12-BIZ-20261007-006`
> 工作台注册：`docs/standards/workbench-navigation.json`
> 本迭代包不新增业务对象、状态、动作、角色、权限和金额口径。

## 1. 批次范围

Pm 是项目履约执行角色。本批只做：

1. `/pm` 岗位壳层和默认今日主线。
2. 项目对象工作空间：项目 + 当前阶段 + 当前任务。
3. 验收/整改工作台：提交、驳回后复验、轮次和证据。
4. 项目只读事实：项目、阶段、任务、现场日报、验收历史。
5. 选材、增减项的入口和只读事实；动作未登记前不得成为可执行主行动。

## 2. 真实场景

### 场景 A：单店 10–20 人

项目经理王昌富早上进场，需要知道自己负责的 5 个项目中，哪些任务逾期、哪个阶段待验收、哪个整改已驳回。系统从今日主线按风险和项目阶段聚合，点击直接进入项目对象工作面。

### 场景 B：多店 2–3 店

项目经理在多个门店项目中协作。系统只显示本人负责或参与的项目；跨店非参与项目不可见，项目成员切换按 Boss/店长既有权限。

### 场景 C：一人装企 BOSS

Boss 可切换 Pm 岗位视角查看项目管理，但实际操作人仍为 Boss，承担能力记录为 Pm，项目、阶段、验收动作逐步留痕，不跳过 Pending 和业主确认。

## 3. 页面生成公式

```text
角色 Pm × 场景（项目推进 / 选材 / 增减项 / 验收整改）
× 对象（项目 + projectStage + projectTask / acceptance）
× 状态（Preparing / Ongoing / Suspended / Accepting / Rejected）
× 唯一主行动（推进任务、登记现场、提交验收或复验）
× 完成后交接（下游工作台、接棒人、reloadScopes）
```

## 4. 工作台入口契约

| 工作台 | 对象锚点 | 入站状态 | 唯一主行动 | 完成后交接 |
| --- | --- | --- | --- | --- |
| 今日主线 | role queue + project | 本人项目待办、逾期、待验收、整改 | 选择项目进入工作面 | 项目管理/验收/财务 |
| 项目推进 | project + projectStage | Preparing / Ongoing / Suspended / Accepting | 推进当前阶段或任务 | 选材、增减项、验收、财务 |
| 待我选材 | project + materialPlan | 待选材、待换材、待客户确认 | 当前选材状态允许的动作 | 采购、成本、应付 |
| 待我处理增减项 | project + contractChange | Pending / Approved | 发起、确认、重算或客户签认 | 任务、材料、应收、成本 |
| 待我验收/整改 | project + projectStage + acceptance | Accepting / Rejected | 提交验收或复验 | 项目继续或结算 |

## 5. 页面任务与动作

### 可研发

- `pm.acceptance.submit`：Boss / Pm / 项目参与 Designer 提交或复验；员工不得代业主确认。
- `pm.project`：项目、阶段、任务、日报只读事实。
- `pm.acceptance`：验收轮次、问题、整改和证据查看。

### 待补齐动作注册

- `project/task/*`：任务新增、编辑、完成、取消、重新打开。当前 `pending_business_review`。
- `project/stage/*`：阶段启动、完成、验收推进、取消。当前 `pending_business_review`。
- `project/project/update`：项目信息更新。当前 `pending_business_review`。
- `pm.materialSelection`：材料计划/选材动作缺失，受 `DEF-WEB-004` 约束。
- `pm.change`：增减项动作多数为 `pending_business_review`。

未冻结动作不得成为可执行主行动，只能显示“待业务确认”。

## 6. Provider 映射

| 能力 | Provider | App 调用点 | 状态 |
| --- | --- | --- | --- |
| 项目分页 | `project/project/page` | `src/pages/project/list.vue` | APPROVED |
| 项目详情 | `project/project/info` | `src/subpackages/project/pages/detail.vue` | APPROVED |
| 项目概览 | `project/project/overview` | App 项目详情 | APPROVED |
| 阶段列表 | `project/stage/page` | App 项目详情/阶段 | APPROVED |
| 阶段详情 | `project/stage/info` | App 阶段详情 | APPROVED |
| 任务列表 | `project/task/page` | `src/domains/schedule/api.ts` | APPROVED |
| 任务详情 | `project/task/info` | App 任务详情 | APPROVED |
| 现场日报 | `project/report/page` | App 日报 | APPROVED |
| 验收列表 | `project/acceptance/page` | App 项目验收 | APPROVED |
| 验收详情 | `project/acceptance/info` | App 验收详情 | APPROVED |
| 提交/复验 | `project/acceptance/save` | App 验收提交 | FROZEN |
| 验收轮次 | `project/acceptance/round/page` | App 验收轮次 | APPROVED |
| 整改列表 | `project/acceptance/rectify/page` | App 整改 | APPROVED |
| 材料计划 | `project/material-plan/page/update` | App 材料计划 | PENDING_ACTION |
| 选材 | `material/selection/*` | App 选材 | PENDING_ACTION |
| 合同变更 | `project/contract-change/*` | App 增减项 | PENDING_ACTION |

## 7. 权限与金额边界

| 维度 | 要求 |
| --- | --- |
| Pm | 本人负责或项目参与范围；只读关联客户，不写客户跟进 |
| Boss | 内部能力超集；可切换 Pm 岗位视角 |
| StoreManager | 本店项目范围，按既有项目权限 |
| Designer | 具项目参与资格时可提交阶段验收，不越权 PM 管理 |
| 金额 | 项目成本、利润不向 Pm 展示；阶段验收不碰金额 |
| 增减项 | 只按合同变更规则，禁止直接改报价或合同历史 |

## 8. 验收场景

- 正向：Pm 从今日主线进入项目，查看阶段/任务/日报/验收，当前阶段唯一主行动正确。
- 反向：任务逾期、阶段未完成、Pending 验收重复提交、无整改证据复验均阻断。
- 越权：非项目参与人、跨店/跨团队、无成本权限角色正确裁剪。
- 并发：任务完成、阶段推进、验收提交使用服务端版本和幂等。
- 闭环：提交/复验后回读 acceptance、acceptanceRound、projectStage、projectTask、project、ownerPendingAcceptance、notice。
- 跨端：与 App 项目、验收、任务事实一致。

## 9. 当前阻塞

1. `project/task/*`、`project/stage/*`、`project/project/update` 仍为 `pending_business_review`。
2. `pm.materialSelection` 没有已登记动作，受 `DEF-WEB-004` 约束。
3. `pm.change` 动作未完全冻结。
4. `GAP-WEB-004` 零任务阶段验收仍阻断。
5. Pm 真实账号 G3 和项目写作链路未验证。

## 10. 下一步

进入 G1.5：冻结 `/pm` 壳层、项目对象工作空间、验收/整改工作台、三档布局和状态设计；然后只实现已冻结的只读与验收提交切片。
