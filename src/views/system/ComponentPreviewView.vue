<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'
import PanelCard from '@/components/PanelCard.vue'
import QuoteSheetGrid from '@/components/QuoteSheetGrid.vue'
import { STATUS_TONES, TONE_MEANING } from '@/core/tone'
import type { CellRef, DraftMap, EditableField, QuoteGroup } from '@/domains/trade/quote-sheet'
import type { QuoteStatus } from '@/domains/trade/model'
import { QUOTE_STATUS_META, QUOTE_MODE_META } from '@/domains/trade/meta'

const emptyActionClicked = ref('')

/* ── QuoteSheetGrid 演示（合成数据，仅渲染验证，不含任何真实业务口径）── */
const gridStatus = ref<QuoteStatus>('draft')
const gridSelected = ref<CellRef | null>(null)
const gridCollapsed = ref<string[]>([])
const gridDraft = reactive<DraftMap>({})

const gridGroups = reactive<QuoteGroup[]>([
  {
    key: 'living', name: '客厅', amount: 38760.00,
    rows: [
      { key: 'L1', itemId: 'L1', category: '木作工程', name: '电视背景墙基层', brandSpec: '轻钢龙骨 · 9.5mm', unit: '㎡', quantity: 12.6, quantityFormula: '=3.5*3.6', materialPrice: 128, manualPrice: 96, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 224, amount: 2822.40 },
      { key: 'L2', itemId: 'L2', category: '木作工程', name: '电视背景墙饰面', brandSpec: '岩板 · 1220×2440', unit: '㎡', quantity: 8.4, quantityFormula: '', materialPrice: 386, manualPrice: 180, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 566, amount: 4754.40 },
      { key: 'L3', itemId: 'L3', category: '水电工程', name: '电视墙强电改造', brandSpec: '国标 2.5mm²', unit: 'm', quantity: 18, quantityFormula: '', materialPrice: 12, manualPrice: 28, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 40, amount: 720.00 },
      { key: 'L4', itemId: 'L4', category: '安装工程', name: '悬浮柜体安装', brandSpec: '多层板 · 生态漆', unit: '㎡', quantity: 6.2, quantityFormula: '=3.1*2', materialPrice: 320, manualPrice: 240, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 560, amount: 3472.00 }
    ]
  },
  {
    key: 'bedroom', name: '主卧', amount: 21480.00,
    rows: [
      { key: 'B1', itemId: 'B1', category: '墙面工程', name: '床头背景墙硬包', brandSpec: '真皮硬包 · 定制', unit: '㎡', quantity: 9.8, quantityFormula: '', materialPrice: 420, manualPrice: 160, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 580, amount: 5684.00 },
      { key: 'B2', itemId: 'B2', category: '木作工程', name: '步入式衣柜柜体', brandSpec: '实木颗粒 · E0', unit: '㎡', quantity: 14.5, quantityFormula: '', materialPrice: 368, manualPrice: 220, pricingMode: 'MaterialAndManual', fixedTotalPrice: null, price: 588, amount: 8526.00 }
    ]
  }
])

const gridRowCount = computed(() => gridGroups.reduce((sum, g) => sum + g.rows.length, 0))
const gridDirtyCount = computed(() => Object.keys(gridDraft).length)

function onGridCell(rowKey: string, field: EditableField, value: number | string | null): void {
  gridDraft[rowKey] = { ...(gridDraft[rowKey] ?? {}), [field]: value ?? (field === 'quantityFormula' ? '' : 0) }
}

function toggleGridGroup(groupKey: string): void {
  const idx = gridCollapsed.value.indexOf(groupKey)
  if (idx >= 0) gridCollapsed.value.splice(idx, 1)
  else gridCollapsed.value.push(groupKey)
}
</script>

