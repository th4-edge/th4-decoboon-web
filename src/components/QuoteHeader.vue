<script setup lang="ts">
import { computed } from 'vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import type { QuoteSaveState } from '@/components/QuoteDecisionPanel.vue'
import type { QuoteStatus } from '@/domains/trade/model'

const props = withDefaults(defineProps<{
  quoteNo: string
  version: number
  status: QuoteStatus
  title?: string
  customerName?: string
  propertyLine?: string
  savedAmount: number
  saveState: QuoteSaveState
  dirtyCount?: number
  saving?: boolean
  submitting?: boolean
  canSave?: boolean
  /** 已由设计确认可编辑（Draft） */
  editable?: boolean
  immersive?: boolean
  browserFullscreen?: boolean
}>(), {
  title: '', customerName: '客户待确认', propertyLine: '房屋待确认',
  dirtyCount: 0, saving: false, submitting: false, canSave: false, editable: false,
  immersive: false, browserFullscreen: false
})

const emit = defineEmits<{
  back: []
  save: []
  submit: []
  'toggle-immersive': []
  'toggle-browser-fullscreen': []
  'open-version-diff': []
}>()

const saveHint = computed(() => {
  if (props.saveState === 'saving') return '保存中…'
  if (props.saveState === 'error') return '保存失败，可重试'
  if (props.saveState === 'dirty') return `有 ${props.dirtyCount} 行未保存`
  if (props.saveState === 'saved') return '已保存并重算'
  return '服务端已同步'
})
</script>

<template>
  <header class="qhead">
    <div class="qhead__identity">
      <div class="qhead__icon" aria-hidden="true">¥</div>
      <div class="qhead__text">
        <h1 class="qhead__title">{{ customerName }} · 区域报价</h1>
        <p class="qhead__sub">{{ propertyLine }}</p>
        <div class="qhead__tags">
          <BusinessStateTag object-key="quote" :status-key="status" />
          <StatusTag tone="muted" :text="`V${version}`" :dot="false" />
          <StatusTag tone="info" :text="quoteNo" :dot="false" />
          <span class="qhead__save" :data-state="saveState">{{ saveHint }}</span>
        </div>
      </div>
    </div>

    <div class="qhead__amount">
      <span class="qhead__amount-label">服务端正式总额</span>
      <MoneyText :value="savedAmount" size="lg" />
      <small class="qhead__amount-note">成本与利润不向设计师展示</small>
    </div>

    <div class="qhead__actions">
      <el-button @click="emit('back')">返回</el-button>
      <el-button @click="emit('open-version-diff')">版本对比</el-button>
      <el-button :loading="saving" :disabled="!canSave" @click="emit('save')">
        保存草稿{{ dirtyCount ? `（${dirtyCount}）` : '' }}
      </el-button>
      <el-button v-if="editable" type="primary" :loading="submitting" :disabled="dirtyCount > 0" @click="emit('submit')">
        提交客户确认
      </el-button>
      <el-button @click="emit('toggle-immersive')">
        {{ immersive ? '退出工作区全屏' : '工作区全屏' }}
      </el-button>
      <el-button @click="emit('toggle-browser-fullscreen')">
        {{ browserFullscreen ? '退出屏幕全屏' : '屏幕全屏' }}
      </el-button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.qhead {
  display: grid;
  grid-template-columns: minmax(320px, 1.1fr) minmax(190px, .65fr) auto;
  gap: $space-4;
  align-items: center;
  padding: $space-3 $space-4;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  box-shadow: $shadow-card;
}

.qhead__identity {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
}

.qhead__icon {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  background: $brand-50;
  border: 1px solid $brand-100;
  color: $brand-700;
  font-size: $font-title;
  font-weight: $font-weight-semibold;
}

.qhead__text { min-width: 0; }

.qhead__title {
  margin: 0;
  font-size: $font-card-title;
  font-weight: $font-weight-semibold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qhead__sub {
  margin: 2px 0 0;
  font-size: $font-caption;
  color: $text-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qhead__tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
  margin-top: $space-2;
}

.qhead__save {
  font-size: $font-caption;
  color: $text-secondary;

  &[data-state='dirty'] { color: $warning-700; }
  &[data-state='error'] { color: $danger-500; }
  &[data-state='saved'] { color: $success-500; }
}

.qhead__amount {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &-label { font-size: $font-caption; color: $text-secondary; }
  &-note { font-size: $font-caption; color: $text-tertiary; }
}

.qhead__actions {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2;
  justify-content: flex-end;
}

@media (max-width: 1280px) {
  .qhead { grid-template-columns: minmax(280px, 1fr) minmax(170px, .6fr); }
  .qhead__actions { grid-column: 1 / -1; justify-content: flex-start; }
}
</style>
