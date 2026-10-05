# 报价写入闭环验收（编辑 → 保存草稿 → 服务端重算 → 重新读取）

- 日期：2026-10-06
- 批次：`QUOTE-WRITE-20261006`
- 环境：本地 decoboon，后端 8090，Web 8080
- 身份：设计师 董夏鹏（19900000005）
- 数据：真实报价 `Q1790922726872`（quoteId `231664524996902912`，67 行，Draft）
- 路由：读 `quote/designer/info`；写 `quote/line/save` —— **均与 App 完全一致**

## 闭环验证（含数据还原）

| 步骤 | 总额 | 区域 | 目标行工程量 | 目标行金额 |
| --- | --- | --- | --- | --- |
| 改前 | ¥127,037.66 | 1 区域（全屋 67 项） | 100 | ¥600.00 |
| 改为 150 并保存 | **¥127,352.66** | **1 区域** | 150 | **¥900.00** |
| 改回 100 并保存 | **¥127,037.66** | **1 区域** | 100 | **¥600.00** |

- 服务端重算正确：小计 +300、税额 +15（5%）、总额 +315
- 保存后自动重新读取，脏标记清零（`未保存改动：0 行`）
- **测试数据已完整还原**，未留下任何业务终态变化

## 写链路的前置条件（实测得出）

`quote/line/save` 的 `@AutoInject` 入参只有：

```text
quoteId · itemId · baseLineId · catalogItemId · quantity · deduct · differenceStatus
```

实测结论：

| 字段 | 能否写入 | 证据 |
| --- | --- | --- |
| `quantity` 工程量 | ✅ | 600 → 900，总额同步重算 |
| `materialPrice` 材料价 | ❌ **被静默忽略** | 请求 999，实际仍为 6.00，**接口不报错** |
| `manualPrice` 人工价 | ❌ 同上 | 入参未定义 |
| `quantityFormula` 工程量公式 | ❌ 入参未定义 | 仅 `quote/lines/save`（Web 专用批量）可写 |

→ **只有工程量有 App 兼容的写入路径**；V2 报价页要求可编辑的材料价 / 人工价 / 公式，
目前**没有 App 兼容的写入口**，须由 `GAP-WEB-002` 裁决。

## 发现并登记的缺陷

### ECD-013 · 报价行改量价会清空空间归属（后端，已登记）

只传 App 既有入参保存工程量后，该行 `space_id` 被写成 `NULL`：

```text
改前：regionGroups = [('全屋', 67 项)]
改后：regionGroups = [('全屋', 66 项), ('综合项目', 1 项)]
```

根因：`QuoteAdjustmentContext.save` 无条件执行 `target.setSpace(source.getSpace())`，
请求不带 `space` 时即覆盖为 null。

- 金额本身正确，**丢的是空间归属**，属静默数据损坏
- **App 的 `QuoteLineInput` 同样没有 `space` 字段 → 两端同源缺陷**
- 已登记后端 `code-error-catalog.md` ECD-013，建议改为「缺省即保留」
- Web 侧规避：`saveQuoteLine` 强制携带 `spaceId`（根因仍需后端修复）

## 后端改动（本批次所需，已提交）

三个报价读取 Provider 的 `QuoteLine` 投影补 `catalogItem`（实体为关联对象，非标量 ID）：

| Provider | 用途 |
| --- | --- |
| `quote/designer/info` | 设计师（Web 报价页在用） |
| `quote/info` | 通用 |
| `project/manager/quote/info` | 项目经理 |

属**向后兼容的加法**（App 忽略新增字段），提交 `103f168`。

## 证据

`raw/screenshots/QUOTE-WRITE-001__designer__1440x900__after__save-draft.png`

## 未覆盖

- 未验证并发保存冲突
- 未验证保存失败后的草稿保留（提交失败态已有设计，未实测）
- 材料价 / 人工价 / 公式的写入路径待 GAP-WEB-002 裁决
