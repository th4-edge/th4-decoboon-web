# Web Batch 1 G1 迭代包

> **⚠️ 退场标注（2026-10-11）**：本文档提到的 `docs/standards/workbench-navigation.json` **已删除**
> （用户裁决「注册表文件要删，A」，见 `GAP-WEB-021`）。文中「注册表登记 / `roles` 过滤 / `deepLink` 解析 /
> S2 注册表冻结」等口径**已作废**；现行唯一来源是三份**按角色静态源**——`src/roles/routes.ts`（路由集合）、
> `src/roles/workbenchConfig.ts`（菜单）、`src/roles/workbenchHome.ts`（首页卡片），业务条款见
> `docs/standards/WEB-工作台契约条款.md`。本文档保留为**当时的过程记录与角色事实**，不再作为规范依据。

> 批次：`WEB-BATCH1-20261007`
> 状态：`G1_FROZEN`，`G1.5` 待冻结
> 业务依据：`DEC-002 / DEC-032 / DEC-033 / DEC-034`、`BR-005 / BR-008 / BR-028 / BR-029 / BR-030`
> 研发交接：`T12-BIZ-20261007-005`、`T12-BIZ-20261007-006`
> 业务答复：`ANS-BIZ-20261007-023`
> 工作台注册：`docs/standards/workbench-navigation.json`
> 本迭代包不新增业务对象、状态、动作、角色、权限、金额、成本或利润口径。

## 1. 批次目标

1. 落地“今日主线/需要我处理”默认入口。
2. 让 `workbench-navigation.json` 成为角色菜单、工作台入口和深链接的唯一注册源。
3. 抽取统一对象工作空间骨架，首用于 Designer。
4. 验证工作台到对象工作面“零搜索进入”和完成后交接。
5. 将 Finance 退款/员工发放幂等键修复作为独立 P0 安全切片纳入验证，不与页面改版混为一体。

## 2. 范围与非目标

### 本批范围

- 今日主线分类队列与入口契约。
- Designer：待我量房、待我设计、待我报价、合同交接。
- 共用对象身份条、状态动作面板、草稿保护和 `reloadScopes` 协调器契约。
- 多入口一致性、深链接恢复和完成后交接。
- 管理角色风险入口中的设计师指派/改派动作契约。
- Finance P0 幂等键安全修复的独立验证。

### 本批不做

- 不重写全部 Designer/Finance 页面。
- 不实现 Pm、Finance、Boss 的全部工作台。
- 不实现跨类统一风险最优排序。
- 不实现零任务阶段验收。
- 不实现 TeamLeader 受限财务字段。
- 不新增 Web 专属 API。
- 不改变合同生效、项目唯一来源、收付款幂等、成本完整性和数据范围。

## 3. 真实场景

### 画像 A：10–20 人单店成长装企

- 使用人：设计师董夏鹏。
- 触发：周一到岗，有 4 个待量房、2 个设计待推进、1 个报价被驳回。
- 当前动作：从今日主线分类处理，不搜索客户。
- 系统下一步：量房完成后设计工作台出现对象；报价驳回后保留客户、房屋和版本进入修订。
- 异常：部分队列读取失败时显示“部分数据暂不可确认”，不显示伪空态。

### 画像 B：20–30 人多店装企

- 使用人：店长谢玲玲。
- 触发：本店待派设计师客户积压，同时有跨店改派请求。
- 当前动作：从风险队列进入客户 `activeProperty`，同店指派成功，跨店改派被拒绝。
- 系统下一步：原设计师历史保留，新设计师工作台出现承接对象。
- 异常：候选设计师离职或范围不符时，主行动禁用并显示原因。

### 画像 C：一人装企 BOSS

- 使用人：企业负责人。
- 触发：同时需要处理量房、报价和财务风险。
- 当前动作：使用综合经营视角或切换岗位视角进入内部工作台。
- 系统下一步：每个节点逐步留痕；实际操作人始终为 BOSS。
- 异常：不得伪装业主确认，不得合并制单、确认、发放为单个不可追溯动作。

## 4. 页面生成公式

```text
角色 × 场景（今日主线 / 量房 / 设计 / 报价 / 合同 / 风险处置）
× 对象（客户 + activeProperty / quote / contract / risk item）
× 状态（服务端状态与入站条件）
× 唯一主行动（服务端 allowedActions）
× 完成后交接（下一状态、接棒人、下游工作台）
```

### 准入三问

1. 谁在什么状态下打开：角色从今日主线或场景工作台进入。
2. 第一个答案：我需要处理什么、为什么在这里、卡在哪里。
3. 唯一主行动：当前状态下服务端允许的动作；其余动作降级。

