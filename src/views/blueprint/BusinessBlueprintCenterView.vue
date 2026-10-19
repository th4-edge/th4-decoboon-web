<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { blueprintApi } from '@/domains/blueprint/api'
import type {
  BlueprintField,
  BlueprintObjectRef,
  BlueprintStage,
  BlueprintRuntimePayload,
  MaterialBlueprintDocument
} from '@/domains/blueprint/model'
import EmptyState from '@/components/EmptyState.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const runtime = ref<BlueprintRuntimePayload | null>(null)
const blueprint = ref<MaterialBlueprintDocument | null>(null)
const activeStageId = ref('')
const activeObjectId = ref('')
const fieldKeyword = ref('')
const fieldObject = ref('all')
const showTechnical = ref(false)

const ROLE_LABELS: Record<string, string> = {
  boss: '企业负责人',
  storeManager: '店长',
  finance: '财务',
  designer: '设计师',
  pm: '项目经理',
  customer: '客户（只读）',
  system: '系统'
}

const stage = computed<BlueprintStage | null>(() =>
  blueprint.value?.stages.find((item) => item.id === activeStageId.value) ?? null
)

const selectedObject = computed<BlueprintObjectRef | null>(() =>
  blueprint.value?.objects.find((item) => item.id === activeObjectId.value) ?? null
)

const viewerRoleLabel = computed(() => {
  const raw = String(runtime.value?.viewerRole || '')
  return ROLE_LABELS[raw.toLowerCase()] || raw || '已登录员工'
})

const fields = computed<BlueprintField[]>(() => {
  const keyword = fieldKeyword.value.trim().toLowerCase()
  const object = fieldObject.value
  return (blueprint.value?.fields ?? []).filter((field) => {
    if (object !== 'all' && field.object !== object) return false
    if (!keyword) return true
    return [field.object, field.field, field.label, field.meaning, field.owner, field.impact]
      .some((value) => String(value ?? '').toLowerCase().includes(keyword))
  })
})

const stageIndex = computed(() => blueprint.value?.stages.findIndex((item) => item.id === activeStageId.value) ?? -1)

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

function displayBusinessText(value?: string): string {
  if (!value) return ''
  return value
    .replace(/P1 报价成本/g, '报价成本')
    .replace(/P2 价格/g, '采购价')
    .replace(/P3 结算价/g, '结算价')
    .replace(/Selection 为空或不是 Selected/g, '尚未完成选材')
    .replace(/status\.ordered\(\)=true 时调用 material\/sheet\/cancel/g, '已进入采购后不能直接取消作业单')
    .replace(/visible=true 且 required=true/g, '设为必填')
    .replace(/supplier 为空/g, '供应商未填')
    .replace(/建单使用 建单时间/g, '建单使用建单时间')
    .replace(/采购下单使用 采购下单时间/g, '采购下单使用采购下单时间')
    .replace(/createTime/g, '建单时间')
    .replace(/orderedAt/g, '采购下单时间')
    .replace(/部分到场推进 部分到场/g, '部分到场推进到场状态')
    .replace(/PartiallyArrived/g, '部分到场')
    .replace(/Supplier\/Factory/g, '供应商/工厂')
    .replace(/priceState=Unpriced/g, '采购价未填')
    .replace(/costComplete=false/g, '成本未完整')
    .replace(/MaterialOrderSheet/g, '作业单')
    .replace(/MaterialPlan/g, '材料计划')
    .replace(/MaterialSelection/g, '选材')
    .replace(/MaterialReturn/g, '退货单')
    .replace(/MaterialSettlement/g, '结算单')
    .replace(/PurchaseOrder/g, '采购单')
    .replace(/GoodsReceipt/g, '到场记录')
    .replace(/Payable/g, '应付')
    .replace(/Partner/g, '合作方')
    .replace(/\bP1\b/g, '报价成本价')
    .replace(/\bP2\b/g, '采购价')
    .replace(/\bP3\b/g, '结算价')
    .replace(/\bSelected\b/g, '已选材')
    .replace(/\bSelection\b/g, '选材')
    .replace(/\bPlanned\b/g, '待下单')
    .replace(/\bReadyToOrder\b/g, '可下单')
    .replace(/\bCancelled\b/g, '已取消')
    .replace(/\bnull\b/g, '暂不显示')
    .replace(/利润保持 暂不显示/g, '利润暂不显示')
}

