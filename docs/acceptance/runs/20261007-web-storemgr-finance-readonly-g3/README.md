# StoreManager 本店财务只读 G3

> 批次：`WEB-BATCH4-STOREMANAGER-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：店长进入本店财务只读态、写入口裁剪、后端越权拒绝 PASS
> 日期：2026-10-07
> 关闭：`GAP-WEB-008`（Web 路由/按钮冲突）

## 1. 范围

- 店长账号：`19900000003`（王洪文，emp `1790000000000000103`，store `1790000000000000002`）。
- 测试企业：`1790000000000000001`（昭青装饰，单门店）。
- 后端：`http://127.0.0.1:8090`；前端：`http://127.0.0.1:8080`。

## 2. 修复内容

1. 路由 `/finance` 的 `roles` 增加 `StoreManager`，守卫 `isFinanceArea` 放行店长只读。
2. 新增 `src/domains/finance/access.ts`：`canWrite`（Boss/Finance）、`canCorrect`（Boss）、`readOnly`。
3. 财务视图按 `canWrite` 裁剪写入口：工作台、应收、应付、收款、付款、退款、台账、项目账本、员工工资、员工提成。
4. 凭证模板 `voucherTemplate.manage` 保持对店长开放（业务允许）。

## 3. 正向（真实店长账号）

| 页面 | 结果 |
| --- | --- |
| `/finance/workbench` | 可进入，显示「本店财务只读」，无「登记资金事实」 |
| `/finance/receivables` | 无「新增应收节点」「登记收款」 |
| `/finance/payables` | 无「新增应付成本」「安排付款」 |
| `/finance/ledger` | 无「手工记账」「批量生成凭证」 |
| `/finance/voucher-templates` | 保留「保存新版本 / 编辑 / 复制并编辑」（业务允许） |

## 4. 反向（后端兜底）

店长令牌直接调用写 Provider：

```text
finance/receipt/save      -> 403 当前账号无权执行该操作
finance/ledger/save       -> 403 当前账号无权执行该操作
document/voucher/build    -> 403 当前账号无权执行该操作
```

数据核对：无新增收款、无新增台账、无新增凭证，应收 `received_amount=0.00` 未变。

## 5. 清理

```text
店长临时口令已还原，原 hash 恢复后临时口令返回 AUTH_FAILED
测试期间无业务写入
```

## 6. 未覆盖

- 跨店负向：本地测试企业仅单门店，无跨店对象可构造；后端 `FinanceAccessContext.resolveProject/visible` 已按 store 限制，待多门店测试企业可用时补真实跨店用例。
- 店长风险队列 `boss.risk` 仍为 planned 入口（deepLink 指向工作台），未实现专属队列页面。
- 店长本店转交/指派入口的 UI 尚未在客户/项目工作面暴露（后端 `customer/owner-change`、`customer/customer/handoff` 已支持店长）。
- 生产环境：未触及。
