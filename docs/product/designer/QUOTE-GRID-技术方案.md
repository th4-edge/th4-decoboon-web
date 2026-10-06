# QuoteSheetGrid 技术方案（报价表格核心组件）

> 批次：`DESIGNER-QUOTE-GRID-TECH-20261006`
> 状态：**已冻结（2026-10-06，随 G1.5 确认）**
> 上游：`G1.5-报价工作台.md`、`V2报价功能基线.md`（50 项必做）
> 参考实现：V2 `DesignerExcelQuoteWorkspaceView.vue`（884 行，原生 `<table>` + `el-input-number`）

---

## 0. 组件职责与边界

**做什么**：渲染报价明细表、承载行内编辑、管理选中单元格、提供键盘流。

**不做什么**（重要）：

| 不做 | 由谁做 |
| --- | --- |
| 计算金额、单价、税额 | **服务端**（`QuoteContext`），组件只显示 |
| 判断报价状态流转 | 服务端；组件只按 `status` 决定可编辑性 |
| 保存 / 提交 | 页面容器通过事件触发 Provider |
| 处理成本与利润 | 设计师侧不展示；即使展示也走服务端字段 |

> 一句话：**组件只管"表怎么渲染、格子怎么编辑"，不管"钱怎么算"。**

---

## 1. 数据结构

### 1.1 行数据（只读 + 可编辑分离）

```ts
/** 服务端返回的报价行（只读部分） */
interface QuoteLineRow {
  key: string              // 稳定行键 = itemId（禁止用数组下标）
  itemId: string
  rowNo: number            // 显示序号，由渲染时计算
  regionKey: string        // 所属区域分组
  regionName: string
  category: string         // 分类
  name: string             // 项目名
  brandSpec: string        // 品牌 / 规格
  unit: string
  // —— 只读（服务端算）——
  quantity: number
  price: number            // 综合单价
  amount: number           // 金额
  // —— 可编辑（草稿态）——
  quantityFormula: string
  materialPrice: number    // 材料价
  manualPrice: number      // 人工价
}

/** 本地草稿：稀疏 map，只存"改过的行" */
type QuoteLineDraft = Partial<Pick<QuoteLineRow,
  'quantity' | 'quantityFormula' | 'materialPrice' | 'manualPrice'>>

type DraftMap = Record<string /* rowKey */, QuoteLineDraft>
```

**为什么用稀疏 draft，而不是复制整份数据**：

1. 内存小：一单 300 行只改 5 行时，只存 5 行；
2. `dirty` 判断天然正确：空 map = 未修改；
3. 保存时只提交改动行，减少请求体；
4. 服务端返回新数据后，未被编辑的行自动跟随服务端，不会"本地旧值覆盖服务端新值"。

### 1.2 分组结构

```ts
interface QuoteGroup {
  key: string
  name: string             // 区域名，如"客厅"
  collapsed: boolean       // 折叠态（页面持有，组件受控）
  rows: QuoteLineRow[]
}
```

### 1.3 选中单元格

```ts
type EditableField = 'quantity' | 'quantityFormula' | 'materialPrice' | 'manualPrice'

interface CellRef {
  rowKey: string
  field: EditableField
}
```

**关键约束**：`rowKey` 必须用服务端稳定 ID（`itemId`），**不能用索引**。
原因：区域折叠会改变索引、排序会改变索引、将来虚拟化也会改变索引——用索引会导致"选中串行"。

---

## 2. 键盘流

### 2.1 按键映射

| 按键 | 行为 |
| --- | --- |
| `Enter` | 提交当前格 → 同列**下一行** |
| `Tab` / `Shift+Tab` | 下一格 / 上一格（**列优先，行尾换行**，只在校验通过后移动） |
| `↑` `↓` | 同列上/下一行（只读行跳过） |
| `←` `→` | 同行左/右可编辑列 |
| `双击` | 进入编辑态 |
| `Esc` | 退出编辑 + **恢复该格原值**（本次未提交的编辑） |
| `Ctrl/Cmd + S` | 保存草稿（**冒泡到页面**，组件不直接保存） |
| `Delete` / `Backspace` | 清空当前格（数值清为 null，公式清空） |

