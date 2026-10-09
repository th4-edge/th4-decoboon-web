# 2026-10-10 · 设计师项目交付 · 主材选材工作台

> 结论：G2 视觉评审通过；独立业务验收未执行，不得对外声明已验收。

## 范围

- 菜单：设计师 / 项目交付 / 主材选材
- 路由：`/workbench/material-selection`
- 对象内工作区：`/designer/projects/:projectId/materials`
- 业务依据：`SCN-006`、`BR-004`、`BR-009`、`DEC-035`、`DEC-056`

## 已验证

- 正常态：跨项目队列、项目切换、筛选、搜索、进度、分项预览、唯一主行动。
- 空态：数据范围内没有待选材项目。
- 错误态：队列读取失败时显示“暂不可确认”并可重试。
- 部分确认态：分项读取失败时保留队列和项目摘要，但标记未加载分项。
- 阻断态：合同没有主材分项时禁用“进入逐项选材”，提示检查合同主材行。
- 业务边界：选材页不展示客户姓名；不展示或修改报价、合同、成本、数量；已进入采购后提示只能走增减项。
- 响应式：1440 三栏、1280 两栏、1024 单栏均无横向溢出；核心文本无溢出；控制台 0 error。

## 证据

```text
output/playwright/material-selection-review/material-selection-final-1440.png
output/playwright/material-selection-review/material-selection-final-1280.png
output/playwright/material-selection-review/material-selection-final-1024-v2.png
output/playwright/material-selection-review/material-selection-partial-1440.png
output/playwright/material-selection-review/material-selection-error-1440.png
```

几何指标：

| 分辨率 | 布局 | 横向溢出 | 页面滚动比 |
| --- | --- | --- | --- |
| 1440×900 | 三栏 | 否 | 1.43 |
| 1280×800 | 两栏 | 否 | 1.58 |
| 1024×768 | 单栏降级 | 否 | 3.12（页面滚动） |

## 约束

- 视觉评审中使用的样本仅用于检查长名称、锁定、未配置和部分确认等状态，不写入后端。
- `GAP-WEB-014` 尚未关闭：主材选材版本语义在后端原地更新与业务文案“形成新版本”之间仍不一致。
- 本轮未改后端、未执行 DDL、未写业务数据。
