<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'
import { materialApi } from '@/domains/material/api'
import type { MaterialSelectionItem, SelectionBoardItem } from '@/domains/material/model'
import { useSessionStore } from '@/stores/session'

type ScopeFilter = 'all' | 'notStarted' | 'inProgress' | 'locked'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const maintainRoles = ['Designer', 'Boss', 'StoreManager', 'Finance']
const canMaintain = computed(() => maintainRoles.includes(session.role ?? ''))

const projects = ref<SelectionBoardItem[]>([])
const selectedProjectId = ref('')
const detailItems = ref<MaterialSelectionItem[]>([])
const activeFilter = ref<ScopeFilter>('all')
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const detailLoading = ref(false)
const detailError = ref('')

let detailSequence = 0

const selectedProject = computed(() =>
  projects.value.find((item) => item.projectId === selectedProjectId.value) ?? null
)

const filteredProjects = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return projects.value.filter((item) => {
    const scopeMatched = activeFilter.value === 'all'
      || (activeFilter.value === 'notStarted' && item.totalItems > 0 && item.selectedItems === 0)
      || (activeFilter.value === 'inProgress' && item.totalItems > 0 && item.selectedItems > 0 && item.selectedItems < item.totalItems)
      || (activeFilter.value === 'locked' && item.orderedItems > 0)
    if (!scopeMatched) return false
    if (!query) return true
    return [item.projectName, item.projectNo, item.community, item.propertyAddress, item.designerName]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  })
})

const summary = computed(() => ({
  projects: projects.value.length,
  notSelected: projects.value.reduce((total, item) => total + item.notSelectedItems, 0),
  inPurchase: projects.value.reduce((total, item) => total + item.orderedItems, 0)
}))

const scopeOptions = computed(() => [
  { key: 'all' as ScopeFilter, label: '全部', count: projects.value.length },
  { key: 'notStarted' as ScopeFilter, label: '未发起', count: projects.value.filter((item) => item.totalItems > 0 && item.selectedItems === 0).length },
  { key: 'inProgress' as ScopeFilter, label: '选材中', count: projects.value.filter((item) => item.totalItems > 0 && item.selectedItems > 0 && item.selectedItems < item.totalItems).length },
  { key: 'locked' as ScopeFilter, label: '有已采购', count: projects.value.filter((item) => item.orderedItems > 0).length }
])

const previewItems = computed(() => {
  const rank = (item: MaterialSelectionItem): number => {
    if (!item.status) return 0
    if (isPurchasing(item.orderStatus)) return 2
    return 1
  }
  return [...detailItems.value]
    .sort((left, right) => rank(left) - rank(right) || Number(right.required) - Number(left.required))
    .slice(0, 8)
})

const selectedReadyCount = computed(() =>
  Math.max(0, (selectedProject.value?.deliveredItems ?? 0) - (selectedProject.value?.orderedItems ?? 0))
)

watch([activeFilter, keyword], () => {
  if (!filteredProjects.value.some((item) => item.projectId === selectedProjectId.value)) {
    void chooseProject(filteredProjects.value[0]?.projectId ?? '')
  }
})

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    projects.value = await materialApi.listSelectionBoard()
    const routeProjectId = String(route.query.projectId ?? '')
    const target = projects.value.find((item) => item.projectId === routeProjectId)
      ?? projects.value[0]
    selectedProjectId.value = target?.projectId ?? ''
    await loadDetail(selectedProjectId.value)
  } catch (err) {
    projects.value = []
    selectedProjectId.value = ''
    detailItems.value = []
    error.value = err instanceof Error ? err.message : '主材选材队列暂不可确认'
  } finally {
    loading.value = false
  }
}

async function chooseProject(projectId: string): Promise<void> {
  if (projectId === selectedProjectId.value) return
  selectedProjectId.value = projectId
  const query = { ...route.query }
  if (projectId) query.projectId = projectId
  else delete query.projectId
  void router.replace({ query })
  await loadDetail(projectId)
}

async function loadDetail(projectId: string): Promise<void> {
  const sequence = ++detailSequence
  detailItems.value = []
  detailError.value = ''
  if (!projectId) return
  detailLoading.value = true
  try {
    const rows = await materialApi.listSelectionItems(projectId)
    if (sequence !== detailSequence) return
    detailItems.value = rows
  } catch (err) {
    if (sequence !== detailSequence) return
    detailError.value = err instanceof Error ? err.message : '该项目的主材分项暂不可确认'
  } finally {
    if (sequence === detailSequence) detailLoading.value = false
  }
}

