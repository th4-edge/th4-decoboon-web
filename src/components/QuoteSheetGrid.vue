<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { formatEditableNumber, formatQuantity } from '@/core/format'
import {
  EDITABLE_FIELDS,
  effectiveValue,
  isEditableField,
  type CellRef,
  type DraftMap,
  type EditableField,
  type QuoteGroup,
  type QuoteLineRow
} from '@/domains/trade/quote-sheet'
import type { QuoteStatus } from '@/domains/trade/model'
import { isQuoteEditable } from '@/domains/trade/meta'

/**
 * 报价表格（Excel 式）。
 * 只负责渲染与编辑；金额/单价/税额由服务端计算，组件不做任何业务计算。
 */
const props = withDefaults(defineProps<{
  groups: QuoteGroup[]
  status: QuoteStatus | null
  draft: DraftMap
  selected: CellRef | null
  /** 多行选择：用于批量删除 */
  selectedRows?: string[]
  collapsedGroups?: string[]
  /** 非法单元格（`rowKey:field`），用于字段级错误标记 */
  invalidCells?: string[]
  loading?: boolean
  projectionUnavailable?: boolean
}>(), { selectedRows: () => [], collapsedGroups: () => [], invalidCells: () => [], loading: false, projectionUnavailable: false })

const emit = defineEmits<{
  'update:cell': [rowKey: string, field: EditableField, value: number | string | null]
  'select:cell': [cell: CellRef | null]
  'toggle:group': [groupKey: string]
  'toggle:row': [rowKey: string, shiftKey: boolean]
  'toggle:all': [checked: boolean]
  'delete:row': [rowKey: string]
  save: []
  retry: []
}>()

const rootRef = ref<HTMLElement | null>(null)

/**
 * 编辑缓冲：输入过程中只更新本地 buffer，不回写受控值。
 * 原因：若每次按键都按受控值重渲染，光标会跳到末尾且格式化会吃掉输入中的小数点（如 99.5 → 995）。
 * 只有 blur / Enter 才提交，Esc 直接丢弃缓冲。
 */
const editingKey = ref<string | null>(null)
const editingRaw = ref('')

const editable = computed(() => isQuoteEditable(props.status))
const totalRows = computed(() => props.groups.reduce((sum, g) => sum + g.rows.length, 0))
const allRowKeys = computed(() => props.groups.flatMap((group) => group.rows.map((row) => row.key)))
const selectedCount = computed(() => props.selectedRows.filter((key) => allRowKeys.value.includes(key)).length)
const allRowsSelected = computed(() => allRowKeys.value.length > 0 && selectedCount.value === allRowKeys.value.length)

function isCollapsed(groupKey: string): boolean {
  return props.collapsedGroups.includes(groupKey)
}

function isRowSelected(rowKey: string): boolean {
  return props.selectedRows.includes(rowKey)
}

function onToggleAll(event: Event): void {
  emit('toggle:all', (event.target as HTMLInputElement).checked)
}

function onRowSelectClick(rowKey: string, event: MouseEvent): void {
  emit('toggle:row', rowKey, event.shiftKey)
}

/** 参与键盘导航的行：排除已折叠区域（折叠区不渲染，也不应被 Tab 命中）。 */
const visibleRows = computed(() =>
  props.groups.filter((g) => !isCollapsed(g.key)).flatMap((g) => g.rows)
)

function cellValue(row: QuoteLineRow, field: EditableField): string {
  const value = effectiveValue(row, field, props.draft)
  if (value === null || value === undefined || value === '') return ''
  if (field === 'quantityFormula') return String(value)
  const num = Number(value)
  if (Number.isNaN(num)) return ''
  // 可编辑输入框内不得带千分位，否则 Number("1,200.00") 解析失败会丢数据
  return field === 'quantity' ? formatQuantity(num) : formatEditableNumber(num, 2)
}

function cellId(rowKey: string, field: EditableField): string {
  return `${rowKey}:${field}`
}

/** 该单元格当前是否被校验标记为非法。 */
function isInvalidCell(rowKey: string, field: EditableField): boolean {
  return props.invalidCells.includes(cellId(rowKey, field))
}

/** 输入框显示值：编辑中取缓冲，否则取受控值。 */
function displayValue(row: QuoteLineRow, field: EditableField): string {
  return editingKey.value === cellId(row.key, field) ? editingRaw.value : cellValue(row, field)
}

function cellStyle(row: QuoteLineRow, field: EditableField): Record<string, string> {
  const has = props.draft[row.key]?.[field] !== undefined
  return has ? { '--cell-dirty': '1' } : {}
}

