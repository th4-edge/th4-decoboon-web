# Finance Web UI 真实写入 G3

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 类型：`REAL_UI_WRITE_G3`
> 状态：应收收款、应付付款 Web 抽屉写入与回滚 PASS
> 日期：2026-10-07

## 对象

- Finance：本地测试账号 `19900000002`
- 应收：`233290454450307072`
- 应付：`1790210543763331233`

## 收款 UI

页面：

`/finance/receivables?projectId=232968907537776640`

操作：

1. 打开“质保金”应收节点。
2. 点击“登记收款”。
3. 在收款单抽屉填写 10.00。
4. 提交“确认收款并核销”。

结果：

```text
收款抽屉关闭
receivable.received_amount=10.00
receivable.status=Partial
receipt 数量=1
```

## 付款 UI

页面：

`/finance/payables?projectId=228669006024802304`

操作：

1. 打开材料采购应付单。
2. 点击“安排付款”。
3. 在付款单抽屉填写 10.00。
4. 提交“确认付款并核销”。

结果：

```text
付款抽屉关闭
payable.paid_amount=10.00
payable.status=Partial
payment 数量=1
```

## 回滚

```text
应收：0.00 / Pending
应付：0.00 / Pending
收款记录：0
付款记录：0
新增台账：0
新增核销：0
Finance 临时凭证：已恢复，临时口令 AUTH_FAILED
```

## 已覆盖

- 真实 Finance 登录。
- Web 收款抽屉提交。
- Web 付款抽屉提交。
- 页面动作成功后抽屉关闭。
- 应收、应付状态回读。
- 收款、付款事实落库。
- 测试数据与凭证回滚。

## 未覆盖

- 双击、超时重试和并发 UI 操作。
- 超额收款/付款在 UI 抽屉中的交互展示，API 层已单独验证拒绝。
- 台账更正、作废、冲正重记。
- 凭证生成、打印和 PDF。
- 项目结算。
- 生产环境。

## 结论

`FINANCE_UI_WRITE_G3_PASS`。财务 Web 收付款抽屉真实提交链路已通过本地测试和回滚验证。
