<!--
  停用（2026-10-09）：按用户裁决，中栏**只保留一张 Hero**（客户为基准形态 + 本页对象信息行）。
  "房屋主体 Hero"与本模型冲突；房屋信息改为 Hero 内的「本次房屋」行 + Hero 下方「房屋信息」块。
  保留于 _停用/ 以便追溯。
-->
<script setup lang="ts">
/**
 * 房屋主体 Hero（= `ObjectHeroCard` 骨架 + 房屋字段映射）。
 *
 * 依据：`WEB-工作台设计构建规范` §4.7——与 `CustomerHeroCard` 共用同一骨架，差异只在主体字段：
 *   L0 身份 = 房屋名 / 房屋状态 / 地址（+ 客户归属）
 *   标签行   = 面积 / 户型 / 小区楼栋房号
 *   L2 事实  = 量房进度 / 原始结构 / 现场证据
 * L1 当前阶段关注层由使用页面通过 `#focus` 插槽传入。
 * 状态标签一律显示**房屋状态**（`domains/property/statusMeta`），不得用客户状态或任务状态代替。
 */
import { computed } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import ObjectHeroCard from '@/components/workbench/ObjectHeroCard.vue'
import { propertyStatusMeta } from '@/domains/property/statusMeta'
import type { StatusTone } from '@/core/tone'

const props = withDefaults(defineProps<{
  propertyName?: string | null
  propertyStatus?: string | null
  propertyStatusName?: string | null
  address?: string | null
  community?: string | null
  building?: string | null
  roomNo?: string | null
  area?: number | null
  layout?: string | null
  /** 归属客户（降为副行信息） */
  customerName?: string | null
  customerPhone?: string | null
  /** 房屋侧风险（可选） */
  riskLabel?: string
  riskTone?: StatusTone
  /** L2 事实 */
  measureProgress?: string | null
  originalStructure?: string | null
  evidenceText?: string | null
  facts?: Array<{ label: string; value: string }>
}>(), {
  propertyName: '',
  propertyStatus: null,
  propertyStatusName: null,
  address: null,
  community: null,
  building: null,
  roomNo: null,
  area: null,
  layout: null,
  customerName: null,
  customerPhone: null,
  riskLabel: '',
  riskTone: undefined,
  measureProgress: null,
  originalStructure: null,
  evidenceText: null,
  facts: undefined
})

const statusMeta = computed(() => propertyStatusMeta(props.propertyStatus, props.propertyStatusName))
const locationText = computed(() => {
  const parts = [props.community, props.building, props.roomNo].filter(Boolean)
  return parts.length ? parts.join(' · ') : (props.address || '房屋地址待完善')
})
const defaultFacts = computed(() => [
  { label: '量房进度', value: props.measureProgress || '未预约' },
  { label: '原始结构', value: props.originalStructure || '未记录' },
  { label: '现场证据', value: props.evidenceText || '暂无' }
])
const factList = computed(() => props.facts ?? defaultFacts.value)
</script>

<template>
  <ObjectHeroCard>
    <template #avatar>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></svg>
    </template>

    <template #title>
      <h2>{{ propertyName || '房屋待建立' }}</h2>
      <StatusTag :tone="statusMeta.tone" :text="statusMeta.label" :dot="false" />
      <StatusTag v-if="riskLabel" :tone="riskTone || 'pending'" :text="riskLabel" :dot="false" />
    </template>

    <template #subtitle>
      <template v-if="customerName">客户：{{ customerName }}<template v-if="customerPhone"> · {{ customerPhone }}</template> · </template>{{ address || locationText }}
    </template>

    <template #chips>
      <StatusTag v-if="area" tone="info" :text="`${area}㎡`" :dot="false" />
      <StatusTag v-if="layout" tone="info" :text="layout" :dot="false" />
      <StatusTag tone="muted" :text="locationText" :dot="false" />
    </template>

    <template v-if="$slots.focus" #focus><slot name="focus" /></template>

    <template #facts>
      <div v-for="fact in factList" :key="fact.label">
        <small>{{ fact.label }}</small><b>{{ fact.value }}</b>
      </div>
    </template>

    <template v-if="$slots.extra" #extra><slot name="extra" /></template>
    <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </ObjectHeroCard>
</template>
