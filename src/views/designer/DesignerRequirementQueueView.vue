<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/components/StatusTag.vue'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'
import { designApi } from '@/domains/design/api'
import type { DesignRequirement, RequirementKind, RequirementStatus } from '@/domains/design/model'
import type { StatusTone } from '@/core/tone'

const router = useRouter()

const KIND_LABELS: Record<RequirementKind, string> = { demand: '诉求', reject: '排斥点' }
const CATEGORY_LABELS: Record<DesignRequirement['category'], string> = {
  function: '功能', style: '风格', material: '材料', budget: '预算', schedule: '工期', quality: '质量', other: '其他'
}
const PRIORITY_META: Record<DesignRequirement['priority'], { label: string; tone: StatusTone }> = {
  high: { label: '高优先', tone: 'blocked' },
  medium: { label: '中优先', tone: 'pending' },
  low: { label: '低优先', tone: 'info' }
}
const STATUS_META: Record<RequirementStatus, { label: string; tone: StatusTone }> = {
  pending: { label: '待确认', tone: 'pending' },
  confirmed: { label: '已确认', tone: 'done' },
  resolved: { label: '已落实', tone: 'progress' }
}

const requirements = ref<DesignRequirement[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const kindFilter = ref<RequirementKind | ''>('')
const statusFilter = ref<RequirementStatus | ''>('')

const filtered = computed(() => {
  const needle = keyword.value.trim().toLowerCase()
  if (!needle) return requirements.value
  return requirements.value.filter((item) => [
    item.title,
    item.detail,
    item.response,
    item.customerName,
    item.customerCommunity,
    item.propertyName,
    item.propertyAddress,
    item.spaceName
  ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
})

const groups = computed(() => {
  const result = new Map<string, {
    customerId?: string
    customerName: string
    propertyId?: string
    propertyName: string
    items: DesignRequirement[]
  }>()
  filtered.value.forEach((item) => {
    const key = `${item.customerId ?? 'unknown'}::${item.propertyId ?? 'unknown'}`
    if (!result.has(key)) {
      result.set(key, {
        customerId: item.customerId,
        customerName: item.customerName || '客户锚点待确认',
        propertyId: item.propertyId,
        propertyName: item.propertyName || item.propertyAddress || item.propertyNo || '房屋锚点待确认',
        items: []
      })
    }
    result.get(key)!.items.push(item)
  })
  return [...result.values()]
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    requirements.value = await designApi.pageRequirements({
      kind: kindFilter.value || undefined,
      status: statusFilter.value || undefined,
      current: 1,
      size: 200
    })
  } catch (err) {
    requirements.value = []
    error.value = err instanceof Error ? err.message : '客户诉求暂不可确认'
  } finally {
    loading.value = false
  }
}

function openCustomer(item: { customerId?: string; propertyId?: string }): void {
  if (!item.customerId) return
  void router.push({
    path: `/designer/my-customers/${item.customerId}`,
    query: {
      tab: 'requirement',
      ...(item.propertyId ? { propertyId: item.propertyId } : {})
    }
  })
}

onMounted(load)
</script>

<template>
  <div class="rq">
    <header class="rq__head">
      <div>
        <p class="rq__eyebrow">REQUIREMENT · PROPERTY · DESIGN</p>
        <h1>客户诉求</h1>
        <p>只显示本人数据范围内、已绑定客户与房屋的诉求或排斥点；状态来自服务端，本页不自行推进状态，也不展示成本与利润。</p>
      </div>
      <button class="rq__refresh" type="button" :class="{ 'is-loading': loading }" @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" /></svg>
        刷新
      </button>
    </header>

    <section class="rq__filters" aria-label="诉求筛选">
      <label class="rq__search">
        <span>搜索</span>
        <input v-model="keyword" type="search" placeholder="客户、房屋、空间或诉求标题" />
      </label>
      <label>
        <span>类型</span>
        <select v-model="kindFilter" @change="load">
          <option value="">全部类型</option>
          <option value="demand">诉求</option>
          <option value="reject">排斥点</option>
        </select>
      </label>
      <label>
        <span>状态</span>
        <select v-model="statusFilter" @change="load">
          <option value="">全部状态</option>
          <option value="pending">待确认</option>
          <option value="confirmed">已确认</option>
          <option value="resolved">已落实</option>
        </select>
      </label>
      <span class="rq__count">{{ filtered.length }} 条事实</span>
    </section>

    <WorkbenchState
      v-if="error && !requirements.length"
      variant="error"
      title="客户诉求暂不可确认"
      :description="error"
      action-text="重新加载"
      min-height="280px"
      @action="load"
    />

    <div v-else-if="loading && !requirements.length" class="rq__skeleton" aria-busy="true">
      <span v-for="n in 5" :key="n" />
    </div>

    <WorkbenchState
      v-else-if="!groups.length"
      title="没有符合条件的客户诉求"
      description="切换类型或状态，或刷新服务端数据；也可能是当前范围内尚未记录结构化诉求。"
      action-text="刷新"
      min-height="240px"
      @action="load"
    />

    <section v-else class="rq__groups" aria-label="客户诉求列表">
      <article v-for="group in groups" :key="`${group.customerId}-${group.propertyId}`" class="rq__group">
        <header class="rq__group-head">
          <div>
            <h2>{{ group.customerName }}</h2>
            <p>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12Z" /><path d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg>
              {{ group.propertyName }}
            </p>
          </div>
          <button type="button" :disabled="!group.customerId" @click="openCustomer(group)">
            打开客户 360
          </button>
        </header>

        <div class="rq__items">
          <article v-for="item in group.items" :key="item.id" class="rq__item" :class="`rq__item--${item.kind}`">
            <div class="rq__item-title">
              <strong>{{ item.title || '诉求标题待确认' }}</strong>
              <div class="rq__tags">
                <StatusTag :tone="PRIORITY_META[item.priority].tone" :text="PRIORITY_META[item.priority].label" :dot="false" />
                <StatusTag :tone="STATUS_META[item.status].tone" :text="STATUS_META[item.status].label" :dot="false" />
              </div>
            </div>
            <p>{{ item.detail || '暂无详细说明' }}</p>
            <p v-if="item.response" class="rq__response">设计回应：{{ item.response }}</p>
            <footer>
              <span>{{ KIND_LABELS[item.kind] }} · {{ CATEGORY_LABELS[item.category] }}</span>
              <span>{{ item.spaceName || '空间未标注' }}</span>
            </footer>
          </article>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
.rq { display: flex; flex-direction: column; gap: $space-5; min-width: 0; }

.rq__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $space-5;

  h1 { margin: 0; color: $text-primary; font-size: $font-display; letter-spacing: -.02em; }
  p { margin: $space-2 0 0; max-width: 820px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.rq__eyebrow { color: $brand-600 !important; font-size: $font-caption !important; font-weight: $font-weight-semibold; letter-spacing: .1em; }

.rq__refresh {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 13px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  cursor: pointer;

  svg { width: 14px; height: 14px; }
  &:hover { color: $brand-600; border-color: $brand-300; background: $brand-50; }
  &.is-loading svg { animation: rq-spin .7s linear infinite; }
}

@keyframes rq-spin { to { transform: rotate(360deg); } }

.rq__filters {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 180px 180px auto;
  align-items: end;
  gap: $space-3;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;

  label { display: flex; flex-direction: column; gap: 6px; color: $text-secondary; font-size: $font-caption; }
  input, select {
    min-width: 0;
    height: 36px;
    padding: 0 10px;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    color: $text-primary;
    background: $surface-0;
    font: inherit;
  }
}

.rq__count { align-self: center; color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }

.rq__skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-4;

  span { height: 158px; border-radius: $radius-md; background: linear-gradient(90deg, $surface-100 25%, $surface-50 37%, $surface-100 63%); background-size: 400% 100%; animation: rq-shimmer 1.4s ease infinite; }
}

@keyframes rq-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.rq__groups { display: flex; flex-direction: column; gap: $space-4; }

.rq__group {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}

.rq__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: 18px 20px;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $surface-50 0%, $surface-0 75%);

  h2 { margin: 0; color: $text-primary; font-size: $font-title; }
  p { display: flex; align-items: center; gap: 6px; margin: 5px 0 0; color: $text-secondary; font-size: $font-caption; }
  svg { width: 14px; height: 14px; }
  button {
    padding: 7px 12px;
    border: 1px solid $brand-200;
    border-radius: $radius-sm;
    color: $brand-700;
    background: $surface-0;
    font: inherit;
    font-size: $font-caption;
    cursor: pointer;
  }
  button:disabled { color: $text-tertiary; border-color: $border-color; cursor: not-allowed; }
}

.rq__items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; padding: $space-4; }

.rq__item {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  padding: 16px;
  border: 1px solid $border-color;
  border-left: 4px solid $brand-400;
  border-radius: $radius-md;
  background: $surface-50;

  > p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
  footer { display: flex; justify-content: space-between; gap: $space-3; color: $text-tertiary; font-size: $font-caption; }
}

.rq__item--reject { border-left-color: $danger-500; background: $danger-50; }
.rq__item-title { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.rq__item-title strong { min-width: 0; color: $text-primary; font-size: $font-body; line-height: 1.5; }
.rq__tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.rq__response { padding: 10px 12px; border-radius: $radius-sm; background: $surface-0; }

@media (max-width: 1280px) {
  .rq__filters { grid-template-columns: minmax(260px, 1fr) 160px 160px; }
  .rq__count { grid-column: 1 / -1; justify-self: end; }
}

@media (max-width: 1024px) {
  .rq__filters { grid-template-columns: 1fr 1fr; }
  .rq__search { grid-column: 1 / -1; }
  .rq__count { grid-column: auto; justify-self: start; }
  .rq__items { grid-template-columns: 1fr; }
}
</style>
