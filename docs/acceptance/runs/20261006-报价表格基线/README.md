# QuoteSheetGrid 基线 · 渲染与交互验收

- 日期：2026-10-06
- 批次：`QUOTE-GRID-BASELINE-20261006`
- 页面：`/__preview/components`（dev-only，合成数据）
- 分辨率：1440×900 / 1280×800 / 1024×768
- 技术方案：`docs/product/designer/QUOTE-GRID-技术方案.md`

## 结构

12 列：`# | 分类·项目 | 区域 | 品牌·规格 | 单位 | 工程量 | 工程量公式 | 材料价 | 人工价 | 单价 | 金额 | 操作`
- 冻结：`#`（48px）+ `分类·项目`（240px），**必须连续自左起**
- 表格 `min-width: 1220px`，`table-layout: fixed` + `colgroup` 显式列宽
- 区域分组可折叠，**折叠区不渲染**

## 交互验证结果

| # | 用例 | 期望 | 实测 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | `Enter` | 同列下一行 | `L1:quantity → L2:quantity` | PASS |
| 2 | `ArrowRight` | 下一个可编辑列 | `quantity → quantityFormula → materialPrice → manualPrice` | PASS |
| 3 | `ArrowRight` 到边界 | 停住 | 停在 `manualPrice` | PASS |
| 4 | `ArrowDown` | 同列下一行 | `L2 → L3` | PASS |
| 5 | 输入 `99.5` | 保留小数点 | 显示 `99.5` | PASS |
| 6 | 输入中 `dirty` | 未提交前不计入改动 | `已改 0 行` | PASS |
| 7 | `Esc` | 丢弃缓冲、还原 | 还原 `12.6`，`已改 0 行` | PASS |
| 8 | `Enter` 提交 | 计入改动 + 下移 | `已改 1 行`，焦点到 `L2:quantity` | PASS |
| 9 | 折叠区域 | 行不渲染 | 6 行 → 4 行 | PASS |
| 10 | 折叠区键盘导航 | 跳过折叠行 | `L4` 按 Enter 停在 `L4` | PASS |
| 11 | 只读态 | 不可编辑、仍可聚焦与导航 | `readonly=24/24`，`L1 → L2` 可导航 | PASS |
| 12 | 冻结列 | 横向滚动位置不变 | 滚动 400px：冻结列 left 不变（42/90），末列 1300→926 | PASS |

## 渲染验证中修复的两个真实缺陷

1. **输入中的小数点被吃掉**：原实现每次按键即回写受控值，`99.5` 被格式化成 `995`。
   → 改为**编辑缓冲**：输入中只更新本地 buffer，`blur`/`Enter` 才提交，`Esc` 丢弃。
2. **只读态整表失焦**：原用 `disabled`，导致只读报价无法聚焦、无法选中复制数值。
   → 改为 `readonly`，保持可聚焦、可复制，且键盘导航仍可用。

## 控制台

无未处理错误。

## 三档截图

`raw/screenshots/GRID-001__preview__{1440x900,1280x800,1024x768}__after.png`

## 说明

- 预览页使用**合成数据**，仅用于渲染与交互验证，不代表任何真实报价口径。
- 本批次未接入真实 Provider；数据接入与金额口径对账在后续批次进行。
- `GAP-WEB-002` 未关闭：工程量公式列已按可配置实现，裁决后决定是否启用。
