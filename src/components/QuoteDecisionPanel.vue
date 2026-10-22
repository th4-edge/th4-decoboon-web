<script setup lang="ts">
import { computed } from 'vue'
import MoneyText from '@/components/MoneyText.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/core/tone'
import type { QuotePreviewSummary } from '@/domains/trade/preview'
import type { QuoteStatus } from '@/domains/trade/model'

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
  /** 报价状态：用于展示接棒与去向，避免提交后流程「停在原地」（XA-20261011-004）。 */
  quoteStatus?: QuoteStatus | null
}>(), { errorMessage: '', lastSavedAt: '', dirtyCount: 0, quoteStatus: null })

const emit = defineEmits<{ retry: [] }>()

const STATE_META: Record<QuoteSaveState, { label: string; tone: StatusTone }> = {
  clean: { label: '已同步', tone: 'done' },
  dirty: { label: '有未保存改动', tone: 'pending' },
  saving: { label: '保存中', tone: 'doing' },
  saved: { label: '已保存', tone: 'done' },
  error: { label: '保存失败', tone: 'blocked' }
}

const stateMeta = computed(() => STATE_META[props.saveState])

/**
 * 接棒与去向：只陈述服务端状态事实与已确定的角色矩阵，不推断未裁决的责任人。
 * 「客户接受报价的登记责任人」尚未裁决，这里不写死，由 GAP-WEB-017 跟踪。
 */
const handoff = computed<{ owner: string; text: string; entry: string } | null>(() => {
  switch (props.quoteStatus) {
    case 'draft':
      return {
        owner: '设计师（本页）',
        text: '当前为草稿，设计师可继续编辑与保存；提交客户确认后本页转为只读。',
        entry: '提交客户确认'
      }
    case 'submitted':
      return {
        owner: '设计师（本页登记客户接受）',
        text: '客户在小程序决策。客户接受后，由设计师在本页「登记客户已接受」；登记后由企业负责人 / 店长在「待我签约」确认签约并发起合同。驳回则回到可改版重报。',
        entry: '登记客户已接受'
      }
    case 'accepted':
      return {
        owner: '企业负责人 / 店长',
        text: '客户已接受（已由设计师登记），由企业负责人或店长确认签约并确认生效；生效后生成项目，交项目经理承接。',
        entry: '待我签约'
      }
    case 'rejected':
      return {
        owner: '设计师（本页）',
        text: '客户已驳回，请改版重报后再次提交客户确认。',
        entry: '改版重报'
      }
    case 'superseded':
      return {
        owner: '设计师（本人）',
        text: '当前版本已被新版本替代，请查看当前版本再继续。',
        entry: '查看当前版本'
      }
    case 'converted':
      return {
        owner: '企业负责人 / 店长',
        text: '报价已转项目，后续由合同与项目链路承接。',
        entry: '待我签约'
      }
    default:
      return null
  }
})
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
          <dt>已保存金额</dt>
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
        <strong>预览仅供即时核对</strong>，正式金额、优惠和税额保存后自动更新。
      </p>

      <section v-if="handoff" class="decision__handoff">
        <p class="decision__handoff-eyebrow">下一步与去向</p>
        <dl>
          <div><dt>下一责任方</dt><dd>{{ handoff.owner }}</dd></div>
          <div><dt>入口</dt><dd>{{ handoff.entry }}</dd></div>
        </dl>
        <p class="decision__handoff-text">{{ handoff.text }}</p>
      </section>

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

.decision__handoff {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  padding: $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-50;
}

.decision__handoff-eyebrow {
  margin: 0;
  color: $brand-600;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
}

.decision__handoff dl { display: grid; gap: 6px; margin: 0; }
.decision__handoff dl div { display: flex; align-items: center; justify-content: space-between; gap: $space-3; }
.decision__handoff dt { color: $text-tertiary; font-size: $font-caption; }
.decision__handoff dd { margin: 0; color: $text-primary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.decision__handoff-text { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }

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
