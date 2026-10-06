# 装得清 Web 全角色研发 Batch 0 控制板

> 批次：`WEB-ALL-ROLE-B0-20261007`
> 当前状态：`B5_TEAMLEADER_G1_FROZEN`
> 主控监督：Codex 总控
> 调度责任：Web 全角色研发批次调度官
> 唯一 Web 仓库：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-web`
> 基线：`dev @ 785b9ff`
> 基线标签：`web-all-role-baseline-20261007` / `web-all-role-b0-control-plane-20261007` / `web-all-role-b0-governance-20261007` / `web-batch1-today-mainline-20261007`
> 业务事实源：`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/推广营销/装得清业务智能体`
> 本控制板不新增业务对象、状态、动作、角色、权限、金额、成本或利润口径。

## 1. 目标

1. 建立全角色 Web 开发的唯一控制面。
2. 固定 7 类员工角色、对象锚点、主链、Provider、权限和验收边界。
3. 固定 Agent 分工、写入范围、停止条件和 Prompt 契约。
4. 阻止无业务裁决、无 App Provider、无真实浏览器证据的页面进入“完成”。
5. 以设计师和财务为首批回查样板，再按主链推进其他角色。

## 2. 固定角色

员工角色固定 7 类：

`Boss / StoreManager / TeamLeader / Marketer / Designer / Pm / Finance`

边界：

- `Owner` 是外部业主/客户确认主体，不是员工角色。
- `ProjectSupport` 只能作为项目经理相关的履约能力，不新增第 8 类员工角色。
- `Boss` 是企业内部岗位能力超集，不代表外部主体确认，也不代表可跳过状态节点。
- `Finance` 有公司范围财务能力，但不自动获得 Boss 管理全权。

## 3. 权威事实源

### Web

- `AGENTS.md`
- `docs/standards/WEB-建设核心思路.md`
- `docs/standards/WEB-开发规范.md`
- `docs/standards/WEB-业务选择器与表单设计规范.md`
- `docs/standards/WEB-业务概念全生命周期规范.md`
- `docs/standards/WEB-业务状态机与闭环一致性规范.md`
- `docs/standards/WEB-业务动作与闭环注册规范.md`
- `docs/standards/WEB-业务指标与权限注册规范.md`
- `docs/standards/WEB-业务页面系统注册规范.md`
- `docs/standards/WEB-场景驱动工作台与多起点导航规范.md`
- `docs/standards/WEB-沉浸式对象工作空间规范.md`
- `docs/standards/workbench-navigation.json`
- `docs/standards/WEB-治理迁移台账.md`
- `docs/standards/business-*.json`
- `src/core/router/index.ts`
- `src/roles/permission.ts`
- `src/styles/tokens.scss`

### 业务

- `DEC-032 / BR-028`：BOSS 全角色与一人装企边界。
- `DEC-033 / BR-029`：沉浸式对象工作空间与操作连续性。
- `DEC-034 / BR-030`：场景驱动工作台与多起点导航。
- `CAP-005 / SOL-013`：角色化工作台地图与多起点导航能力。
- `SCN-017 / SCN-018 / SCN-019`：设计师、项目经理、财务多起点工作台场景。
- `T12-BIZ-20261007-005`：场景驱动工作台与多起点导航研发交接。
- `REQ-BIZ-20261007-016 / ANS-BIZ-20261007-023`：Web 全角色未决事项业务裁决。
- `T12-BIZ-20261007-006`：Web 全角色未决事项研发交接。
- `GAP-026`：TeamLeader 商务财务字段范围待冻结。
- `CAP-004`：Web 沉浸式对象工作空间能力。
- `SOL-012`：对象作战室与状态驱动连续推进方案。
- `SCN-014 / SCN-015 / SCN-016`：设计师、财务、负责人沉浸式场景。
- 相关 `DEC / BR / SCN / SOL / CAP / MET / GAP / EV`。

### App

`/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-app`

每个 Web Provider 必须能指出 App 对应调用点；无法映射时标记 `BLOCKED_PROVIDER`。

## 4. 批次路线

| 批次 | 范围 | 目的 | 前置 |
| --- | --- | --- | --- |
| Batch 0 | 基线、lane、矩阵、Provider、测试资产 | 建立控制面 | 已完成基线冻结 |
| Batch 1 | 今日主线 + `workbench-navigation.json` + Designer 工作台地图 + 存量 Finance 回查 | 按 T12 先落地公共入口和设计师样板，提取对象工作空间骨架 | Batch 0 完成 |
| Batch 2 | Pm | 项目、任务、阶段、选材、增减项、验收/整改 | Batch 1 公共骨架与业务裁决 |
| Batch 3 | Finance | 应收、应付、收付款、台账、凭证、成本完整性 | Batch 2 项目主链与财务动作策略 |
| Batch 4 | Marketer + StoreManager + TeamLeader | 客户跟进、邀约量房、风险队列、客户经营、商务财务 | Batch 3 及未决业务裁决关闭 |
| Batch 5 | Boss | 经营结论、风险队列、审批、指派、连续内部动作、一人装企岗位视角 | 前序事实聚合与权限裁决 |
| Batch 6 | 全角色沉浸式闭环 | 多角色、多租户、多分辨率、跨端对账 | 各角色页面与测试资产就绪 |

禁止 7 个角色同时开发。一次只推进一个角色或一条明确主链。

## 5. 批次状态机

```text
B0_INTAKE
-> B0_BASELINE_AUDIT
-> B0_LANE_FREEZE
-> B0_FACT_AUDIT
-> B0_MATRIX_READY
-> B0_GOVERNANCE_WIRING
-> B0_GOVERNANCE_READY
-> ROLE_BATCH_READY
-> BIZ_T05
-> T06_OR_T12
-> G1_FREEZE
-> G1.5_FREEZE
-> DEV
-> G2_BUILD
-> G3_RENDER
-> INDEPENDENT_ACCEPTANCE
-> KNOWLEDGE_WRITEBACK
-> DONE
```

`BLOCKED` 条件：业务裁决缺失、Provider 无 App 调用点、权限或金额口径未冻结、`reloadScopes` 未登记、基线不干净、Agent 写入冲突、真实浏览器环境或测试账号不可用。

`BLOCKED` 时只允许证据整理、问题澄清和只读审计。

## 6. Gate

### B0-G1 基线门禁

- 当前 Web 工作树已形成可回滚基线。
- 唯一仓库和分支已明确。
- `.idea/` 等非业务产物已排除。
- lane 中旧 `th4-decoboon-web-v2` 写范围已清理。

### B0-G2 矩阵门禁

- 7 类角色场景矩阵完成。
- Provider 与 App 调用点映射完成。
- 权限正向、负向、跨租户用例完成。
- 金额、成本、利润影响逐项标记。
- `reloadScopes` 来自注册表。
- 测试企业、账号、三档分辨率和证据目录就绪。

### B0-G3 工作台与多起点治理门禁

- `workbench-navigation.json` 已建立并覆盖 7 类角色。
- 一级领域不超过 7 项，工作台标签不得为模块 CRUD 命名。
- 每个工作台声明入站队列、对象锚点、当前工作面、唯一主行动、完成后交接、上下文恢复和 `reloadScopes`。
- `check:workbenches`、`check:workspaces` 通过。
- 存量模块菜单与对象工作空间偏差已登记 `WEB-治理迁移台账.md`。

### G1 业务与场景门禁

- `T05` 已提交，`T06/T12` 已取得。
- 至少 2 个真实中小装企场景。
- 页面生成公式五要素齐全。
- 动作与 App 对齐。
- Provider 有 App 调用点。
- 权限、金额、异常、幂等、审计和 `reloadScopes` 完整。
- 工作台 key、入口场景、入站状态、对象锚点、唯一主行动和完成后交接已在 `workbench-navigation.json` 登记。
- 多入口同锚点、同状态源、同允许动作和零搜索进入契约已明确。

### G1.5 交互与构图门禁

- 页面原型属于六类之一。
- 唯一主行动明确。
- 信息层级不超过 3 层。
- 1440 / 1280 / 1024 三档方案明确。
- 正常、加载、空、失败、无权限、过期、部分确认、冲突和长内容状态完整。
- 复用组件清单完成。
- 默认落地“今日主线/需要我处理”；高频工作台两层内可达。
- 完成后显示去向、接棒人、下一状态和下游工作台。
- 上下文恢复覆盖筛选、滚动、`activeProperty`、版本、草稿和深链接。

### G2 工程门禁

- 十项注册检查和构建通过（含 `check:workbenches`、`check:workspaces`）。
- 无 `any`、无静默兜底。
- 无裸色值、裸字号、裸圆角。
- 无 Web 专属 API。
- 无前端自算状态、金额、成本、利润。

### G3 渲染门禁

- 真实浏览器三档截图。
- 至少一条关键路径纯键盘完成。
- 控制台无未处理错误。
- 正向和负向权限均已验证。
- 至少两轮“渲染 -> 批判 -> 修正”。

### A1 独立验收门禁

- 使用独立角色、独立租户和真实浏览器。
- 覆盖正常、拒绝、越权、并发和闭环。
- 完成 App/Web 同源同口径对账。
- 完成跨角色交接和账务对账。
- 完成多入口一致性、零搜索进入、完成后交接和一人装企岗位视角验证。
- 输出 `PASS / FAIL / BLOCKED / NOT_TESTED`。
- 不修改业务代码，不代业务智能体裁决。

## 7. Agent 分工与写入边界

| Agent | 职责 | 只能写入 | 禁止 |
| --- | --- | --- | --- |
| 调度官 | 编排、提示词、状态推进、冲突拦截 | `docs/product/roles/**` 和调度记录 | 写业务代码、裁决业务 |
| 业务裁决 Agent | 回答 T05，输出 T06/T12 | 业务智能体目录 | 改 Web 代码、自称验收 |
| 产品规划 Agent | G1/G1.5、场景、页面任务 | Web `docs/product/**` | 写 `src/**`、擅自补规则 |
| UI 交互 Agent | 构图、状态、组件、视觉批判 | Web `docs/product/design/**` 或冻结 UI 产物 | 改业务状态和金额 |
| 研发 Agent | 实现已冻结迭代包 | Web `src/**`、`scripts/**`、必要配置 | 改业务事实、开 Web 专属 API |
| 独立验收 Agent | 真实浏览器审计、证据链、缺陷 | `docs/acceptance/runs/**` | 修改生产实现、宣布业务通过 |
| 知识回写 Agent | EV、GAP、知识卡和状态更新 | 业务智能体目录 | 复制第二套知识库、营销外发 |

路径硬前置：

```text
目标写路径必须解析到：
/Users/zhangwei/FutureFiles/安徽昭青/家装装修/装客宝/前端代码/th4-decoboon-web/...

若目标路径包含 th4-decoboon-web-v2、th4-decoboon-web-v1v2-archive
或未解析到上述唯一目录，立即停止写入并报告 LANE_PATH_MISMATCH。
```

## 8. 当前阻塞

1. Pm 任务完成证据已通过真实上传验证；任务重开后端已修正，Web 入口待后端新版本运行后启用。
2. 阶段验收首次提交真实验证已通过；业主确认/驳回、整改复验、项目字段更新和合同变更仍未完成。
3. `GAP-WEB-003/004/006` 未关闭，`GAP-WEB-007` 仍在进行；`GAP-026` 待冻结 TeamLeader 受限财务字段。
9. `GAP-WEB-008` CLOSED：店长已可进入本店财务只读态，写入口按角色裁剪，后端越权写 403。
10. `GAP-WEB-009` OPEN：`boss.risk` 登记 TeamLeader 可读，但 `statistic/risk/report` 仅允许 Boss/Finance/StoreManager，TeamLeader 风险读侧缺失。
11. `GAP-WEB-010` OPEN：`customer/owner-change` 要求变更原因，但 `customer/customer/update` 无 reason 入参与审计留痕。
12. `GAP-WEB-011` OPEN：`statistic/team-leader/report` 向 TeamLeader 返回成本字段，与 `GAP-026` 受限口径冲突。
4. 报价接受率和本月回款仍为实现口径差异，不得作为正式经营指标。
5. Finance 验收仍为 `PARTIAL`，其他角色尚无完整专属页面。
6. `finance.ledger` 已登记批量生成凭证 `document/voucher/build`（Finance/Boss）并通过真实 G3；凭证作废暂不开放（无 Provider）。
7. 采购锁定/客户确认并发、生产环境和跨端一致性未完成。
8. 本地测试凭证均只做临时重置并已恢复，禁止复制到生产。

## 9. 当前下一步

```text
当前状态：B5_TEAMLEADER_G1_FROZEN
已完成：店长批次 G3 收尾；TeamLeader G1 动作冻结（团队范围、指派、只读、受限字段）与真实账号证据
下一步：BATCH5_TEAMLEADER_G2（本团队客户/指派 + 经营概览只读）
允许动作：团队指派、本人负责风险处置、本团队只读经营概览
禁止动作：财务写、客户负责人变更、主材选材写、成本/利润区块、生产发布
```
