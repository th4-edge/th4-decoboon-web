<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { formatMoney } from '@/core/format'
import { financeApi } from '@/domains/finance/api'
import { PAYABLE_STATUS_META, PAYABLE_TYPE_META } from '@/domains/finance/meta'
import type { Payable } from '@/domains/finance/model'
import type { PickerOption } from '@/domains/common/picker'

const props = withDefaults(defineProps<{
  modelValue: string
  storeId?: string
  sheetId?: string
  type?: 'employeeSalary' | 'employeeCommission'
  clearable?: boolean
  disabled?: boolean
  title?: string
  placeholder?: string
}>(), {
  storeId: undefined,
  sheetId: undefined,
  type: undefined,
  clearable: false,
  disabled: false,
  title: '选择待发员工应付',
  placeholder: '选择待发员工应付'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()
const PAGE_SIZE = 20
const visible = ref(false)
const keyword = ref('')
const rows = ref<Payable[]>([])
const selected = ref<Payable | null>(null)
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
let requestSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

const fieldLabel = computed(() => selected.value?.name || (props.modelValue ? '已选员工应付需重新确认' : props.placeholder))
const fieldDescription = computed(() => selected.value
  ? [selected.value.payeeEmployee?.name || selected.value.payeeName || '员工待确认', selected.value.period || '期间待确认', `未发 ¥${formatMoney(selected.value.outstandingAmount)}`].join(' · ')
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
    const page = await financeApi.employeePayablePage({
      payableId: id,
      current: 1,
      size: 1,
      storeId: props.storeId,
      sheetId: props.sheetId,
      type: props.type
    })
    selected.value = page.list.find((item) => item.id === id) ?? null
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
    const page = await financeApi.employeePayablePage({
      current: current.value,
      size: PAGE_SIZE,
      keyword: keyword.value.trim() || undefined,
      storeId: props.storeId,
      sheetId: props.sheetId,
      type: props.type
    })
    if (seq !== requestSeq) return
    rows.value = reset ? page.list : mergeRows(rows.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (loadError) {
    if (seq !== requestSeq) return
    const message = loadError instanceof Error ? loadError.message : '员工待发应付暂不可确认'
    error.value = reset ? message : `${message}，已保留当前候选`
    if (!reset) current.value = Math.max(1, current.value - 1)
  } finally {
    if (seq === requestSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function mergeRows(left: Payable[], right: Payable[]): Payable[] {
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

function choose(item: Payable): void {
  if (item.outstandingAmount <= 0) return
  selected.value = item
  emit('update:modelValue', item.id)
  emit('change', {
    id: item.id,
    label: item.name || item.payeeEmployee?.name || '员工应付',
    description: [item.payeeEmployee?.name || item.payeeName, `未发 ¥${formatMoney(item.outstandingAmount)}`].filter(Boolean).join(' · '),
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
  <div class="employee-payable-picker">
    <button
      type="button"
      class="employee-payable-picker__field"
      :class="{ 'employee-payable-picker__field--empty': !modelValue, 'employee-payable-picker__field--selected': Boolean(selected && modelValue), 'employee-payable-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span v-if="selected && modelValue" class="employee-payable-picker__selected">
        <span class="employee-payable-picker__selected-top">
          <span>当前员工应付</span>
          <StatusTag :tone="PAYABLE_STATUS_META[selected.status].tone" :text="PAYABLE_STATUS_META[selected.status].label" />
          <span>{{ PAYABLE_TYPE_META[selected.type].label }}</span>
          <b>未发 ¥{{ formatMoney(selected.outstandingAmount) }}</b>
        </span>
        <strong>{{ selected.payeeEmployee?.name || selected.payeeName || '员工待确认' }}</strong>
        <small>{{ selected.name || '未命名员工应付' }}</small>
        <span class="employee-payable-picker__facts">
          <span><small>应付金额</small><b>¥{{ formatMoney(selected.amount) }}</b></span>
          <span><small>已发金额</small><b>¥{{ formatMoney(selected.paidAmount) }}</b></span>
          <span><small>待发金额</small><b>¥{{ formatMoney(selected.outstandingAmount) }}</b></span>
          <span><small>期间</small><b>{{ selected.period || '待确认' }}</b></span>
        </span>
      </span>
      <span v-else class="employee-payable-picker__copy">
        <strong>{{ fieldLabel }}</strong>
        <small v-if="fieldDescription">{{ fieldDescription }}</small>
      </span>
      <span class="employee-payable-picker__actions">
        <span v-if="clearable && modelValue && !disabled" @click.stop="clear">清除</span>
        <span aria-hidden="true">{{ disabled ? '已锁定' : '选择' }}</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(920px, 96vw)" append-to-body destroy-on-close>
      <div class="employee-payable-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索员工、应付名称或期间"
          @input="scheduleSearch"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <span>{{ total ? `共 ${total} 笔待发` : '按条件检索' }}</span>
      </div>
      <el-alert v-if="error" type="error" :closable="false" title="员工待发应付暂不可确认" show-icon>
        <template #default>
          <span>{{ error }}</span>
          <el-button size="small" plain @click="load(true)">重新加载</el-button>
        </template>
      </el-alert>
      <el-skeleton v-else-if="loading && !rows.length" :rows="6" animated />
      <div v-else-if="!rows.length" class="employee-payable-picker__empty">
        <strong>{{ keyword ? '没有匹配的待发员工应付' : '当前没有待发员工应付' }}</strong>
        <span>确认工资单或提成是否已生成应付，并检查门店范围。</span>
      </div>
      <template v-else>
        <button
          v-for="item in rows"
          :key="item.id"
          type="button"
          class="employee-payable-picker__card"
          :class="{ active: item.id === modelValue }"
          @click="choose(item)"
        >
          <span class="employee-payable-picker__card-head">
            <strong>{{ item.payeeEmployee?.name || item.payeeName || '员工待确认' }}</strong>
            <StatusTag :tone="PAYABLE_STATUS_META[item.status].tone" :text="PAYABLE_STATUS_META[item.status].label" />
          </span>
          <span class="employee-payable-picker__card-name">{{ item.name || '未命名员工应付' }}</span>
          <span class="employee-payable-picker__card-meta">
            <small>{{ PAYABLE_TYPE_META[item.type].label }}</small>
            <small>{{ item.period || '期间待确认' }}</small>
            <small>{{ item.project?.name || '企业薪酬' }}</small>
          </span>
          <span class="employee-payable-picker__card-amounts">
            <span><small>应付</small><b>¥{{ formatMoney(item.amount) }}</b></span>
            <span><small>已发</small><b>¥{{ formatMoney(item.paidAmount) }}</b></span>
            <span><small>待发</small><b>¥{{ formatMoney(item.outstandingAmount) }}</b></span>
          </span>
          <span class="employee-payable-picker__card-foot">
            <small>选择后将按该应付待发金额发起发放</small>
            <b>{{ item.id === modelValue ? '已选' : '选择应付' }}</b>
          </span>
        </button>
        <div class="employee-payable-picker__more">
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
.employee-payable-picker__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  width: 100%;
  min-height: 54px;
  padding: $space-2 $space-3;
  color: $text-primary;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  text-align: left;
  cursor: pointer;
}
.employee-payable-picker__field:hover:not(:disabled),
.employee-payable-picker__field:focus-visible { border-color: $brand-300; box-shadow: $shadow-focus; }
.employee-payable-picker__field--empty { color: $text-tertiary; }
.employee-payable-picker__field--disabled { cursor: not-allowed; opacity: .72; }
.employee-payable-picker__field--selected { min-height: 142px; align-items: stretch; background: linear-gradient(135deg, $brand-50 0%, $surface-0 76%); }
.employee-payable-picker__selected { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, .85fr); grid-template-areas: 'top top' 'name facts' 'desc facts'; gap: $space-2 $space-5; width: 100%; }
.employee-payable-picker__selected-top { grid-area: top; display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.employee-payable-picker__selected-top > span:first-child { color: $brand-600; font-weight: $font-weight-semibold; }
.employee-payable-picker__selected-top b { color: $brand-700; }
.employee-payable-picker__selected > strong { grid-area: name; font-size: $font-title; line-height: 1.4; }
.employee-payable-picker__selected > small { grid-area: desc; color: $text-secondary; font-size: $font-caption; }
.employee-payable-picker__facts { grid-area: facts; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; }
.employee-payable-picker__facts > span { padding: $space-2; background: rgba(255, 255, 255, .78); border: 1px solid $border-color; border-radius: $radius-sm; }
.employee-payable-picker__facts small,
.employee-payable-picker__facts b { display: block; }
.employee-payable-picker__facts small { color: $text-tertiary; font-size: $font-caption; }
.employee-payable-picker__facts b { margin-top: 2px; font-size: $font-body-sm; }
.employee-payable-picker__field--selected .employee-payable-picker__actions { flex-direction: column; align-items: flex-end; justify-content: center; align-self: stretch; }
.employee-payable-picker__copy { min-width: 0; }
.employee-payable-picker__copy strong,
.employee-payable-picker__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.employee-payable-picker__copy strong { font-size: $font-body-sm; }
.employee-payable-picker__copy small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
.employee-payable-picker__actions { display: flex; gap: $space-2; color: $brand-700; font-size: $font-caption; }
.employee-payable-picker__actions span:first-child { color: $text-tertiary; }
.employee-payable-picker__toolbar { display: flex; align-items: center; gap: $space-3; margin-bottom: $space-3; }
.employee-payable-picker__toolbar > span { margin-left: auto; color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
.employee-payable-picker__card { display: block; width: 100%; padding: $space-3 $space-4; color: $text-primary; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-md; text-align: left; cursor: pointer; }
.employee-payable-picker__card + .employee-payable-picker__card { margin-top: $space-2; }
.employee-payable-picker__card:hover,
.employee-payable-picker__card.active { border-color: $brand-300; background: $brand-50; }
.employee-payable-picker__card-head,
.employee-payable-picker__card-foot { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.employee-payable-picker__card-head strong { font-size: $font-card-title; }
.employee-payable-picker__card-name { display: block; margin-top: $space-1; color: $brand-700; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.employee-payable-picker__card-meta { display: flex; flex-wrap: wrap; gap: $space-2; margin-top: $space-2; }
.employee-payable-picker__card-meta small { padding: 2px 7px; color: $text-secondary; background: $surface-50; border-radius: $radius-pill; }
.employee-payable-picker__card-amounts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: $space-2; margin-top: $space-3; }
.employee-payable-picker__card-amounts > span { padding: $space-2; background: $surface-50; border-radius: $radius-sm; }
.employee-payable-picker__card-amounts small,
.employee-payable-picker__card-amounts b { display: block; }
.employee-payable-picker__card-amounts small { color: $text-tertiary; font-size: $font-caption; }
.employee-payable-picker__card-amounts b { margin-top: 3px; font-size: $font-body-sm; }
.employee-payable-picker__card-foot { margin-top: $space-2; }
.employee-payable-picker__card-foot small { color: $text-tertiary; font-size: $font-caption; }
.employee-payable-picker__card-foot b { color: $brand-700; font-size: $font-caption; }
.employee-payable-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }
.employee-payable-picker__more { display: flex; justify-content: center; padding: $space-3 0; }
.employee-payable-picker__more span { color: $text-tertiary; font-size: $font-caption; }
@media (max-width: 900px) { .employee-payable-picker__selected { grid-template-columns: 1fr; grid-template-areas: 'top' 'name' 'desc' 'facts'; } }
</style>
