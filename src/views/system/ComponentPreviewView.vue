<script setup lang="ts">
import { ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import MoneyText from '@/components/MoneyText.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import CostIncompleteValue from '@/components/CostIncompleteValue.vue'
import PanelCard from '@/components/PanelCard.vue'
import { STATUS_TONES, TONE_MEANING } from '@/core/tone'
import { QUOTE_STATUS_META, QUOTE_MODE_META } from '@/domains/trade/meta'

const emptyActionClicked = ref('')
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
</style>