function projectAddress(item: SelectionBoardItem): string {
  return [item.community, item.propertyAddress].filter(Boolean).join(' · ') || '房屋地址待补充'
}

function projectArea(item: SelectionBoardItem): string {
  return item.area === undefined || item.area === null ? '面积待补充' : `${item.area}㎡`
}

function isPurchasing(status?: string): boolean {
  return ['ordering', 'partiallyOrdered', 'ordered', 'partiallyArrived', 'arrived'].includes(status ?? '')
}

function materialOrderTone(status?: string): StatusTone {
  if (status === 'arrived') return 'done'
  if (status === 'ordered' || status === 'partiallyOrdered') return 'progress'
  return 'pending'
}

function openProjectWorkspace(item: SelectionBoardItem): void {
  const path = ['Designer', 'Boss'].includes(session.role ?? '')
    ? `/designer/projects/${item.projectId}/materials`
    : `/workbench/materials/${item.projectId}`
  void router.push(path)
}
</script>

<template>
  <div class="msb">
    <header class="msb__head">
      <div>
        <p class="msb__eyebrow">项目交付 · 主材选材</p>
        <h2>把现场确认的主材选择，稳定交接给财务下单</h2>
        <p>
          这里只显示当前数据范围内尚未完成逐项选材的在跑项目。设计师现场或逐项沟通后代录，
          保存即“已选材”；交付后由财务决定供应商、价格与数量。
        </p>
      </div>
      <el-button :loading="loading" @click="load">刷新选材队列</el-button>
    </header>

    <section v-if="error" class="msb__state" aria-live="assertive">
      <EmptyState
        title="主材选材队列暂不可确认"
        :description="error"
        action-text="重新加载"
        @action="load"
      />
    </section>

    <template v-else>
      <section class="msb__summary" aria-label="主材选材汇总">
        <article>
          <span>尚未完成选材的项目</span>
          <strong>{{ summary.projects }}</strong>
          <small>只统计项目，不把多条材料分项重复算成多个项目</small>
        </article>
        <article>
          <span>待选材分项</span>
          <strong>{{ summary.notSelected }}</strong>
          <small>合同主材行中还没有选材结果的分项</small>
        </article>
        <article :class="{ 'msb__metric--warn': summary.inPurchase > 0 }">
          <span>已进入采购、需走增减项</span>
          <strong>{{ summary.inPurchase }}</strong>
          <small>采购后选材锁定，换材不能再直接改选材文本</small>
        </article>
      </section>

      <div class="msb__layout">
        <aside class="msb__queue">
          <div class="msb__queue-head">
            <div>
              <strong>待选材项目</strong>
              <span>{{ filteredProjects.length }} / {{ projects.length }}</span>
            </div>
            <el-input v-model="keyword" clearable placeholder="项目、小区、门牌" />
          </div>

          <div class="msb__filters" role="tablist" aria-label="项目筛选">
            <button
              v-for="option in scopeOptions"
              :key="option.key"
              type="button"
              :class="{ active: activeFilter === option.key }"
              @click="activeFilter = option.key"
            >
              {{ option.label }}
              <b>{{ option.count }}</b>
            </button>
          </div>

          <div class="msb__queue-list">
            <SkeletonBlock v-if="loading" variant="card" :rows="6" />
            <EmptyState
              v-else-if="!filteredProjects.length"
              title="当前筛选下没有待选材项目"
              description="可以切换筛选或清空搜索。已完成全部主材选材的项目不会出现在这里。"
            />
            <button
              v-for="project in filteredProjects"
              v-else
              :key="project.projectId"
              type="button"
              class="msb-project"
              :class="{ 'msb-project--active': project.projectId === selectedProjectId }"
              @click="chooseProject(project.projectId)"
            >
              <span class="msb-project__top">
                <BusinessStateTag object-key="project" :server-value="project.projectStatus" :dot="false" />
                <em>{{ project.projectNo || '项目编号待确认' }}</em>
              </span>
              <strong>{{ project.projectName }}</strong>
              <small>{{ projectAddress(project) }}</small>
              <span class="msb-project__progress">
                <i :style="{ width: `${Math.min(100, Math.max(0, project.progress))}%` }" />
              </span>
              <span class="msb-project__facts">
                <b>待选 {{ project.notSelectedItems }}</b>
                <b>已选 {{ project.selectedItems }} / {{ project.totalItems }}</b>
                <b v-if="project.orderedItems">已采购 {{ project.orderedItems }}</b>
              </span>
              <em class="msb-project__next">{{ project.nextAction || '待业务确认下一步' }}</em>
            </button>
          </div>
        </aside>

        <main class="msb__workspace">
          <SkeletonBlock v-if="loading" variant="card" :rows="8" />
          <EmptyState
            v-else-if="!selectedProject"
            title="请选择一个待选材项目"
            description="左侧队列只展示当前数据范围内尚未完成逐项选材的项目。"
          />
          <template v-else>
            <ObjectHeroCard>
              <template #avatar>材</template>
              <template #title>
                <h2>{{ selectedProject.projectName }}</h2>
                <BusinessStateTag object-key="project" :server-value="selectedProject.projectStatus" />
              </template>
              <template #subtitle>
                {{ projectAddress(selectedProject) }} · {{ projectArea(selectedProject) }}
              </template>
              <template #chips>
                <BusinessStateTag object-key="materialSelection" :status-key="selectedProject.selectedItems > 0 ? 'selected' : 'notStarted'" :dot="false" />
              </template>

              <template #focus>
                <div class="msb-focus">
                  <span>选材进度</span>
                  <strong>{{ selectedProject.selectedItems }} / {{ selectedProject.totalItems }}</strong>
                  <div class="msb-focus__bar"><i :style="{ width: `${Math.min(100, Math.max(0, selectedProject.progress))}%` }" /></div>
                </div>
                <div class="msb-focus">
                  <span>当前下一步</span>
                  <strong>{{ selectedProject.nextAction || '待业务确认' }}</strong>
                  <small>{{ selectedProject.designerName ? `选材责任人：${selectedProject.designerName}` : '选材责任人待确认' }}</small>
                </div>
              </template>

              <template #facts>
                <div><small>待选材</small><b>{{ selectedProject.notSelectedItems }}</b></div>
                <div><small>已选材</small><b>{{ selectedProject.selectedItems }}</b></div>
                <div><small>已交付待下单</small><b>{{ selectedReadyCount }}</b></div>
                <div><small>已进入采购</small><b>{{ selectedProject.orderedItems }}</b></div>
              </template>

              <template #actions>
                <div class="msb__primary">
                  <small v-if="selectedProject.totalItems === 0">合同主材分项未配置，先检查报价/合同主材行</small>
                  <small v-else>进入逐项工作区维护颜色、规格、品牌、工艺与选材说明</small>
                  <el-button
                    type="primary"
                    :disabled="selectedProject.totalItems === 0 || !canMaintain"
                    @click="openProjectWorkspace(selectedProject)"
                  >
                    {{ selectedProject.totalItems === 0 ? '等待合同主材分项' : '进入逐项选材' }}
                  </el-button>
                </div>
              </template>
            </ObjectHeroCard>

            <section class="msb__panel">
              <header class="msb__panel-head">
                <div>
                  <h3>这项项目接下来最需要处理的分项</h3>
                  <p>优先显示尚未选材的分项；已采购分项只作锁定提示，不能在这里换材。</p>
                </div>
                <el-button text @click="loadDetail(selectedProject.projectId)">重新读取</el-button>
              </header>

              <div class="msb__panel-body">
                <div v-if="detailLoading" class="msb__panel-loading">
                  <SkeletonBlock variant="table" :rows="5" />
                </div>
                <div v-else-if="detailError" class="msb__partial" role="status">
                  <StatusTag text="部分数据暂不可确认" tone="pending" :dot="false" />
                  <p>{{ detailError }}。项目汇总仍可查看，请重新读取后再判断选材是否完成。</p>
                  <el-button plain @click="loadDetail(selectedProject.projectId)">重新读取分项</el-button>
                </div>
                <EmptyState
                  v-else-if="!previewItems.length"
                  title="合同主材分项暂不可确认"
                  description="请先检查项目合同是否包含主材行；没有主材分项时不能伪装成选材完成。"
                />
                <div v-else class="msb-materials">
                  <article v-for="item in previewItems" :key="item.itemId" class="msb-material" :class="{ 'msb-material--locked': isPurchasing(item.orderStatus) }">
                    <div class="msb-material__ident">
                      <span>{{ item.spaceName || '综合项目' }}<template v-if="item.category"> · {{ item.category }}</template></span>
                      <strong>{{ item.materialName }}</strong>
                      <small>
                        合同要求：{{ [item.brand, item.spec].filter(Boolean).join(' / ') || '暂不可确认' }}
                        <template v-if="item.unit"> · {{ item.quantity }}{{ item.unit }}</template>
                      </small>
                    </div>
                    <div class="msb-material__state">
                      <BusinessStateTag object-key="materialSelection" :status-key="item.status ? 'selected' : 'notStarted'" :dot="false" />
                      <StatusTag
                        v-if="item.orderStatus && item.orderStatus !== 'none'"
                        :text="item.orderStatusName || '采购状态待确认'"
                        :tone="materialOrderTone(item.orderStatus)"
                        :dot="false"
                      />
                    </div>
                    <p v-if="item.selectionText">{{ item.selectionText }}</p>
                    <p v-else-if="isPurchasing(item.orderStatus)" class="msb-material__lock">
                      已进入采购，选材文本已锁定；如需更换材料，请发起增减项。
                    </p>
                    <p v-else>尚未保存选材结果。</p>
                  </article>
                  <p v-if="detailItems.length > previewItems.length" class="msb-materials__more">
                    仅预览前 {{ previewItems.length }} 项，进入逐项工作区可处理全部 {{ detailItems.length }} 项。
                  </p>
                </div>
              </div>
            </section>
          </template>
        </main>

        <aside class="msb__guide">
          <section>
            <h3>现场代录口径</h3>
            <ul>
              <li>与客户现场/逐项沟通确认后代录，保存即“已选材”。</li>
              <li>选材只记录文本和留证图片，不改报价、合同、成本、数量、采购与库存。</li>
              <li>交付财务后，供应商、价格、数量仍由财务在下单时决定。</li>
            </ul>
          </section>
          <section>
            <h3>什么时候不能直接改</h3>
            <p v-if="selectedProject?.orderedItems">
              当前有 {{ selectedProject.orderedItems }} 项已进入采购。已采购分项不能再改选材文本，换材必须走增减项。
            </p>
            <p v-else>进入采购前，已选材内容仍可修改；保存后页面会重新读取当前选材事实。进入采购后只能走增减项。</p>
          </section>
          <section>
            <h3>选材责任与边界</h3>
            <dl>
              <div><dt>维护角色</dt><dd>设计师 / 企业负责人 / 店长 / 财务</dd></div>
              <div><dt>只读角色</dt><dd>项目经理 / 团队负责人 / 业务员</dd></div>
              <div><dt>最近更新</dt><dd>{{ selectedProject?.updatedAt ? formatDateTime(String(selectedProject.updatedAt)) : '暂不可确认' }}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/workbench-shell' as wb;

