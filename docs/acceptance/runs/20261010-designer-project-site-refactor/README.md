# 设计师项目工地重构 · 本地真实数据验收

- 日期：2026-10-10
- 批次：`DESIGNER-PROJECTS-REFACTOR-20261010`
- 页面：`/designer/projects`
- 环境：Web Vite `http://127.0.0.1:8080`，本地后端 `http://127.0.0.1:8090`
- 账号：设计师 `19900000005`（董夏鹏）
- 业务事实：只读取项目、阶段、任务、现场和验收 Provider，未新增/修改业务状态、权限、金额或成本口径

## 本轮范围

1. 项目工地改为「左队列 + 中对象工作面 + 右状态引导」工作台。
2. 当前项目与当前阶段使用 `activeProjectId` / `activeStageId` 写入 URL，刷新可恢复。
3. 未指定项目锚点时显示“请先选择一个项目”，不默认选中第一条。
4. 服务端筛选和关键词搜索；筛选后当前对象不在结果时联动到新队列首位，无结果时清空中栏和右栏。
5. 项目 Hero 只使用服务端 `businessStateView.derivedLabels` 的 `currentStage/progress/risk` 作为 L1 关注事实。
6. 项目、阶段、任务、验收统一使用 `BusinessStateTag`，页面不维护另一套状态中文。
7. 设计师唯一主行动为“打开主材选材”；PM 的开工、节点和验收动作只显示责任/阻断/去向，不生成可点击主按钮。
8. 项目 Hero 展示整体施工进度条，中栏/右栏展示回款进度条、合同金额、已收和应收工程款。
9. 回款只读取项目应收计划的应收/已收投影，不展示应付、成本、毛利和利润。

## 真实浏览器结果

| 验证项 | 结果 | 证据 |
| --- | --- | --- |
| 设计师真实项目列表 | PASS，11 个项目 | 渲染记录 |
| 无锚点进入 | PASS，未默认选中项目 | 渲染记录 |
| 状态筛选 | PASS，切到待验收后 4 个项目并联动首项 | 渲染记录 |
| 搜索无结果 | PASS，清空选择、中栏回到先选择、URL 保留 keyword/status | 渲染记录 |
| 阶段切换 | PASS，`activeStageId` 写回 URL，当前工作面同步切换 | 渲染记录 |
| 深链接刷新 | PASS，项目与阶段恢复 | 渲染记录 |
| 主行动 | PASS，进入 `/designer/projects/{id}/materials` | 渲染记录 |
| 右栏新增增减项 | PASS，首屏可见，进入 `/designer/projects/{id}/changes?action=create` 后自动打开发起抽屉 | 渲染记录 |
| 现场动态/验收事实 | PASS，上下排列 App 卡片流，不存在左右双列 | 渲染记录 |
| 图片/视频媒体 | PASS，真实验收图片完成私有授权并加载；图片九宫格预览、视频首帧与播放弹窗已接入 | 渲染记录 |
| 左栏项目卡进度条 | PASS，卡片高度 160px、进度条固定 6px，不再被 flex 收缩/遮挡 | 渲染记录 |
| 施工进度条 | PASS，选中项目显示真实项目进度百分比 | 渲染记录 |
| 回款进度条 | PASS，合同金额 / 已收 / 应收 / 待收与百分比来自服务端应收汇总 | 渲染记录 |
| 成本/利润文案 | PASS，页面正文无 `成本/毛利/利润` | 渲染记录 |
| 控制台 | PASS，0 error / 0 warning | 浏览器日志 |
| 横向溢出 | PASS，1440 / 1280 / 1024 均 `scrollWidth = viewport` | 渲染记录 |
| 1440 三栏页高 | PASS，`pageScroll / viewport = 1.40`，左右栏底边对齐，施工/回款进度条首屏可见 | 渲染记录 |
| 1280 两栏布局 | PASS，320px + 644px，右栏回落到中栏下方 | 渲染记录 |
| 1024 单栏布局 | PASS，960px 单列，无横向溢出 | 渲染记录 |

## 静态门禁

- `npm run type-check` PASS
- `npm run build` PASS
- `npm run check:forms` 当前被并行改动中的 `DesignerContractChangesView.vue` 远程 `el-select` 命中阻断，本页无表单/选择器变化
- `npm run check:concepts` 当前被同一个并行文件阻断，本页业务概念未新增
- `npm run check:states` PASS
- `npm run check:actions` PASS
- `npm run check:metrics` PASS（保留既有指标差异提示）
- `npm run check:permissions` PASS
- `npm run check:page-system` PASS
- `npm run check:workbenches` PASS（剩余告警属于其他工作台和迁移期菜单差异）
- `npm run check:workspaces` PASS

## 截图

- `output/playwright/designer-project-site-20261010/project-activity-media-1440.png`
- `output/playwright/designer-project-site-20261010/project-activity-vertical-1440.png`
- `output/playwright/designer-project-site-20261010/project-site-change-guide-fix-1440.png`
- `output/playwright/designer-project-site-20261010/project-site-card-fix-1440.png`
- `output/playwright/designer-project-site-20261010/project-site-progress-1440.png`
- `output/playwright/designer-project-site-20261010/project-site-progress-1280.png`
- `output/playwright/designer-project-site-20261010/project-site-progress-1024.png`

## 未做与边界

- 后端仅对既有 `project/project/page`、`project/project/info` 增加应收/已收回款投影，不新增 API，不扩展角色权限矩阵；回款投影沿用项目可见数据范围，状态机、成本/毛利/利润口径不变。
- 未执行任何写动作；主材选材只验证了对象路由入口，逐项编辑行为不在本页验收范围。
- 其他设计师、跨企业和 PM 权限负向仍需在后续独立验收批次执行。