### 2.2 实现方式：事件委托，不是每格绑监听

```text
容器 @keydown  ←  单个监听
  → 从 event.target.closest('[data-cell]') 取 "rowKey:field"
  → 查表得到行列位置
  → 执行移动 / 编辑 / 取消
```

单元格标记：

```html
<td :data-cell="`${row.key}:quantity`">…</td>
```

**好处**：
- 300 行 × 4 可编辑列 = 1200 个格子，只挂 **1 个** keydown 监听；
- 折叠/展开/将来虚拟化后，**无需重新绑定**；
- 键盘逻辑集中在一处，易测试。

### 2.3 与公式栏的联动

- 选中单元格 → 触发 `select:cell` → 页面把值传给 `QuoteFormulaBar`；
- 公式栏 `Enter` → 调用组件 `focusNextRow(rowKey, 'quantityFormula')`（`defineExpose` 暴露）；
- **单向数据流**：组件不持有公式栏状态，只暴露命令式聚焦方法。

### 2.4 只读态

`status !== 'draft'` 时：
- 所有 `input` / `input-number` 加 `disabled`
- `Enter` / `Tab` 只做导航，不做提交
- 工具栏按钮禁用

### 2.5 已知坑（V2 踩过）

| 坑 | 处理 |
| --- | --- |
| `Enter` 在 input 内会触发表单提交 | `@keydown.enter.prevent` |
| `el-input-number` 的方向键会被组件吞掉 | 监听在 `keydown` 捕获阶段，或对 number 输入单独处理 |
| 折叠区域内的行仍参与 Tab 导航 | 导航查表时**跳过折叠区域的行** |

---

## 3. 冻结列实现

### 3.1 方案：原生 `<table>` + `position: sticky`

```text
.sheet-scroll { overflow: auto; }             ← 唯一滚动容器
table { border-collapse: separate; table-layout: fixed; }
thead th        { position: sticky; top: 0;    z-index: 3; }
td.freeze-1     { position: sticky; left: 0;    z-index: 2; }
td.freeze-2     { position: sticky; left: 48px; z-index: 2; }
thead th.freeze { z-index: 4; }               ← 表头与冻结列的交叉区
```

**冻结列**：`#`（序号）+ `分类 / 项目`。列宽用 `<colgroup>` 显式声明（`table-layout: fixed` 是前提）。

### 3.2 四个必须注意的点

1. **必须 `border-collapse: separate`**，否则 sticky 列边框会消失（V2 已采用）。
2. **冻结列必须有背景色**，否则横向滚动时下方内容会透出。
3. **必须 `scrollbar-gutter: stable`**，避免滚动条出现时列宽跳动。
4. **列宽必须确定**，sticky 的 `left` 偏移量依赖前一列宽；用百分比会导致偏移错位。

### 3.3 未采用的替代方案

| 方案 | 为什么不用 |
| --- | --- |
| 左右两张表联动滚动 | 行高难对齐、滚动同步抖动、行内编辑焦点评分复杂 |
| `el-table` 的 `fixed` | 行内编辑 + 公式栏联动 + 跨格键盘流下成本高，且不易精确控制 DOM |
| CSS Grid 模拟表格 | 冻结表头与冻结列同时做代价更大 |

> 结论：**原生 table + sticky** 是这类"电子表格式"表格的最短路径。

---

## 4. 虚拟滚动取舍

### 4.1 结论：**首批不引入虚拟滚动**

### 4.2 理由（数据说话）

| 依据 | 数字 |
| --- | --- |
| 单张报价实际行数量级 | **50–300 行**（V2 的 550 条是**整个报价项目库**，不是单张报价） |
| 300 行 × 12 列 DOM 规模 | 约 3600 个单元格，浏览器可承受 |
| 引入虚拟滚动的代价 | 与 sticky 冻结列、行内编辑、公式栏联动、动态行高**同时冲突**，复杂度与 bug 面显著上升 |
| 收益 | 在当前量级**不明显** |

### 4.3 先做的性能保底（零成本替代）

