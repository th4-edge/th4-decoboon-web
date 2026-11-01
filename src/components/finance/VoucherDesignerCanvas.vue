<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  VoucherDesignerColumn,
  VoucherDesignerConfig,
  VoucherDesignerElement,
  VoucherDesignerTable
} from '@/domains/document/model'

interface FieldOption {
  key: string
  label: string
}

interface CanvasItem extends VoucherDesignerElement {
  kind: 'element' | 'table'
  columns?: VoucherDesignerColumn[]
  headerRepeat?: boolean
  rowsPerPage?: number
  rowHeightMm?: number
}

interface DragState {
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originalX: number
  originalY: number
  originalWidth: number
  originalHeight: number
}

const props = defineProps<{
  modelValue: VoucherDesignerConfig
  fieldOptions?: FieldOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: VoucherDesignerConfig]
}>()

const DEFAULT_FIELDS: FieldOption[] = [
  { key: 'voucher.no', label: '凭证编号' },
  { key: 'voucher.date', label: '开具日期' },
  { key: 'party.name', label: '对方名称' },
  { key: 'party.phone', label: '联系电话' },
  { key: 'party.idcard', label: '身份证号码' },
  { key: 'party.trade', label: '工种' },
  { key: 'project.name', label: '所属项目' },
  { key: 'voucher.amount', label: '金额合计' },
  { key: 'voucher.amountWords', label: '金额大写' },
  { key: 'voucher.summary', label: '摘要' }
]

const TABLE_COLUMNS: VoucherDesignerColumn[] = [
  { key: 'detail.no', label: '来源说明', widthMm: 28, align: 'left' },
  { key: 'detail.date', label: '日期', widthMm: 22, align: 'left' },
  { key: 'detail.account', label: '支付账户', widthMm: 24, align: 'left' },
  { key: 'detail.amount', label: '金额', widthMm: 22, align: 'right' },
  { key: 'detail.target', label: '到账账户', widthMm: 28, align: 'left' },
  { key: 'detail.category', label: '款项类型', widthMm: 24, align: 'left' },
  { key: 'detail.remark', label: '备注', widthMm: 32, align: 'left' }
]

const MM_TO_PX = 3.779527559
const config = ref<VoucherDesignerConfig>(clone(props.modelValue))
const selectedId = ref('title')
const activeLibraryTab = ref<'fields' | 'fixed'>('fields')
const gridVisible = ref(true)
const boundaryVisible = ref(true)
const zoom = ref(0.8)
const dragging = ref<DragState | null>(null)
const history = ref<string[]>([])
const future = ref<string[]>([])

const fields = computed(() => props.fieldOptions?.length ? props.fieldOptions : DEFAULT_FIELDS)
/**
 * 打印分页可视化（缺口 C1）。
 * 表格按「表头 + 每页行数 × 行高」推算分页线；**不猜测数据行数**，只如实展示分页位置与越界风险。
 * 表头高度按 TABLE_HEADER_MM 估算并在界面标注，避免把估算当成精确值。
 */
const TABLE_HEADER_MM = 8
const mmToPx = (mm: number): number => mm * MM_TO_PX * zoom.value
const printableBottomMm = computed(() => config.value.page.heightMm - config.value.page.marginMm)

interface PageGuide { id: string; top: string; label: string }

const paginationGuides = computed<PageGuide[]>(() => {
  const guides: PageGuide[] = []
  const total = config.value.page.heightMm
  const stepBase = (table: VoucherDesignerTable): number =>
    TABLE_HEADER_MM + Math.max(table.rowsPerPage ?? 0, 1) * Math.max(table.rowHeightMm ?? 0, 1)
  for (const table of config.value.tables ?? []) {
    const step = stepBase(table)
    if (step <= 0) continue
    const rowsPerPage = Math.max(table.rowsPerPage ?? 0, 1)
    let y = table.yMm + step
    let page = 2
    // 最多画到纸张底部，避免死循环
    while (y < total && page <= 50) {
      guides.push({ id: `${table.id}-p${page}`, top: `${mmToPx(y)}px`, label: `第 ${page} 页起 · 每页 ${rowsPerPage} 行` })
      y += step
      page += 1
    }
  }
  return guides
})

