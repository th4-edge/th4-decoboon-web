<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { formatMoney } from '@/core/format'
import type { PickerOption } from '@/domains/common/picker'
import { financeApi } from '@/domains/finance/api'
import { identityApi } from '@/domains/identity/api'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief, ProjectBusinessOrigin, ProjectStatus } from '@/domains/project/model'
import StatusTag from '@/components/StatusTag.vue'

type GroupKey = 'all' | 'active' | 'paused' | 'done'
type OriginKey = 'all' | ProjectBusinessOrigin

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
}>(), {
  title: '选择项目',
  placeholder: '选择项目',
  disabled: false,
  clearable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [option: PickerOption | null]
}>()

const ACTIVE_STATUSES: ProjectStatus[] = ['preparing', 'ongoing', 'accepting']
const DONE_STATUSES: ProjectStatus[] = ['finished', 'settled']
const STATUS_LABELS: Record<ProjectStatus, string> = {
  preparing: '待开工',
  ongoing: '施工中',
  suspended: '已暂停',
  accepting: '验收中',
  finished: '已完工',
  settled: '已结算'
}
const STATUS_TONES = {
  active: 'doing',
  paused: 'todo',
  done: 'dark',
  risk: 'blocked'
} as const

const visible = ref(false)
const keyword = ref('')
const group = ref<GroupKey>('all')
const origin = ref<OriginKey>('all')
const storeId = ref('')
const designerId = ref('')
const managerId = ref('')
const stores = ref<Array<{ id: string; name: string }>>([])
const designers = ref<Array<{ id: string; name: string }>>([])
const managers = ref<Array<{ id: string; name: string }>>([])
const frequent = ref<ProjectBrief[]>([])
const selected = ref<ProjectBrief | null>(null)
const items = ref<ProjectBrief[]>([])
const current = ref(1)
const total = ref(0)
const hasMore = ref(false)
const loading = ref(false)
const error = ref('')
const pageSize = 20
let requestSeq = 0
let timer: ReturnType<typeof setTimeout> | undefined

const fieldTitle = computed(() => selected.value?.name || (props.modelValue ? '已选项目需重新确认' : props.placeholder))
const fieldDescription = computed(() => selected.value ? projectDescription(selected.value) : '')
const activeFilterCount = computed(() => [storeId.value, designerId.value, managerId.value, group.value !== 'all' ? group.value : '', origin.value !== 'all' ? origin.value : ''].filter(Boolean).length)

function projectDescription(project: ProjectBrief): string {
  return [
    project.customerName && !project.name.includes(project.customerName) ? project.customerName : '',
    project.address && !project.name.includes(project.address) ? project.address : ''
  ].filter(Boolean).join(' · ')
}

function projectOption(project: ProjectBrief): PickerOption {
  return {
    id: project.id,
    label: project.name || '未命名项目',
    description: [STATUS_LABELS[project.status], projectDescription(project)].filter(Boolean).join(' · '),
    raw: project
  }
}

onMounted(() => {
  void Promise.all([
    financeApi.frequentProjects().then((list) => { frequent.value = list }).catch(() => { frequent.value = [] }),
    identityApi.stores().then((list) => { stores.value = list }).catch(() => { stores.value = [] }),
    identityApi.designers().then((list) => { designers.value = list }).catch(() => { designers.value = [] }),
    identityApi.employeesByRole('Pm').then((list) => { managers.value = list }).catch(() => { managers.value = [] })
  ])
})

watch(() => props.modelValue, async (id) => {
  if (!id) {
    selected.value = null
    return
  }
  if (selected.value?.id === id) return
  try {
    selected.value = await projectApi.projectInfo(id)
  } catch {
    selected.value = null
  }
}, { immediate: true })

function open(): void {
  if (props.disabled) return
  visible.value = true
  void load(true)
}

defineExpose({ open })

function statusesForGroup(): ProjectStatus[] | undefined {
  if (group.value === 'active') return ACTIVE_STATUSES
  if (group.value === 'paused') return ['suspended']
  if (group.value === 'done') return DONE_STATUSES
  return undefined
}

