# Finance 收付款真实 API 写入 G3

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 类型：`API_REAL_WRITE`
> 状态：收款、付款、幂等、超额拒绝真实写入与回滚 PASS
> 日期：2026-10-07

## 测试对象

- 应收：`233290454450307072`，金额 200.00，Pending
- 应付：`1790210543763331233`，金额 720.00，Pending
- Finance：本地测试账号 `19900000002`

## 收款

请求金额：10.00

结果：

```text
receipt_id: 233356073304588288
success: true
```

同一幂等键重试返回同一 `receipt_id`：

```text
233356073304588288
```

超额收款：

```text
400 收款金额不能超过应收余额
```

应收状态：

```text
received_amount=10.00
status=Partial
```

## 付款

请求金额：10.00

结果：

```text
payment_id: 233356073996648448
success: true
```

同一幂等键重试返回同一 `payment_id`：

```text
233356073996648448
```

超额付款：

```text
400 付款金额不能超过应付余额
```

应付状态：

```text
paid_amount=10.00
status=Partial
```

## 回滚结果

测试后已恢复：

```text
应收：received_amount=0.00，status=Pending
应付：paid_amount=0.00，status=Pending
收款记录：0
付款记录：0
资金台账新增：0
应付核销新增：0
Finance 临时凭证：已恢复，临时口令 AUTH_FAILED
```

## 未覆盖

- Web 财务抽屉的真实 UI 写操作。
- 应收/应付编辑动作。
- 退款真实写入。
- 台账更正、作废、冲正重记。
- 凭证生成和打印。
- 项目结算。
- 生产环境。

## 结论

`FINANCE_WRITE_API_G3_PASS`。收款/付款 Provider 的正常写入、幂等和超额拒绝已通过本地真实 API 验证并回滚。Web 表单写链路和凭证链路仍需单独验收。