/** 可打印区域越界告警：套打最常见的失败原因就是元素/行数超出可打印高度。 */
const printableWarnings = computed<string[]>(() => {
  const warnings: string[] = []
  const bottom = printableBottomMm.value
  for (const table of config.value.tables ?? []) {
    const rowsPerPage = Math.max(table.rowsPerPage ?? 0, 1)
    const used = table.yMm + TABLE_HEADER_MM + rowsPerPage * Math.max(table.rowHeightMm ?? 0, 1)
    if (used > bottom) {
      warnings.push(`表格「${table.id}」每页 ${rowsPerPage} 行超出可打印高度（可打印底边 ${bottom.toFixed(0)}mm，占用至 ${used.toFixed(0)}mm），打印时会被截断；请减少每页行数或行高，或下移表格。`)
    } else if (table.yMm + table.heightMm > bottom) {
      warnings.push(`表格「${table.id}」框高超出可打印底边（${(table.yMm + table.heightMm).toFixed(0)}mm > ${bottom.toFixed(0)}mm）。`)
    }
  }
  for (const element of config.value.elements ?? []) {
    if (element.yMm + element.heightMm > bottom) {
      warnings.push(`元素「${element.fixedText || element.binding || element.id}」底边 ${(element.yMm + element.heightMm).toFixed(0)}mm 超出可打印底边 ${bottom.toFixed(0)}mm。`)
    }
  }
  return warnings
})

const selectedTablePagination = computed(() => {
  const table = selectedTable.value
  if (!table) return ''
  const rows = Math.max(table.rowsPerPage ?? 0, 1)
  return `选中表格每页 ${rows} 行 · 行高 ${table.rowHeightMm ?? 0}mm · 表头重复${table.headerRepeat ? '已开启' : '未开启'}（分页线按表头 ${TABLE_HEADER_MM}mm 估算）`
})

const paperWidthPx = computed(() => config.value.page.widthMm * MM_TO_PX * zoom.value)
const paperHeightPx = computed(() => config.value.page.heightMm * MM_TO_PX * zoom.value)
const printableInsetPx = computed(() => config.value.page.marginMm * MM_TO_PX * zoom.value)
const selectedElement = computed(() => config.value.elements.find((item) => item.id === selectedId.value))
const selectedTable = computed(() => config.value.tables.find((item) => item.id === selectedId.value))
const selectedTitle = computed(() => {
  if (selectedElement.value) return selectedElement.value.fixedText || selectedElement.value.binding || selectedElement.value.type
  if (selectedTable.value) return selectedTable.value.binding
  return '未选择元素'
})
const allItems = computed<CanvasItem[]>(() => {
  const elements: CanvasItem[] = config.value.elements.map((item) => ({ ...item, kind: 'element' }))
  const tables: CanvasItem[] = config.value.tables.map((item) => ({
    ...item,
    type: 'table',
    kind: 'table',
    zIndex: 1,
    fixedText: item.binding,
    style: {},
    border: {}
  }))
  return [...elements, ...tables].sort((left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0))
})

watch(() => props.modelValue, (value) => {
  if (serialize(value) === serialize(config.value)) return
  config.value = clone(value)
}, { deep: true })

watch(config, (value) => {
  if (serialize(value) === serialize(props.modelValue)) return
  emit('update:modelValue', clone(value))
}, { deep: true })

