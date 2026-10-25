<script setup lang="ts">
/**
 * 设计方案卡片组。
 *
 * 依据：`WEB-工作台设计构建规范` §4.8——待我设计只展示当前房屋下的方案概览和状态变迁；
 * 方案推进、设计项编辑、报价等业务操作必须进入方案工作台，卡片只保留复制、删除。
 */
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import { formatDateTime } from '@/core/format'
import type { StatusTone } from '@/core/tone'
import type { DesignScheme } from '@/domains/design/model'

const props = withDefaults(defineProps<{
  schemes: DesignScheme[]
  selectedId: string
  statusLabels: Record<string, string>
  statusTones: Record<string, StatusTone>
  busyId?: string
}>(), { busyId: '' })

const emit = defineEmits<{
  open: [scheme: DesignScheme]
  copy: [scheme: DesignScheme]
  delete: [scheme: DesignScheme]
}>()

const steps = [
  { value: 'draft', label: '设计中' },
  { value: 'ready', label: '待谈单' },
  { value: 'presented', label: '已讲解' },
  { value: 'selected', label: '已选中' }
] as const

function toneOf(status: string): StatusTone {
  return props.statusTones[status] ?? 'info'
}

function labelOf(scheme: DesignScheme): string {
  return props.statusLabels[scheme.status] ?? scheme.status
}

function currentStepIndex(scheme: DesignScheme): number {
  return steps.findIndex((step) => step.value === scheme.status)
}

function canDelete(scheme: DesignScheme): boolean {
  return scheme.status === 'draft'
}

function primaryPrice(scheme: DesignScheme): number | null {
  if (scheme.priceSource === 'quote') return scheme.currentQuoteAmount ?? null
  if (scheme.priceSource === 'calculated') return scheme.calculatedAmount
  return null
}

function priceLabel(scheme: DesignScheme): string {
  if (scheme.priceSource === 'quote') {
    return `当前正式报价${scheme.currentQuoteNo ? ` · ${scheme.currentQuoteNo}` : ''}`
  }
  if (scheme.priceSource === 'calculated') return '方案计算价 · 待生成正式报价'
  return '尚无设计分项 · 暂不可计算'
}
</script>

<template>
  <section v-if="schemes.length" class="scheme-cards" aria-label="设计方案">
    <article
      v-for="scheme in schemes"
      :key="scheme.id"
      class="scheme-card"
      :class="{ active: scheme.id === selectedId }"
      @click="emit('open', scheme)"
    >
      <header class="scheme-card__head">
        <div>
          <strong>{{ scheme.name || '方案待命名' }}</strong>
          <small>{{ scheme.no || '编号待确认' }} · V{{ scheme.version }}<template v-if="scheme.style"> · {{ scheme.style }}</template></small>
        </div>
        <StatusTag :tone="toneOf(scheme.status)" :text="labelOf(scheme)" :dot="false" />
      </header>

      <div class="scheme-card__price">
        <div>
          <small>{{ priceLabel(scheme) }}</small>
          <strong v-if="primaryPrice(scheme) !== null"><MoneyText :value="primaryPrice(scheme)" size="lg" /></strong>
          <strong v-else class="scheme-card__price-empty">暂不可计算</strong>
        </div>
        <span v-if="scheme.currentQuoteStatusName" class="scheme-card__quote-state">{{ scheme.currentQuoteStatusName }}</span>
      </div>

      <div class="scheme-card__facts">
        <span><small>面积</small><b>{{ scheme.area ? `${scheme.area}㎡` : '待补充' }}</b></span>
        <span><small>空间</small><b>{{ scheme.spaceCount }} 个</b></span>
        <span><small>设计项</small><b>{{ scheme.itemCount }} 项</b></span>
        <span><small>最近更新</small><b>{{ formatDateTime(scheme.updatedAt) || '待确认' }}</b></span>
        <span v-if="scheme.priceSource === 'quote'"><small>方案计算价</small><b>¥{{ scheme.calculatedAmount.toFixed(2) }}</b></span>
      </div>

      <ol class="scheme-card__flow" :class="{ 'scheme-card__flow--archived': scheme.status === 'archived' }">
        <li
          v-for="(step, index) in steps"
          :key="step.value"
          :class="{ done: currentStepIndex(scheme) >= index, current: currentStepIndex(scheme) === index }"
        >
          <i />
          <small>{{ step.label }}</small>
        </li>
      </ol>

      <footer class="scheme-card__foot">
        <span>点击卡片进入方案工作台</span>
        <div>
          <button type="button" class="scheme-card__action" :disabled="busyId === scheme.id" @click.stop="emit('copy', scheme)">复制</button>
          <button
            type="button"
            class="scheme-card__action scheme-card__action--danger"
            :disabled="!canDelete(scheme) || busyId === scheme.id"
            :title="canDelete(scheme) ? '复制或删除方案' : '只有设计中的方案可以删除'"
            @click.stop="emit('delete', scheme)"
          >删除</button>
        </div>
      </footer>
    </article>
  </section>
