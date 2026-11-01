<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { blueprintApi } from '@/domains/blueprint/api'
import type {
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
    .replace(/报价成本快照冻结/g, '报价成本记录已锁定')
    .replace(/快照/g, '记录')
    .replace(/业务助手和页面只使用当前用户数据范围；越权统一拒绝。/g, '业务助手只使用您当前有权访问的数据。')
    .replace(/当前品类模板中 设为必填 的单据头字段为空/g, '当前作业单缺少该类材料要求的必填测量信息')
    .replace(/拒绝提交并提示缺失字段；模板配置错误进入配置检查/g, '补齐必填信息后再提交；如模板配置有误，请联系管理员')
    .replace(/拒绝登记并核对采购单/g, '不能登记，请核对采购单')
    .replace(/拒绝直接取消/g, '不能直接取消')
    .replace(/项目级材料需求事实/g, '项目级材料需求记录')
    .replace(/平台品类基线 L1 \+ 企业个性化 L2/g, '平台提供品类基础模板，企业可在此基础上调整')
    .replace(/在建单时取企业发布版本并冻结版本，字段只能改显隐、必填、顺序和别名。/g, '建单时使用企业已发布的模板版本，并记录显示项、必填项、顺序和名称。')
    .replace(/部分到场推进\s*部分到场/g, '部分到场按实际到场数量推进')
    .replace(/当前系统没有独立经销商实体，按 供应商\/工厂 等类型区分。/g, '统一合作方；供应商、经销商和工厂通过类型区分。')
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
  if (value === 'ready-for-implementation') return '已发布'
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
          查看材料从选材、下单、到场到结算的流程和规则。日常操作请前往项目材料、主材下单或结算页面。
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
      title="材料业务说明暂不可确认"
      description="请刷新重试；如仍无法查看，请联系企业管理员。"
    />

    <template v-else-if="blueprint && runtime">
      <section class="bp__facts" aria-label="材料说明版本">
        <article class="bp__fact">
          <span>说明版本</span>
          <strong>v{{ runtime.version }}</strong>
          <small>{{ statusLabel(runtime.status) }}</small>
        </article>
        <article class="bp__fact">
          <span>适用规则</span>
          <strong>{{ runtime.sourceRefCount }} 条</strong>
          <small>当前有效规则</small>
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
            <small>按流程顺序</small>
          </div>
          <button
            v-for="(item, index) in blueprint.stages"
            :key="item.id"
            type="button"
            class="bp__stage-btn"
            :class="{ 'bp__stage-btn--active': item.id === activeStageId }"
            :aria-current="item.id === activeStageId ? 'step' : undefined"
            @click="selectStage(item.id)"
          >
            <b>{{ index + 1 }}</b>
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
                <span>进入条件</span>
                <strong>{{ displayBusinessText(stage.trigger) }}</strong>
              </div>
              <div class="bp__stage-cell">
                <span>形成结果</span>
                <strong>{{ displayBusinessText(stage.output) }}</strong>
              </div>
              <div class="bp__stage-cell">
                <span>金额记录</span>
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
              <span>接下来做什么</span>
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

          <PanelCard title="相关业务对象" description="点击查看该对象在材料流程中的作用。">
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
            <EmptyState v-else title="选择一个业务对象" description="选择后查看该对象在材料流程中的作用。" />
          </PanelCard>

        </main>
      </div>

      <div class="bp__lower">
        <PanelCard title="材料检查要点" description="用于核对材料业务的完整性和下一步处理。">
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

        <PanelCard title="常见例外" description="以下情况按对应业务规则处理。">
          <ul class="bp__exception-list">
            <li v-for="item in blueprint.exceptions" :key="item.id">
              <p>{{ displayBusinessText(item.text) }}</p>
            </li>
          </ul>
          <EmptyState v-if="!blueprint.exceptions.length" title="当前没有额外例外" description="材料流程按常规规则处理即可。" />
        </PanelCard>
      </div>

      <PanelCard title="说明">
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
    radial-gradient(circle at 92% 8%, var(--zdq-brand-a12, rgba(47, 125, 90, .12)), transparent 28%),
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
