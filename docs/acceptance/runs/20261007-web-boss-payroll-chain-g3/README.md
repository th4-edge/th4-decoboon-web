# Boss 一人装企工资链闭环核对 G3

> 批次：`WEB-BATCH7-BOSS-20261007`
> 类型：`REAL_ACCOUNT_READ_AND_GATE`
> 状态：工资链闭环一致性、步骤门禁与角色边界 PASS
> 日期：2026-10-07
> 上游：`DEC-032`、`BR-028`、`BR-015`、`DEC-017`

## 1. 范围

- BOSS：`19900000001`（张伟，Company `1790000000000000001`）。
- 链路口径：薪酬方案 → 考勤 → 工资单生成 → 确认 → 员工发放 → 资金台账 → 工资条。
- Provider：`payroll/compensation/*`、`attendance/summary/*`、`payroll/sheet/build|update`、`finance/payment/employee/save`、`payroll/payslip/my/page`。

## 2. 闭环一致性（既有已发放工资单 2026-11）

对已 Paid 的工资单 `233288320833028096`（2026-11，实发 11727.27）逐段核对：

```text
工资单 233288320833028096        status=Paid，confirmed_at=2026-10-07 02:04:52
工资项 233288321004994560 (0105)  net 6000.00  status=Confirmed
工资项 233288321109852160 (0106)  net 5727.27  status=Confirmed
应付   233288413749444608         PayrollItem/233288321004994560  amount 6000.00 paid 6000.00 status=Paid
应付   233288413791387648         PayrollItem/233288321109852160  amount 5727.27 paid 5727.27 status=Paid
付款   233288468220870656 (0105)  amount 6000.00
付款   233288414571528192 (0106)  amount 5727.27
台账   233288468246036480          Expense/Payment 6000.00 董夏鹏 员工工资/提成发放
台账   233288414600888320          Expense/Payment 5727.27 谢玲玲 员工工资/提成发放
工资条 233288413925605376 (0105)  net 6000.00  Published
工资条 233288413988519936 (0106)  net 5727.27  Published
```

结论：工资单→工资项→应付→付款→台账→工资条金额与主体逐段一致，无重复累计、无断链。

## 3. 步骤门禁与角色边界（真实账号）

```text
BOSS 确认未完成考勤的 2026-12 草稿工资单
  -> 400 考勤未确认，工资单不可确认（业务门禁生效，且未落库）
StoreManager 确认工资单
  -> 403 当前账号无权执行该操作（requireEditor = Boss/Finance）
BOSS / StoreManager 读取工资单
  -> 正常（requireReader = Boss/Finance/StoreManager）
员工本人（0105）读取工资条
  -> 返回本人 2026-11 工资条（实发 6000.00，已发布）
```

## 4. 清理

```text
确认调用被门禁拒绝，2026-12 工资单仍为 Draft、confirmed_at=NULL
无新增应付/付款/台账/工资条（PayrollItem 应付计数 0）
未重置凭证
```

## 5. 未覆盖

- 从零构造全新薪酬方案→考勤→工资单→确认→发放的完整写入链：需要新建一整个工资周期数据，本轮未构造；改以「既有已发放周期逐段核对 + 全链门禁/角色验证」作为闭环证据。
- BOSS 作为发薪对象的工资/应付/流水/成本归集：属 `GAP-WEB-006`（员工工资 L2）边界。
- 生产环境：未触及。
