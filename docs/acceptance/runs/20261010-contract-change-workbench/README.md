# 2026-10-10 · 设计师项目交付 · 增减项工作台

> 结论：G2 视觉评审通过；独立业务验收未执行，不得对外声明已验收。

## 范围

- 菜单查看页：`/workbench/contract-changes`
- 详情页：`/designer/projects/:projectId/changes`
- 发起入口：项目工地对应项目，带 `action=create`
- 业务依据：`SCN-004`、`BR-035`、`BR-041`、`DEC-041`、`DEC-055`

## 已验证

- 菜单页：左侧项目工地、中间项目 Hero、下方已有变更单列表。
- 菜单页不出现“发起增减项”。
- 点击变更单进入详情，详情页不出现新增按钮。
- 项目工地以 `action=create` 进入详情时，自动打开一张多明细发起抽屉。
- 发起抽屉包含：变更原因、多行明细、新增/减项/替换、来源选择、报价项目库目标、客户线下确认时间/确认人/方式、签名或现场证据、结果预览。
- 客户线下确认是创建前置；新入口不提供调价；原报价和原合同行不变；成本对设计师不可见。
- 1440 两/三栏无横向溢出；1280 两栏中央和引导内部滚动，无横向溢出；控制台 0 error。

## 证据

```text
output/playwright/contract-change-review/contract-change-board-1440.png
output/playwright/contract-change-review/contract-change-board-1280.png
output/playwright/contract-change-review/contract-change-detail-1440.png
output/playwright/contract-change-review/contract-change-create-1440.png
```

## 约束

- 浏览器视觉评审使用临时只读样本，不写入后端。
- 当前有效剩余、目标金额、成本和差额以服务端为准。
- 独立验收、真实审批写入和生产冒烟尚未执行。
