<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { formatMoney } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import type { Payable, PayableStatus } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'

type PayableFilter = 'all' | 'overdue' | 'dueSoon' | 'urgent' | 'salary' | PayableStatus

const props = withDefaults(defineProps<{
  modelValue: string
  projectId?: string
  projectName?: string
  clearable?: boolean
}>(), {
  projectId: '',
  projectName: '',
  clearable: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const filters: Array<{ value: PayableFilter; label: string }> = [
  { value: 'all', label: '全部待付' },
  { value: 'overdue', label: '已逾期' },
  { value: 'dueSoon', label: '7 天内到期' },
  { value: 'urgent', label: '紧急付款' },
  { value: 'salary', label: '工人工资' },
  { value: 'pending', label: '待付款' },
  { value: 'partial', label: '部分付款' },
  { value: 'paid', label: '已付清' },
  { value: 'closed', label: '已关闭' }
]

const visible = ref(false)
const keyword = ref('')
const filter = ref<PayableFilter>('all')
const rows = ref<Payable[]>([])
const selected = ref<Payable | null>(null)
const loading = ref(false)
const error = ref('')
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const pageSize = 20
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

const fieldLabel = computed(() => selected.value?.name || (props.modelValue ? '已选应付单需重新确认' : '选择待付应付单'))
const fieldDescription = computed(() => selected.value
  ? [payableTypeLabel(selected.value), payablePayee(selected.value), `未付 ¥${formatMoney(selected.value.outstandingAmount)}`].filter(Boolean).join(' · ')
  : '')
const resultText = computed(() => total.value ? `共 ${total.value} 张应付单` : '按付款优先级浏览或搜索')

watch(() => props.modelValue, async (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  try {
    const page = await financeApi.payables({ projectId: props.projectId || undefined, current: 1, size: 200 })
    selected.value = page.list.find((item) => item.id === id) ?? null
  } catch {
    selected.value = null
  }
}, { immediate: true })

watch(() => props.projectId, () => {
  if (selected.value?.project?.id && selected.value.project.id === props.projectId) return
  rows.value = []
  total.value = 0
  hasMore.value = false
  selected.value = null
  if (visible.value) void load(true)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function open(): void {
  visible.value = true
  keyword.value = ''
  filter.value = 'all'
  void load(true)
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    current.value = 1
    rows.value = []
    total.value = 0
    hasMore.value = false
  }
  loading.value = true
  error.value = ''
  try {
    const page = await financeApi.payables({
      projectId: props.projectId || undefined,
      keyword: keyword.value.trim() || undefined,
      current: current.value,
      size: pageSize
    })
    if (seq !== requestSeq) return
    rows.value = reset ? page.list : mergeRows(rows.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (loadError) {
    if (seq !== requestSeq) return
    error.value = loadError instanceof Error ? loadError.message : '应付单暂不可确认'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function mergeRows(left: Payable[], right: Payable[]): Payable[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

const filteredRows = computed(() => rows.value.filter((item) => {
  if (filter.value === 'all') return item.outstandingAmount > 0 && item.status !== 'closed'
  if (filter.value === 'dueSoon') return item.outstandingAmount > 0 && daysUntilDue(item.dueDate) >= 0 && daysUntilDue(item.dueDate) <= 7
  if (filter.value === 'urgent') return item.outstandingAmount > 0 && item.urgent
  if (filter.value === 'salary') return item.type === 'salary'
  return item.status === filter.value
}))

function onKeywordInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function loadMore(): void {
  if (!hasMore.value || loading.value) return
  current.value += 1
  void load(false)
}

function choose(item: Payable): void {
  if (item.outstandingAmount <= 0 || item.status === 'closed') return
  selected.value = item
  emit('update:modelValue', item.id)
  emit('change', {
    id: item.id,
    label: item.name || '未命名应付单',
    description: fieldDescriptionFor(item),
    raw: item
  })
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function payableTypeLabel(item: Payable): string {
  return PAYABLE_TYPE_META[item.type].label
}

function payablePayee(item: Payable): string {
  return item.payeeName || item.payeeEmployee?.name || '收款方待确认'
}

function fieldDescriptionFor(item: Payable): string {
  return [payableTypeLabel(item), payablePayee(item), `未付 ¥${formatMoney(item.outstandingAmount)}`].filter(Boolean).join(' · ')
}

function daysUntilDue(value: string): number {
  if (!value) return Number.POSITIVE_INFINITY
  const due = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(due.getTime())) return Number.POSITIVE_INFINITY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((due.getTime() - today.getTime()) / 86400000)
}

function amountLabel(item: Payable): string {
  return item.estimated ? '待定价' : `¥${formatMoney(item.amount)}`
}

function outstandingLabel(item: Payable): string {
  return item.estimated ? '待结算' : `¥${formatMoney(item.outstandingAmount)}`
}

function dueLabel(item: Payable): string {
  const days = daysUntilDue(item.dueDate)
  if (Number.isFinite(days)) {
    if (days < 0) return `已逾期 ${Math.abs(days)} 天`
    if (days === 0) return '今天到期'
    if (days <= 7) return `${days} 天后到期`
  }
  return item.dueDate || '到期日待确认'
}
</script>

<template>
  <div class="payable-picker">
    <button type="button" class="payable-picker__field" :class="{ 'payable-picker__field--empty': !modelValue, 'payable-picker__field--selected': Boolean(selected && modelValue) }" @click="open">
      <span v-if="selected && modelValue" class="payable-picker__selected">
        <span class="payable-picker__selected-top">
          <span>当前应付单</span>
          <StatusTag :tone="PAYABLE_STATUS_META[selected.status].tone" :text="PAYABLE_STATUS_META[selected.status].label" />
          <span class="payable-picker__selected-type">{{ payableTypeLabel(selected) }}</span>
          <span v-if="selected.urgent" class="payable-picker__selected-urgent">紧急付款</span>
          <b>未付 ¥{{ formatMoney(selected.outstandingAmount) }}</b>
        </span>
        <strong>{{ selected.name || '未命名应付单' }}</strong>
        <small>{{ selected.project?.name || '企业通用费用' }} · {{ selected.project?.no || '无项目编号' }}</small>
        <span class="payable-picker__selected-facts">
          <span><small>应付金额</small><b>{{ amountLabel(selected) }}</b></span>
          <span><small>已付金额</small><b>¥{{ formatMoney(selected.paidAmount) }}</b></span>
          <span><small>未付金额</small><b>{{ outstandingLabel(selected) }}</b></span>
          <span><small>到期日</small><b>{{ dueLabel(selected) }}</b></span>
          <span><small>收款方</small><b>{{ payablePayee(selected) }}</b></span>
          <span><small>来源单号</small><b>{{ selected.sourceNo || '无来源单号' }}</b></span>
        </span>
      </span>
      <span v-else class="payable-picker__copy">
        <strong>{{ fieldLabel }}</strong>
        <small v-if="fieldDescription">{{ fieldDescription }}</small>
      </span>
      <span class="payable-picker__actions">
        <span v-if="clearable && modelValue" class="payable-picker__clear" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" title="选择待付应付单" width="min(1000px, 96vw)" append-to-body destroy-on-close class="payable-picker__dialog">
      <div class="payable-picker__context">
        <span>当前项目</span>
        <strong>{{ projectName || (projectId ? '已选择项目' : '全部可见项目') }}</strong>
        <small>按逾期、临期、紧急、工人工资和付款进度浏览；已付清和已关闭应付不可选择。</small>
      </div>

      <div class="payable-picker__toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索应付名称、收款方、来源单号或项目" @input="onKeywordInput" @keyup.enter="load(true)" @clear="load(true)" />
        <span>{{ resultText }}</span>
      </div>

      <div class="payable-picker__layout">
        <aside class="payable-picker__filters">
          <strong>付款优先级</strong>
          <button v-for="item in filters" :key="item.value" type="button" :class="{ active: filter === item.value }" @click="filter = item.value">{{ item.label }}</button>
          <p>逾期和临期应付优先；实际付款金额与核销结果由服务端最终判定。</p>
        </aside>

        <main class="payable-picker__results" aria-live="polite">
          <el-alert v-if="error" type="error" :closable="false" title="应付单暂不可确认" show-icon>
            <template #default><el-button size="small" plain @click="load(true)">重新加载</el-button></template>
          </el-alert>
          <el-skeleton v-else-if="loading && !rows.length" :rows="6" animated />
          <div v-else-if="!filteredRows.length" class="payable-picker__empty"><strong>当前条件下没有可付应付单</strong><span>调整状态或关键词后重试。</span></div>
          <button
            v-for="item in filteredRows"
            v-else
            :key="item.id"
            type="button"
            class="payable-picker__card"
            :class="{ active: item.id === modelValue, disabled: item.outstandingAmount <= 0 || item.status === 'closed' }"
            :disabled="item.estimated || item.outstandingAmount <= 0 || item.status === 'closed'"
            @click="choose(item)"
          >
            <span class="payable-picker__card-head">
              <strong>{{ item.name || '未命名应付单' }}</strong>
              <StatusTag :tone="PAYABLE_STATUS_META[item.status].tone" :text="PAYABLE_STATUS_META[item.status].label" />
            </span>
            <span class="payable-picker__card-sub">{{ item.project?.name || '企业通用费用' }} · {{ item.project?.no || '无项目编号' }}</span>
            <span class="payable-picker__card-tags">
              <small>{{ payableTypeLabel(item) }}</small>
              <small :class="{ 'is-risk': item.status === 'overdue' }">{{ dueLabel(item) }}</small>
              <small v-if="item.urgent" class="is-urgent">紧急</small>
              <small>{{ payablePayee(item) }}</small>
            </span>
            <span class="payable-picker__card-amounts">
              <span><small>应付金额</small><b>{{ amountLabel(item) }}</b></span>
              <span><small>已付金额</small><b>¥{{ formatMoney(item.paidAmount) }}</b></span>
              <span class="is-outstanding"><small>未付金额</small><b>{{ outstandingLabel(item) }}</b></span>
            </span>
            <span class="payable-picker__card-foot"><small>{{ item.sourceNo || '无来源单号' }}</small><b>{{ item.id === modelValue ? '已选' : '选择应付单' }}</b></span>
          </button>
          <div v-if="hasMore" class="payable-picker__more"><el-button :loading="loading" @click="loadMore">加载更多应付单</el-button></div>
        </main>
      </div>

      <template #footer><el-button @click="visible = false">关闭</el-button><el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.payable-picker__field { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; min-height: 54px; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; color: $text-primary; text-align: left; cursor: pointer; }
.payable-picker__field--empty { color: $text-tertiary; }
.payable-picker__field--selected { min-height: 168px; align-items: stretch; background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%); }
.payable-picker__selected { display: grid; grid-template-columns: minmax(0, 1fr) minmax(330px, .95fr); grid-template-areas: 'top top' 'name facts' 'desc facts'; gap: $space-2 $space-5; width: 100%; }
.payable-picker__selected-top { grid-area: top; display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; > span:first-child { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; } b { margin-left: auto; color: $brand-700; font-size: $font-card-title; font-variant-numeric: tabular-nums; } }
.payable-picker__selected-type { padding: 2px 8px; color: $text-secondary; background: $surface-100; border-radius: $radius-pill; font-size: $font-caption; }
.payable-picker__selected-urgent { padding: 2px 8px; color: $warning-700; background: $warning-50; border-radius: $radius-pill; font-size: $font-caption; }
.payable-picker__selected > strong { grid-area: name; font-size: $font-title; line-height: 1.4; word-break: break-word; }
.payable-picker__selected > small { grid-area: desc; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
.payable-picker__selected-facts { grid-area: facts; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: $space-2; > span { padding: $space-2; border: 1px solid $border-color; border-radius: $radius-sm; background: rgba(255, 255, 255, .76); } small, b { display: block; } small { color: $text-tertiary; font-size: $font-caption; } b { margin-top: 2px; font-size: $font-body-sm; word-break: break-word; } }
.payable-picker__field--selected .payable-picker__actions { flex-direction: column; align-items: flex-end; justify-content: center; align-self: stretch; }
.payable-picker__copy { min-width: 0; strong, small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } strong { font-size: $font-body-sm; } small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; } }
.payable-picker__actions { display: flex; align-items: center; gap: $space-2; flex: 0 0 auto; color: $brand-700; font-size: $font-caption; }
.payable-picker__clear { color: $text-tertiary; }
.payable-picker__context { padding: $space-3 $space-4; margin-bottom: $space-3; border: 1px solid $brand-100; border-radius: $radius-md; background: linear-gradient(135deg, $brand-50 0%, $surface-0 82%); span, strong, small { display: block; } span { color: $text-tertiary; font-size: $font-caption; } strong { margin-top: 3px; font-size: $font-body-sm; } small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; } }
.payable-picker__toolbar { display: flex; align-items: center; gap: $space-3; margin-bottom: $space-3; span { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; } }
.payable-picker__layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: $space-4; min-height: 430px; }
.payable-picker__filters { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-md; background: linear-gradient(160deg, $brand-50 0%, $surface-0 82%); strong { display: block; margin-bottom: $space-2; font-size: $font-body-sm; } button { width: 100%; padding: $space-2 $space-3; border: 0; border-radius: $radius-sm; background: transparent; color: $text-secondary; text-align: left; cursor: pointer; &:hover, &.active { background: $surface-0; color: $brand-700; } } p { margin: $space-3 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; } }
.payable-picker__results { min-width: 0; max-height: 520px; overflow: auto; }
.payable-picker__card { display: block; width: 100%; padding: $space-3 $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; color: $text-primary; text-align: left; cursor: pointer; & + & { margin-top: $space-2; } &:hover, &.active { border-color: $brand-300; background: $brand-50; } &.disabled { cursor: not-allowed; opacity: .55; } }
.payable-picker__card-head, .payable-picker__card-foot, .payable-picker__card-tags { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.payable-picker__card-head strong { font-size: $font-card-title; }
.payable-picker__card-sub { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
.payable-picker__card-tags { justify-content: flex-start; flex-wrap: wrap; margin-top: $space-2; small { padding: 2px 7px; border-radius: $radius-pill; background: $surface-50; color: $text-secondary; &.is-risk { background: $danger-50; color: $danger-500; } &.is-urgent { background: $warning-50; color: $warning-700; } } }
.payable-picker__card-amounts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2; margin-top: $space-3; > span { padding: $space-2; border-radius: $radius-sm; background: $surface-50; } small, b { display: block; } small { color: $text-tertiary; font-size: $font-caption; } b { margin-top: 3px; font-size: $font-body-sm; } .is-outstanding b { color: $brand-700; } }
.payable-picker__card-foot { margin-top: $space-2; small { color: $text-tertiary; font-size: $font-caption; } b { color: $brand-700; font-size: $font-caption; } }
.payable-picker__more { padding-top: $space-3; text-align: center; }
.payable-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }
@media (max-width: 900px) { .payable-picker__selected { grid-template-columns: 1fr; grid-template-areas: 'top' 'name' 'desc' 'facts'; } }
@media (max-width: 720px) { .payable-picker__layout { grid-template-columns: 1fr; } .payable-picker__card-amounts { grid-template-columns: 1fr; } }
</style>