function onCellInput(row: QuoteLineRow, field: EditableField, event: Event): void {
  editingKey.value = cellId(row.key, field)
  editingRaw.value = (event.target as HTMLInputElement).value
}

/** 提交缓冲到草稿：blur / Enter 触发。 */
function commitCell(row: QuoteLineRow, field: EditableField): void {
  if (editingKey.value !== cellId(row.key, field)) return
  const raw = editingRaw.value
  editingKey.value = null
  editingRaw.value = ''
  if (field === 'quantityFormula') {
    emit('update:cell', row.key, field, raw)
    return
  }
  if (raw.trim() === '') {
    emit('update:cell', row.key, field, null)
    return
  }
  const num = Number(raw)
  emit('update:cell', row.key, field, Number.isNaN(num) ? null : num)
}

function onCellFocus(row: QuoteLineRow, field: EditableField): void {
  emit('select:cell', { rowKey: row.key, field })
}

function onCellBlur(row: QuoteLineRow, field: EditableField): void {
  commitCell(row, field)
}

function queryCell(rowKey: string, field: EditableField): HTMLInputElement | null {
  return rootRef.value?.querySelector<HTMLInputElement>(`[data-cell="${rowKey}:${field}"] input`) ?? null
}

async function focusCell(rowKey: string, field: EditableField): Promise<void> {
  await nextTick()
  const input = queryCell(rowKey, field)
  if (!input) return
  input.focus()
  input.select()
  emit('select:cell', { rowKey, field })
}

async function move(rowKey: string, field: EditableField, deltaRow: number, deltaCol: number): Promise<void> {
  const rows = visibleRows.value
  const rowIndex = rows.findIndex((r) => r.key === rowKey)
  const fieldIndex = EDITABLE_FIELDS.indexOf(field)
  if (rowIndex < 0 || fieldIndex < 0) return
  const nextRow = Math.min(Math.max(rowIndex + deltaRow, 0), rows.length - 1)
  const nextField = Math.min(Math.max(fieldIndex + deltaCol, 0), EDITABLE_FIELDS.length - 1)
  await focusCell(rows[nextRow].key, EDITABLE_FIELDS[nextField])
}

/**
 * 判断光标/选区是否到达边界。
 * 注意：聚焦时我们调用 select() 全选，此时 selectionStart=0 而 selectionEnd=长度，
 * 因此「右边界」必须用 selectionEnd 判断，否则全选状态下方向键无法跨格。
 */
function isCaretAtEdge(input: HTMLInputElement | null, edge: 'start' | 'end'): boolean {
  if (!input) return true
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  return edge === 'start' ? start === 0 : end >= input.value.length
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  const cellEl = target?.closest<HTMLElement>('[data-cell]')
  const dataset = cellEl?.dataset.cell
  if (!dataset) return

  const [rowKey, rawField] = dataset.split(':')
  if (!rowKey || !isEditableField(rawField)) return
  const field: EditableField = rawField

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    emit('save')
    return
  }

  if (!editable.value) {
    if (event.key === 'ArrowDown') { event.preventDefault(); void move(rowKey, field, 1, 0) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); void move(rowKey, field, -1, 0) }
    else if (event.key === 'Escape') { (target as HTMLInputElement).blur() }
    return
  }

  switch (event.key) {
    case 'Enter': {
      event.preventDefault()
      const row = findRow(rowKey)
      if (row) commitCell(row, field)
      void move(rowKey, field, 1, 0)
      break
    }
    case 'Tab':
      event.preventDefault()
      void move(rowKey, field, 0, event.shiftKey ? -1 : 1)
      break
    case 'ArrowDown':
      event.preventDefault()
      void move(rowKey, field, 1, 0)
      break
    case 'ArrowUp':
      event.preventDefault()
      void move(rowKey, field, -1, 0)
      break
    case 'ArrowRight':
      if (isCaretAtEdge(target as HTMLInputElement, 'end')) {
        event.preventDefault()
        void move(rowKey, field, 0, 1)
      }
      break
    case 'ArrowLeft':
      if (isCaretAtEdge(target as HTMLInputElement, 'start')) {
        event.preventDefault()
        void move(rowKey, field, 0, -1)
      }
      break
    case 'Escape':
      event.preventDefault()
      // 丢弃本次输入缓冲即可：受控值未被改动，天然还原为草稿值/服务端值
      editingKey.value = null
      editingRaw.value = ''
      ;(target as HTMLInputElement).blur()
      break
  }
}

