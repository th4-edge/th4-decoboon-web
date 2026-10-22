<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { statisticApi } from '@/domains/statistic/api'
import type { MetricDefinition } from '@/domains/statistic/model'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

/**
 * 「财务数字怎么算？」口径释义区块（对齐 App `JzMetricGlossary`）。
 * 依据 `DEC-018 / BR-016`：口径必须能在产品内查看——包括来源、公式、时间口径、包含与排除、缺失值规则。
 * 口径唯一来源是服务端指标字典；前端只展示，不改写、不兜底。
 */
const definitions = ref<MetricDefinition[]>([])
const expanded = ref<string[]>([])
const loading = ref(false)
const error = ref('')

/** 最容易混的几笔钱：用一句话说清彼此差别（与字典口径一致的产品文案）。 */
const confusions: Array<{ label: string; text: string }> = [
  { label: '累计收款', text: '从开始用系统到现在，客户实际交到公司账上的钱，含已结清归档的项目；不含手工登记的其他收入与退款冲减。' },
  { label: '本月回款', text: '只看本月按收款日期实际收到的客户款项，含历史归档项目收到的钱。' },
  { label: '资金收入', text: '本月资金台账里的全部收入，除客户回款外还包含手工登记的其他收入——口径比「本月回款」宽。' },
  { label: '已收金额', text: '只看现在还在管的项目：应收节点上「已确认收到」的金额，是按合同节点勾稽的结果，不是现金口径。' },
  { label: '现金流', text: '本月资金收入减资金支出，是钱的进出，不是利润。' }
]

const financeMetrics = computed(() => definitions.value.filter((item) => item.category === 'finance'))

onMounted(load)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    definitions.value = await statisticApi.metricDictionary()
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '指标口径暂不可确认'
  } finally { loading.value = false }
}

function toggle(key: string): void {
  expanded.value = expanded.value.includes(key)
    ? expanded.value.filter((item) => item !== key)
    : [...expanded.value, key]
}

function statusLabel(status: string): string {
  if (status === 'verified') return '已核对'
  if (status === 'approved') return '已批准'
  if (status) return status
  return '待确认'
}
</script>

<template>
  <PanelCard title="财务数字怎么算？" description="口径说明来自指标说明；来源、公式、时间口径、包含与排除、缺失值规则均可展开查看。" flush>
    <template #extra>
      <el-button text type="primary" @click="load">刷新口径</el-button>
    </template>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <SkeletonBlock v-else-if="loading && !definitions.length" variant="table" :rows="4" />

    <template v-else>
      <div class="glossary__confusions">
        <p class="glossary__confusions-title">最容易混的几笔钱</p>
        <dl>
          <div v-for="item in confusions" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.text }}</dd>
          </div>
        </dl>
      </div>

      <EmptyState
        v-if="!financeMetrics.length"
        title="暂无可展示的财务口径"
        description="当前暂未获取财务指标说明，请稍后刷新。"
      />
      <div v-else class="glossary__list">
        <div v-for="metric in financeMetrics" :key="metric.key" class="glossary__item">
          <button type="button" class="glossary__head" @click="toggle(metric.key)">
            <span class="glossary__name">
              {{ metric.name }}
              <small v-if="metric.userLabel">（{{ metric.userLabel }}）</small>
            </span>
            <span class="glossary__meta">
              <StatusTag :text="statusLabel(metric.status)" :tone="metric.status === 'verified' || metric.status === 'approved' ? 'done' : 'todo'" />
              <span class="glossary__toggle">{{ expanded.includes(metric.key) ? '收起' : '展开' }}</span>
            </span>
          </button>
          <p class="glossary__definition">{{ metric.definition || '口径说明待确认' }}</p>
          <dl v-if="expanded.includes(metric.key)" class="glossary__detail">
            <div v-if="metric.formula"><dt>怎么算</dt><dd>{{ metric.formula }}</dd></div>
            <div v-if="metric.source"><dt>数据来源</dt><dd>{{ metric.source }}</dd></div>
            <div v-if="metric.timeScope"><dt>时间口径</dt><dd>{{ metric.timeScope }}</dd></div>
            <div v-if="metric.includes"><dt>包含</dt><dd>{{ metric.includes }}</dd></div>
            <div v-if="metric.excludes"><dt>不包含</dt><dd>{{ metric.excludes }}</dd></div>
            <div v-if="metric.missingValue"><dt>缺失时怎么显示</dt><dd>{{ metric.missingValue }}</dd></div>
            <div v-if="metric.updatedAt"><dt>口径更新时间</dt><dd>{{ metric.updatedAt }}</dd></div>
          </dl>
        </div>
      </div>
    </template>
  </PanelCard>
</template>

<style scoped lang="scss">
.glossary__confusions { padding: $space-3 $space-4; border-bottom: 1px solid $border-color; background: $surface-50; }
.glossary__confusions-title { margin: 0 0 $space-2; color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.glossary__confusions dl { display: grid; gap: $space-2; margin: 0; }
.glossary__confusions dl div { display: grid; grid-template-columns: 88px 1fr; gap: $space-2; }
.glossary__confusions dt { color: $text-primary; font-size: $font-caption; font-weight: $font-weight-semibold; }
.glossary__confusions dd { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }

.glossary__list { display: flex; flex-direction: column; }
.glossary__item { padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.glossary__item:last-child { border-bottom: 0; }
.glossary__head { display: flex; align-items: center; justify-content: space-between; gap: $space-3; width: 100%; padding: 0; border: 0; background: transparent; text-align: left; cursor: pointer; }
.glossary__name { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.glossary__name small { color: $text-tertiary; font-weight: $font-weight-regular; }
.glossary__meta { display: flex; align-items: center; gap: $space-2; }
.glossary__toggle { color: $brand-600; font-size: $font-caption; }
.glossary__definition { margin: $space-2 0 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
.glossary__detail { display: grid; gap: 6px; margin: $space-2 0 0; }
.glossary__detail div { display: grid; grid-template-columns: 96px 1fr; gap: $space-2; }
.glossary__detail dt { color: $text-tertiary; font-size: $font-caption; }
.glossary__detail dd { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.7; }
</style>