.msb {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.msb__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 860px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.msb__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.msb__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;

  article {
    padding: $space-4;
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: $surface-0;
    box-shadow: $shadow-card;
  }

  span, small, strong { display: block; }
  span { color: $text-secondary; font-size: $font-caption; }
  strong { margin: $space-1 0; color: $brand-700; font-size: $font-kpi; line-height: 1; }
  small { color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
}

.msb__metric--warn strong { color: $warning-700; }

.msb__layout { @include wb.workbench-layout(345px, 330px); }
.msb__queue { @include wb.workbench-queue; }
.msb__queue-list { @include wb.workbench-queue-scroll; }
.msb__workspace { @include wb.workbench-workspace; }
.msb__guide { @include wb.workbench-guide; }

.msb__queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  div { min-width: 0; }
  strong { display: block; font-size: $font-body; }
  span { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
  :deep(.el-input) { width: 168px; }
}

.msb__filters {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;

  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: 1px solid $border-color;
    border-radius: $radius-pill;
    background: $surface-0;
    color: $text-secondary;
    font-size: $font-caption;
    cursor: pointer;
  }

  button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
  b { font-variant-numeric: tabular-nums; }
}

.msb-project {
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active { background: $brand-50; }
  &--active { box-shadow: inset 3px 0 0 $brand-500; }
  > strong { display: block; margin-top: 6px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
  > small { display: block; margin-top: 3px; overflow: hidden; color: $text-secondary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
}

.msb-project__top,
.msb-project__facts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.msb-project__top em {
  overflow: hidden;
  color: $text-tertiary;
  font-size: $font-caption;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msb-project__progress {
  display: block;
  height: 5px;
  margin-top: 9px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $surface-100;

  i { display: block; height: 100%; border-radius: inherit; background: $brand-500; }
}

.msb-project__facts {
  justify-content: flex-start;
  margin-top: 7px;
  color: $text-secondary;
  font-size: $font-caption;

  b { font-weight: $font-weight-medium; }
  b + b { padding-left: $space-2; border-left: 1px solid $border-color; }
}

.msb-project__next {
  display: block;
  margin-top: 6px;
  color: $brand-700;
  font-size: $font-caption;
  font-style: normal;
  line-height: 1.5;
}

.msb-focus {
  padding: $space-3;
  border: 1px solid rgba(255, 255, 255, .88);
  border-radius: $radius-sm;
  background: rgba(255, 255, 255, .72);

  span, small, strong { display: block; }
  span { color: $text-tertiary; font-size: $font-caption; }
  strong { margin-top: 3px; color: $text-primary; font-size: $font-body; }
  small { margin-top: 4px; color: $text-secondary; font-size: $font-caption; }
}

.msb-focus__bar {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: $radius-pill;
  background: $surface-100;

  i { display: block; height: 100%; border-radius: inherit; background: $brand-500; }
}

.msb__primary {
  display: flex;
  align-items: center;
  gap: $space-3;

  small { color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
}

.msb__panel {
  display: flex;
  flex-direction: column;
  max-height: 520px;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.msb__panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  h3 { margin: 0; font-size: $font-title; }
  p { margin: 4px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
}

.msb__panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.msb__panel-loading { padding: $space-3; }

.msb__partial {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: $space-3;
  padding: $space-4;
  background: $warning-50;

  p { flex: 1 1 360px; margin: 0; color: $warning-700; font-size: $font-body-sm; line-height: 1.6; }
}

.msb-materials { padding: $space-2 $space-4 $space-4; }

.msb-material {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: $space-2 $space-4;
  padding: $space-3 0;
  border-bottom: 1px solid $border-color;

  &:last-of-type { border-bottom: 0; }
  p { grid-column: 1 / -1; margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; white-space: pre-wrap; }
}

.msb-material--locked {
  opacity: .72;
  background: linear-gradient(90deg, transparent, $surface-50);
}

.msb-material__ident {
  min-width: 0;

  span, strong, small { display: block; }
  span { color: $text-tertiary; font-size: $font-caption; }
  strong { margin-top: 2px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
  small { margin-top: 3px; color: $text-secondary; font-size: $font-caption; }
}

.msb-material__state {
  display: flex;
  align-items: flex-start;
  gap: $space-1;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.msb-material__lock { color: $warning-700 !important; }

.msb-materials__more {
  margin: $space-3 0 0 !important;
  color: $text-tertiary !important;
  font-size: $font-caption !important;
}

.msb__guide {
  section {
    padding: $space-4;
    border: 1px solid $border-color;
    border-radius: $radius-md;
    background: $surface-0;
    box-shadow: $shadow-card;
  }

  h3 { margin: 0 0 $space-2; font-size: $font-body-sm; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { position: relative; padding: 0 0 $space-2 12px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
  li::before { position: absolute; top: 7px; left: 0; width: 5px; height: 5px; border-radius: 50%; background: $brand-400; content: ''; }
  dl { margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: $space-3; padding: $space-2 0; border-bottom: 1px solid $border-color; }
  dl div:last-child { border-bottom: 0; }
  dt { color: $text-tertiary; font-size: $font-caption; }
  dd { margin: 0; color: $text-primary; font-size: $font-caption; text-align: right; }
}

.msb__state { border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }

@media (min-width: 769px) and (max-width: 1400px) {
  .msb__panel { max-height: 300px; }
  .msb__guide {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $space-2;
  }
  .msb__guide section { padding: 10px; }
  .msb__guide h3 { margin-bottom: 4px; font-size: $font-caption; }
  .msb__guide li { padding-bottom: 4px; font-size: $font-caption; line-height: 1.45; }
  .msb__guide p { font-size: $font-caption; line-height: 1.45; }
  .msb__guide dl div { padding: 3px 0; }
}

@media (max-width: 1024px) {
  .msb__head { flex-direction: column; }
  .msb__summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .msb__queue-head { align-items: flex-start; }
  .msb__queue-head :deep(.el-input) { width: 100%; }
  .msb__queue-head { flex-wrap: wrap; }
  .msb__primary { align-items: stretch; flex-direction: column; }
}

@media (max-width: 768px) {
  .msb__summary { grid-template-columns: 1fr; }
}
</style>