function findRow(rowKey: string): QuoteLineRow | null {
  for (const group of props.groups) {
    const row = group.rows.find((r) => r.key === rowKey)
    if (row) return row
  }
  return null
}

/**
 * 提交当前仍在编辑中的单元格缓冲。
 * 页面保存前必须先调用：程序化触发（如 Enter 或按钮点击）不保证 blur 先于 click，
 * 否则最后一次输入不会进入草稿，导致"看起来改了但没保存"。
 */
function commitPending(): void {
  const key = editingKey.value
  if (!key) return
  const [rowKey, rawField] = key.split(':')
  if (!rowKey || !isEditableField(rawField)) return
  const row = findRow(rowKey)
  if (row) commitCell(row, rawField)
}

defineExpose({
  commitPending,
  focusNextRow: (rowKey: string, field: EditableField) => focusCell(rowKey, field),
  focusCell,
  scrollToRow: (rowKey: string) => {
    rootRef.value?.querySelector<HTMLElement>(`[data-cell="${rowKey}:quantity"]`)?.scrollIntoView({ block: 'center' })
  }
})
</script>

<template>
  <div ref="rootRef" class="grid" :class="{ 'grid--readonly': !editable }" @keydown="onKeydown">
    <SkeletonBlock v-if="loading" variant="table" :rows="6" />

    <EmptyState
      v-else-if="projectionUnavailable"
      title="报价分组暂不可确认"
      description="报价分组暂不可确认，请重新读取。"
      action-text="重新读取"
      @action="emit('retry')"
    />

    <EmptyState
      v-else-if="totalRows === 0"
      title="还没有报价分项"
      description="可以从报价项目库选择，或手动新增一项。"
      action-text="新增分项"
      @action="emit('select:cell', null)"
    />

    <div v-else class="grid__scroll">
      <table class="grid__table">
        <colgroup>
          <col class="c-no" />
          <col class="c-item" />
          <col class="c-region" />
          <col class="c-brand" />
          <col class="c-unit" />
          <col class="c-num" />
          <col class="c-formula" />
          <col class="c-num" />
          <col class="c-num" />
          <col class="c-num" />
          <col class="c-amount" />
          <col class="c-action" />
        </colgroup>

        <thead>
          <tr>
            <th class="is-frozen is-frozen--1 num grid__select-head">
              <input
                type="checkbox"
                :checked="allRowsSelected"
                :disabled="!editable || allRowKeys.length === 0"
                aria-label="全选报价行"
                title="全选报价行"
                @change="onToggleAll"
              />
            </th>
            <th class="is-frozen is-frozen--2">分类 / 项目</th>
            <th>区域</th>
            <th>品牌 / 规格</th>
            <th>单位</th>
            <th class="num">工程量</th>
            <th>工程量公式</th>
            <th class="num">材料价</th>
            <th class="num">人工价</th>
            <th class="num">单价</th>
            <th class="num">金额</th>
            <th class="c-action-head">操作</th>
          </tr>
        </thead>

        <tbody>
          <template v-for="group in groups" :key="group.key">
            <tr class="grid__group-row">
              <td :colspan="2" class="grid__group-cell is-frozen">
                <button
                  type="button"
                  class="grid__group-toggle"
                  :aria-expanded="!isCollapsed(group.key)"
                  @click="emit('toggle:group', group.key)"
                >
                  <span class="grid__group-arrow" :class="{ 'is-collapsed': isCollapsed(group.key) }">▾</span>
                  <strong>{{ group.name }}</strong>
                  <span class="grid__group-count">{{ group.rows.length }} 项</span>
                  <span
                    v-if="group.unassigned"
                    class="grid__group-warn"
                    role="img"
                    aria-label="综合项目"
                    title="「综合项目」= 未归属具体房间的行。综合/公共项（如成品保护、运输、管理费等）本就不需要区域；按房间计量的项（如瓦工铺贴、水电改造）建议在设计方案里补区域后再报价。"
                  >⚠</span>
                </button>
              </td>
              <td :colspan="10" class="grid__group-rest">
                <span class="grid__group-sum">小计 <MoneyText :value="group.amount" size="sm" /></span>
              </td>
            </tr>

            <template v-if="!isCollapsed(group.key)">
              <tr
                v-for="(row, index) in group.rows"
                :key="row.key"
                class="grid__row"
                :class="{ 'is-selected': selected?.rowKey === row.key, 'is-multi-selected': isRowSelected(row.key) }"
              >
                <td class="is-frozen is-frozen--1 num grid__muted">
                  <span class="grid__row-select">
                    <input
                      type="checkbox"
                      :checked="isRowSelected(row.key)"
                      :disabled="!editable"
                      :aria-label="`选择 ${row.name}`"
                      @click.stop="onRowSelectClick(row.key, $event)"
                    />
                    <span>{{ index + 1 }}</span>
                  </span>
                </td>
                <td class="is-frozen is-frozen--2">
                  <span class="grid__category">{{ row.category }}</span>
                  <span class="grid__name" :title="row.name">{{ row.name }}</span>
                  <span v-if="row.sourceRegionNames?.length" class="grid__source">来源：{{ row.sourceRegionNames.join('、') }}</span>
                </td>
                <td class="grid__muted">{{ group.name }}</td>
                <td class="grid__muted" :title="row.brandSpec">{{ row.brandSpec || '—' }}</td>
                <td class="grid__muted">{{ row.unit }}</td>

                <td class="num" :class="{ 'is-invalid': isInvalidCell(row.key, 'quantity') }" :data-cell="`${row.key}:quantity`" :style="cellStyle(row, 'quantity')">
                  <input
                    class="cell-input cell-input--num"
                    type="text"
                    inputmode="decimal"
                    :value="displayValue(row, 'quantity')"
                    :readonly="!editable"
                    :aria-invalid="isInvalidCell(row.key, 'quantity')"
                    :aria-label="`${row.name} 工程量`"
                    @input="onCellInput(row, 'quantity', $event)"
                    @focus="onCellFocus(row, 'quantity')"
                    @blur="onCellBlur(row, 'quantity')"
                  />
                </td>

                <td :class="{ 'is-invalid': isInvalidCell(row.key, 'quantityFormula') }" :data-cell="`${row.key}:quantityFormula`" :style="cellStyle(row, 'quantityFormula')">
                  <input
                    class="cell-input"
                    type="text"
                    :value="displayValue(row, 'quantityFormula')"
                    :readonly="!editable"
                    :aria-invalid="isInvalidCell(row.key, 'quantityFormula')"
                    placeholder="=F1*2"
                    :aria-label="`${row.name} 工程量公式`"
                    @input="onCellInput(row, 'quantityFormula', $event)"
                    @focus="onCellFocus(row, 'quantityFormula')"
                    @blur="onCellBlur(row, 'quantityFormula')"
                  />
                </td>

                <td class="num" :class="{ 'is-invalid': isInvalidCell(row.key, 'materialPrice') }" :data-cell="`${row.key}:materialPrice`" :style="cellStyle(row, 'materialPrice')">
                  <input
                    class="cell-input cell-input--num"
                    type="text"
                    inputmode="decimal"
                    :value="displayValue(row, 'materialPrice')"
                    :readonly="!editable"
                    :aria-invalid="isInvalidCell(row.key, 'materialPrice')"
                    :aria-label="`${row.name} 材料价`"
                    @input="onCellInput(row, 'materialPrice', $event)"
                    @focus="onCellFocus(row, 'materialPrice')"
                    @blur="onCellBlur(row, 'materialPrice')"
                  />
                </td>

                <td class="num" :class="{ 'is-invalid': isInvalidCell(row.key, 'manualPrice') }" :data-cell="`${row.key}:manualPrice`" :style="cellStyle(row, 'manualPrice')">
                  <input
                    class="cell-input cell-input--num"
                    type="text"
                    inputmode="decimal"
                    :value="displayValue(row, 'manualPrice')"
                    :readonly="!editable"
                    :aria-invalid="isInvalidCell(row.key, 'manualPrice')"
                    :aria-label="`${row.name} 人工价`"
                    @input="onCellInput(row, 'manualPrice', $event)"
                    @focus="onCellFocus(row, 'manualPrice')"
                    @blur="onCellBlur(row, 'manualPrice')"
                  />
                </td>

                <td class="num grid__readonly"><MoneyText :value="row.price" size="md" /></td>
                <td class="num grid__amount"><MoneyText :value="row.amount" size="md" /></td>
                <td class="grid__action">
                  <button
                    type="button"
                    class="grid__delete"
                    :disabled="!editable"
                    :aria-label="`删除 ${row.name}`"
                    @click="emit('delete:row', row.key)"
                  >
                    ×
                  </button>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.grid {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.grid__scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  overflow: auto;
  scrollbar-gutter: stable both-edges;
}

