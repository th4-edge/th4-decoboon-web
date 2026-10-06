# 装得清 Web 全角色场景矩阵

> 批次：`WEB-ALL-ROLE-B0-20261007`
> 业务口径只以 `zhuangdeqing-business` 为准。
> 本矩阵用于产品规划和研发审计，不代表页面已实现或已验收。

## 1. 固定字段

| 字段 | 说明 |
| --- | --- |
| 角色 | 固定 7 类员工角色 |
| 对象锚点 | 客户、房屋、项目、账本等显式对象 |
| 主要工作面 | 角色在当前对象上可处理的业务面 |
| 当前状态 | 服务端状态，不由前端推测 |
| 唯一主行动 | 当前状态下视觉最重的行动 |
| Provider 映射 | 已有 Provider 的完整路由 |
| App 调用点 | App 对应页面或 API 调用点 |
| 权限/范围 | Company / Store / Team / Self / ProjectParticipant / ProjectOwner |
| 金额影响 | 是否影响报价、合同、应收、应付、收付款、成本、利润 |
| 异常 | 拒绝、越权、冲突、重复、部分读取失败 |
| `reloadScopes` | 动作后必须回读的对象集合 |
| 验收 | 正常、拒绝、越权、并发、闭环、跨端对账 |
| 当前状态 | 未开工 / 已有骨架 / 已有 G1 / 已过 G3 / 验收中 |
| 证据或缺口 | 验收目录、GAP、T05/T12 |

## 2. 首批角色矩阵

| 角色 | 对象锚点 | 主要工作面 | 唯一主行动建议 | Provider 映射 | 权限范围 | 金额影响 | 异常重点 | `reloadScopes` | 验收重点 | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Boss | 风险/待办队列 + 客户/项目 | 经营结论、风险、指派、审批、内部连续动作 | 按服务端允许动作处置当前风险 | 待审计 App 经营、项目、财务聚合 Provider | Company | 视动作而定；不得代替业主确认 | 同人连续节点、已发放历史、跨企业、外部确认 | 从对应 actionPolicy 读取 | 一人装企、连续制单确认发放、跨企业反例 | 只有管理导航骨架 |
| StoreManager | 本店风险/待办 + 客户/项目 | 本店客户、设计、项目、财务只读和干预 | 处理本店当前风险或按允许动作指派 | `customer/owner-change`、`customer/customer/handoff`、`project/project/update`、`voucherTemplate.manage`；财务只读 | Store | 成本/毛利可见但不扩大；财务动作只读 | 跨店、越权指派、利润不可见、财务写拒绝 | 从 actionPolicy 读取 | 本店范围、跨店反例、交接闭环 | 已有 G1（`GAP-WEB-008` OPEN） |
| TeamLeader | 本团队风险/待办 + 客户/项目 | 团队客户、跟进、项目协同 | 处理本团队当前风险或指派本团队设计师 | `customer/customer/handoff`、风险处置；只读 `statistic/team-leader/report` | Team | 不自动获得财务和利润能力；成本/应付/付款/现金流/工资/提成不可见 | 跨团队、财务写拒绝、成本越界 | 从 actionPolicy 读取 | 团队范围、跨团队反例、受限字段不生成 | 已有 G1（`GAP-026`/`GAP-WEB-009`/`011` OPEN） |
| Marketer | 客户 + 跟进任务 | 跟进、邀约、安排量房、移交设计 | 写跟进、安排量房或移交下一步 | `customer/customer/page`、`customer/customer-follow/page|save`、量房链路待核对 | Self + 客户归属 | 无直接财务影响 | 重复跟进、无客户、量房结果越权、移交断点 | `customer,customerFollow`；量房按动作登记 | 跟进 -> 量房 -> 设计交接 | 通用工作台 planned |
| Designer | 客户 + `activeProperty` | 跟进、量房、设计、报价、合同交接、项目参与 | 推进当前客户/房屋到下一服务端状态 | 已有客户、房屋、设计、报价、项目 Provider | Self + ProjectParticipant | 报价金额影响；成本/利润不展示 | 多房屋、版本冲突、驳回、无报价、越权 | 按动作读取 design/quote/customer/property | `SCN-014`、真实 G3、三档、写入回读 | 已有骨架、G1、真实 G3，未全验收 |
| Pm | 项目 + 当前阶段 | 任务、阶段、施工计划、变更、验收、整改 | 推进当前阶段/任务/验收 | `project/project/page|info`、任务、阶段、验收、变更链路待审计 | ProjectParticipant | 任务和验收不直接改金额；变更按合同规则 | 非参与人、阶段未完成、业主确认边界、并发任务 | 从 actionPolicy 读取 | 任务推进、阶段验收、业主本人确认、跨角色回读 | 通用工作台 planned |
| Finance | 项目 + 当前应收/应付/收付款/台账/凭证 | 应收、收款、应付、付款、退款、台账、凭证、成本完整性 | 核销当前应收/应付并进入收付款、台账或凭证 | 已有 finance 和 document Provider | Company | 强金额影响；成本可见；利润按权限 | 超收、超付、重复登记、版本冲突、成本不完整 | 按动作读取 receivable/receipt/ledger/project | 收付款正常/越权/并发、成本完整性和凭证闭环 | 已有骨架、G1，验收 PARTIAL；`GAP-WEB-006` OPEN |

## 3. 填写纪律

1. Provider 没有 App 调用点时写 `BLOCKED_PROVIDER`，不得直接编码。
2. `reloadScopes` 未在动作注册表登记时写“待业务裁决”，不得前端推断。
3. 金额、成本、利润必须写“可见 / 不可见 / 不生成区块”，不能只写“隐藏”。
4. 未裁决状态和动作只能写“候选”，不能写“已冻结”。
5. Designer 和 Finance 已有实现也必须回查，不因为存量就跳过 G1/G1.5/G3。