async function load(reset = true): Promise<void> {
  const seq = ++requestSeq
  if (reset) {
    current.value = 1
    items.value = []
    total.value = 0
    hasMore.value = false
  }
  loading.value = true
  error.value = ''
  try {
    const page = await projectApi.pageProjects({
      keyword: keyword.value.trim() || undefined,
      statuses: statusesForGroup(),
      businessOrigin: origin.value === 'all' ? undefined : origin.value,
      storeId: storeId.value || undefined,
      designerId: designerId.value || undefined,
      managerId: managerId.value || undefined,
      current: current.value,
      size: pageSize
    })
    if (seq !== requestSeq) return
    items.value = reset ? page.list : mergeProjects(items.value, page.list)
    total.value = page.total
    hasMore.value = page.hasMore
  } catch (loadError) {
    if (seq !== requestSeq) return
    error.value = loadError instanceof ProviderError ? loadError.message : '项目暂不可确认'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function mergeProjects(left: ProjectBrief[], right: ProjectBrief[]): ProjectBrief[] {
  const map = new Map(left.map((item) => [item.id, item]))
  right.forEach((item) => map.set(item.id, item))
  return [...map.values()]
}

function onKeywordInput(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void load(true) }, 300)
}

function loadMore(): void {
  if (!hasMore.value || loading.value) return
  current.value += 1
  void load(false)
}

function choose(project: ProjectBrief): void {
  selected.value = project
  emit('update:modelValue', project.id)
  emit('change', projectOption(project))
  visible.value = false
}

function clear(): void {
  selected.value = null
  emit('update:modelValue', '')
  emit('change', null)
}

function clearFilters(): void {
  storeId.value = ''
  designerId.value = ''
  managerId.value = ''
  group.value = 'all'
  origin.value = 'all'
  keyword.value = ''
  void load(true)
}
</script>

<template>
  <div class="project-picker">
    <button
      type="button"
      class="project-picker__field"
      :class="{ 'project-picker__field--empty': !modelValue, 'project-picker__field--disabled': disabled, 'project-picker__field--selected': Boolean(selected) }"
      :disabled="disabled"
      @click="open"
    >
      <span class="project-picker__field-main">
        <span v-if="selected" class="project-picker__field-top">
          <span class="project-picker__field-eyebrow">当前项目</span>
          <StatusTag :text="STATUS_LABELS[selected.status]" :tone="selected.status === 'suspended' ? STATUS_TONES.paused : DONE_STATUSES.includes(selected.status) ? STATUS_TONES.done : STATUS_TONES.active" />
          <span class="project-picker__field-origin">{{ selected.businessOrigin === 'carryover' ? '接管项目' : '正常项目' }}</span>
          <b>¥{{ formatMoney(selected.contractAmount) }}</b>
        </span>
        <strong>{{ fieldTitle }}</strong>
        <small v-if="fieldDescription">{{ fieldDescription }}</small>
        <span v-if="selected" class="project-picker__field-facts">
          <span>设计 {{ selected.designerName || '未分配' }}</span>
          <span>施工 {{ selected.managerName || '未分配' }}</span>
          <span>{{ selected.currentStageName || '阶段待确认' }}</span>
        </span>
      </span>
      <span class="project-picker__field-actions">
        <span v-if="clearable && modelValue && !disabled" @click.stop="clear">清除</span>
        <span aria-hidden="true">打开选择面板</span>
      </span>
    </button>

    <el-dialog v-model="visible" :title="title" width="min(1180px, 96vw)" destroy-on-close>
      <div class="project-picker__head">
        <div class="project-picker__status-tabs">
          <button type="button" :class="{ active: group === 'all' }" @click="group = 'all'; load(true)">全部项目</button>
          <button type="button" :class="{ active: group === 'active' }" @click="group = 'active'; load(true)">在跑</button>
          <button type="button" :class="{ active: group === 'paused' }" @click="group = 'paused'; load(true)">暂停</button>
          <button type="button" :class="{ active: group === 'done' }" @click="group = 'done'; load(true)">已完工</button>
        </div>
        <div class="project-picker__origin-tabs">
          <button type="button" :class="{ active: origin === 'all' }" @click="origin = 'all'; load(true)">全部来源</button>
          <button type="button" :class="{ active: origin === 'new' }" @click="origin = 'new'; load(true)">正常项目</button>
          <button type="button" :class="{ active: origin === 'carryover' }" @click="origin = 'carryover'; load(true)">接管项目</button>
        </div>
        <div class="project-picker__search">
          <span>精细查找</span>
          <el-input v-model="keyword" clearable placeholder="名称 / 客户 / 地址" @input="onKeywordInput" @keyup.enter="load(true)" @clear="load(true)" />
        </div>
      </div>

      <div class="project-picker__layout">
        <aside class="project-picker__rail">
          <div class="project-picker__filter-section">
            <h4>门店</h4>
            <button type="button" :class="{ active: !storeId }" @click="storeId = ''; load(true)">全部门店</button>
            <button v-for="store in stores" :key="store.id" type="button" :class="{ active: storeId === store.id }" @click="storeId = store.id; load(true)">{{ store.name }}</button>
          </div>
          <div class="project-picker__filter-section">
            <h4>设计师</h4>
            <button type="button" :class="{ active: !designerId }" @click="designerId = ''; load(true)">全部设计师</button>
            <button v-for="designer in designers" :key="designer.id" type="button" :class="{ active: designerId === designer.id }" @click="designerId = designer.id; load(true)">{{ designer.name }}</button>
          </div>
          <div class="project-picker__filter-section">
            <h4>项目经理</h4>
            <button type="button" :class="{ active: !managerId }" @click="managerId = ''; load(true)">全部项目经理</button>
            <button v-for="manager in managers" :key="manager.id" type="button" :class="{ active: managerId === manager.id }" @click="managerId = manager.id; load(true)">{{ manager.name }}</button>
          </div>
          <button v-if="activeFilterCount" type="button" class="project-picker__reset" @click="clearFilters">清除全部筛选</button>
        </aside>

        <section class="project-picker__main">
          <div v-if="frequent.length && !keyword && activeFilterCount === 0" class="project-picker__frequent">
            <span>常用项目</span>
            <button v-for="project in frequent" :key="project.id" type="button" @click="choose(project)">{{ project.name }}</button>
          </div>

          <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
            <template #default><el-button size="small" plain @click="load(true)">重新加载</el-button></template>
          </el-alert>

          <div v-else class="project-picker__cards-wrap">
            <el-skeleton v-if="loading && !items.length" :rows="6" animated />
            <div v-else-if="!items.length" class="project-picker__empty">
              <strong>没有匹配项目</strong>
              <span>调整左侧责任人或顶部状态/来源筛选后重试。</span>
            </div>
            <template v-else>
              <div class="project-picker__cards">
                <button
                  v-for="project in items"
                  :key="project.id"
                  type="button"
                  class="project-card"
                  :class="{ 'project-card--active': project.id === modelValue }"
                  @click="choose(project)"
                >
                  <div class="project-card__top">
                    <StatusTag :text="STATUS_LABELS[project.status]" :tone="project.status === 'suspended' ? STATUS_TONES.paused : DONE_STATUSES.includes(project.status) ? STATUS_TONES.done : STATUS_TONES.active" />
                    <span v-if="project.businessOrigin === 'carryover'" class="project-card__origin">接管项目</span>
                    <span v-else class="project-card__origin">正常项目</span>
                  </div>
                  <h3>{{ project.name }}</h3>
                  <p>{{ projectDescription(project) }}</p>
                  <div class="project-card__facts">
                    <span><small>合同金额</small><strong>¥{{ formatMoney(project.contractAmount) }}</strong></span>
                    <span><small>设计负责人</small><strong>{{ project.designerName || '未分配' }}</strong></span>
                    <span><small>施工负责人</small><strong>{{ project.managerName || '未分配' }}</strong></span>
                    <span><small>当前阶段</small><strong>{{ project.currentStageName || '阶段待确认' }}</strong></span>
                  </div>
                </button>
              </div>
              <div v-if="hasMore" class="project-picker__more">
                <el-button :loading="loading" @click="loadMore">加载更多</el-button>
              </div>
            </template>
          </div>
        </section>
      </div>

      <template #footer>
        <span class="project-picker__count">共 {{ total }} 个项目 · 已展示 {{ items.length }} 个</span>
        <el-button @click="visible = false">取消</el-button>
        <el-button v-if="clearable && modelValue" @click="clear(); visible = false">清除选择</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.project-picker__field { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; width: 100%; min-height: 44px; padding: $space-3 $space-4; color: $text-primary; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-md; text-align: left; cursor: pointer; }