onMounted(() => {
  if (!config.value.elements.length && !config.value.tables.length) seedDefaultDesign()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function serialize(value: VoucherDesignerConfig): string {
  return JSON.stringify(value)
}

function pushHistory(): void {
  history.value.push(JSON.stringify(config.value))
  if (history.value.length > 50) history.value.shift()
  future.value = []
}

function undo(): void {
  const value = history.value.pop()
  if (!value) return
  future.value.push(JSON.stringify(config.value))
  config.value = JSON.parse(value) as VoucherDesignerConfig
}

function redo(): void {
  const value = future.value.pop()
  if (!value) return
  history.value.push(JSON.stringify(config.value))
  config.value = JSON.parse(value) as VoucherDesignerConfig
}

function seedDefaultDesign(): void {
  config.value.elements = [
    text('company', 'company', '昭青装饰工程有限公司 · 服务热线 0551-8888 6666', 20, 5, 170, 8, 12, 'center'),
    text('title', 'title', '工资发放凭证', 20, 15, 170, 14, 20, 'center', true),
    field('voucherNo', 'voucher.no', '凭证编号', 20, 35, 80, 9),
    field('voucherDate', 'voucher.date', '凭证日期', 110, 35, 80, 9),
    field('partyName', 'party.name', '收款人', 20, 47, 80, 9),
    field('projectName', 'project.name', '所属项目', 110, 47, 80, 9),
    text('amountLabel', 'fixed', '金额合计', 20, 168, 30, 10, 12, 'left'),
    field('amount', 'voucher.amount', '￥0.00', 50, 168, 60, 10),
    field('amountWords', 'voucher.amountWords', '人民币大写', 110, 168, 80, 10),
    text('sign', 'fixed', '制单：________    审核：________    领款人签字：________', 20, 228, 170, 10, 12, 'left'),
    text('footer', 'fixed', '本凭证为款项收付单据打印稿，用于企业留档；不属于会计记账凭证。', 20, 270, 170, 8, 10, 'center')
  ]
  config.value.tables = [{
    id: 'detail',
    binding: 'voucher.items',
    xMm: 20,
    yMm: 68,
    widthMm: 170,
    heightMm: 88,
    headerRepeat: true,
    rowsPerPage: 10,
    rowHeightMm: 8,
    columns: TABLE_COLUMNS.slice(0, 5)
  }]
}

function text(id: string, type: string, fixedText: string, xMm: number, yMm: number, widthMm: number,
              heightMm: number, fontSize: number, align: string, bold = false): VoucherDesignerElement {
  return {
    id,
    type,
    fixedText,
    xMm,
    yMm,
    widthMm,
    heightMm,
    zIndex: 1,
    style: { fontSize, align, bold, color: '#1A1A17' },
    border: {}
  }
}

function field(id: string, binding: string, fixedText: string, xMm: number, yMm: number, widthMm: number, heightMm: number): VoucherDesignerElement {
  return {
    id,
    type: 'field',
    binding,
    fixedText,
    xMm,
    yMm,
    widthMm,
    heightMm,
    zIndex: 1,
    style: { fontSize: 12, align: 'left', bold: false, color: '#1A1A17' },
    border: { bottom: true }
  }
}

function addText(): void {
  pushHistory()
  const id = uniqueId('text')
  config.value.elements.push(text(id, 'text', '请输入固定文本', 20, 20, 70, 10, 12, 'left'))
  selectedId.value = id
}

function addField(binding: string, label: string): void {
  pushHistory()
  const id = uniqueId('field')
  config.value.elements.push(field(id, binding, label, 20, 20, 80, 9))
  selectedId.value = id
}

function addImage(): void {
  pushHistory()
  const id = uniqueId('image')
  config.value.elements.push({
    id,
    type: 'image',
    fixedText: '企业Logo',
    xMm: 20,
    yMm: 10,
    widthMm: 36,
    heightMm: 18,
    zIndex: 2,
    style: { align: 'left' },
    border: {}
  })
  selectedId.value = id
}

function addQr(): void {
  pushHistory()
  const id = uniqueId('qr')
  config.value.elements.push({
    id,
    type: 'qr',
    fixedText: '凭证二维码',
    xMm: 160,
    yMm: 248,
    widthMm: 30,
    heightMm: 30,
    zIndex: 2,
    style: { align: 'center' },
    border: {}
  })
  selectedId.value = id
}

function addSignature(): void {
  pushHistory()
  const id = uniqueId('signature')
  config.value.elements.push(text(id, 'signature', '制单：________    审核：________', 20, 238, 170, 10, 12, 'left'))
  selectedId.value = id
}

function addTable(): void {
  pushHistory()
  const id = uniqueId('table')
  config.value.tables.push({
    id,
    binding: 'voucher.items',
    xMm: 20,
    yMm: 80,
    widthMm: 170,
    heightMm: 80,
    headerRepeat: true,
    rowsPerPage: 10,
    rowHeightMm: 8,
    columns: TABLE_COLUMNS.slice(0, 4)
  })
  selectedId.value = id
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
}

function selectItem(id: string): void {
  selectedId.value = id
}

function startDrag(event: PointerEvent, item: { id: string; xMm: number; yMm: number; widthMm: number; heightMm: number }, mode: 'move' | 'resize'): void {
  event.preventDefault()
  event.stopPropagation()
  pushHistory()
  selectedId.value = item.id
  dragging.value = {
    id: item.id,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    originalX: item.xMm,
    originalY: item.yMm,
    originalWidth: item.widthMm,
    originalHeight: item.heightMm
  }
}

function onPointerMove(event: PointerEvent): void {
  const drag = dragging.value
  if (!drag) return
  const deltaX = (event.clientX - drag.startX) / MM_TO_PX / zoom.value
  const deltaY = (event.clientY - drag.startY) / MM_TO_PX / zoom.value
  const patch = drag.mode === 'move'
    ? { xMm: Math.max(0, drag.originalX + deltaX), yMm: Math.max(0, drag.originalY + deltaY) }
    : { widthMm: Math.max(5, drag.originalWidth + deltaX), heightMm: Math.max(5, drag.originalHeight + deltaY) }
  updateItem(drag.id, patch)
}

function endDrag(): void {
  dragging.value = null
}

function updateItem(id: string, patch: Partial<VoucherDesignerElement & VoucherDesignerTable>): void {
  const element = config.value.elements.find((item) => item.id === id)
  if (element) Object.assign(element, patch)
  const table = config.value.tables.find((item) => item.id === id)
  if (table) Object.assign(table, patch)
}

function updateSelected(patch: Partial<VoucherDesignerElement & VoucherDesignerTable>): void {
  if (!selectedId.value) return
  updateItem(selectedId.value, patch)
}

function updateElementStyle(key: string, value: unknown): void {
  const element = selectedElement.value
  if (!element) return
  element.style = { ...(element.style ?? {}), [key]: value }
}

function updateBorder(side: string): void {
  const element = selectedElement.value
  if (!element) return
  const border = { ...(element.border ?? {}) }
  border[side] = !Boolean(border[side])
  element.border = border
}

function toggleTableColumn(key: string): void {
  const table = selectedTable.value
  if (!table) return
  const exists = table.columns.some((column) => column.key === key)
  table.columns = exists
    ? table.columns.filter((column) => column.key !== key)
    : [...table.columns, ...TABLE_COLUMNS.filter((column) => column.key === key)]
}

function removeSelected(): void {
  if (!selectedId.value) return
  pushHistory()
  config.value.elements = config.value.elements.filter((item) => item.id !== selectedId.value)
  config.value.tables = config.value.tables.filter((item) => item.id !== selectedId.value)
  selectedId.value = config.value.elements[0]?.id ?? config.value.tables[0]?.id ?? ''
}

function itemStyle(item: CanvasItem): Record<string, string> {
  const style = 'style' in item ? item.style ?? {} : {}
  const border = 'border' in item ? item.border ?? {} : {}
  return {
    left: `${item.xMm * MM_TO_PX * zoom.value}px`,
    top: `${item.yMm * MM_TO_PX * zoom.value}px`,
    width: `${item.widthMm * MM_TO_PX * zoom.value}px`,
    height: `${item.heightMm * MM_TO_PX * zoom.value}px`,
    zIndex: String(item.zIndex ?? 1),
    fontSize: `${Number(style.fontSize ?? 12) * zoom.value}px`,
    fontWeight: style.bold ? '700' : '400',
    textAlign: String(style.align ?? 'left'),
    borderTop: border.top ? '1px solid #111827' : '1px solid transparent',
    borderRight: border.right ? '1px solid #111827' : '1px solid transparent',
    borderBottom: border.bottom ? '1px solid #111827' : '1px solid transparent',
    borderLeft: border.left ? '1px solid #111827' : '1px solid transparent'
  }
}

function tableColumnWidth(column: VoucherDesignerColumn): string {
  const total = selectedTable.value?.columns.reduce((sum, item) => sum + item.widthMm, 0) ?? 1
  return `${Math.max(8, column.widthMm / total * 100)}%`
}
</script>

<template>
  <div class="voucher-designer">
    <div class="voucher-designer__toolbar">
      <div class="voucher-designer__tool-group">
        <button type="button" class="vd-tool" :disabled="!history.length" @click="undo">撤销</button>
        <button type="button" class="vd-tool" :disabled="!future.length" @click="redo">重做</button>
      </div>
      <div class="voucher-designer__tool-group">
        <button type="button" class="vd-tool" @click="addText">文本</button>
        <button type="button" class="vd-tool" @click="addTable">表格</button>
        <button type="button" class="vd-tool" @click="addImage">图片</button>
        <button type="button" class="vd-tool" @click="addQr">二维码</button>
        <button type="button" class="vd-tool" @click="addSignature">签字栏</button>
      </div>
      <div class="voucher-designer__tool-group">
        <button type="button" class="vd-tool" :class="{ active: gridVisible }" @click="gridVisible = !gridVisible">网格</button>
        <button type="button" class="vd-tool" :class="{ active: boundaryVisible }" @click="boundaryVisible = !boundaryVisible">打印边界</button>
        <button type="button" class="vd-tool" @click="zoom = Math.max(0.5, zoom - 0.1)">－</button>
        <span class="voucher-designer__zoom">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="vd-tool" @click="zoom = Math.min(1.4, zoom + 0.1)">＋</button>
      </div>
      <div class="voucher-designer__tool-group">
        <button type="button" class="vd-tool vd-tool--danger" :disabled="!selectedId" @click="removeSelected">删除</button>
      </div>
    </div>

    <div class="voucher-designer__body">
      <aside class="voucher-designer__library">
        <div class="voucher-designer__panel-title">字段库</div>
        <div class="voucher-designer__tabs">
          <button type="button" :class="{ active: activeLibraryTab === 'fields' }" @click="activeLibraryTab = 'fields'">活动字段</button>
          <button type="button" :class="{ active: activeLibraryTab === 'fixed' }" @click="activeLibraryTab = 'fixed'">固定文本</button>
        </div>
        <div v-if="activeLibraryTab === 'fields'" class="voucher-designer__field-list">
          <button v-for="fieldOption in fields" :key="fieldOption.key" type="button" class="voucher-designer__field" @click="addField(fieldOption.key, fieldOption.label)">
            <strong>{{ fieldOption.label }}</strong>
            <small>{{ fieldOption.key }}</small>
          </button>
        </div>
        <div v-else class="voucher-designer__field-list">
          <button type="button" class="voucher-designer__field" @click="addText"><strong>普通文本</strong><small>固定</small></button>
          <button type="button" class="voucher-designer__field" @click="addSignature"><strong>签字栏</strong><small>固定</small></button>
          <button type="button" class="voucher-designer__field" @click="addImage"><strong>企业Logo</strong><small>图片</small></button>
          <button type="button" class="voucher-designer__field" @click="addQr"><strong>凭证二维码</strong><small>二维码</small></button>
        </div>
      </aside>

      <main class="voucher-designer__canvas-wrap">
        <div class="voucher-designer__canvas-toolbar voucher-designer__canvas-toolbar--stack">
          <div class="voucher-designer__canvas-toolbar-row">
            <span>打印画布 · {{ config.page.widthMm }} × {{ config.page.heightMm }} mm</span>
            <span>页边距 {{ config.page.marginMm }} mm · 网格 {{ config.page.gridSizeMm }} mm · 可打印底边 {{ printableBottomMm.toFixed(0) }} mm</span>
          </div>
          <div v-if="selectedTablePagination" class="voucher-designer__canvas-hint">{{ selectedTablePagination }}</div>
          <ul v-if="printableWarnings.length" class="voucher-designer__canvas-warnings">
            <li v-for="warning in printableWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>
        <div class="voucher-designer__canvas-scroll">
          <div
            class="voucher-designer__paper"
            :class="{ 'voucher-designer__paper--grid': gridVisible }"
            :style="{ width: `${paperWidthPx}px`, height: `${paperHeightPx}px` }"
          >
            <div
              v-if="boundaryVisible"
              class="voucher-designer__boundary"
              :style="{ inset: `${printableInsetPx}px` }"
            />
            <div
              v-for="guide in paginationGuides"
              :key="guide.id"
              class="voucher-designer__page-line"
              :style="{ top: guide.top }"
            >
              <span>{{ guide.label }}</span>
            </div>
            <template v-for="item in allItems" :key="item.id">
              <div
                v-if="item.type === 'table'"
                class="voucher-designer__item voucher-designer__table"
                :class="{ selected: selectedId === item.id }"
                :style="itemStyle(item)"
                @pointerdown="startDrag($event, item, 'move')"
                @click="selectItem(item.id)"
              >
                <table>
                  <thead>
                    <tr>
                      <th v-for="column in item.columns ?? []" :key="column.key" :style="{ width: tableColumnWidth(column) }">{{ column.label }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in 3" :key="row">
                      <td v-for="column in item.columns ?? []" :key="column.key" :style="{ textAlign: column.align === 'right' ? 'right' : 'left' }">
                        {{ column.key === 'detail.amount' ? '0.00' : column.label }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <span class="voucher-designer__resize" @pointerdown.stop="startDrag($event, item, 'resize')" />
              </div>
              <div
                v-else
                class="voucher-designer__item"
                :class="{ selected: selectedId === item.id }"
                :style="itemStyle(item)"
                @pointerdown="startDrag($event, item, 'move')"
                @click="selectItem(item.id)"
              >
                <span v-if="item.type === 'image' || item.type === 'qr'" class="voucher-designer__placeholder">{{ item.fixedText ?? item.binding }}</span>
                <span v-else>{{ item.fixedText || item.binding }}</span>
                <span class="voucher-designer__resize" @pointerdown.stop="startDrag($event, item, 'resize')" />
              </div>
            </template>
          </div>
        </div>
      </main>

      <aside class="voucher-designer__props">
        <div class="voucher-designer__panel-title">属性</div>
        <div class="voucher-designer__prop-group">
          <span class="voucher-designer__prop-label">当前元素</span>
          <strong>{{ selectedTitle }}</strong>
        </div>

        <template v-if="selectedElement">
          <label class="voucher-designer__prop-row">
            <span>X / Y</span>
            <input :value="Math.round(selectedElement.xMm)" type="number" @input="updateSelected({ xMm: Number(($event.target as HTMLInputElement).value) })">
            <input :value="Math.round(selectedElement.yMm)" type="number" @input="updateSelected({ yMm: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <label class="voucher-designer__prop-row">
            <span>宽 / 高</span>
            <input :value="Math.round(selectedElement.widthMm)" type="number" @input="updateSelected({ widthMm: Number(($event.target as HTMLInputElement).value) })">
            <input :value="Math.round(selectedElement.heightMm)" type="number" @input="updateSelected({ heightMm: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <label class="voucher-designer__prop-row">
            <span>字号</span>
            <input :value="selectedElement.style?.fontSize ?? 12" type="number" @input="updateElementStyle('fontSize', Number(($event.target as HTMLInputElement).value))">
          </label>
          <label class="voucher-designer__prop-row">
            <span>对齐</span>
            <select :value="selectedElement.style?.align ?? 'left'" @change="updateElementStyle('align', ($event.target as HTMLSelectElement).value)">
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
            </select>
          </label>
          <label class="voucher-designer__switch">
            <input :checked="Boolean(selectedElement.style?.bold)" type="checkbox" @change="updateElementStyle('bold', ($event.target as HTMLInputElement).checked)">
            <span>粗体</span>
          </label>
          <div class="voucher-designer__prop-group">
            <span class="voucher-designer__prop-label">边框</span>
            <div class="voucher-designer__border-grid">
              <button v-for="side in ['top', 'right', 'bottom', 'left']" :key="side" type="button" :class="{ active: selectedElement.border?.[side] }" @click="updateBorder(side)">{{ side }}</button>
            </div>
          </div>
          <label v-if="selectedElement.type === 'field'" class="voucher-designer__prop-row">
            <span>绑定字段</span>
            <input :value="selectedElement.binding ?? ''" @input="updateSelected({ binding: ($event.target as HTMLInputElement).value })">
          </label>
        </template>

        <template v-if="selectedTable">
          <label class="voucher-designer__prop-row">
            <span>行高</span>
            <input :value="selectedTable.rowHeightMm" type="number" @input="updateSelected({ rowHeightMm: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <label class="voucher-designer__prop-row">
            <span>每页行数</span>
            <input :value="selectedTable.rowsPerPage" type="number" @input="updateSelected({ rowsPerPage: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <label class="voucher-designer__switch">
            <input :checked="selectedTable.headerRepeat" type="checkbox" @change="updateSelected({ headerRepeat: ($event.target as HTMLInputElement).checked })">
            <span>表头每页重复</span>
          </label>
          <div class="voucher-designer__prop-group">
            <span class="voucher-designer__prop-label">明细列</span>
            <div class="voucher-designer__columns">
              <label v-for="column in TABLE_COLUMNS" :key="column.key" class="voucher-designer__column">
                <input :checked="selectedTable.columns.some((item) => item.key === column.key)" type="checkbox" @change="toggleTableColumn(column.key)">
                <span>{{ column.label }}</span>
              </label>
            </div>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.voucher-designer {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  overflow: hidden;
}

.voucher-designer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  align-items: center;
  padding: $space-3;
  border-bottom: 1px solid $border-color;
}

.voucher-designer__tool-group {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-right: $space-3;
  border-right: 1px solid $border-color;
}

.voucher-designer__tool-group:last-child {
  border-right: 0;
}

.vd-tool {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-card;
  color: $text-primary;
  font-size: $font-body-sm;
}

.vd-tool.active,
.vd-tool:hover {
  border-color: $brand-500;
  color: $brand-700;
}

.vd-tool--danger {
  color: $danger-500;
}

.voucher-designer__zoom {
  min-width: 42px;
  color: $text-tertiary;
  font-size: $font-caption;
  text-align: center;
}

.voucher-designer__body {
  display: grid;
  grid-template-columns: 190px minmax(560px, 1fr) 250px;
  min-height: 720px;
}

.voucher-designer__library,
.voucher-designer__props {
  background: $bg-page;
}

.voucher-designer__library {
  border-right: 1px solid $border-color;
}

.voucher-designer__props {
  border-left: 1px solid $border-color;
}

.voucher-designer__panel-title,
.voucher-designer__canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 $space-3;
  border-bottom: 1px solid $border-color;
  color: $text-secondary;
  font-size: $font-body-sm;
  font-weight: 650;
}

.voucher-designer__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: $space-2;
}

.voucher-designer__tabs button {
  padding: 7px 6px;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  font-size: $font-caption;
}

.voucher-designer__tabs button.active {
  border-color: $brand-300;
  background: $brand-50;
  color: $brand-700;
}

.voucher-designer__field-list {
  display: grid;
  gap: 6px;
  padding: 0 $space-2 $space-3;
}

.voucher-designer__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 9px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-card;
  text-align: left;
}

