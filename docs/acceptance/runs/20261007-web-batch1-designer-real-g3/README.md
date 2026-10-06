# Web Batch 1 设计师真实账号 G3

> 批次：`WEB-BATCH1-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：设计师只读页面 PASS；写链路 NOT_TESTED
> 日期：2026-10-07

## 范围

验证真实本地测试企业、真实 Designer 凭证、真实后端 Provider 下：

- 今日工作
- 报价工作台
- 客户与设计
- 合同交接
- 项目工地

## 环境

- Web：`http://127.0.0.1:8080`
- 后端：`http://127.0.0.1:8090`，`dev` profile
- 数据库：本地 `127.0.0.1/decoboon`
- 凭证：本地测试设计师凭证，仅临时替换密码哈希
- 恢复：验收后已还原原哈希；临时口令探针返回 `AUTH_FAILED`

## 结果

| 页面 | 1440 | 1280 | 1024 | Console |
| --- | --- | --- | --- | --- |
| 今日工作 | PASS | PASS | PASS | 0 error / 0 warning |
| 报价工作台 | PASS | PASS | PASS | PASS |
| 客户与设计 | PASS | PASS | PASS | PASS |
| 合同交接 | PASS | PASS | PASS | PASS |
| 项目工地 | PASS | PASS | PASS | PASS |

- 三档分辨率均无页面横向溢出。
- 真实 `session/info`、`quote/designer/page`、`project/project/page` 等项目读取接口返回 200。
- 今日工作显示工作台注册入口和真实报价统计。
- 合同交接显示真实交接队列。
- 项目工地显示真实参与项目。

## 证据

- `output/playwright/batch1-real/designer-workbench-1440.png`
- `output/playwright/batch1-real/designer-workbench-1280.png`
- `output/playwright/batch1-real/designer-workbench-1024.png`
- `output/playwright/batch1-real/designer-quotes-1440.png`
- `output/playwright/batch1-real/designer-customers-1440.png`
- `output/playwright/batch1-real/designer-contract-1440.png`
- `output/playwright/batch1-real/designer-projects-1440.png`

## 未覆盖

- 合同签约、设计提交、报价提交和验收写操作。
- 退款、员工发放的真实超时/双击/并发 E2E。
- 其他角色真实账号 G3。
- 对象工作空间动作策略和 `reloadScopes` 的真实回读。
- `GAP-WEB-004` 空阶段验收和 `GAP-026` TeamLeader 财务字段。

## 结论

`REAL_ACCOUNT_G3_PARTIAL_PASS`。设计师只读页面具备继续研发的页面证据，但不得据此宣布 Batch 1 或全角色业务验收完成。
