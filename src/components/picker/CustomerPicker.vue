<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerStage } from '@/domains/crm/model'
import type { PickerOption } from '@/domains/common/picker'
import type { StatusTone } from '@/core/tone'

type CustomerFilter = 'all' | CustomerStage

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}>(), {
  title: '选择客户',
  placeholder: '选择客户',
  disabled: false,
  clearable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const STAGE_META: Record<CustomerStage, { label: string; tone: StatusTone }> = {
  intention: { label: '待首联', tone: 'todo' },
  following: { label: '跟进中', tone: 'doing' },
  pendingMeasure: { label: '待量房', tone: 'info' },
  quote: { label: '方案报价', tone: 'pending' },
  sign: { label: '已签约', tone: 'done' },
  construction: { label: '施工中', tone: 'alert' },
  done: { label: '已完工', tone: 'dark' },
  lost: { label: '已流失', tone: 'closed' }
}

const filters: Array<{ value: CustomerFilter; label: string }> = [
  { value: 'all', label: '全部客户' },
  { value: 'intention', label: '待首联' },
  { value: 'following', label: '跟进中' },
  { value: 'pendingMeasure', label: '待量房' },
  { value: 'quote', label: '方案报价' },
  { value: 'sign', label: '已签约' },
  { value: 'construction', label: '施工中' },
  { value: 'done', label: '已完工' },
  { value: 'lost', label: '已流失' }
]

const visible = ref(false)
const keyword = ref('')
const stage = ref<CustomerFilter>('all')
const customers = ref<Customer[]>([])
const selected = ref<Customer | null>(null)
const loading = ref(false)
const error = ref('')
const current = ref(1)
const hasMore = ref(false)
const pageSize = 20
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSeq = 0

const selectedLabel = computed(() => selected.value?.name || (props.modelValue ? '已选客户需重新确认' : props.placeholder))
const selectedDescription = computed(() => selected.value
  ? [selected.value.phone, selected.value.community || selected.value.addr].filter(Boolean).join(' · ')
  : '')
const resultText = computed(() => customers.value.length ? `已加载 ${customers.value.length} 位` : '按阶段浏览或搜索')

watch(() => props.modelValue, async (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  try {
    selected.value = await crmApi.customerInfo(id)
  } catch {
    selected.value = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function open(): void {
  if (props.disabled) return
  visible.value = true
  keyword.value = ''
  stage.value = 'all'
  void load(true)
}

function pickFilter(value: CustomerFilter): void {
  stage.value = value
  void load(true)
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    current.value = 1
    customers.value = []
    hasMore.value = false
  }
  loading.value = true
  error.value = ''
  try {
    const list = await crmApi.pageCustomers({
      keyword: keyword.value.trim() || undefined,
      stage: stage.value === 'all' ? undefined : stage.value,
      current: current.value,
      size: pageSize
    })
    if (seq !== requestSeq) return
    customers.value = reset ? list : mergeCustomers(customers.value, list)
    hasMore.value = list.length === pageSize
  } catch (loadError) {
    if (seq !== requestSeq) return
    error.value = loadError instanceof Error ? loadError.message : '客户数据暂不可确认'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function mergeCustomers(left: Customer[], right: Customer[]): Customer[] {
  const merged = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

function onKeywordInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void load(true) }, 300)
}

function loadMore(): void {
  if (!hasMore.value || loading.value) return
  current.value += 1
  void load(false)
}

function choose(customer: Customer): void {
  selected.value = customer
  const option: PickerOption = {
    id: customer.id,
    label: customer.name || '客户待完善',
    description: [customer.phone, customer.community || customer.addr].filter(Boolean).join(' · '),
    raw: customer
  }
  emit('update:modelValue', customer.id)
  emit('change', option)
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function customerSubtitle(customer: Customer): string {
  return [customer.community, customer.addr].filter(Boolean).join(' · ') || '地址待补充'
}
</script>

<template>
  <div class="customer-picker">
    <button
      type="button"
      class="customer-picker__field"
      :class="{ 'customer-picker__field--empty': !modelValue, 'customer-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span class="customer-picker__copy">
        <strong>{{ selectedLabel }}</strong>
        <small v-if="selectedDescription">{{ selectedDescription }}</small>
      </span>
      <span class="customer-picker__field-actions">
        <span v-if="clearable && modelValue && !disabled" class="customer-picker__clear" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(980px, 96vw)" append-to-body destroy-on-close class="customer-picker__dialog">
      <div class="customer-picker__toolbar">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索客户姓名、手机号、小区或地址"
          @input="onKeywordInput"
          @keyup.enter="load(true)"
          @clear="load(true)"
        />
        <span>{{ resultText }}</span>
      </div>

      <div class="customer-picker__layout">
        <aside class="customer-picker__filters">
          <strong>客户阶段</strong>
          <button
            v-for="item in filters"
            :key="item.value"
            type="button"
            :class="{ active: stage === item.value }"
            @click="pickFilter(item.value)"
          >
            {{ item.label }}
          </button>
          <p>客户归属和可见范围由登录员工的数据权限决定。</p>
        </aside>

        <main class="customer-picker__results" aria-live="polite">
          <el-alert v-if="error" type="error" :closable="false" title="客户数据暂不可确认" show-icon>
            <template #default>
              <p>{{ error }}</p>
              <el-button size="small" plain @click="load(true)">重新加载</el-button>
            </template>
          </el-alert>
          <el-skeleton v-else-if="loading && !customers.length" :rows="6" animated />
          <div v-else-if="!customers.length" class="customer-picker__empty">
            <strong>当前条件下没有客户</strong>
            <span>调整阶段或关键词后重试。</span>
          </div>
          <button
            v-for="customer in customers"
            v-else
            :key="customer.id"
            type="button"
            class="customer-picker__card"
            :class="{ active: customer.id === modelValue }"
            @click="choose(customer)"
          >
            <span class="customer-picker__card-head">
              <strong>{{ customer.name || '客户待完善' }}</strong>
              <StatusTag :tone="STAGE_META[customer.stage].tone" :text="STAGE_META[customer.stage].label" />
            </span>
            <span class="customer-picker__card-sub">{{ customerSubtitle(customer) }}</span>
            <span class="customer-picker__card-tags">
              <small>{{ customer.phone || '电话待补充' }}</small>
              <small v-if="customer.grade">{{ customer.grade }} 级客户</small>
              <small>{{ customer.designerName || '负责人待确认' }}</small>
            </span>
            <span class="customer-picker__card-foot">
              <small>最近跟进 {{ customer.lastFollowAt || '暂不可确认' }}</small>
              <b>{{ customer.id === modelValue ? '已选' : '选择客户' }}</b>
            </span>
          </button>
          <div v-if="hasMore" class="customer-picker__more">
            <el-button :loading="loading" @click="loadMore">加载更多客户</el-button>
          </div>
        </main>
      </div>

      <template #footer>
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.customer-picker__field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  width: 100%;
  min-height: 54px;
  padding: $space-2 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;
}

.customer-picker__field--empty { color: $text-tertiary; }
.customer-picker__field--disabled { cursor: not-allowed; opacity: .62; }

.customer-picker__copy {
  min-width: 0;

  strong,
  small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong { font-size: $font-body-sm; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.customer-picker__field-actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex: 0 0 auto;
  color: $brand-700;
  font-size: $font-caption;
}

.customer-picker__clear { color: $text-tertiary; }

.customer-picker__toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;

  span { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
}

.customer-picker__layout {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: $space-4;
  min-height: 420px;
}

.customer-picker__filters {
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(160deg, $brand-50 0%, $surface-0 82%);

  strong { display: block; margin-bottom: $space-2; font-size: $font-body-sm; }
  button {
    width: 100%;
    padding: $space-2 $space-3;
    border: 0;
    border-radius: $radius-sm;
    background: transparent;
    color: $text-secondary;
    text-align: left;
    cursor: pointer;
    &:hover,
    &.active { background: $surface-0; color: $brand-700; }
  }
  p { margin: $space-3 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
}

.customer-picker__results {
  min-width: 0;
  max-height: 520px;
  overflow: auto;
}

.customer-picker__card {
  display: block;
  width: 100%;
  padding: $space-3 $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;

  & + & { margin-top: $space-2; }
  &:hover,
  &.active { border-color: $brand-300; background: $brand-50; }
}

.customer-picker__card-head,
.customer-picker__card-foot,
.customer-picker__card-tags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.customer-picker__card-head strong { font-size: $font-card-title; }
.customer-picker__card-sub { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
.customer-picker__card-tags { justify-content: flex-start; flex-wrap: wrap; margin-top: $space-2; }
.customer-picker__card-tags small { padding: 2px 7px; border-radius: $radius-pill; background: $surface-50; color: $text-secondary; }
.customer-picker__card-foot { margin-top: $space-2; }
.customer-picker__card-foot small { color: $text-tertiary; }
.customer-picker__card-foot b { color: $brand-700; font-size: $font-caption; }
.customer-picker__more { padding-top: $space-3; text-align: center; }
.customer-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }

@media (max-width: 720px) {
  .customer-picker__layout { grid-template-columns: 1fr; }
}
</style>