.voucher-designer__field strong {
  color: $text-primary;
  font-size: $font-caption;
}

.voucher-designer__field small {
  color: $text-tertiary;
  font-size: 10px;
}

.voucher-designer__canvas-wrap {
  min-width: 0;
  background: $bg-page;
}

.voucher-designer__canvas-toolbar {
  border-bottom: 1px solid $border-color;
}

.voucher-designer__canvas-scroll {
  min-height: 676px;
  max-height: 760px;
  overflow: auto;
  padding: 28px;
  background:
    linear-gradient(90deg, transparent 23px, rgba(0, 0, 0, 0.04) 24px),
    linear-gradient(0deg, transparent 23px, rgba(0, 0, 0, 0.04) 24px),
    #f4f1eb;
  background-size: 24px 24px;
}

.voucher-designer__canvas-toolbar--stack { flex-direction: column; align-items: flex-start; gap: 6px; }
.voucher-designer__canvas-toolbar-row { display: flex; justify-content: space-between; gap: $space-3; width: 100%; }
.voucher-designer__canvas-hint { color: $text-secondary; font-size: $font-caption; }
.voucher-designer__canvas-warnings { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; color: $warning-700; font-size: $font-caption; list-style: none; }
.voucher-designer__page-line {
  position: absolute; left: 0; right: 0;
  border-top: 1px dashed rgba(232, 160, 32, .85);
  pointer-events: none;
}
.voucher-designer__page-line span {
  position: absolute; right: 4px; top: -14px;
  padding: 0 4px;
  color: $warning-700; font-size: 10px;
  background: rgba(253, 244, 227, .9);
}
.voucher-designer__paper {
  position: relative;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 8px 22px rgba(26, 26, 23, 0.14);
}

