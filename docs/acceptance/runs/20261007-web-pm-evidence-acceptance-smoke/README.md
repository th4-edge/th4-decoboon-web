# Web Pm 任务完成证据与阶段验收 smoke

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`MOCK_NETWORK_INTEGRATION`
> 状态：任务完成证据与 Pm 验收路由契约通过
> 日期：2026-10-07

## 验证范围

- Pm 任务处于 `Accepting` 时打开“完成任务”对话框。
- 上传任务证据调用 `file/private/grant`。
- 确认完成任务调用 `project/task/update`，携带 `action=done` 和证据路径。
- `/pm/projects/:projectId/acceptance` 复用阶段验收工作区。
- 阶段验收工作区使用 Pm 返回路径。

## 捕获 payload

```json
{
  "taskId": "t1",
  "action": "done",
  "evidenceUrls": ["upload/project/task/proof.png"]
}
```

## 结果

- 任务完成按钮打开对话框。
- 证据上传后确认按钮可用。
- 任务完成请求携带证据路径。
- Pm 验收路由加载 `.aw` 阶段验收工作区。
- 页面标题为“阶段验收工作区”。

## 未覆盖

- 真实任务完成和证据写链路。
- 阶段验收真实提交、复验和业主确认。
- 采购锁定并发。
- 三档真实浏览器截图。
- 生产环境。