</template>

<style scoped lang="scss">
.scheme-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: $space-3;
  overflow: visible;
  padding-bottom: 2px;
}

.scheme-card {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  cursor: pointer;
  transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;

  &:hover { border-color: $brand-300; box-shadow: $shadow-card; transform: translateY(-1px); }
  &.active { border-color: $brand-500; box-shadow: inset 0 0 0 1px $brand-200; }
}

.scheme-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.scheme-card__head > div { min-width: 0; }
.scheme-card__head strong { display: block; overflow: hidden; color: $text-primary; font-size: $font-title; text-overflow: ellipsis; white-space: nowrap; }
.scheme-card__head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }

.scheme-card__price {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-3;
  border: 1px solid $brand-100;
  border-radius: $radius-sm;
  background: $brand-50;

  > div { min-width: 0; }
  small { display: block; color: $text-secondary; font-size: $font-caption; }
  strong { display: block; margin-top: 3px; color: $brand-700; }
}

.scheme-card__price-empty {
  color: $text-secondary !important;
  font-size: $font-body-sm !important;
}

.scheme-card__quote-state {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $surface-0;
  font-size: $font-caption;
}

.scheme-card__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 12px;
  padding: 10px;
  border-radius: $radius-sm;
  background: $surface-50;

  span { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  small { color: $text-tertiary; font-size: $font-caption; }
  b { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
}

.scheme-card__flow {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;

  li { position: relative; display: flex; flex: 1; flex-direction: column; align-items: center; gap: 5px; min-width: 0; }
  li:not(:last-child)::after { position: absolute; top: 5px; left: calc(50% + 7px); width: calc(100% - 14px); height: 1px; background: $border-color; content: ''; }
  i { position: relative; z-index: 1; width: 11px; height: 11px; border: 2px solid $surface-0; border-radius: 50%; background: $border-color; box-shadow: 0 0 0 1px $border-color; }
  small { overflow: hidden; max-width: 100%; color: $text-tertiary; font-size: $font-caption; text-overflow: ellipsis; white-space: nowrap; }
  li.done i { background: $brand-500; box-shadow: 0 0 0 1px $brand-500; }
  li.done:not(:last-child)::after { background: $brand-300; }
  li.current i { box-shadow: 0 0 0 3px $brand-100; }
  li.current small { color: $brand-700; font-weight: $font-weight-semibold; }
}

.scheme-card__flow--archived { opacity: .55; }

.scheme-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding-top: $space-2;
  border-top: 1px solid $border-color;

  > span { color: $text-tertiary; font-size: $font-caption; }
  > div { display: flex; gap: 6px; }
}

.scheme-card__action {
  padding: 5px 9px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $text-secondary;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: $brand-300; background: $brand-50; color: $brand-700; }
  &:disabled { cursor: not-allowed; opacity: .5; }
}

.scheme-card__action--danger:hover:not(:disabled) { border-color: $danger-200; background: $danger-50; color: $danger-500; }
</style>