.voucher-designer__paper--grid {
  background-image:
    linear-gradient(to right, rgba(14, 138, 125, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(14, 138, 125, 0.08) 1px, transparent 1px);
  background-size: 18.9px 18.9px;
}

.voucher-designer__boundary {
  position: absolute;
  border: 1px dashed $warning-500;
  pointer-events: none;
}

.voucher-designer__item {
  position: absolute;
  display: flex;
  align-items: center;
  overflow: hidden;
  color: $text-primary;
  line-height: 1.3;
  user-select: none;
  cursor: move;
}

.voucher-designer__item.selected {
  outline: 2px solid $brand-500;
  outline-offset: 1px;
}

.voucher-designer__resize {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 10px;
  height: 10px;
  background: $brand-500;
  cursor: nwse-resize;
}

.voucher-designer__table {
  display: block;
}

.voucher-designer__table table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.voucher-designer__table th,
.voucher-designer__table td {
  padding: 4px 5px;
  border: 1px solid $text-primary;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.voucher-designer__table th {
  background: #f3f4f6;
  font-weight: 700;
}

.voucher-designer__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border: 1px dashed $text-tertiary;
  color: $text-tertiary;
  font-size: 11px;
}

.voucher-designer__props {
  padding-bottom: $space-3;
}

.voucher-designer__prop-group,
.voucher-designer__prop-row,
.voucher-designer__switch,
.voucher-designer__border-grid,
.voucher-designer__columns {
  margin: $space-3;
}

.voucher-designer__prop-group {
  display: grid;
  gap: 6px;
}

.voucher-designer__prop-label {
  color: $text-tertiary;
  font-size: $font-caption;
}

.voucher-designer__prop-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 6px;
  align-items: center;
  color: $text-secondary;
  font-size: $font-caption;
}

.voucher-designer__prop-row input,
.voucher-designer__prop-row select {
  min-width: 0;
  height: 30px;
  padding: 0 7px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-card;
  color: $text-primary;
}

.voucher-designer__switch {
  display: flex;
  gap: 6px;
  align-items: center;
  color: $text-secondary;
  font-size: $font-caption;
}

.voucher-designer__border-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.voucher-designer__border-grid button {
  height: 28px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-card;
  color: $text-secondary;
  font-size: 10px;
}

.voucher-designer__border-grid button.active {
  border-color: $brand-500;
  color: $brand-700;
}

.voucher-designer__columns {
  display: grid;
  gap: 6px;
}

.voucher-designer__column {
  display: flex;
  gap: 6px;
  align-items: center;
  color: $text-secondary;
  font-size: $font-caption;
}

@media (max-width: 1100px) {
  .voucher-designer__body {
    grid-template-columns: 170px minmax(480px, 1fr);
  }

  .voucher-designer__props {
    grid-column: 1 / -1;
    border-top: 1px solid $border-color;
    border-left: 0;
  }
}
</style>
