# Web Batch 2 Pm 真实写链路 G3

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`REAL_ACCOUNT_G3`
> 状态：阶段开工、任务开始、任务提交验收真实写入与回滚 PASS
> 日期：2026-10-07

## 测试对象

- 项目：`231352376261345280`
- 阶段：`231352376336842752`，开工交底
- 任务：`231352376382980096`，水电--无主灯电路改造
- Pm：本地测试账号 `19900000008`

## 操作前

```text
项目状态：Preparing
阶段状态：Todo，actual_start=NULL
任务状态：Todo，progress=0，actual_start=NULL
StageOpen 日报：0
```

## 操作后

```text
项目状态：Ongoing
阶段状态：Doing，actual_start=2026-10-07
任务状态：Accepting，progress=90，actual_start=2026-10-07
StageOpen 日报：1
```

## 回滚结果

操作后已恢复：

```text
项目状态：Preparing
阶段状态：Todo，actual_start=NULL
任务状态：Todo，progress=0，actual_start=NULL
StageOpen 日报：0
```

Pm 临时凭证据恢复，临时口令再次登录返回 `AUTH_FAILED`。

## 页面结果

- `/pm/workbench?projectId=231352376261345280` 真实项目上下文打开。
- 阶段开工后当前阶段更新为 `Doing`。
- 任务开始后状态显示“进行中”，进度 10%。
- 任务提交验收后状态显示“待确认”，进度 90%。
- 1440 / 1280 / 1024 无横向溢出。
- Console `0 error / 0 warning`。

## 证据

- `output/playwright/pm-write-real/pm-workbench-1440.png`
- `output/playwright/pm-write-real/pm-workbench-1280.png`
- `output/playwright/pm-write-real/pm-workbench-1024.png`

## 未覆盖

- 任务完成及现场证据上传。
- 任务重开；后端当前 `reopen` 落成 `Todo`，与业务裁决 `Doing` 不一致。
- 阶段验收提交、复验和业主确认。
- 项目字段更新表单。
- 合同变更。
- 生产环境。
