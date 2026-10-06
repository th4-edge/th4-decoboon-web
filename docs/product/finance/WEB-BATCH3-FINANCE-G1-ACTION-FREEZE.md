# Web Batch 3 Finance G1 动作冻结补充

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 状态：`G1_ACTION_FROZEN`
> 上游：`FINANCE-G1-迭代包.md`、`DEC-018`、`BR-003`、`BR-016`、`MET-005`、`MET-006`、`SCN-005`、`SCN-008`
> 本文件不新增金额、成本、利润或账务口径。

## 1. 已冻结动作

| 动作 | 角色 | Provider | 结果 |
| --- | --- | --- | --- |
| 保存应收节点 | Finance / Boss | `finance/receivable/save` | `frozen` |
| 登记客户收款 | Finance / Boss | `finance/receipt/save` | `frozen` |
| 保存应付单 | Finance / Boss | `finance/payable/save` | `frozen` |
| 登记业务付款 | Finance / Boss | `finance/payment/save` | `frozen` |

共同边界：

- 数据范围由服务端按登录员工裁决。
- 收付款必须幂等。
- 金额不得超过待收/未付。
- 动作后按注册表回读应收/应付、收款/付款、台账、项目账本和相关成本。
- 成本不完整时利润和毛利率为空，显示“成本未完整”。

## 2. 台账动作已冻结

| 动作 | 角色 | Provider | 状态 |
| --- | --- | --- | --- |
| 手工记账 | Finance / Boss | `finance/ledger/save` | frozen |
| 更正手工流水元数据 | Finance / Boss，Finance 仅分类/用途 | `finance/ledger/update` | frozen |
| 作废手工流水 | Boss | `finance/ledger/delete` | frozen |
| 手工流水冲正重记 | Boss | `finance/ledger/correct` | frozen |

## 3. 当前不开放

- `document/voucher/build` 尚未完成台账工作区动作注册。
- 员工工资/提成仍属 `GAP-WEB-006` 边界。
- 公司经营利润和法定会计不进入本期。
- `finance.ledger` 仍显示“待业务确认”，不作为可执行主行动。

## 4. 页面批次范围

本批先验证既有财务页面：

- 财务工作台
- 应收 / 收款
- 应付 / 付款
- 项目账本
- 资金台账只读
- 凭证模板和凭证只读

写动作只开放已经冻结的应收、收款、应付、付款；台账更正、删除和出凭证不在本轮开放。

## 5. 验收门槛

- 正常：应收 → 收款 → 台账；应付 → 付款 → 台账。
- 反向：超收、超付、重复提交、已结清继续收付款必须被服务端拒绝。
- 权限：非 Finance/Boss 不得执行财务写动作；StoreManager 财务只读。
- 金额：成本不完整时禁止显示伪利润。
- 页面：真实浏览器三档分辨率和真实财务账号。
