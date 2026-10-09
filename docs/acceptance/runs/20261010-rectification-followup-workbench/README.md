# 2026-10-10 · 设计师项目交付 · 整改跟进工作台

> 结论：G2 视觉评审通过；独立业务验收未执行，不得对外声明已验收。

## 范围

- 菜单路径：`/workbench/rectification`
- 对象工作区：`/designer/projects/:projectId/acceptance?stageId=...`
- 业务依据：`BR-008`、`SCN-010`、`DEC-007`、`DEC-013`

## 已验证

- 菜单页左侧仅显示有整改中阶段的项目工地。
- 中栏显示项目 Hero，下方显示整改中阶段。
- 列表展示轮次、整改类型、整改责任人、问题、截止日期、逾期天数和下一步。
- 点击整改项进入同一阶段验收工作区，携带 `stageId`。
- 页面没有新增整改单、代业主确认或直接关闭整改的入口。
- 1440/1280 无页面横向溢出，控制台 0 error。

## 证据

```text
output/playwright/rectification-board-1440.png
output/playwright/rectification-board-1280.png
```

## 约束

- 浏览器视觉评审使用临时只读样本，不写入后端。
- 整改复验仍使用同一验收单和 append-only 轮次。
- 员工不能代替业主确认或驳回。
- 独立验收、真实多轮复验和生产冒烟尚未执行。
