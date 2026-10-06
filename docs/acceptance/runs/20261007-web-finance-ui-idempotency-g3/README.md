# Finance Web UI 幂等与并发 G3

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 类型：`REAL_UI_IDEMPOTENCY_G3`
> 状态：双击防重、同幂等键并发、真实账号回读与回滚 PASS
> 日期：2026-10-07

## 1. 对象

- Finance：本地测试账号 `19900000002`（吴濛濛，emp `1790000000000000102`）。
- 测试企业：`1790000000000000001`（昭青装饰）。
- 应收节点：`233290454450307072`（质保金，200.00，Pending，待收 200.00）。
- 前端：`http://127.0.0.1:8080`（Vite dev），后端：`http://127.0.0.1:8090`（local dev）。

## 2. 双击防重（真实 UI）

操作：在 `/finance/receivables?projectId=232968907537776640` 打开“质保金 → 登记收款”抽屉，填写
“本次收款”10.00，双击“确认收款并核销”。

结果：

```text
receipt_id: 233359160614322176
amount: 10.00
idempotency_key: cc2269d5-bc37-40d1-aa61-a139cf6221c2（抽屉打开时生成，双击两次复用同一键）
receipt 行数: 1
ledger 行数: 1（source=Receipt，source_id=233359160614322176）
receivable: received_amount=10.00，status=Partial
```

结论：同一次打开抽屉内的两次提交复用同一 `idempotency_key`，服务端只形成一条收款和一条台账。
前端按钮 `:loading="saving"` 在提交期间禁用，与后端幂等共同兜底。

## 3. 同幂等键并发（API 并发）

两个会话同时提交相同 `idempotencyKey=g3i-concurrent-0001`、金额 5.00：

```text
请求 A: success=false，message=该幂等键已被其他收付款占用，请勿复用
请求 B: success=true，receipt_id=233359243674124289
```

最终：

```text
receipt 行数（该应收）: 2（10.00 + 5.00，各一条）
每笔收款对应台账: 各 1 条
receivable: received_amount=15.00，status=Partial
```

结论：并发同幂等键只形成一条有效收款，另一请求被拒绝，不重复核销、不重复写台账。

## 4. UI 回读

页面“刷新”后质保金行显示：

```text
部分收款 · 已收 ¥15.00 / ¥200.00 · 8%
```

与数据库 `received_amount=15.00 / status=Partial` 一致，回读来自服务端事实。

## 5. 清理与回滚

```text
db_finance_receipt: 0（该应收）
db_finance_ledger（两笔收款来源）: 0
db_finance_receivable: received_amount=0.00，status=Pending
Finance 口令: password_hash 还原为原值，临时口令登录返回 AUTH_FAILED
```

## 6. 未覆盖

- 真实网络超时后重试：由“同键并发 + 同键顺序重试”覆盖同幂等键契约，未注入真实网络中断。
- 付款侧双击：收款与付款抽屉复用同一提交范式与同一幂等键机制，本轮以收款为主证。
- 跨会话重复提交（关闭后重新打开）视为新业务意图，不属同一幂等键，未纳入防重断言。
- 生产环境：未触及。
