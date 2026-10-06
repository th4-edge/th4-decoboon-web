# Web 凭证生成真实账号 G3

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：真实 Finance 账号写入、重打幂等、合并与非法来源拒绝、清理回滚 PASS
> 日期：2026-10-07
> 动作：`document/voucher/build`（对象 `voucher`，角色 Finance/Boss，范围 Company）

## 1. 范围

- 本地测试企业 `1790000000000000001`（昭青装饰）。
- Finance 账号：`19900000002`（吴濛濛，emp `1790000000000000102`）。
- 后端：本地 dev 实例 `http://127.0.0.1:8090`，动作 `POST /api/document/voucher/build`。
- 注册表动作前置条件取自 `docs/standards/business-action-policies.json`。
- 本文件不新增金额、成本、利润或账务口径。

## 2. 动作注册（Web 侧）

本轮先补齐 Web 注册表，动作才允许进入实际验证：

- 新增状态机 `voucher`（`active` / `voided`），派生事实 `voucherNo`、`templateVersion`、`sourceKeys`、`sha256`、`fileName`。
- 新增动作 `document/voucher/build`：Finance/Boss、Company、`to=active`、账单口径取来源流水。
- `finance.ledger` 页面任务 `actionPolicyKeys` 增加 `document/voucher/build`。
- 新增验收场景 `voucher.build.normal`、`voucher.build.rejection`、`voucher.build.concurrent`。
- 校验：`check:states`、`check:actions`、`check:permissions`、`check:page-system`、`check:workbenches`、`check:workspaces`、`type-check`、`build` 全部通过。

## 3. 正向：生成凭证并重打

来源流水：

```text
ledger_id: 233299284433305600
direction: Income / Receipt
category: 进度款
counterparty: 提成P0本地测试客户
amount: 26162.44
project_id: 232968907537776640
```

首次生成：

```text
voucherId: 233358119390937088
voucherNo: PZ202610070641500001
type: Receipt
title: 客户收款收据
templateVersion: 2
totalAmount: 26162.44
partyName: 提成P0本地测试客户
fileName: 昭青装饰_客户收款收据_PZ202610070641500001.pdf
size: 64325
sha256: 170c84c2107d3b6a8221ef4f3e11cd475b4afaae1cfc1c1259ffd4d01ed9482d
status: Active
operator: 吴濛濛
```

同一来源重打（第二次相同 `ledgerIds`）：

```text
voucherId: 233358119390937088
voucherNo: PZ202610070641500001
```

结论：重打返回同一条凭证、同一凭证号，未产生第二条凭证事实。

## 4. 反向：拒绝用例

同一来源组合不同口径合并（项目相同、款项类型不同）：

```text
ledgerIds: [233299284433305600, 233299285888729088] -> 400 仅可合并收款方/付款方、项目、款项类型三者相同的记录
```

不同对方合并：

```text
ledgerIds: [233288468246036480, 233299286262022144] -> 400 仅可合并收款方/付款方、项目、款项类型三者相同的记录
```

空来源：

```text
ledgerIds: [] -> 400 请选择要打印的款项记录
```

已作废来源（临时置 `voided=1` 后立即还原）：

```text
ledgerIds: [233299282990465024] -> 404 存在无权访问或已不存在的款项记录
```

以上拒绝用例均未产生凭证记录或对象文件。

## 5. 清理与回滚

测试后已恢复：

```text
db_voucher_record 凭证行：0
db_voucher_item 明细行：0
db_voucher_revision 修订行：0
对象文件（OSS）：DELETE 204，复验 HEAD 404
本地下载 spool：已清空
db_finance_ledger 测试流水 voided 标记：已还原为 0
Finance 口令：password_hash 还原为原值，临时口令登录返回 AUTH_FAILED
```

## 6. 未覆盖

- 凭证作废：后端当前没有凭证作废 Provider，未登记相关动作，不得凭空实现。
- Book/Boss 之外的负向角色用例：由 Provider `requireRole(Boss, Finance)` 与 `FinanceAccessContext` 回归覆盖，本轮未再临时重置第二个账号。
- 凭证模板自定义发布：属 `voucherTemplate.manage` 边界，不在本动作内。
