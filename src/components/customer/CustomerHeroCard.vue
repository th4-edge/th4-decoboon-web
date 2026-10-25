<script setup lang="ts">
/**
 * 客户主体 Hero（= `ObjectHeroCard` 骨架 + 客户字段映射）。
 *
 * 依据：`WEB-工作台设计构建规范` §4.7——五种主体 Hero 共用同一骨架，差异只在主体字段。
 * L1 当前阶段关注层由**使用页面**通过 `#focus` 插槽传入（§4.7 硬约束 2）。
 */
import { computed, ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import CustomerLossDrawer from '@/components/customer/CustomerLossDrawer.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { portraitItemsOf } from '@/domains/crm/portrait'
import { CUSTOMER_RISK_META, CUSTOMER_SOURCE_LABELS, CUSTOMER_STAGE_META, customerGradeClass, customerGradeLabel } from '@/domains/crm/customerMeta'
import type { Customer, CustomerLossStage } from '@/domains/crm/model'
import { formatRelativeDay } from '@/core/format'

const props = withDefaults(defineProps<{
  customer?: Partial<Customer> | null
  portraitTitle?: string
  portraitHint?: string
  portraitLimit?: number
  /** 覆盖 L2 默认事实（面积/预算/负责人/设计师） */
  facts?: Array<{ label: string; value: string }>
  /** 当前页面对应的签约前阶段；由服务端已返回的业务对象上下文传入。 */
  lossStage?: CustomerLossStage
  /** 当前房屋；为空时只能按客户整体流失。 */
  propertyId?: string
  propertyName?: string
  /** 是否展示流失/恢复入口；服务端仍会再次校验权限与状态。 */
  canManageLoss?: boolean
}>(), {
  customer: null,
  portraitTitle: '客户画像',
  portraitHint: '沟通前先了解需求、预算和决策方式',
  portraitLimit: 4,
  facts: undefined,
  lossStage: undefined,
  propertyId: undefined,
  propertyName: undefined,
  canManageLoss: false
})

const emit = defineEmits<{ lossUpdated: [] }>()
const lossOpen = ref(false)
const lossMode = ref<'mark' | 'restore'>('mark')
const stageMeta = computed(() => CUSTOMER_STAGE_META[(props.customer?.stage ?? 'unknown') as keyof typeof CUSTOMER_STAGE_META] ?? CUSTOMER_STAGE_META.unknown)
const riskMeta = computed(() => {
  const level = props.customer?.riskLevel
  return level ? CUSTOMER_RISK_META[level] ?? { label: '待确认', tone: 'info' as const } : { label: '待确认', tone: 'info' as const }
})
const avatarText = computed(() => (props.customer?.name || '客').slice(0, 1))
function openLoss(mode: 'mark' | 'restore') {
  lossMode.value = mode
  lossOpen.value = true
}

const LOSS_REASON_LABELS: Record<string, string> = {
  ChoseOtherCompany: '选择了其他装修公司',
  PriceBudgetMismatch: '价格或预算不匹配',
  DesignUnsatisfied: '设计方案不满意',
  ScheduleMismatch: '工期或开工时间不匹配',
  SelfOrRelative: '自装或亲友装修',
  ProjectCancelled: '装修计划取消',
  ServiceTrust: '服务或信任问题',
  Other: '其他'
}
const LOSS_STAGE_LABELS: Record<CustomerLossStage, string> = {
  FollowUp: '待跟进', Measure: '量房', Design: '设计', Negotiation: '谈单', Signing: '签约'
}
const lossReasonLabel = computed(() => props.customer?.lossReason ? LOSS_REASON_LABELS[props.customer.lossReason] : '流失原因待确认')
const lossStageLabel = computed(() => props.customer?.lossStage
  ? `流失于${LOSS_STAGE_LABELS[props.customer.lossStage]}阶段`
  : '已流失')
const sourceText = computed(() => {
  const source = props.customer?.source
  if (!source) return '来源待补充'
  return CUSTOMER_SOURCE_LABELS[source] ?? source
})

const portraitItems = computed(() => portraitItemsOf(props.customer?.portrait))
const defaultFacts = computed(() => [
  { label: '面积', value: props.customer?.area ? `${props.customer.area}㎡` : '待补充' },
  { label: '预算', value: props.customer?.budget ? `${props.customer.budget} 万` : '待补充' },
  { label: '负责人', value: props.customer?.ownerName || '待分配' },
  { label: '设计师', value: props.customer?.designerName || '未指派' }
])
const factList = computed(() => props.facts ?? defaultFacts.value)
const portraitExpanded = ref(false)
const visiblePortraitItems = computed(() =>
  portraitExpanded.value ? portraitItems.value : portraitItems.value.slice(0, props.portraitLimit)
)
</script>

<template>
  <ObjectHeroCard>
    <template #avatar>{{ avatarText }}</template>

    <template #title>
      <!-- 本页对象信息（如待我量房的「房屋名「明细」」）置于客户名之前 -->
      <slot name="title-prefix" />
      <h2>{{ customer?.name || '客户待完善' }}</h2>
      <span class="chero__grade" :class="customerGradeClass(customer?.grade)">{{ customerGradeLabel(customer?.grade) }}</span>
      <StatusTag :tone="stageMeta.tone" :text="stageMeta.label" :dot="false" />
      <StatusTag :tone="riskMeta.tone" :text="riskMeta.label" :dot="false" />
      <!-- 本页对象信息追加到标题行（如「· 恒大绿洲3栋1802 [已量房]」） -->
      <slot name="title-extra" />
    </template>

    <template #subtitle>
      {{ customer?.phone || '电话待补充' }} · {{ sourceText }}
      · {{ customer?.community || customer?.addr || '房屋待补充' }}
    </template>

    <template v-if="$slots['object-context']" #object-context><slot name="object-context" /></template>

    <template #chips>
      <StatusTag :tone="customer?.wechatAdded ? 'done' : 'muted'" :text="customer?.wechatAdded ? '已加微信' : '未加微信'" :dot="false" />
      <StatusTag :tone="(customer?.visitCount || 0) > 0 ? 'doing' : 'muted'" :text="`到店 ${customer?.visitCount || 0} 次`" :dot="false" />
      <StatusTag v-if="customer?.lastVisitAt" tone="info" :text="`最近到店 ${formatRelativeDay(customer.lastVisitAt)}`" :dot="false" />
      <StatusTag v-for="tag in customer?.tags?.slice(0, 5) || []" :key="tag" tone="info" :text="tag" :dot="false" />
      <StatusTag
        v-if="customer?.stage === 'lost' && customer?.lossStage"
        tone="blocked"
        :text="lossStageLabel"
        :dot="false"
      />
      <StatusTag v-else-if="customer?.partialLoss" tone="blocked" text="存在房屋已流失" :dot="false" />
    </template>

    <template v-if="$slots.focus" #focus><slot name="focus" /></template>

    <template #facts>
      <div v-for="fact in factList" :key="fact.label">
        <small>{{ fact.label }}</small><b>{{ fact.value }}</b>
      </div>
    </template>

    <template #extra>
      <section v-if="customer?.stage === 'lost' || customer?.partialLoss" class="chero__loss">
        <div class="chero__loss-head">
          <strong>{{ customer?.stage === 'lost' ? '客户已流失' : '部分房屋已流失' }}</strong>
          <span>{{ lossStageLabel }}</span>
        </div>
        <p>{{ lossReasonLabel }}<template v-if="customer?.lossPropertyName"> · {{ customer.lossPropertyName }}</template></p>
        <p v-if="customer?.competitorName">对比公司：{{ customer.competitorName }}</p>
        <p v-if="customer?.lossReasonText">{{ customer.lossReasonText }}</p>
        <small v-if="customer?.lostAt">记录于 {{ formatRelativeDay(customer.lostAt) }}<template v-if="customer?.lostByName"> · {{ customer.lostByName }}</template></small>
      </section>
      <div class="chero__portrait-head">
        <div><strong>{{ portraitTitle }}</strong><small>{{ portraitHint }}</small></div>
        <slot name="portrait-action" />
      </div>
      <div v-if="portraitItems.length" class="chero__portrait-chips">
        <span v-for="item in visiblePortraitItems" :key="item.key"><small>{{ item.label }}</small>{{ item.value }}</span>
        <button v-if="portraitItems.length > portraitLimit" class="chero__text-button" type="button" @click="portraitExpanded = !portraitExpanded">
          {{ portraitExpanded ? '收起' : `查看全部 ${portraitItems.length} 项` }}
        </button>
      </div>
      <p v-else class="chero__portrait-empty">画像还没填写。先记下装修目的、开工窗口和风格偏好，后续工作会更准确。</p>
    </template>

    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    <template #actions>
      <button
        v-if="canManageLoss && customer?.id && customer?.lossId && (customer?.stage === 'lost' || customer?.partialLoss)"
        type="button"
        class="chero__loss-action"
        @click="openLoss('restore')"
      >
        {{ customer?.stage === 'lost' ? '恢复客户' : '恢复已流失房屋' }}
      </button>
      <button
        v-if="canManageLoss && customer?.id && customer?.stage !== 'lost' && customer?.stage !== 'sign' && customer?.stage !== 'construction' && customer?.stage !== 'done'"
        type="button"
        class="chero__loss-action"
        @click="openLoss('mark')"
      >
        标记流失
      </button>
      <slot name="actions" />
    </template>

  </ObjectHeroCard>
    <CustomerLossDrawer
      v-if="customer?.id"
      v-model="lossOpen"
      :customer="customer"
      :property-id="propertyId"
      :property-name="propertyName"
      :loss-stage="lossStage"
      :mode="lossMode"
      @updated="emit('lossUpdated')"
    />
</template>

<style scoped lang="scss">
.chero__grade { padding: 3px 9px; border-radius: $radius-pill; font-size: $font-caption; font-weight: $font-weight-semibold; }
.chero__grade.grade--a { color: $success-500; background: $success-50; }
.chero__grade.grade--b { color: $warning-700; background: $warning-50; }
.chero__grade.grade--c,
.chero__grade.grade--none { color: $text-tertiary; background: $surface-100; }

.chero__portrait-head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.chero__portrait-head strong { color: $text-primary; font-size: $font-body-sm; }
.chero__portrait-head small { display: block; margin-top: 2px; color: $text-tertiary; font-size: $font-caption; }
.chero__portrait-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: $space-2; }
.chero__portrait-chips > span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; }
.chero__portrait-chips small { color: $text-tertiary; }
.chero__text-button { padding: 0; border: 0; background: transparent; color: $brand-600; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.chero__loss { margin-bottom: $space-3; padding: $space-3; border: 1px solid $danger-200; border-radius: $radius-md; background: $danger-50; }
.chero__loss-head { display: flex; justify-content: space-between; gap: $space-3; color: $danger-500; }
.chero__loss-head span { font-size: $font-caption; }
.chero__loss p { margin: 6px 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.55; }
.chero__loss small { display: block; margin-top: 6px; color: $text-tertiary; font-size: $font-caption; }
.chero__loss-action { padding: 6px 12px; border: 1px solid $danger-200; border-radius: $radius-md; background: $surface-0; color: $danger-500; font: inherit; font-size: $font-caption; font-weight: $font-weight-semibold; cursor: pointer; }
.chero__portrait-empty { margin: $space-2 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
</style>
