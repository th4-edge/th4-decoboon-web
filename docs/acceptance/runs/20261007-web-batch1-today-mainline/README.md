# Web Batch 1 今日主线视觉烟测

> 批次：`WEB-BATCH1-20261007`
> 类型：`VISUAL_SMOKE`
> 状态：通过视觉烟测，不等于真实账号或业务验收
> 日期：2026-10-07

## 范围

验证 `workbench-navigation.json` 驱动的今日主线入口、角色工作台卡片、已批准入口和深链接基础路径渲染。

## 环境

- Web：`http://127.0.0.1:8080`
- 模式：合成 StoreManager 会话，仅拦截 `auth/session/info`
- 业务写操作：无
- 真实账户登录：未完成，当前测试口径不可用

## 证据

- `output/playwright/batch1/today-mainline-1440.png`
- `output/playwright/batch1/today-mainline-1280.png`
- `output/playwright/batch1/today-mainline-1024.png`
- `output/playwright/batch1/designer-workbench-1440.png`
- `output/playwright/batch1/designer-workbench-1280.png`
- `output/playwright/batch1/designer-workbench-1024.png`

## 结果

- 三档分辨率均无页面横向溢出。
- 控制台 `0 error / 0 warning`。
- 页面显示 StoreManager 对应的今日主线工作台卡片。
- `decisionStatus=pending_business_review` 的入口显示待业务确认，不作为可执行主行动。
- 已批准入口使用基础工作台/列表深链接，未伪造对象 ID 或默认第一条对象。
- Designer 专属工作台的场景入口使用列表基础路径；`/designer/projects/{projectId}/acceptance` 等路径不会生成无效的半路径。

## 未覆盖

- 真实账号登录和真实租户数据。
- 服务端入站队列数量和风险排序。
- 对象工作空间动作执行和 `reloadScopes`。
- 多入口一致性、越权、并发和写链路验收。

## 结论

`VISUAL_SMOKE_PASS`。下一步需在有效本地测试凭证恢复后执行真实账号 G3 验证；不得以本报告替代最终验收。