<template>
  <div class="preview">
    <h1 class="preview__title">基础组件渲染预览（仅 dev）</h1>
    <p class="preview__desc">用于 G3 渲染验证；生产构建不注册该路由。</p>

    <PanelCard title="StatusTag · 14 档状态 tone" description="文字 + 颜色 + 圆点，禁止只靠颜色">
      <div class="grid">
        <div v-for="tone in STATUS_TONES" :key="tone" class="grid__item">
          <StatusTag :tone="tone" :text="tone" />
          <span class="grid__note">{{ TONE_MEANING[tone] }}</span>
        </div>
      </div>
      <div class="grid grid--gap">
        <StatusTag v-for="tone in STATUS_TONES" :key="`solid-${tone}`" :tone="tone" :text="tone" mode="solid" :dot="false" />
        <StatusTag tone="done" text="md 尺寸" size="md" />
      </div>
    </PanelCard>

    <PanelCard title="StatusTag · 报价状态（口径来自 App）" description="设计师侧 STATUS_META">
      <div class="grid grid--gap">
        <StatusTag v-for="(meta, key) in QUOTE_STATUS_META" :key="key" :tone="meta.tone" :text="meta.label" size="md" />
        <StatusTag v-for="(meta, key) in QUOTE_MODE_META" :key="`mode-${key}`" :tone="meta.tone" :text="meta.label" size="md" :dot="false" />
      </div>
    </PanelCard>

    <PanelCard title="MoneyText · 金额与差额" description="缺值必须表达「暂不可确认」，禁止用 0 冒充">
      <dl class="rows">
        <div><dt>正常金额</dt><dd><MoneyText :value="42325.52" size="lg" /></dd></div>
        <div><dt>真实为零</dt><dd><MoneyText :value="0" /></dd></div>
        <div><dt>缺值（null）</dt><dd><MoneyText :value="null" /></dd></div>
        <div><dt>差额 +525.00</dt><dd><MoneyText :value="525" delta size="lg" /></dd></div>
        <div><dt>差额 −525.00</dt><dd><MoneyText :value="-525" delta size="lg" /></dd></div>
        <div><dt>差额 0</dt><dd><MoneyText :value="0" delta /></dd></div>
      </dl>
    </PanelCard>

    <PanelCard title="CostIncompleteValue · 成本未完整">
      <div class="grid grid--gap">
        <CostIncompleteValue />
        <CostIncompleteValue hint="缺少：主材到货成本、人工结算成本" />
        <span class="rows__pair">毛利：<MoneyText :value="null" /> <CostIncompleteValue /></span>
      </div>
    </PanelCard>

    <PanelCard title="EmptyState · 真实为空必须给下一步">
      <div class="grid grid--2">
        <EmptyState title="还没有报价分项" description="可以从报价项目库选择，或手动新增一项。" action-text="新增分项" @action="emptyActionClicked = '新增分项'" />
        <EmptyState title="暂无上一版本" description="这是该房屋的第一版报价，没有可对比的历史版本。" />
      </div>
      <p v-if="emptyActionClicked" class="rows__pair">已触发动作：{{ emptyActionClicked }}</p>
    </PanelCard>

    <PanelCard title="SkeletonBlock · 加载态" description="骨架屏，禁止遮罩转圈">
      <div class="grid grid--2">
        <SkeletonBlock :rows="4" />
        <SkeletonBlock variant="table" :rows="5" />
      </div>
    </PanelCard>

    <PanelCard title="QuoteSheetGrid · 报价表格（合成数据）" description="12 列 / 冻结前两列 / 行内编辑 / 键盘流 / 区域折叠">
      <template #extra>
        <div class="rows__pair">
          <el-button size="small" @click="gridStatus = gridStatus === 'draft' ? 'submitted' : 'draft'">
            切换为 {{ gridStatus === 'draft' ? '只读（已提交）' : '可编辑（草稿）' }}
          </el-button>
          <StatusTag :tone="gridStatus === 'draft' ? 'todo' : 'pending'" :text="gridStatus === 'draft' ? '草稿·可编辑' : '待客户确认·只读'" />
          <span class="grid-demo__stat">{{ gridRowCount }} 行 · 已改 {{ gridDirtyCount }} 行</span>
        </div>
      </template>
      <div class="grid-demo">
        <QuoteSheetGrid
          :groups="gridGroups"
          :status="gridStatus"
          :draft="gridDraft"
          :selected="gridSelected"
          :collapsed-groups="gridCollapsed"
          @update:cell="onGridCell"
          @select:cell="gridSelected = $event"
          @toggle:group="toggleGridGroup"
        />
      </div>
      <p class="rows__pair">键盘：Enter 下一行 · Tab 下一格 · ↑↓←→ 移动 · Esc 还原该格 · Ctrl/Cmd+S 保存</p>
    </PanelCard>

    <PanelCard title="PanelCard · 面板壳" description="报价工作台三栏的基础容器">
      <template #extra><StatusTag tone="progress" text="可编辑" /></template>
      <p class="rows__pair">面板内容区（flush 模式用于表格）。</p>
      <template #footer>底部说明 / 下一步</template>
    </PanelCard>
  </div>
</template>

<style scoped lang="scss">
.preview {
  display: flex;
  flex-direction: column;
  gap: $space-5;
  padding: $space-6;
  max-width: 1180px;
  margin: 0 auto;
}

.preview__title { margin: 0; font-size: $font-h1; }
.preview__desc { margin: 0; font-size: $font-body-sm; color: $text-secondary; }

.grid { display: flex; flex-direction: column; gap: $space-3; }
.grid--gap { flex-direction: row; flex-wrap: wrap; align-items: center; gap: $space-2; }
.grid--2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-4; }
.grid__item { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: $space-3; }
.grid__note { font-size: $font-caption; color: $text-secondary; }

.rows { display: flex; flex-direction: column; gap: $space-2; margin: 0; }
.rows > div { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: $space-3; }
.rows dt { font-size: $font-caption; color: $text-secondary; }
.rows dd { margin: 0; }
.rows__pair { display: inline-flex; align-items: center; gap: $space-2; font-size: $font-body-sm; }
.grid-demo { height: 380px; display: flex; border: 1px solid $border-color; border-radius: $radius-sm; overflow: hidden; }
.grid-demo__stat { font-size: $font-caption; color: $text-secondary; }
</style>
