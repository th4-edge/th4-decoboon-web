# Web Batch 6 Marketer G1 动作冻结

> 批次：`WEB-BATCH6-MARKETER-20261007`
> 状态：`G1_ACTION_FROZEN`
> 上游：`DEC-009`、`DEC-032`、`DEC-033`、`DEC-034`、`DEC-035`、`BR-001`、`BR-006`、`BR-007`、`BR-009`、`BR-028`、`BR-029`、`BR-030`、`SCN-001`、`T12-BIZ-20261007-006`
> 事实源：`zhuangdeqing-business`（装得清业务智能体）
> 本文件不新增角色、状态、动作、金额、成本或利润口径。

## 1. 角色定位

业务员是**客户归属范围内的前台执行角色**：

- 数据范围：`Self`（客户负责人=本人）；跨业务员客户一律阻断（DEC-009）。
- 主链：客户 → 跟进 → 房屋 → 约定量房 → 移交设计。
- 只读查看**本人客户**的设计与项目进度（DEC-009），不越权修改设计、报价、合同、财务（DEC-033 / DEC-034）。
- 不自动获得财务、成本、利润、工人档案与主材选材写能力。

## 2. 已冻结写动作

| 动作 | 角色 | Provider | 范围约束 |
| --- | --- | --- | --- |
| 保存客户跟进 | Marketer / Designer / StoreManager / Boss | `customer/customer-follow/save` | 客户归属可见（业务员仅本人负责客户） |
| 安排 / 调整量房 | Marketer / Designer / StoreManager / Boss | `customer/customer/measure` | 客户与房屋已建档；量房时间晚于当前；已量房不得重复预约 |

共同边界：

- 数据范围由服务端按登录员工裁决，前端不得传 `empId/ownerId` 作为授权依据。
- 写动作按 `reloadScopes` 回读；失败保留输入并显示原因。
- 业务员**不得**自助指派设计师（`customer/designer-handoff` 明确排除 Marketer）。

## 3. 只读能力（生成区块，不生成写入口）

| 面 | 可见 | 不可见 |
| --- | --- | --- |
| 客户 | 本人负责的客户、房屋、跟进、阶段轨道、时间线 | 其他业务员客户（跨业务员阻断） |
| 设计 | 本人客户的设计与方案（只读，DEC-009） | 编辑设计 |
| 报价 | 本人客户的报价进展（只读） | 编辑报价、成本与毛利 |
| 项目 | 本人客户的项目进度（只读，DEC-009） | 项目状态/任务/阶段/成员写动作 |
| 量房 | 本人客户的量房预约与记录 | 他人客户的量房 |

**不可见区块**：成本、利润、毛利率、应付、付款、现金流、工资、提成（BR-006 业务员不可见成本类凭证字段）；工人档案（BR-007 / DEC-006，业务员不可见）。

## 4. 明确拒绝（负向矩阵）

- 指派/改派设计师 `customer/designer-handoff`：Marketer 拒绝（仅 Boss/StoreManager/TeamLeader）。
- 客户负责人变更 `customer/owner-change`：拒绝（仅 Boss/StoreManager）。
- 财务写与读：`finance/*` 拒绝。
- 项目写：`project/project/update`、`project/task/update`、阶段推进、成员切换拒绝。
- 报价/合同/设计写：拒绝。
- 主材选材写：拒绝（`DEC-035` Marketer 只读）。
- 工人档案：不可见。
- 跨业务员客户、跨团队/跨门店：拒绝。

## 5. 页面批次范围

本批审计/建设业务员可见面：

- 业务员工作台（今日主线 `today.mainline`）
- 本人客户跟进（`customer.followup`，Self 范围）
- 本人客户的量房安排（`designer.measure`）
- 本人客户的设计/项目只读入口
- 全局搜索

不做：业务员专属财务页、成本/利润区块、工人档案、跨业务员客户、独立量房结论录入。

## 6. 验收门槛

- 正向：本人客户写入跟进；安排/调整量房；只读本人客户的设计与项目。
- 反向：跨业务员客户拒绝；指派设计师拒绝；财务读写拒绝；项目写拒绝；主材选材写拒绝。
- 越权：跨企业、跨门店/团队、他人客户。
- 金额：成本/利润/现金流区块不生成（不是 0）。
- 页面：真实业务员账号、三档分辨率、只读态无写入口。

## 7. 当前不开放

- `GAP-WEB-012` OPEN：`DEC-034` 量房工作台列出 Marketer 可「录量房」，但 `measure/save` 动作注册表与后端 `property/measure/save` 均要求量房完成由指定设计师执行 → Marketer 是否能录量房结论待业务裁决，本批不开放。
- 业务员的报价/合同只读字段范围未单独冻结，本批只读既有投影。
- `customer.followup` / `designer.measure` 现有深链接指向 `/designer/customers`（Designer/Boss 专属），业务员不可达，需在本批实现业务员可达的客户工作面。

## 8. 冻结证据（2026-10-07，本地真实账号）

业务员：`19900000004`（黄贤杰，emp `1790000000000000104`）。

正向：

```text
customer/customer/page        -> 50 条，owner 全部为黄贤杰（Self 范围）
customer/customer-follow/save -> 成功创建 followId 233368566424928256（随后回滚）
design/scheme/page            -> 本人客户设计只读可见
project/project/page          -> 本人客户项目 P1791233715909 只读可见
customer/customer/measure     -> 已量房屋重复预约 -> 400 该房屋已完成量房，不能重复预约
```

反向：

```text
customer/customer/handoff -> 403 仅团队负责人、店长或企业负责人可以指定设计师
finance/receivable/page   -> 403 当前账号无权执行该操作
project/project/update    -> 403 只有项目经理或企业负责人可以调整项目状态
project/task/update       -> 403 只有企业负责人、店长或项目经理可以推进施工任务
property/measure/save     -> 403 该房屋已指定设计师，量房完成必须由指定设计师执行
```

**冲突（GAP-WEB-012）**：`DEC-034` 量房工作台适用角色含 Marketer 且动作列含「录量房」，但动作注册表 `measure/save` 与后端 `property/measure/save` 均要求量房完成由指定设计师执行，业务员被拒。按纪律登记 GAP，不自行选择版本。

**环境提示**：本地 8090 运行实例为主仓库构建，未包含 `DEC-035` / 任务 reopen 等工作树提交；业务员主链的负向拒绝不受影响。