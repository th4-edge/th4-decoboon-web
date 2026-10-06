<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { propertyApi } from '@/domains/property/api'
import type { Property, PropertyStatus } from '@/domains/property/model'
import type { PickerOption } from '@/domains/common/picker'
import type { StatusTone } from '@/core/tone'

type PropertyFilter = 'all' | PropertyStatus

const props = withDefaults(defineProps<{
  modelValue: string
  customerId?: string
  customerName?: string
  title?: string
  placeholder?: string
  clearable?: boolean
}>(), {
  customerId: '',
  customerName: '',
  title: '选择房屋',
  placeholder: '请选择房屋',
  clearable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const STATUS_META: Record<PropertyStatus, { label: string; tone: StatusTone }> = {
  pendingMeasure: { label: '待量房', tone: 'todo' },
  measuring: { label: '量房中', tone: 'doing' },
  measured: { label: '已量房', tone: 'done' },
  designing: { label: '设计中', tone: 'doing' },
  quoted: { label: '已报价', tone: 'pending' },
  contracted: { label: '已签约', tone: 'done' },
  serving: { label: '施工中', tone: 'alert' },
  completed: { label: '已完工', tone: 'dark' }
}

const filters: Array<{ value: PropertyFilter; label: string }> = [
  { value: 'all', label: '全部房屋' },
  { value: 'pendingMeasure', label: '待量房' },
  { value: 'measuring', label: '量房中' },
  { value: 'measured', label: '已量房' },
  { value: 'designing', label: '设计中' },
  { value: 'quoted', label: '已报价' },
  { value: 'contracted', label: '已签约' },
  { value: 'serving', label: '施工中' },
  { value: 'completed', label: '已完工' }
]

const visible = ref(false)
const keyword = ref('')
const status = ref<PropertyFilter>('all')
const properties = ref<Property[]>([])
const selected = ref<Property | null>(null)
const loading = ref(false)
const error = ref('')
let requestSeq = 0

const disabled = computed(() => !props.customerId)
const selectedLabel = computed(() => selected.value ? propertyLabel(selected.value) : (props.customerId ? props.placeholder : '请先选择客户'))
const selectedDescription = computed(() => selected.value
  ? [selected.value.propertyNo, selected.value.area ? `${selected.value.area}㎡` : ''].filter(Boolean).join(' · ')
  : '')
const filteredProperties = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  return properties.value.filter((property) => {
    if (status.value !== 'all' && property.status !== status.value) return false
    if (!needle) return true
    return [property.community, property.building, property.roomNo, property.address, property.layout, property.propertyNo]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
})

watch(() => [props.modelValue, props.customerId] as const, async ([id, customerId]) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  if (!customerId) {
    selected.value = null
    return
  }
  try {
    const list = await propertyApi.listProperties(customerId)
    selected.value = list.find((item) => item.id === id) ?? null
  } catch {
    selected.value = null
  }
}, { immediate: true })

watch(() => props.customerId, () => {
  properties.value = []
  selected.value = null
  if (visible.value) void load()
})

function open(): void {
  if (disabled.value) return
  visible.value = true
  keyword.value = ''
  status.value = 'all'
  void load()
}

async function load(): Promise<void> {
  if (!props.customerId) return
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const list = await propertyApi.listProperties(props.customerId)
    if (seq !== requestSeq) return
    properties.value = list
    if (props.modelValue) selected.value = list.find((item) => item.id === props.modelValue) ?? null
  } catch (loadError) {
    if (seq !== requestSeq) return
    error.value = loadError instanceof Error ? loadError.message : '房屋数据暂不可确认'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function choose(property: Property): void {
  selected.value = property
  const option: PickerOption = {
    id: property.id,
    label: propertyLabel(property),
    description: [property.propertyNo, property.area ? `${property.area}㎡` : '', property.layout].filter(Boolean).join(' · '),
    raw: property
  }
  emit('update:modelValue', property.id)
  emit('change', option)
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function propertyLabel(property: Property): string {
  return property.community || property.address || [property.building, property.roomNo].filter(Boolean).join(' ') || '房屋待完善'
}

function propertyAddress(property: Property): string {
  return [property.community, property.building, property.roomNo].filter(Boolean).join(' ') || property.address || '详细地址待补充'
}
</script>

<template>
  <div class="property-picker">
    <button
      type="button"
      class="property-picker__field"
      :class="{ 'property-picker__field--empty': !modelValue, 'property-picker__field--disabled': disabled }"
      :disabled="disabled"
      @click="open"
    >
      <span class="property-picker__copy">
        <strong>{{ selectedLabel }}</strong>
        <small v-if="selectedDescription">{{ selectedDescription }}</small>
      </span>
      <span class="property-picker__field-actions">
        <span v-if="clearable && modelValue && !disabled" class="property-picker__clear" @click.stop="clear">清除</span>
        <span aria-hidden="true">选择</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(960px, 96vw)" append-to-body destroy-on-close class="property-picker__dialog">
      <div class="property-picker__context">
        <span>当前客户</span>
        <strong>{{ customerName || '客户待确认' }}</strong>
        <small>多房屋客户必须明确选择本次业务对应的房屋，系统不会自动选择第一套。</small>
      </div>

      <div class="property-picker__toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索小区、楼栋、房号、地址或房屋编号" />
        <span>{{ filteredProperties.length }} 套房屋</span>
      </div>

      <div class="property-picker__layout">
        <aside class="property-picker__filters">
          <strong>房屋阶段</strong>
          <button
            v-for="item in filters"
            :key="item.value"
            type="button"
            :class="{ active: status === item.value }"
            @click="status = item.value"
          >
            {{ item.label }}
          </button>
          <p>房屋只按当前客户加载，不允许跨客户复用。</p>
        </aside>

        <main class="property-picker__results" aria-live="polite">
          <el-alert v-if="error" type="error" :closable="false" title="房屋数据暂不可确认" show-icon>
            <template #default>
              <p>{{ error }}</p>
              <el-button size="small" plain @click="load">重新加载</el-button>
            </template>
          </el-alert>
          <el-skeleton v-else-if="loading && !properties.length" :rows="5" animated />
          <div v-else-if="!filteredProperties.length" class="property-picker__empty">
            <strong>当前条件下没有房屋</strong>
            <span>调整阶段或关键词后重试。</span>
          </div>
          <button
            v-for="property in filteredProperties"
            v-else
            :key="property.id"
            type="button"
            class="property-picker__card"
            :class="{ active: property.id === modelValue }"
            @click="choose(property)"
          >
            <span class="property-picker__card-head">
              <strong>{{ propertyLabel(property) }}</strong>
              <StatusTag :tone="STATUS_META[property.status].tone" :text="STATUS_META[property.status].label" />
            </span>
            <span class="property-picker__card-sub">{{ propertyAddress(property) }}</span>
            <span class="property-picker__card-tags">
              <small>{{ property.propertyNo || '房屋编号待补充' }}</small>
              <small>{{ property.area ? `${property.area}㎡` : '面积待补充' }}</small>
              <small>{{ property.layout || '户型待补充' }}</small>
            </span>
            <span class="property-picker__card-foot">
              <small>最近量房 {{ property.latestMeasureAt || '暂不可确认' }}</small>
              <b>{{ property.id === modelValue ? '已选' : '选择房屋' }}</b>
            </span>
          </button>
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
.property-picker__field {
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

.property-picker__field--empty { color: $text-tertiary; }
.property-picker__field--disabled { cursor: not-allowed; opacity: .62; }

.property-picker__copy {
  min-width: 0;

  strong,
  small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  strong { font-size: $font-body-sm; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.property-picker__field-actions {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex: 0 0 auto;
  color: $brand-700;
  font-size: $font-caption;
}

.property-picker__clear { color: $text-tertiary; }

.property-picker__context {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px $space-3;
  padding: $space-3 $space-4;
  margin-bottom: $space-3;
  border: 1px solid $brand-100;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 82%);

  span { color: $text-tertiary; font-size: $font-caption; }
  strong { font-size: $font-body-sm; }
  small { grid-column: 1 / -1; color: $text-secondary; font-size: $font-caption; }
}

.property-picker__toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;

  span { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
}

.property-picker__layout {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: $space-4;
  min-height: 400px;
}

.property-picker__filters {
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

.property-picker__results {
  min-width: 0;
  max-height: 500px;
  overflow: auto;
}

.property-picker__card {
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

.property-picker__card-head,
.property-picker__card-foot,
.property-picker__card-tags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.property-picker__card-head strong { font-size: $font-card-title; }
.property-picker__card-sub { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
.property-picker__card-tags { justify-content: flex-start; flex-wrap: wrap; margin-top: $space-2; }
.property-picker__card-tags small { padding: 2px 7px; border-radius: $radius-pill; background: $surface-50; color: $text-secondary; }
.property-picker__card-foot { margin-top: $space-2; }
.property-picker__card-foot small { color: $text-tertiary; }
.property-picker__card-foot b { color: $brand-700; font-size: $font-caption; }
.property-picker__empty { display: grid; gap: $space-2; padding: $space-8; color: $text-secondary; text-align: center; }

@media (max-width: 720px) {
  .property-picker__layout { grid-template-columns: 1fr; }
}
</style>
