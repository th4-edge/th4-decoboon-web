# Web Batch 2 Pm 真实账号 G3

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：Pm 只读页面 PASS；写链路 NOT_TESTED
> 日期：2026-10-07

## 范围

验证真实本地测试企业、真实 Pm 凭证、真实后端 Provider 下：

- `/pm/workbench` 项目队列
- 项目对象上下文
- 阶段事实
- 任务、日报、验收读取
- 1440 / 1280 / 1024 布局

## 环境

- Web：`http://127.0.0.1:8080`
- 后端：`http://127.0.0.1:8090`，`dev` profile
- 数据库：本地 `127.0.0.1/decoboon`
- 凭证：本地测试 Pm 凭证，仅临时替换密码哈希
- 恢复：验收后已还原原哈希；临时口令探针返回 `AUTH_FAILED`

## 结果

- 项目队列真实返回 5 个项目。
- 选择项目后 URL 携带 `projectId`，刷新上下文可恢复。
- 项目详情读取成功。
- 阶段返回 8 条。
- 任务、日报、验收读取接口均返回 200。
- 未冻结的任务/阶段主行动显示禁用“待业务确认”。
- 三档分辨率均无横向溢出。
- 控制台 `0 error / 0 warning`。

## 证据

- `output/playwright/batch2-pm-real/pm-workbench-1440.png`
- `output/playwright/batch2-pm-real/pm-workbench-1280.png`
- `output/playwright/batch2-pm-real/pm-workbench-1024.png`

## 未覆盖

- 任务新增、编辑、完成、取消、重新打开。
- 阶段启动、完成、推进和取消。
- 选材与增减项写动作。
- 阶段验收提交/复验真实写链路。
- Pm 多入口一致性、并发和负向权限。
- `GAP-WEB-004` 零任务验收。

## 结论

`REAL_ACCOUNT_G3_PARTIAL_PASS`。Pm 只读项目工作台已具备继续研发的页面证据，但动作注册未冻结前不得宣布 Pm 闭环完成。
