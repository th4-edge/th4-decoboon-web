# Web Batch 2 Pm 写动作集成烟测

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`MOCK_NETWORK_INTEGRATION`
> 状态：请求契约通过，不代表真实写入验收
> 日期：2026-10-07

## 验证范围

- 开启阶段调用 `project/stage/update`。
- 开始任务调用 `project/task/update`。
- 提交验收按钮使用 `project/task/update` 的 `action=finish`。
- 真实浏览器点击后重新读取项目上下文。
- 未调用真实业务写接口，所有读取和响应均被 Playwright 拦截。

## 捕获 payload

```json
{"stageId":"s1","status":"Doing"}
{"taskId":"t1","action":"start"}
```

## 结果

- 阶段开工按钮存在并发出正确 payload。
- 任务开始按钮存在并发出正确 payload。
- 完成任务、重开任务未接入：
  - 完成需要现场证据上传，当前未实现。
  - 重开当前后端 `reopen` 落到 `Todo`，与业务裁决要求的 `Done/Accepting → Doing` 不一致，等待后端修正。
- 控制台无未处理错误。

## 未覆盖

- 真实项目数据写入。
- 任务完成证据和隐蔽任务节点留证。
- 阶段验收提交、复验和业主确认。
- 项目字段更新表单。
- 合同变更和选材。
- `project/task/update`、`project/stage/update` 的真实幂等和并发。
