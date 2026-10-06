<script setup lang="ts">
import { computed } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'
import type { QuotePreviewSummary } from '@/domains/trade/preview'

/** 保存状态四态：未保存 / 保存中 / 已保存 / 失败。 */
export type QuoteSaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error'

const props = withDefaults(defineProps<{
  savedAmount: number
  savedSubtotal: number
  /** 编辑预览；未编辑时为 null */
  preview: QuotePreviewSummary | null
  discount: number
  taxRate: number
  saveState: QuoteSaveState
  errorMessage?: string
  lastSavedAt?: string
  dirtyCount?: number
}>(), { errorMessage: '', lastSavedAt: '', dirtyCount: 0 })

const emit = defineEmits<{ retry: [] }>()

const STATE_META: Record<QuoteSaveState, { label: string; tone: StatusTone }> = {
  clean: { label: '已同步', tone: 'done' },
  dirty: { label: '有未保存改动', tone: 'pending' },
  saving: { label: '保存中', tone: 'doing' },
  saved: { label: '已保存', tone: 'done' },
  error: { label: '保存失败', tone: 'blocked' }
}

const stateMeta = computed(() => STATE_META[props.saveState])
const discountText = computed(() =>
  props.discount && props.discount !== 1 ? `${((1 - props.discount) * 100).toFixed(2)}%` : '未设置'
)
</script>

<template>
  <section class="decision">
    <header class="decision__head">
      <h2 class="decision__title">报价决策</h2>
      <StatusTag :tone="stateMeta.tone" :text="stateMeta.label" />
    </header>

    <div class="decision__body">
      <dl class="decision__list">
        <div>
          <dt>服务端已保存</dt>
          <dd><MoneyText :value="savedAmount" size="lg" /></dd>
        </div>
        <div>
          <dt>本次编辑预览</dt>
          <dd>
            <MoneyText v-if="preview" :value="preview.amount" size="lg" />
            <span v-else class="decision__muted">—</span>
          </dd>
        </div>
        <div>
          <dt>与已保存差额</dt>
          <dd>
            <MoneyText v-if="preview" :value="preview.delta" delta />
            <span v-else class="decision__muted">—</span>
          </dd>
        </div>
        <div>
          <dt>区域小计</dt>
          <dd>
            <MoneyText :value="preview ? preview.subtotal : savedSubtotal" />
          </dd>
        </div>
        <div>
          <dt>优惠</dt>
          <dd class="decision__muted">{{ discountText }}</dd>
        </div>
        <div>
          <dt>税率</dt>
          <dd class="decision__muted">{{ ((taxRate || 0) * 100).toFixed(0) }}%</dd>
        </div>
      </dl>

      <p class="decision__note">
        <strong>预览仅供即时核对</strong>，正式金额、优惠和税额保存后以<strong>服务端重算</strong>为准。
      </p>

      <el-alert
        v-if="saveState === 'error'"
        class="decision__alert"
        type="error"
        :closable="false"
        show-icon
        title="保存失败，编辑内容已保留"
      >
        <p class="decision__error-message">{{ errorMessage || '暂不可确认，请重试' }}</p>
        <el-button size="small" type="primary" plain @click="emit('retry')">重试保存</el-button>
      </el-alert>

      <p v-if="lastSavedAt" class="decision__foot">{{ lastSavedAt }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.decision {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.decision__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;
}

.decision__title {
  margin: 0;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
}

.decision__body {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-4;
  overflow: auto;
}

.decision__list {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin: 0;

  > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $space-3;
  }

  dt { font-size: $font-caption; color: $text-secondary; }
  dd { margin: 0; text-align: right; }
}

.decision__muted { font-size: $font-body-sm; color: $text-secondary; }

.decision__note {
  margin: 0;
  padding: $space-3;
  border-radius: $radius-sm;
  background: $warning-50;
  border: 1px solid $warning-200;
  font-size: $font-caption;
  line-height: 1.7;
  color: $warning-700;

  strong { font-weight: $font-weight-semibold; }
}

.decision__alert { margin: 0; }

.decision__error-message {
  margin: 0 0 $space-2;
  color: $danger-500;
  font-size: $font-caption;
  line-height: 1.6;
}

.decision__foot {
  margin: 0;
  font-size: $font-caption;
  color: $text-tertiary;
}
</style>