1. **区域分组折叠**——最有效的减行手段；折叠区**不渲染**（`v-if`）而非 `display:none`。
2. **行级 `key` 稳定**（itemId），避免整表重渲染。
3. **`v-memo`** 只依赖行数据与选中态，避免选一格重渲染全表。
4. **金额列不做响应式计算**，直接显示服务端值。
5. **输入事件不触发全表 computed**，`draft` 用稀疏 map 避免大对象替换。

### 4.4 触发引入的阈值（写死，避免以后拍脑袋）

```text
单张报价行数 > 500  →  评估虚拟滚动
单张报价行数 > 1000 →  必须虚拟滚动（或改后端分页/按区域懒加载）
```

若引入，选型优先 `@tanstack/vue-virtual`（固定行高窗口化）。
**前提**：行高必须固定——本表可以做到（行高固定、内容截断 + tooltip）。

---

## 5. 组件接口

```ts
// props
interface Props {
  groups: QuoteGroup[]                       // 区域分组的行数据
  status: QuoteStatus                        // 决定可编辑性
  draft: DraftMap                            // 草稿（受控）
  selected: CellRef | null                   // 选中单元格（受控）
  loading?: boolean
}

// emits
'update:cell'   (rowKey: string, field: EditableField, value: number | string | null)
'select:cell'   (cell: CellRef | null)
'toggle:group'  (groupKey: string)
'save'          ()                           // Ctrl/Cmd+S 冒泡
'add:line'      ()
'delete:selected'()
'import'        ()
'export'        ()

// expose
focusNextRow(rowKey: string, field: EditableField): void
scrollToRow(rowKey: string): void
```

**受控原则**：组件不修改 `draft` 与 `selected`，只 emit；由页面持有状态。
（例外：正在输入的中间态允许组件内部临时持有，`blur`/`Enter` 时提交。）

---

## 6. 状态

| 状态 | 表现 |
| --- | --- |
| 正常 | 表格渲染 |
| 加载中 | `SkeletonBlock variant="table"` |
| 真实为空 | `EmptyState`「还没有报价分项」+「新增分项」 |
| 只读（非 draft） | 输入 disabled + 顶部说明 |
| 长内容 | 项目名/品牌规格截断 + tooltip；金额不换行 |
| 极端值 | 0.001 精度工程量；超长金额右对齐 |

---

## 7. 实现顺序（每步可独立验证）

| 步骤 | 内容 | 验证 |
| --- | --- | --- |
| 1 | 静态渲染：12 列 + 区域分组 + 表头固定 | 三档截图 |
| 2 | 冻结前 2 列 + 横向滚动 | 三档滚动验证 |
| 3 | 行内编辑 + 稀疏 draft + dirty | 改一格看 `dirty` |
| 4 | 键盘流（Enter/Tab/方向键/Esc） | 纯键盘走完路径 |
| 5 | 公式栏联动 | 选中→公式栏→Enter→下一行 |
| 6 | 区域折叠 + 折叠区不渲染 | 折叠后导航跳过 |
| 7 | 性能保底（v-memo / 稳定 key） | 300 行改一格不卡 |

---

## 8. 验收标准

- [ ] 12 列在三档分辨率下均可读，横向滚动时前 2 列冻结、表头固定
- [ ] 纯键盘可完成：选中 → 编辑 → Enter 下一行 → Ctrl+S 保存
- [ ] `Esc` 恢复该格原值，不影响其他已改格
- [ ] 只读态（非 draft）不可编辑、不可提交
- [ ] 折叠区域内的行不参与键盘导航
- [ ] 金额列**从不**由前端计算；显示「暂不可确认」而非 0
- [ ] 300 行下改一格不触发全表重渲染
- [ ] 控制台无未处理错误

---

## 9. 风险

| # | 风险 | 应对 |
| --- | --- | --- |
| 1 | sticky 与固定列宽在三档下的对齐 | 用 `colgroup` 显式列宽，三档分别验证 |
| 2 | `el-input-number` 吞方向键 | 捕获阶段监听或自研数字输入 |
| 3 | `GAP-WEB-002` 已关闭 | 公式列启用，按白名单公式与服务端权威计算实现 |
| 4 | 精度：金额 2 位 / 数量 3 位 / 行 ID 文本化 | `format.ts` 统一 + ID 不走数值 |
| 5 | 导入数据与草稿冲突 | 导入后**整体替换** draft，不做合并 |
