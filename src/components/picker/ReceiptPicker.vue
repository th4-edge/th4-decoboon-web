<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { formatMoney } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import type { Receipt } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'

const props = withDefaults(defineProps<{
  modelValue: string
  clearable?: boolean
  disabled?: boolean
  title?: string
  placeholder?: string
}>(), {
  clearable: false,
  disabled: false,
  title: '选择原收款',
  placeholder: '选择原收款记录'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()
const PAGE_SIZE = 20
const visible = ref(false)
const keyword = ref('')
const rows = ref<Receipt[]>([])
const selected = ref<Receipt | null>(null)
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
let requestSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const fieldLabel = computed(() => selected.value ? receiptTitle(selected.value) : (props.modelValue ? '已选原收款需重新确认' : props.placeholder))
const fieldDescription = computed(() => selected.value
  ? [selected.value.customer?.name || selected.value.payerName || '客户待确认', selected.value.receivedAt, `¥${formatMoney(selected.value.amount)}`].join(' · ')
  : '')

watch(() => props.modelValue, (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  void resolveSelected(id)
}, { immediate: true })

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function open(): void {
  if (props.disabled) return
  visible.value = true
  keyword.value = ''
  void load(true)
}

async function resolveSelected(id: string): Promise<void> {
  try {
    selected.value = await financeApi.receiptInfo(id)
  } catch {
    selected.value = null
  }
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    current.value = 1
    rows.value = []
    total.value = 0
    hasMore.value = false
    loading.value = true
  } else {
    loadingMore.value = true
  }
  error.value = ''
  try {
    const page = await financeApi.receipts({
      status: 'active',
      current: current.value,
      size: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined
    })
    if (seq !== requestSeq) return
    rows.value = reset ? page.list : mergeRows(rows.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (loadError) {
    if (seq !== requestSeq) return
    const message = loadError instanceof Error ? loadError.message : '原收款暂不可确认'
    error.value = reset ? message : `${message}，已保留当前候选`
    if (!reset) current.value = Math.max(1, current.value - 1)
  } finally {
    if (seq === requestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function mergeRows(left: Receipt[], right: Receipt[]): Receipt[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function loadMore(): void {
  if (!hasMore.value || loading.value || loadingMore.value) return
  current.value += 1
  void load(false)
}

function receiptTitle(item: Receipt): string {
  return `${item.project?.name || '项目待确认'} · ¥${formatMoney(item.amount)}`
}

function receiptStatusLabel(item: Receipt): string {
  return item.status === 'reversed' ? '已冲正' : '有效'
}

function choose(item: Receipt): void {
  selected.value = item
  emit('update:modelValue', item.id)
  emit('change', {
    id: item.id,
    label: receiptTitle(item),
    description: [item.customer?.name || item.payerName, item.receivedAt, ACCOUNT_LABEL[item.account]].filter(Boolean).join(' · '),
    raw: item
  })
  visible.value = false
}

function clear(): void {
  if (props.disabled) return
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}
</script>

<template>
  <div class="receipt-picker">
    <button
      type="button"
      class="receipt-picker__field"
      :class="{ 'receipt-picker__field--empty': !modelValue, 'receipt-picker__field--selected': Boolean(selected && modelValue), 'receipt-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span v-if="selected && modelValue" class="receipt-picker__selected">
        <span class="receipt-picker__selected-top">
          <span>当前原收款</span>
          <StatusTag :tone="selected.status === 'active' ? 'done' : 'closed'" :text="receiptStatusLabel(selected)" />
          <span>{{ ACCOUNT_LABEL[selected.account] }}</span>
          <b>¥{{ formatMoney(selected.amount) }}</b>
        </span>
        <strong>{{ selected.project?.name || '项目待确认' }}</strong>
        <small>{{ selected.customer?.name || selected.payerName || '客户待确认' }} · {{ selected.receivedAt }}</small>
        <span class="receipt-picker__facts">
          <span><small>原收款金额</small><b>¥{{ formatMoney(selected.amount) }}</b></span>
          <span><small>收款日期</small><b>{{ selected.receivedAt || '待确认' }}</b></span>
          <span><small>核销节点</small><b>{{ selected.receivable?.name || '待确认' }}</b></span>
          <span><small>付款方</small><b>{{ selected.payerName || selected.customer?.name || '待确认' }}</b></span>
        </span>
      </span>
      <span v-else class="receipt-picker__copy">
        <strong>{{ fieldLabel }}</strong>
        <small v-if="fieldDescription">{{ fieldDescription }}</small>
      </span>
      <span class="receipt-picker__actions">
        <span v-if="clearable && modelValue && !disabled" @click.stop="clear">清除</span>
        <span aria-hidden="true">{{ disabled ? '已锁定' : '选择' }}</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(920px, 96vw)" append-to-body destroy-on-close>
      <div class="receipt-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索项目、客户、付款方或备注"
          @input="scheduleSearch"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <span>{{ total ? `共 ${total} 笔有效收款` : '按关键词检索' }}</span>
      </div>
      <el-alert v-if="error" type="error" :closable="false" title="原收款暂不可确认" show-icon>
        <template #default>
          <span>{{ error }}</span>
          <el-button size="small" plain @click="load(true)">重新加载</el-button>
        </template>
      </el-alert>
      <el-skeleton v-else-if="loading && !rows.length" :rows="6" animated />
      <div v-else-if="!rows.length" class="receipt-picker__empty">
        <strong>{{ keyword ? '没有匹配的有效收款' : '当前范围没有可退款收款' }}</strong>
        <span>调整关键词，或检查项目与门店范围；已冲正收款不会出现在候选中。</span>
      </div>
      <template v-else>
        <button
          v-for="item in rows"
          :key="item.id"
          type="button"
          class="receipt-picker__card"
          :class="{ active: item.id === modelValue }"
          @click="choose(item)"
        >
          <span class="receipt-picker__card-head">
            <strong>{{ item.project?.name || '项目待确认' }}</strong>
            <StatusTag tone="done" text="有效" />
          </span>
          <span class="receipt-picker__card-sub">{{ item.customer?.name || item.payerName || '客户待确认' }} · {{ item.receivedAt }}</span>
          <span class="receipt-picker__card-tags">
            <small>{{ ACCOUNT_LABEL[item.account] }}</small>
            <small>{{ item.receivable?.name || '核销节点待确认' }}</small>
            <small>{{ item.payerName || item.customer?.name || '付款方待确认' }}</small>
          </span>
          <span class="receipt-picker__card-foot">
            <span>原收款 <b>¥{{ formatMoney(item.amount) }}</b></span>
            <b>{{ item.id === modelValue ? '已选' : '选择原收款' }}</b>
          </span>
        </button>
        <div class="receipt-picker__more">
          <el-button v-if="hasMore" :loading="loadingMore" plain @click="loadMore">加载更多</el-button>
          <span v-else>已显示全部 {{ total }} 笔</span>
        </div>
      </template>
      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.receipt-picker__field { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; min-height: 54px; padding: $space-2 $space-3; color: $text-primary; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-sm; text-align: left; cursor: pointer; }
.receipt-picker__field:hover:not(:disabled), .receipt-picker__field:focus-visible { border-color: $brand-300; box-shadow: $shadow-focus; }
.receipt-picker__field--empty { color: $text-tertiary; }
.receipt-picker__field--disabled { cursor: not-allowed; opacity: .72; }
.receipt-picker__field--selected { min-height: 142px; align-items: stretch; background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%); }
.receipt-picker__selected { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, .85fr); grid-template-areas: 'top top' 'name facts' 'desc facts'; gap: $space-2 $space-5; width: 100%; }
.receipt-picker__selected-top { grid-area: top; display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.receipt-picker__selected-top > span:first-child { color: $brand-600; font-weight: $font-weight-semibold; }
.receipt-picker__selected-top b { color: $brand-700; }
.receipt-picker__selected > strong { grid-area: name; font-size: $font-title; line-height: 1.4; }
.receipt-picker__selected > small { grid-area: desc; color: $text-secondary; font-size: $font-caption; }
.receipt-picker__facts { grid-area: facts; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; }
.receipt-picker__facts > span { padding: $space-2; background: rgba(255, 255, 255, .78); border: 1px solid $border-color; border-radius: $radius-sm; }
.receipt-picker__facts small, .receipt-picker__facts b { display: block; }
.receipt-picker__facts small { color: $text-tertiary; font-size: $font-caption; }
.receipt-picker__facts b { margin-top: 2px; font-size: $font-body-sm; }
.receipt-picker__field--selected .receipt-picker__actions { flex-direction: column; align-items: flex-end; justify-content: center; align-self: stretch; }
.receipt-picker__copy { min-width: 0; }
.receipt-picker__copy strong, .receipt-picker__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.receipt-picker__copy strong { font-size: $font-body-sm; }
.receipt-picker__copy small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.receipt-picker__actions { display: flex; gap: $space-2; color: $brand-700; font-size: $font-caption; }
.receipt-picker__actions span:first-child { color: $text-tertiary; }
.receipt-picker__toolbar { display: flex; align-items: center; gap: $space-3; margin-bottom: $space-3; }
.receipt-picker__toolbar > span { margin-left: auto; color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
.receipt-picker__card { display: block; width: 100%; padding: $space-3 $space-4; color: $text-primary; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-md; text-align: left; cursor: pointer; }
.receipt-picker__card + .receipt-picker__card { margin-top: $space-2; }
.receipt-picker__card:hover, .receipt-picker__card.active { border-color: $brand-300; background: $brand-50; }
.receipt-picker__card-head, .receipt-picker__card-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.receipt-picker__card-head strong { font-size: $font-card-title; }
.receipt-picker__card-sub { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
.receipt-picker__card-tags { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: $space-2; }
.receipt-picker__card-tags small { padding: 2px 7px; color: $text-secondary; background: $surface-50; border-radius: $radius-pill; }
.receipt-picker__card-foot { margin-top: $space-3; color: $text-secondary; font-size: $font-caption; }
.receipt-picker__card-foot b { color: $brand-700; }
.receipt-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }
.receipt-picker__more { display: flex; justify-content: center; padding: $space-3 0; }
.receipt-picker__more span { color: $text-tertiary; font-size: $font-caption; }
@media (max-width: 900px) { .receipt-picker__selected { grid-template-columns: 1fr; grid-template-areas: 'top' 'name' 'desc' 'facts'; } }
</style>