function objectName(id: string): string {
  return blueprint.value?.objects.find((item) => item.id === id)?.name || id
}

function severityLabel(severity: string): string {
  if (severity === 'P0') return '高'
  if (severity === 'P1') return '中'
  return '低'
}

function scopeLabel(scope: string): string {
  return ({
    project: '项目', row: '材料行', purchase: '采购单', settlement: '结算',
    Project: '项目', MaterialPlan: '材料计划', PurchaseOrder: '采购单',
    GoodsReceipt: '到场记录', MaterialSettlement: '结算单', MaterialOrderSheet: '作业单'
  } as Record<string, string>)[scope] || scope
}

function toneOfSeverity(severity: string): 'blocked' | 'alert' | 'pending' | 'info' {
  if (severity === 'P0') return 'blocked'
  if (severity === 'P1') return 'alert'
  if (severity === 'P2') return 'pending'
  return 'info'
}

function statusLabel(value: string): string {
  if (value === 'ready-for-implementation') return '可实施'
  if (value === 'draft') return '草稿'
  return value || '待确认'
}

function selectStage(id: string): void {
  activeStageId.value = id
}

function moveStage(offset: number): void {
  const stages = blueprint.value?.stages ?? []
  const next = stageIndex.value + offset
  if (next >= 0 && next < stages.length) activeStageId.value = stages[next].id
}

function openProjectLedger(): void {
  void router.push('/finance/projects')
}

