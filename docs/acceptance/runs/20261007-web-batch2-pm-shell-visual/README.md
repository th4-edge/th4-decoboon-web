# Web Batch 2 Pm 壳层视觉烟测

> 批次：`WEB-BATCH2-PM-20261007`
> 类型：`VISUAL_SMOKE_MOCK`
> 状态：通过布局烟测，不代表真实账号或业务验收
> 日期：2026-10-07

## 范围

验证 `/pm` 岗位壳层、今日主线、Pm 工作台注册入口和三档布局。

## 环境

- Web：`http://127.0.0.1:8080`
- 会话：合成 Pm 会话，仅拦截 `auth/session/info`
- 项目数据：拦截 `project/project/page` 返回空数组
- 业务写操作：无

## 结果

- `/pm/workbench` 在 1440 / 1280 / 1024 三档均无横向溢出。
- 控制台 `0 error / 0 warning`。
- 页面显示 4 个 Pm 场景入口。
- Pm 工作台注册卡片深链接解析为 `/pm/workbench?...`，不越权进入 Designer 壳层。
- 空项目列表显示真实为空状态，不默认第一条项目。

## 证据

- `output/playwright/batch2-pm/pm-workbench-1440.png`
- `output/playwright/batch2-pm/pm-workbench-1280.png`
- `output/playwright/batch2-pm/pm-workbench-1024.png`

## 未覆盖

- 真实 Pm 账号和真实项目数据。
- 项目详情、阶段、任务、日报、验收的真实读取。
- 任务/阶段动作，当前仍为 `pending_business_review`。
- 选材和增减项动作，当前受 `DEF-WEB-004` 和 pending 动作约束。
- 真实浏览器 1024 下的长项目名称和极端任务数量。