## 5. 工作台入口契约

| 工作台 | 角色 | 对象锚点 | 入站状态 | 唯一主行动 | 完成后交接 |
| --- | --- | --- | --- | --- | --- |
| 今日主线 | 7 类角色 | role queue + selected object | 服务端待办/风险/超期/上游交接 | 选择当前分类中的对象并进入工作面 | 对应角色工作台或对象工作空间 |
| 待我量房 | Marketer / Designer / Boss | 客户 + `activeProperty` | 待量房 / 量房中 | 安排量房或登记量房结论 | 设计工作台 |
| 待我设计 | Designer / Boss | 客户 + `activeProperty` + design | 草稿 / 可交付 / 已讲解 | 推进方案到下一允许状态 | 报价工作台 |
| 待我报价 | Designer / Boss / StoreManager | 客户 + `activeProperty` + quote | Draft / Submitted / Rejected | 继续编辑、提交或处理驳回 | 合同工作台 |
| 合同交接 | Designer / Boss / StoreManager | 客户 + quote + contract | PendingSign / Signed 未 Effective | 合同交接或推进允许节点 | 项目工作台 |
| 风险队列 | Boss / StoreManager / TeamLeader | 风险项 + 客户/项目 | 分类风险 | 处理当前分类风险 | 对应对象工作台 |

## 6. 页面任务与动作

页面任务以 `business-page-tasks.json` 为准，当前已登记：

- `workbench.today.category`
- `designer.measure.schedule`
- `designer.measure.result`
- `designer.design.advance`
- `designer.quote.submit`
- `boss.customer.designer-handoff`
- `finance.contractChange.confirm`

动作必须先登记 `business-action-policies.json`。当前与 Batch 1 直接相关的新增冻结动作：

- `customer/designer-handoff`：Boss / StoreManager / TeamLeader，显式 `activeProperty`，保留历史，回读客户、房屋、量房、设计、通知和待办队列。
- `customer/owner-change`：Boss / StoreManager，独立动作语义，承载于 `customer/customer/update`，不级联改写项目/财务归属。

仍为 `pending_business_review` 的动作不得成为可执行主行动。

## 7. 统一对象工作空间骨架

必须包含：

1. 对象身份条：客户 + `activeProperty`、项目 + 阶段、财务 + 单据。
2. 当前事实：服务端状态、版本、金额、责任人、风险和数据截止时间。
3. 状态动作面板：唯一主行动、阻断原因、前置条件、完成后去向。
4. 操作分层：L0 就地、L1 抽屉、L2 全屏工作区、L3 安全门。
5. 上下文恢复：URL、筛选、滚动、选中子对象、版本和草稿。
6. `reloadScopes` 协调器：动作后按注册表回读。
7. 页面状态：loading / empty / error / unauthorized / expired / partial / stale / success。
8. 完成交接：下一状态、接棒人、下游工作台、显式“下一项”。

## 8. 权限与金额边界

| 维度 | Batch 1 要求 |
| --- | --- |
| 数据范围 | Company / Store / Team / Self / ProjectParticipant，服务端最终校验 |
| Designer | 本人负责客户和参与项目；成本、利润不生成区块 |
| Boss | 企业内部能力超集；不冒充业主/客户确认 |
| StoreManager | 本店范围；跨店指派拒绝 |
| TeamLeader | 本团队范围；受限财务字段受 `GAP-026` 约束 |
| 金额 | 页面不自行计算；报价金额以服务端为准；成本不完整时利润为空 |
| 高风险 | 合同生效、收付款、退款、审批、删除进入安全门 |

## 9. 验收场景

`business-acceptance-scenarios.json` 已登记：

- `batch1.workbench.multiEntry.normal`
- `batch1.workbench.quoteReject.rejection`
- `batch1.workbench.designerHandoff.unauthorized`
- `batch1.workbench.quoteRevision.concurrent`
- `batch1.designer.measureToDesign.closure`

另有资金 P0 安全切片验证：

- 退款/员工发放正常提交。
- 双击、网络超时重试、并发提交。
- 关闭后重新打开视为新意图。
- 退款、发放、资金台账、提成调整事实数量一致。

## 10. G1 完成定义

- 本文件冻结。
- 相关页面任务、动作策略和验收场景注册且门禁通过。
- `workbench-navigation.json` 覆盖 Batch 1 工作台。
- 未裁决动作保持 pending，不得作为主行动。
- 下一步进入 G1.5 交互与构图冻结和研发切片。
