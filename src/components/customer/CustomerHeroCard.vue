<script setup lang="ts">
/**
 * 客户主体 Hero（= `ObjectHeroCard` 骨架 + 客户字段映射）。
 *
 * 依据：`WEB-工作台设计构建规范` §4.7——五种主体 Hero 共用同一骨架，差异只在主体字段。
 * L1 当前阶段关注层由**使用页面**通过 `#focus` 插槽传入（§4.7 硬约束 2）。
 */
import { computed, ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { portraitItemsOf } from '@/domains/crm/portrait'
import { CUSTOMER_RISK_META, CUSTOMER_SOURCE_LABELS, CUSTOMER_STAGE_META, customerGradeClass, customerGradeLabel } from '@/domains/crm/customerMeta'
import type { Customer } from '@/domains/crm/model'
import { formatRelativeDay } from '@/core/format'

const props = withDefaults(defineProps<{
  customer?: Partial<Customer> | null
  portraitTitle?: string
  portraitHint?: string
  portraitLimit?: number
  /** 覆盖 L2 默认事实（面积/预算/负责人/设计师） */
  facts?: Array<{ label: string; value: string }>
}>(), {
  customer: null,
  portraitTitle: '客户画像',
  portraitHint: '沟通前先了解需求、预算和决策方式',
  portraitLimit: 4,
  facts: undefined
})

const stageMeta = computed(() => CUSTOMER_STAGE_META[(props.customer?.stage ?? 'unknown') as keyof typeof CUSTOMER_STAGE_META] ?? CUSTOMER_STAGE_META.unknown)
const riskMeta = computed(() => {
  const level = props.customer?.riskLevel
  return level ? CUSTOMER_RISK_META[level] ?? { label: '待确认', tone: 'info' as const } : { label: '待确认', tone: 'info' as const }
})
const avatarText = computed(() => (props.customer?.name || '客').slice(0, 1))
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
    </template>

    <template v-if="$slots.focus" #focus><slot name="focus" /></template>

    <template #facts>
      <div v-for="fact in factList" :key="fact.label">
        <small>{{ fact.label }}</small><b>{{ fact.value }}</b>
      </div>
    </template>

    <template #extra>
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
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </ObjectHeroCard>
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
.chero__portrait-empty { margin: $space-2 0 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
</style>
