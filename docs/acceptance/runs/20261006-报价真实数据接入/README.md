# 报价表格 · 真实数据接入验收

- 日期：2026-10-06
- 批次：`QUOTE-REALDATA-20261006`
- 环境：本地 decoboon，后端 8090，Web 8080
- 身份：设计师 董夏鹏（19900000005）
- 数据：真实报价 `Q1790922726872`（quoteId `231664524996902912`，67 行，Draft）
- 路由：`quote/designer/info`（与 App 完全一致）

## 字段契约（实测 `quote/designer/info` 真实响应）

**顶层**：`quoteId · no · title · version · status(枚举对象) · mode(枚举对象) · area · subtotal · amount · discount · taxRate · taxAmount · designFee · managementFee · customer · property · design · createdBy · items · regionGroups · constructionGroups · materialGroups · otherGroups · createTime · updateTime`

**报价行并集字段**：`itemId · space · role · differenceType · differenceStatus · included · discountAmount · components · type · category · name · unit(枚举) · quantity · materialPrice · manualPrice · pricingMode · price · amount · formula · craft · brand · spec · sort`

### 与 App 归一化的一致性

| 项 | App 处理 | Web V3 处理 | 结论 |
| --- | --- | --- | --- |
| 主键 | `id ?? quoteId` | `quoteId ?? id` | 一致 |
| 状态/模式枚举 | `enumValue()` 取 `value\|key` | 同 | 一致 |
| 单位 | `UNIT_NAMES[value]` | 同表 | 一致 |
| 金额 | 直取，不计算 | 直取，不计算 | 一致 |

## 金额口径对账（页面 vs 服务端）

| 项 | 服务端 | 页面 | 结论 |
| --- | --- | --- | --- |
| 总额 | 127037.66 | ¥127,037.66 | PASS |
| 小计 | 120988.25 | ¥120,988.25 | PASS |
| 税额 | 6049.41 | ¥6,049.41 | PASS |
| 行金额 | 各行 `amount` | 逐行一致 | PASS |

## 成本可见性（App 红线）

| 检查 | 结果 |
| --- | --- |
| 页面出现「成本 / 毛利」字样 | 否 |
| 表头含成本列 | 否 |
| Provider 是否返回 `cost` | **未返回**（服务端已按角色过滤） |

结论：设计师侧成本不泄漏，符合 App 红线。

## 发现的问题（已记录，未自行修改）

### 1. `quantity_formula` 无读取路径（关联 `GAP-WEB-002`）

- 数据库 `quote_line.quantity_formula` **存在**（迁移 69）
- 批量保存 `quote/lines/save` **可写入**
- 但 `quote/designer/info` **不返回该字段**（67 行并集字段中确认不存在）

→ 工程量公式功能目前**只有写、没有读**，属不完整能力，需业务裁决后补齐。

### 2. `area` 返回 0

该报价的 `area` 为 0（未关联房屋面积）。页面如实展示 `0㎡`，属真实数据，非缺陷。

## 渲染验证中发现并修复的缺陷

| # | 缺陷 | 影响 | 修复 |
| --- | --- | --- | --- |
| 1 | 可编辑单元格显示千分位（`1,200.00`） | `Number("1,200.00")` = NaN，编辑提交会丢数据 | 新增 `formatEditableNumber()`，输入框内不带千分位；展示型金额保留千分位 |

修复后实测：材料价显示 `1200.00`；改为 `1350` 后脏标记 `未保存改动：1 行`。

## 证据

`raw/screenshots/QUOTE-REAL-001__designer__1440x900__after__real-quote.png`

## 未覆盖

- 未做保存（本批只验证读取与编辑契约，不写库）
- 未做版本对比、导入导出、公式栏
- 未在 1280/1024 复验真实数据
