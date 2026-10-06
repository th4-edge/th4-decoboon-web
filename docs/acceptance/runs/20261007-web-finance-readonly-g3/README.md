# Web Finance 只读 G3

> 批次：`WEB-BATCH3-FINANCE-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：Finance 真实账号只读页面 G3 PASS；资金写入 NOT_TESTED
> 日期：2026-10-07

## 范围

使用真实本地 Finance 测试账号访问全部财务路由：

- 财务工作台
- 应收计划
- 收款记录
- 应付账款
- 付款记录
- 客户退款
- 资金台账
- 项目账本
- 收付凭证
- 凭证模板
- 员工工资
- 员工提成
- 提成负向调整

## 结果

- 13 个财务路由均可打开。
- 页面标题和一级标题一致。
- 1440 / 1280 / 1024 均无横向溢出。
- Console `0 error / 0 warning`。
- 财务工作台与资金台账完成三档截图。
- 未执行任何收付款、退款、记账、结算或凭证写入。

## 证据

- `output/playwright/finance-g3-real/finance-workbench-1440.png`
- `output/playwright/finance-g3-real/finance-workbench-1280.png`
- `output/playwright/finance-g3-real/finance-workbench-1024.png`
- `output/playwright/finance-g3-real/finance-ledger-1440.png`
- `output/playwright/finance-g3-real/finance-ledger-1280.png`
- `output/playwright/finance-g3-real/finance-ledger-1024.png`

## 凭证

- Finance 测试凭证仅临时重置。
- 验收后已恢复原密码哈希。
- 临时口令再次登录返回 `AUTH_FAILED`。

## 未覆盖

- 应收/收款真实写入。
- 应付/付款真实写入。
- 退款真实写入。
- 台账记账、更正、作废、冲正重记真实写入。
- 凭证生成、打印和 PDF。
- 项目结算真实写入。
- 生产环境。

## 结论

`FINANCE_READONLY_G3_PASS`。页面和路由具备真实账号只读证据，但资金写链路尚未验收。
