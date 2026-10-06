# 项目工地 · 页面落地与布局冒烟验收

- 日期：2026-10-06
- 批次：`DESIGNER-PROJECTS-20261006`
- 页面：`/designer/projects`
- 分辨率：1440×900 / 1280×800 / 1024×768
- 环境：本地 Vite `http://127.0.0.1:8080`，后端 `http://127.0.0.1:8090`

## 本轮完成

1. 项目池：按项目参与关系加载项目，支持关键词和状态筛选。
2. 项目事实：项目名称、编号、客户、房屋、状态、施工进度、当前阶段。
3. 施工阶段：按 `sort` 展示阶段顺序、权重、状态、进度和计划日期。
4. 施工任务：只读展示任务、阶段、状态、进度、负责人和计划日期。
5. 现场动态：只读展示最新现场记录、记录时间和记录人。
6. 验收事实：只读展示最新阶段验收状态、结论、问题和时间。
7. 设计师边界：不推进 PM 的开工/节点/验收动作，不展示项目成本、毛利和利润，不代业主确认验收。

## Provider 路由

| 用途 | Provider |
| --- | --- |
| 项目列表 | `project/project/page` |
| 项目详情 | `project/project/info` |
| 施工阶段 | `project/stage/page` |
| 施工任务 | `project/task/page` |
| 现场动态 | `project/report/page` |
| 验收事实 | `project/acceptance/page` |

## 验证结论

| 项 | 结果 |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run build` | PASS |
| `/designer/projects` 三档渲染 | PASS（路由 Mock 数据） |
| 浏览器控制台 | 0 error / 0 warning |
| 项目池、阶段、任务、现场、验收渲染 | PASS（路由 Mock 数据） |
| 真实项目数据与权限负向 | 待真实设计师账号登录后补验 |

## 数据说明

本轮截图使用 Playwright 路由 Mock 提供合成项目、阶段、任务、现场和验收数据，仅用于验证信息架构、阶段轨道和只读项目协同。

**这不是 G3 真实数据验收，也不代表 PM 节点推进或验收动作已完成。**

## 截图

- `raw/screenshots/DESIGNER-PROJECTS-1440x900.png`
- `raw/screenshots/DESIGNER-PROJECTS-1280x800.png`
- `raw/screenshots/DESIGNER-PROJECTS-1024x768.png`

## 后续必须补验

1. 使用真实设计师账号确认只显示本人参与项目。
2. 验证阶段、任务、现场和验收数据与 PM / App 一致。
3. 验证设计师调用 PM 节点推进接口和业主验收接口均被拒绝。
4. 补真实数据下 1440 / 1280 / 1024 三档和键盘路径。
5. 主材选材、增减项和更完整的任务协同后续按项目页批次补齐。