.project-picker__field--selected { min-height: 128px; background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%); }
.project-picker__field--selected .project-picker__field-main { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(260px, .8fr); grid-template-areas: 'top top' 'name facts' 'desc facts'; gap: $space-2 $space-5; width: 100%; }
.project-picker__field--empty strong { color: $text-placeholder; font-weight: $font-weight-regular; }
.project-picker__field-top { grid-area: top; display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; }
.project-picker__field-eyebrow { color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.project-picker__field-top b { color: $brand-700; font-size: $font-card-title; font-variant-numeric: tabular-nums; }
.project-picker__field-origin { padding: 2px 8px; color: $text-secondary; background: $surface-100; border-radius: $radius-pill; font-size: $font-caption; }
.project-picker__field--selected .project-picker__field-main > strong { grid-area: name; font-size: $font-title; line-height: 1.4; white-space: normal; }
.project-picker__field--selected .project-picker__field-main > small { grid-area: desc; margin-top: 0; line-height: 1.5; white-space: normal; }
.project-picker__field-facts { grid-area: facts; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: $space-2; color: $text-secondary; font-size: $font-caption; }
.project-picker__field-facts span { padding: $space-2; background: rgba(255, 255, 255, .76); border: 1px solid $border-color; border-radius: $radius-sm; }
.project-picker__field--selected .project-picker__field-actions { flex-direction: column; align-items: flex-end; justify-content: center; align-self: stretch; }
.project-picker__field--disabled { color: $text-tertiary; background: $surface-100; cursor: not-allowed; }
.project-picker__field-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.project-picker__field-main strong,
.project-picker__field-main small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project-picker__field-main strong { font-size: $font-body-sm; }
.project-picker__field-main small { color: $text-tertiary; font-size: $font-caption; }
.project-picker__field-actions { display: flex; gap: $space-2; flex-shrink: 0; color: $brand-600; font-size: $font-caption; }
.project-picker__head { display: flex; align-items: center; gap: $space-4; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.project-picker__status-tabs,
.project-picker__origin-tabs { display: flex; align-items: center; gap: 6px; }
.project-picker__status-tabs button,
.project-picker__origin-tabs button { min-height: 32px; padding: 0 $space-3; color: $text-secondary; background: $surface-50; border: 1px solid $border-color; border-radius: $radius-pill; cursor: pointer; font-size: $font-body-sm; }
.project-picker__status-tabs button.active,
.project-picker__origin-tabs button.active { color: $brand-700; background: $brand-50; border-color: $brand-300; font-weight: $font-weight-semibold; }
.project-picker__search { display: flex; align-items: center; gap: $space-2; margin-left: auto; }
.project-picker__search > span { color: $text-tertiary; font-size: $font-caption; white-space: nowrap; }
.project-picker__layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: $space-4; min-height: 620px; margin-top: $space-4; }
.project-picker__rail { padding-right: $space-3; border-right: 1px solid $border-color; overflow: auto; }
.project-picker__filter-section { padding-bottom: $space-4; margin-bottom: $space-4; border-bottom: 1px solid $border-color; }
.project-picker__filter-section h4 { margin: 0 0 $space-2; color: $text-tertiary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.project-picker__filter-section button { display: block; width: 100%; padding: 8px $space-2; color: $text-secondary; background: transparent; border: 0; border-radius: $radius-sm; text-align: left; cursor: pointer; font-size: $font-body-sm; }
.project-picker__filter-section button:hover { background: $bg-hover; }
.project-picker__filter-section button.active { color: $brand-700; background: $brand-50; font-weight: $font-weight-semibold; }
.project-picker__reset { width: 100%; padding: $space-2; color: $danger-500; background: transparent; border: 1px dashed $danger-200; border-radius: $radius-sm; cursor: pointer; }
.project-picker__main { min-width: 0; }
.project-picker__frequent { display: flex; align-items: center; flex-wrap: wrap; gap: $space-2; margin-bottom: $space-3; color: $text-secondary; font-size: $font-caption; }
.project-picker__frequent button { padding: 4px 10px; color: $brand-700; background: $brand-50; border: 1px solid $brand-100; border-radius: $radius-pill; cursor: pointer; }
.project-picker__cards-wrap { max-height: 640px; overflow: auto; }
.project-picker__cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.project-card { padding: $space-4; color: $text-primary; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-md; text-align: left; cursor: pointer; transition: border-color $transition-fast, box-shadow $transition-fast; }
.project-card:hover { border-color: $brand-300; box-shadow: $shadow-card; }
.project-card--active { border-color: $brand-500; background: $brand-50; }
.project-card__top { display: flex; align-items: center; gap: $space-2; margin-bottom: $space-3; }
.project-card__origin { padding: 2px 8px; color: $text-secondary; background: $surface-100; border-radius: $radius-pill; font-size: $font-caption; }
.project-card h3 { margin: 0; font-size: $font-card-title; }
.project-card p { margin: $space-2 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.project-card__facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-2; padding-top: $space-3; border-top: 1px solid $border-color; }
.project-card__facts span { min-width: 0; }
.project-card__facts small,
.project-card__facts strong { display: block; }
.project-card__facts small { color: $text-tertiary; font-size: $font-caption; }
.project-card__facts strong { margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: $font-body-sm; }
.project-picker__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 360px; color: $text-secondary; }
.project-picker__empty strong { color: $text-primary; }
.project-picker__empty span { margin-top: $space-2; font-size: $font-caption; }
.project-picker__more { display: flex; justify-content: center; padding: $space-4; }
.project-picker__count { margin-right: auto; color: $text-secondary; font-size: $font-caption; }
@media (max-width: 1100px) {
  .project-picker__head { flex-wrap: wrap; }
  .project-picker__search { margin-left: 0; }
  .project-picker__layout { grid-template-columns: 180px minmax(0, 1fr); }
  .project-picker__cards { grid-template-columns: 1fr; }
}
</style>