onMounted(async () => {
  try {
    const result = await blueprintApi.runtime()
    runtime.value = result.runtime
    blueprint.value = result.blueprint
    activeStageId.value = result.blueprint.stages[0]?.id ?? ''
  } catch (e) {
    error.value = e instanceof ProviderError ? e.message : '业务蓝图暂不可确认'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="bp">
    <header class="bp__hero">
      <div class="bp__hero-copy">
        <p class="bp__kicker">材料业务说明</p>
        <h1>{{ blueprint?.title || '材料业务蓝图' }}</h1>
        <p class="bp__desc">
          用于了解材料流程、字段和规则；日常操作请去项目材料、主材下单或结算。
          本页只解释既有业务事实，不发起审批、付款、删除或权限变更。
        </p>
      </div>
      <div class="bp__hero-actions">
        <el-button @click="openProjectLedger">去项目账本做材料体检</el-button>
        <el-button type="primary" plain @click="router.push('/finance/material-ordering')">打开主材下单</el-button>
      </div>
    </header>

    <SkeletonBlock v-if="loading" variant="card" :rows="8" />

    <el-alert
      v-else-if="error"
      type="error"
      :closable="false"
      show-icon
      :title="error"
      description="蓝图运行态读取失败。请刷新重试；未确认前不要据此判断材料业务已完成。"
    />

    <template v-else-if="blueprint && runtime">
      <section class="bp__facts" aria-label="蓝图版本事实">
        <article class="bp__fact">
          <span>蓝图版本</span>
          <strong>v{{ runtime.version }}</strong>
          <small>{{ statusLabel(runtime.status) }}</small>
        </article>
        <article class="bp__fact">
          <span>规则来源</span>
          <strong>{{ runtime.sourceRefCount }} 条</strong>
          <small>已登记业务规则</small>
        </article>
        <article class="bp__fact">
          <span>对象与阶段</span>
          <strong>{{ blueprint.objects.length }} / {{ blueprint.stages.length }}</strong>
          <small>对象 / 履约阶段</small>
        </article>
        <article class="bp__fact">
          <span>当前视角</span>
          <strong>{{ viewerRoleLabel }}</strong>
          <small>按角色显示</small>
        </article>
      </section>

      <div class="bp__layout">
        <nav class="bp__stages" aria-label="材料履约阶段">
          <div class="bp__stages-head">
            <span>履约阶段</span>
            <small>按业务事实顺序</small>
          </div>
          <button
            v-for="item in blueprint.stages"
            :key="item.id"
            type="button"
            class="bp__stage-btn"
            :class="{ 'bp__stage-btn--active': item.id === activeStageId }"
            :aria-current="item.id === activeStageId ? 'step' : undefined"
            @click="selectStage(item.id)"
          >
            <b>{{ item.no }}</b>
            <span>{{ item.name }}</span>
            <small>{{ item.roles.length }} 个角色</small>
          </button>
        </nav>

        <main class="bp__main">
          <PanelCard v-if="stage" :title="`${stage.no} · ${stage.name}`" :description="displayBusinessText(stage.trigger)">
            <template #extra>
              <div class="bp__stage-actions">
                <el-button size="small" :disabled="stageIndex <= 0" @click="moveStage(-1)">上一阶段</el-button>
                <el-button size="small" :disabled="stageIndex >= blueprint.stages.length - 1" @click="moveStage(1)">下一阶段</el-button>
              </div>
            </template>

            <div class="bp__stage-grid">
              <div class="bp__stage-cell">
                <span>触发事件</span>
                <strong>{{ displayBusinessText(stage.trigger) }}</strong>
              </div>
              <div class="bp__stage-cell">
                <span>系统产出</span>
                <strong>{{ displayBusinessText(stage.output) }}</strong>
              </div>
              <div class="bp__stage-cell">
                <span>账务口径</span>
                <strong>{{ displayBusinessText(stage.accounting) }}</strong>
              </div>
              <div class="bp__stage-cell">
                <span>参与角色</span>
                <div class="bp__chips">
                  <StatusTag v-for="role in stage.roles" :key="role" tone="info" :text="roleLabel(role)" />
                </div>
              </div>
            </div>

            <div class="bp__stage-system">
              <span>系统下一步</span>
              <p>{{ displayBusinessText(stage.system) }}</p>
            </div>

            <div class="bp__stage-bottom">
              <div>
                <h3>异常与恢复</h3>
                <ul class="bp__list">
                  <li v-for="item in stage.exceptions" :key="item">{{ displayBusinessText(item) }}</li>
                </ul>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="业务对象图谱" description="点击对象查看业务含义；对象关系由系统维护。">
            <div class="bp__objects">
              <button
                v-for="item in blueprint.objects"
                :key="item.id"
                type="button"
                class="bp__object"
                :class="{ 'bp__object--active': item.id === activeObjectId }"
                @click="activeObjectId = item.id"
              >
                <strong>{{ item.name }}</strong>
                <small>{{ displayBusinessText(item.meaning) }}</small>
              </button>
            </div>

            <div v-if="selectedObject" class="bp__object-detail">
              <div class="bp__object-detail-head">
                <div>
                  <h3>{{ selectedObject.name }}</h3>
                  <p>{{ displayBusinessText(selectedObject.meaning) }}</p>
                </div>
              </div>
            </div>
            <EmptyState v-else title="选择一个业务对象" description="对象说明来自已发布蓝图，不从前端模型推导。" />
          </PanelCard>

          <div class="bp__technical-toggle">
            <el-button size="small" plain @click="showTechnical = !showTechnical">
              {{ showTechnical ? '收起字段明细' : '查看字段明细（实施/培训用）' }}
            </el-button>
          </div>
          <PanelCard v-if="showTechnical" title="字段字典" description="字段含义、责任人和影响范围必须可追溯；本页不展示具体项目的金额数据。" flush>
            <template #extra>
              <div class="bp__field-tools">
                <el-input v-model="fieldKeyword" clearable placeholder="搜索字段、含义或责任人" style="width: 240px" />
                <el-select v-model="fieldObject" style="width: 170px">
                  <el-option label="全部对象" value="all" />
                  <el-option v-for="item in blueprint.objects" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
              </div>
            </template>
            <el-table :data="fields" show-header>
              <el-table-column label="对象" width="170"><template #default="{ row }">{{ objectName(row.object) }}</template></el-table-column>
              <el-table-column label="字段" min-width="190">
                <template #default="{ row }">
                  <strong class="bp__field-label">{{ row.label }}</strong>
                </template>
              </el-table-column>
              <el-table-column prop="meaning" label="含义" min-width="260" />
              <el-table-column prop="owner" label="责任人" min-width="150" />
              <el-table-column prop="impact" label="影响" min-width="260" />
            </el-table>
            <EmptyState v-if="!fields.length" title="没有匹配字段" description="调整关键词或对象筛选后重试。" />
          </PanelCard>
        </main>
      </div>

      <div class="bp__lower">
        <PanelCard title="业务校核项" description="页面只展示已登记校核；具体项目命中情况在项目材料体检中读取。">
          <ul class="bp__check-list">
            <li v-for="item in blueprint.checks" :key="item.id" class="bp__check">
              <div class="bp__check-head">
                <strong>{{ item.label }}</strong>
                <StatusTag :tone="toneOfSeverity(item.severity)" :text="`${severityLabel(item.severity)} · ${scopeLabel(item.scope)}`" />
              </div>
              <p>{{ displayBusinessText(item.condition) }}</p>
              <small>{{ displayBusinessText(item.nextAction) }}</small>
            </li>
          </ul>
        </PanelCard>

        <PanelCard title="例外与未决" description="例外按业务规则处理；未决项不冒充已裁决。">
          <ul class="bp__exception-list">
            <li v-for="item in blueprint.exceptions" :key="item.id">
              <p>{{ displayBusinessText(item.text) }}</p>
            </li>
          </ul>
          <div v-if="blueprint.gaps.length" class="bp__gap">
            <h3>未决业务事项</h3>
            <article v-for="item in blueprint.gaps" :key="item.id">
              <strong>{{ item.label }}</strong>
              <p>{{ displayBusinessText(item.currentImplementation) }}</p>
              <small>{{ displayBusinessText(item.whyNotClosed) }}</small>
            </article>
          </div>
          <EmptyState v-else title="当前没有登记中的蓝图层未决项" description="不等于业务已全部验收；以对账矩阵为准。" />
        </PanelCard>
      </div>

      <PanelCard title="使用说明">
        <p class="bp__footnote">
          本页展示材料业务说明，版本 v{{ blueprint.version }}；日常操作请以项目材料、主材下单和结算页面为准。
        </p>
      </PanelCard>
    </template>
  </div>
</template>

<style scoped lang="scss">
.bp {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5 $space-6 $space-8;
  max-width: 1680px;
  margin: 0 auto;
}

.bp__hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  padding: $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background:
    radial-gradient(circle at 92% 8%, rgba(47, 125, 90, .12), transparent 28%),
    linear-gradient(135deg, $surface-0 0%, $surface-50 100%);
}

.bp__hero-copy { max-width: 900px; }
.bp__kicker { margin: 0 0 $space-2; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .12em; }
.bp__hero h1 { margin: 0 0 $space-2; font-size: $font-display; }
.bp__desc { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.75; }
.bp__hero-actions { display: flex; gap: $space-2; flex-wrap: wrap; justify-content: flex-end; }

.bp__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-3; }
.bp__fact { display: flex; flex-direction: column; gap: 3px; padding: $space-3 $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.bp__fact span, .bp__fact small { color: $text-secondary; font-size: $font-caption; }
.bp__fact strong { font-size: $font-card-title; font-variant-numeric: tabular-nums; }

.bp__layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: $space-4; align-items: start; }
.bp__stages { position: sticky; top: $space-4; display: flex; flex-direction: column; gap: 5px; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.bp__stages-head { display: flex; flex-direction: column; gap: 2px; padding: $space-1 $space-2 $space-3; border-bottom: 1px solid $border-color; margin-bottom: $space-2; }
.bp__stages-head span { font-weight: $font-weight-semibold; }
.bp__stages-head small { color: $text-tertiary; font-size: $font-caption; }
.bp__stage-btn { display: grid; grid-template-columns: 32px minmax(0, 1fr); grid-template-rows: auto auto; gap: 1px $space-2; width: 100%; padding: $space-2 $space-3; border: 0; border-radius: $radius-sm; background: transparent; color: $text-primary; text-align: left; cursor: pointer; }
.bp__stage-btn b { grid-row: 1 / 3; align-self: center; width: 28px; height: 28px; display: grid; place-items: center; border-radius: $radius-pill; background: $surface-100; color: $text-secondary; font-size: $font-caption; }
.bp__stage-btn span { font-size: $font-body-sm; font-weight: $font-weight-medium; }
.bp__stage-btn small { color: $text-tertiary; font-size: $font-caption; }
.bp__stage-btn:hover { background: $surface-50; }
.bp__stage-btn--active { background: $brand-50; }
.bp__stage-btn--active b { background: $brand-500; color: $surface-0; }
.bp__stage-btn--active span { color: $brand-700; }

.bp__main { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }
.bp__stage-actions { display: flex; gap: $space-2; }
.bp__stage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.bp__stage-cell { display: flex; flex-direction: column; gap: 4px; min-height: 76px; padding: $space-3; border-radius: $radius-sm; background: $surface-50; }
.bp__stage-cell span, .bp__stage-system span, .bp__object-detail-grid span, .bp__stage-bottom h3 { color: $text-secondary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.bp__stage-cell strong { font-size: $font-body-sm; line-height: 1.6; }
.bp__stage-system { margin-top: $space-3; padding: $space-3; border-left: 3px solid $brand-400; border-radius: 0 $radius-sm $radius-sm 0; background: $brand-50; }
.bp__stage-system p { margin: 4px 0 0; font-size: $font-body-sm; line-height: 1.7; }
.bp__stage-bottom { display: grid; grid-template-columns: 1.3fr 1fr; gap: $space-4; margin-top: $space-4; }
.bp__stage-bottom h3 { margin: 0 0 $space-2; }
.bp__list { margin: 0; padding-left: 18px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.75; }

.bp__objects { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $space-2; }
.bp__object { display: flex; flex-direction: column; gap: 3px; min-height: 88px; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; color: $text-primary; text-align: left; cursor: pointer; }
.bp__object strong { font-size: $font-body-sm; }
.bp__object span { color: $brand-600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.bp__object small { color: $text-tertiary; font-size: $font-caption; line-height: 1.5; }
.bp__object:hover, .bp__object--active { border-color: $brand-400; background: $brand-50; }
.bp__object-detail { margin-top: $space-4; padding-top: $space-4; border-top: 1px solid $border-color; }
.bp__object-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.bp__object-detail-head h3 { margin: 0; font-size: $font-card-title; }
.bp__object-detail-head p { margin: 4px 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.bp__object-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: $space-3; margin-top: $space-3; }

.bp__field-tools { display: flex; gap: $space-2; }
.bp__field-label { display: block; font-size: $font-body-sm; }
.bp__field-code { display: block; color: $text-tertiary; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }

.bp__lower { display: grid; grid-template-columns: 1.2fr 1fr; gap: $space-4; align-items: start; }
.bp__check-list, .bp__exception-list { display: flex; flex-direction: column; gap: $space-2; margin: 0; padding: 0; list-style: none; }
.bp__check, .bp__exception-list li { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; }
.bp__check-head { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.bp__check p, .bp__exception-list p, .bp__gap p { margin: $space-2 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.65; }
.bp__check small, .bp__exception-list small, .bp__gap small { color: $text-tertiary; font-size: $font-caption; }
.bp__exception-list strong { font-size: $font-body-sm; }
.bp__gap { margin-top: $space-4; padding-top: $space-4; border-top: 1px solid $border-color; }
.bp__gap h3 { margin: 0 0 $space-2; font-size: $font-body-sm; }
.bp__gap article + article { margin-top: $space-3; }

.bp__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.bp__footnote { margin: $space-3 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
.bp__footnote code { padding: 1px 5px; border-radius: $radius-xs; background: $surface-100; }

@media (max-width: 1280px) {
  .bp__objects { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .bp__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .bp { padding: $space-4; }
  .bp__hero { align-items: flex-start; flex-direction: column; }
  .bp__hero-actions { justify-content: flex-start; }
  .bp__layout { grid-template-columns: 1fr; }
  .bp__stages { position: static; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .bp__stages-head { grid-column: 1 / -1; }
  .bp__lower { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .bp__stages { grid-template-columns: 1fr; }
  .bp__stage-grid, .bp__stage-bottom, .bp__object-detail-grid, .bp__objects { grid-template-columns: 1fr; }
  .bp__field-tools { flex-direction: column; width: 100%; }
}
.bp__technical-toggle { display: flex; justify-content: flex-end; }
</style>
