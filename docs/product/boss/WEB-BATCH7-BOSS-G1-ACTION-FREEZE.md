# Web Batch 7 Boss G1 动作冻结

> 批次：`WEB-BATCH7-BOSS-20261007`
> 状态：`G1_ACTION_FROZEN`
> 上游：`DEC-015`、`DEC-016`、`DEC-032`、`DEC-033`、`DEC-034`、`BR-028`、`BR-029`、`BR-030`、`SCN-016`、`T12-BIZ-20261007-006`
> 事实源：`zhuangdeqing-business`（装得清业务智能体）
> 本文件不新增角色、状态、动作、金额、成本或利润口径。

## 1. 角色定位

BOSS 是**企业内部全部岗位能力的超集**（DEC-032 / BR-028）：

```text
BOSS 能力 = Boss 管理 ∪ StoreManager ∪ TeamLeader ∪ Marketer ∪ Designer ∪ Pm ∪ Finance 内部能力
```

- 数据范围：`Company`（全企业）。
- 单人装企无需虚构岗位即可完成全部**内部**业务闭环。
- **外部主体能力不并入**：业主验收确认、客户合同签认、工人/供应商自助、平台运营管理。
- 同人连续节点仍逐步推进状态机、逐步留痕，不得合并为一个不可追溯动作。

## 2. 已冻结写动作（按域，共 33 项已登记动作）

| 域 | 动作 |
| --- | --- |
| 客户/量房 | `follow/save`、`measure`、`measure/save`、`customer/designer-handoff`、`customer/owner-change` |
| 设计/报价/合同 | `design/scheme/save|build`、`design/space/*`、`design/item/*`、`quote/save`、`quote/lines/save`、`quote/submit`、`project/contract/save`、`project/contract/*`、`project/contract-change/*`、`project/contract-change/customer-confirm`（代登记） |
| 项目/施工 | `project/project/update`、`project/task/*`、`project/stage/*`、`project/acceptance/save`、`project/acceptance/*` |
| 材料 | `material/selection/save`、`material/selection/confirm` |
| 财务 | `finance/receivable|receipt|payable|payment/save`、`finance/ledger/save|update|delete|correct`、`document/voucher/build` |

共同边界：

- 金额、成本、权限、幂等和完整性校验不变；不因 BOSS 身份放宽。
- 连续由同一 BOSS 执行的制单/确认/发放，每一步独立记录实际操作人、承担能力、前后状态和时间。

## 3. 只读与管理面

| 面 | 说明 |
| --- | --- |
| 经营概览 | 本月漏斗、线索/到店/量房/报价/签约（`statistic/boss/business/report`） |
| 风险队列 | 全企业风险（`statistic/risk/report`，Boss Company 范围） |
| 财务 | 全公司应收/应付/收付款/台账/凭证/成本/利润 |
| 设计/项目 | 可进入设计与项目工作面执行内部动作 |
| 组织 | 员工、团队、门店、角色与配置（管理面） |

## 4. 明确拒绝（负向矩阵）

- **业主验收确认/驳回**：`project/acceptance/confirm|reject` 角色仅 `Owner`，BOSS 不可代确认（DEC-015 / BR-028）。
- 客户本人合同签认：BOSS 只能按 `DEC-015` 以内部代登记方式留痕，不得伪装客户本人。
- 跨企业：拒绝（Company 范围不等于跨租户）。
- 修改已发放工资、已释放提成、已发生收付款历史金额：禁止。
- 平台运营管理（`com.th4.edge.platform`）：BOSS 不获得。
- 通过前端传 `companyId/empId/ownerId` 伪造身份：拒绝。

## 5. 页面批次范围

- 管理导航（经营总览、业务分析、项目监管、设计与报价、财务经营、组织效能、风险中心）
- 风险队列 `/workbench/risk`（Boss 已可读，全企业范围）
- 财务 `/finance/**`、设计与报价 `/designer/**`、项目 `/pm/**`（Boss 均可进）
- 一人装企岗位视角：同一 BOSS 依次执行制单→确认→发放，界面只切上下文，不改身份/范围/审计主体

不做：代业主确认入口、平台运营入口、跨企业视图。

## 6. 验收门槛

- 正向：单人装企工资闭环（方案→考勤→工资单→确认→发放→台账→工资条）每步留痕。
- 正向：BOSS 连续执行制单/确认/发放，审计记录实际操作人与承担能力。
- 反向：BOSS 不能代替业主确认/驳回；财务/店长/普通员工不能获得 BOSS 全企业能力。
- 反向：不能跨企业、不能改已发生历史金额。
- 金额：成本完整才给利润；不完整显示「成本未完整」。
- 页面：真实 BOSS 账号、三档分辨率。

## 7. 当前不开放 / 待决

- 管理导航中「经营总览 / 业务分析 / 项目监管 / 组织效能」仍为 planned，未实现专属页面；本批先冻结边界与已实现入口（风险队列、财务、设计报价、项目）。
- `GAP-026`（TeamLeader 商务财务字段）与 `GAP-WEB-009/011`（TeamLeader 风险读侧、成本越界）未关闭，不影响 BOSS Company 范围，但需在实现组织效能前收敛。
- 一人装企「岗位视角」UI 尚未实现（只切上下文不改身份），需在 G2 落地并留痕。

## 8. 冻结证据（2026-10-07，本地真实账号）

BOSS：`19900000001`（张伟，emp `1790000000000000101`，Company `1790000000000000001`）。

```text
statistic/risk/report          -> 全企业 37 条风险（high 1）
finance/receivable/page        -> 可读全公司应收（Company 范围）
statistic/boss/business/report -> 本月漏斗（线索 11 / 到店 0 / 量房 5 / 报价 …）
project/acceptance/confirm     -> 注册表角色仅 Owner（BOSS 不可代业主确认）
project/contract-change/customer-confirm -> 角色含 Boss（按 DEC-015 内部代登记）
```

结论：BOSS 内部能力超集与「不冒充业主」边界在注册表与实现层一致。