.grid__table {
  width: 100%;
  min-width: 1220px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: $font-body-sm;
}

.c-no { width: 48px; }
.c-item { width: 240px; }
.c-region { width: 90px; }
.c-brand { width: 150px; }
.c-unit { width: 60px; }
.c-num { width: 100px; }
.c-formula { width: 150px; }
.c-amount { width: 120px; }
.c-action { width: 56px; }

.grid__table th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: $space-2 $space-3;
  text-align: left;
  font-size: $font-caption;
  font-weight: $font-weight-medium;
  color: $text-secondary;
  background: $surface-100;
  border-bottom: 1px solid $border-color;
  white-space: nowrap;
}

.grid__table th.num,
.grid__table td.num { text-align: right; }

.grid__select-head { text-align: center !important; }

.grid__select-head input,
.grid__row-select input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: $brand-500;
  cursor: pointer;
}

.grid__row-select {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: $space-2;
  width: 100%;
}

.grid__table td {
  padding: 0 $space-2;
  height: 40px;
  background: $surface-0;
  border-bottom: 1px solid $border-color;
  vertical-align: middle;
  overflow: hidden;
}

/* 冻结列：必须连续自左起；背景色不可省，否则横向滚动时透出内容 */
.is-frozen {
  position: sticky;
  z-index: 2;
  background: $surface-0;
}

