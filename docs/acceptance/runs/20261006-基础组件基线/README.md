# 基础组件基线 · 渲染验收

- 日期：2026-10-06
- 批次：`COMPONENT-BASELINE-20261006`
- 页面：`/__preview/components`（**dev-only**，生产构建不注册）
- 环境：本地 127.0.0.1:8080，后端 8090（dev）
- 分辨率：1440×900 / 1280×800 / 1024×768

## 结论

| 组件 | 验证内容 | 结论 |
| --- | --- | --- |
| `StatusTag` | 14 档 tone 的 soft/solid 两态、sm/md 两尺寸、圆点 | PASS |
| `StatusTag` + 报价 meta | 报价 6 状态与 3 模式标签，口径取自 App `quote/list.vue` | PASS |
| `MoneyText` | 正常金额 / 真实为零 / 缺值 / 差额 +、−、0 | PASS |
| `CostIncompleteValue` | 默认与自定义提示 | PASS |
| `EmptyState` | 带下一步动作与纯说明两种；动作可触发 | PASS |
| `SkeletonBlock` | text 与 table 两种骨架 | PASS |
| `PanelCard` | 标题/描述/extra/footer 插槽 | PASS |

## 关键口径验证

- **缺值不伪装**：`MoneyText` 收到 `null` 显示「暂不可确认」；真实 `0` 显示 `¥0.00`（两者明确区分）。
- **禁止伪利润**：`CostIncompleteValue` 与「暂不可确认」的毛利成对出现。
- **状态不只靠颜色**：`StatusTag` 始终带文字与圆点。

## 产品色对齐（本批次一并修复）

发现并按规范修复：**Element Plus 默认主色是蓝 `#409eff`，与本产品品牌青绿不符**。

- 新增 `src/styles/element-theme.scss`：覆盖 `--el-color-primary|success|warning|danger|info` 系列变量
- 用 `:root:root` 提升优先级，确保按需引入时不被 Element 自身 `:root` 覆盖
- 色值仍只来自 `tokens.scss`（`mix()` 派生深浅档，不重复定义）
- 同时对齐文本色、边框色、背景色与圆角

实测（浏览器计算样式）：

```text
--el-color-primary        = #2f7d5a   ← 品牌青绿（修复前为 #409eff 蓝）
--th4-status-done         = #00b42a   ← 与 App STATUS_COLOR 同源
StatusTag(idle) 计算样式   = color rgb(201,205,212) / bg rgb(242,243,245)
```

## 控制台

重新加载后**无新增控制台记录**（0 错误 0 警告）。

## 三档截图

`raw/screenshots/COMP-001__preview__{1440x900,1280x800,1024x768}__after.png`

## 已知事项

- 组件尚未接入真实业务页面，本批次只验证渲染与口径。
- 组件自身的交互状态（focus/hover/disabled）在真实页面接入时再验。