.is-frozen--1 { left: 0; width: 48px; }
.is-frozen--2 {
  left: 48px;
  box-shadow: 1px 0 0 $border-color;
}

thead .is-frozen {
  z-index: 4;
  background: $surface-100;
}

.grid__group-row td {
  background: $surface-50;
  border-bottom: 1px solid $border-color;
  height: 36px;
}

.grid__group-cell.is-frozen {
  background: $surface-50;
  z-index: 2;
}

.grid__group-toggle {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: $font-body-sm;
  color: $text-primary;
}

.grid__group-arrow {
  display: inline-block;
  transition: transform $transition-fast;
  color: $text-tertiary;

  &.is-collapsed { transform: rotate(-90deg); }
}

.grid__group-warn { margin-left: 6px; color: $warning-700; font-size: $font-caption; cursor: help; }
.grid__group-count {
  font-size: $font-caption;
  color: $text-tertiary;
}

.grid__group-sum {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  font-size: $font-caption;
  color: $text-secondary;
}

.grid__row.is-selected td { background: $brand-50; }
.grid__row.is-selected .is-frozen { background: $brand-50; }

.grid__row.is-multi-selected td { background: $brand-50; }
.grid__row.is-multi-selected .is-frozen { background: $brand-50; }

.grid__category {
  display: block;
  font-size: $font-caption;
  color: $text-tertiary;
}

.grid__source { display: block; margin-top: 3px; font-size: $font-caption; color: $text-tertiary; }
.grid__name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid__muted { color: $text-secondary; }

.grid__readonly { color: $text-secondary; }

.grid__amount { font-weight: $font-weight-medium; }

.cell-input {
  width: 100%;
  height: 28px;
  padding: 2px $space-2;
  border: 1px solid transparent;
  border-radius: $radius-xs;
  background: transparent;
  font: inherit;
  color: inherit;
  outline: none;

  &:hover:not(:read-only) { border-color: $border-color; }

  &:focus {
    border-color: $brand-500;
    background: $surface-0;
    box-shadow: $shadow-focus;
  }

  /* 只读态：保持可聚焦、可选中复制（disabled 会让整表无法聚焦） */
  &:read-only {
    color: $text-secondary;
    cursor: default;
  }
}

.cell-input--num { text-align: right; font-variant-numeric: tabular-nums; }

/* 字段级错误：红色边框 + 浅底 + 图标位（不只靠颜色：同时有 aria-invalid 与页面错误文案） */
td.is-invalid .cell-input {
  border-color: $danger-500;
  background: $danger-50;
}

td.is-invalid .cell-input:focus {
  box-shadow: 0 0 0 3px rgba(229, 72, 77, .18);
}

/* 有未保存改动的单元格左侧标记（不靠颜色单独表达：同时有边框） */
.grid__table td[style*='--cell-dirty'] .cell-input {
  border-color: $warning-500;
  background: $warning-50;
}

.grid__delete {
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: $radius-xs;
  background: transparent;
  color: $text-tertiary;
  cursor: pointer;
  font-size: $font-body;

  &:hover:not(:disabled) {
    border-color: $danger-200;
    background: $danger-50;
    color: $danger-500;
  }

  &:disabled { cursor: default; opacity: .4; }
}

.grid--readonly .grid__table th { background: $surface-100; }
</style>
