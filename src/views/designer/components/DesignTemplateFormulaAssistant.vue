<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  FORMULA_FUNCTIONS,
  FORMULA_SCENARIOS,
  QUICK_VARIABLES,
  formulaErrorMessage,
  previewFormula,
  scenarioForUnit,
  variableGroups,
  type FormulaScenario,
  type FormulaVariable
} from '@/domains/designtemplate/formula-guide'
import type { TemplateRoom } from '@/domains/designtemplate/model'
import type { DesignItemType } from '@/domains/design/model'

const props = withDefaults(defineProps<{
  modelValue: boolean
  itemName?: string
  unit?: string
  formula?: string
  room?: TemplateRoom
  rooms: TemplateRoom[]
  itemType?: DesignItemType
  /** 分项区处于浏览器全屏时，抽屉必须挂到全屏元素内，否则会被遮盖。 */
  fullscreen?: boolean
}>(), {
  itemName: '',
  unit: '',
  formula: '',
  itemType: undefined,
  fullscreen: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  insert: [text: string]
}>()

type TabName = 'recommended' | 'scenario' | 'variable'

const activeTab = ref<TabName>('recommended')
const expandedVariable = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const roomLabel = computed(() => props.room?.name || '综合项目')
const preview = computed(() => previewFormula(props.formula, props.room, props.rooms, props.unit))
const previewText = computed(() => {
  if (preview.value.status === 'ready' || preview.value.status === 'fixed') {
    return `${preview.value.value ?? '—'} ${props.unit || ''}`.trim()
  }
  if (preview.value.status === 'missing') return '待补尺寸'
  if (preview.value.status === 'empty') return '未填写'
  return '暂不可确认'
})
const previewHint = computed(() => {
  if (preview.value.status === 'ready') {
    const dimension = preview.value.dimension === 2 ? '面积' : preview.value.dimension === 1 ? '长度' : '数量'
    return preview.value.usedReference ? `结果量纲：${dimension}（按模版参考值校验，不进入金额）` : `结果量纲：${dimension}`
  }
  if (preview.value.status === 'missing') return `缺少：${preview.value.missingVariables.join('、') || '尺寸'}`
  if (preview.value.status === 'error') return formulaErrorMessage(preview.value.code, preview.value.message)
  return '即时预览；正式结果以金额已更新为准'
})

const recommended = computed(() => {
  const byUnit = scenarioForUnit(FORMULA_SCENARIOS, props.unit)
  if (byUnit.length) return byUnit.slice(0, 3)
  return FORMULA_SCENARIOS.slice(0, 3)
})

/** 变量按「常用 / 区域输入 / 量房快照」分组，常用变量排最前。 */
const variableGroupList = computed(() => variableGroups())

/** 常用变量快捷插入区（A / P / CP / WP / H），在任意页签都可见。 */
const quickVariables = QUICK_VARIABLES

function insert(text: string): void {
  emit('insert', text)
  visible.value = false
}

function insertVariable(variable: FormulaVariable): void {
  insert(variable.insertText)
}

function insertScenario(scenario: FormulaScenario): void {
  if (scenario.formula.startsWith('固定数量')) {
    insert('')
    return
  }
  insert(scenario.formula)
}

function toggleVariable(symbol: string): void {
  expandedVariable.value = expandedVariable.value === symbol ? '' : symbol
}

watch(() => props.modelValue, (value) => {
  if (value) activeTab.value = 'recommended'
})
</script>

<template>
  <el-drawer
    v-model="visible"
    direction="rtl"
    size="480px"
    :with-header="false"
    :append-to-body="!fullscreen"
    class="formula-assistant-drawer"
  >
    <div class="fa">
      <header class="fa__head">
        <div>
          <p class="fa__eyebrow">公式助手</p>
          <h3>{{ itemName || '当前分项' }}</h3>
          <p>{{ roomLabel }} · 单位 {{ unit || '—' }}</p>
        </div>
        <el-button link @click="visible = false">关闭</el-button>
      </header>

      <section class="fa__preview" :class="`is-${preview.status}`">
        <div class="fa__preview-main">
          <span class="fa__preview-label">当前公式</span>
          <strong>{{ formula || '未填写' }}</strong>
        </div>
        <div class="fa__preview-value">
          <b>{{ previewText }}</b>
          <small>{{ previewHint }}</small>
        </div>
      </section>

      <section class="fa__quick">
        <header class="fa__quick-head">
          <strong>常用变量</strong>
          <small>点一下插入到公式栏：面积用 A，周长用 P</small>
        </header>
        <div class="fa__quick-list">
          <button
            v-for="variable in quickVariables"
            :key="`quick-${variable.symbol}`"
            type="button"
            class="fa__quick-chip"
            :title="variable.summary"
            @click="insertVariable(variable)"
          >
            <b>{{ variable.symbol }}</b>
            <span>{{ variable.name }}</span>
            <em>{{ variable.unit }}</em>
          </button>
        </div>
      </section>

      <el-tabs v-model="activeTab" class="fa__tabs">
        <el-tab-pane label="推荐公式" name="recommended">
          <p class="fa__intro">先看这个分项通常怎么算；点“插入”后公式会进入公式栏，再按当前区域核对变量。</p>
          <article v-for="scenario in recommended" :key="`rec-${scenario.id}`" class="fa-card">
            <header>
              <strong>{{ scenario.title }}</strong>
              <span>{{ scenario.unitHint }}</span>
            </header>
            <p>{{ scenario.when }}</p>
            <code>{{ scenario.formula }}</code>
            <p class="fa-card__hint">{{ scenario.explain }}</p>
            <p v-if="scenario.caution" class="fa-card__caution">{{ scenario.caution }}</p>
            <el-button type="primary" plain size="small" @click="insertScenario(scenario)">插入公式</el-button>
          </article>
        </el-tab-pane>

        <el-tab-pane label="场景公式" name="scenario">
          <p class="fa__intro">按施工场景找公式：地面、踢脚线、墙面、顶面、防水、墙地砖、综合项目、计数固定项。</p>
          <article v-for="scenario in FORMULA_SCENARIOS" :key="scenario.id" class="fa-card">
            <header>
              <strong>{{ scenario.title }}</strong>
              <span>{{ scenario.unitHint }}</span>
            </header>
            <p>{{ scenario.when }}</p>
            <code>{{ scenario.formula }}</code>
            <p class="fa-card__hint">{{ scenario.explain }}</p>
            <p v-if="scenario.caution" class="fa-card__caution">{{ scenario.caution }}</p>
            <el-button type="primary" plain size="small" @click="insertScenario(scenario)">插入公式</el-button>
          </article>
        </el-tab-pane>

        <el-tab-pane label="变量与函数" name="variable">
          <p class="fa__intro">点变量名插入到公式栏；展开可看业务含义、什么时候用和常见错误。</p>
          <p class="fa__intro">模版区域可以先填一组「参考面积 / 参考周长」用来校验公式：填了会按参考值预览并标注「按参考值」，没填就显示「待补」。参考值只是打底，不进入工程量与金额；实例化到方案后录入该房屋的实测面积 / 周长才参与金额。量房记录的开间、进深只作记录，不能用来推算工程量。</p>
          <section v-for="group in variableGroupList" :key="group.key" class="fa__group">
            <h4>{{ group.label }}</h4>
            <p class="fa__group-hint">{{ group.hint }}</p>
            <article
              v-for="variable in group.variables"
              :key="variable.symbol"
              class="fa-var"
              :class="{ 'is-open': expandedVariable === variable.symbol, 'is-usable': variable.available, 'is-disabled': !variable.available }"
            >
              <button type="button" class="fa-var__head" @click="toggleVariable(variable.symbol)">
                <b>{{ variable.symbol }}</b>
                <span>{{ variable.name }}</span>
                <small>{{ variable.unit }}</small>
                <small v-if="!variable.available" class="fa-var__off">不能进公式</small>
                <i>{{ expandedVariable === variable.symbol ? '收起' : '详情' }}</i>
              </button>
              <p class="fa-var__summary">{{ variable.summary }}</p>
              <div v-if="expandedVariable === variable.symbol" class="fa-var__body">
                <p>{{ variable.meaning }}</p>
                <dl>
                  <div><dt>来源</dt><dd>{{ variable.source }}</dd></div>
                  <div><dt>什么时候用</dt><dd>{{ variable.howToUse }}</dd></div>
                  <div><dt>例子</dt><dd>{{ variable.example }}</dd></div>
                  <div><dt>没填会怎样</dt><dd>{{ variable.notReady }}</dd></div>
                  <div><dt>常见错误</dt><dd>{{ variable.commonMistake }}</dd></div>
                </dl>
                <el-button v-if="variable.available" size="small" type="primary" plain @click="insertVariable(variable)">插入 {{ variable.symbol }}</el-button>
                <p v-else class="fa-var__na">这个变量不能用于工程量公式，请改用 A / P / CP / WP。</p>
              </div>
            </article>
          </section>

          <section class="fa__group">
            <h4>函数</h4>
            <article v-for="fn in FORMULA_FUNCTIONS" :key="fn.name" class="fa-var" :class="{ 'is-disabled': !fn.available }">
              <div class="fa-var__head">
                <b>{{ fn.name }}</b>
                <span>{{ fn.summary }}</span>
                <small>{{ fn.available ? '可用' : '暂不可用' }}</small>
                <i v-if="fn.available" @click="insert(fn.insertText ?? `${fn.name}()`)" role="button" tabindex="0">插入</i>
              </div>
              <p class="fa-var__summary">{{ fn.signature }}</p>
              <p class="fa-var__summary">{{ fn.description }}</p>
              <p class="fa-var__summary">参数：{{ fn.params }}　示例：{{ fn.example }}</p>
              <p v-if="fn.note" class="fa-card__caution">{{ fn.note }}</p>
            </article>
          </section>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.fa { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.fa__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding-bottom: $space-3; border-bottom: 1px solid $border-color; }
.fa__eyebrow { margin: 0; color: $brand-600; font-size: $font-caption; font-weight: $font-weight-semibold; letter-spacing: .08em; }
.fa__head h3 { margin: $space-1 0 2px; font-size: $font-title; }
.fa__head p { margin: 0; color: $text-secondary; font-size: $font-caption; }
.fa__preview { display: flex; align-items: center; justify-content: space-between; gap: $space-3; margin: $space-3 0; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
.fa__preview.is-ready { border-color: $status-done-border; background: $status-done-soft; }
.fa__preview.is-missing { border-color: $status-pending-border; background: $status-pending-soft; }
.fa__preview.is-error { border-color: $status-blocked-border; background: $status-blocked-soft; }
.fa__preview-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fa__preview-main strong { overflow: hidden; color: $ink-950; text-overflow: ellipsis; white-space: nowrap; }
.fa__preview-label { color: $text-secondary; font-size: $font-caption; }
.fa__preview-value { text-align: right; }
.fa__preview-value b { display: block; color: $brand-700; font-size: $font-title; font-variant-numeric: tabular-nums; }
.fa__preview-value small { color: $text-secondary; font-size: $font-caption; }
.fa__quick { padding: $space-3; border: 1px solid $brand-200; border-radius: $radius-sm; background: $brand-50; }
.fa__quick-head { display: flex; align-items: baseline; gap: $space-2; margin-bottom: $space-2; }
.fa__quick-head strong { color: $brand-800; font-size: $font-body-sm; }
.fa__quick-head small { color: $text-secondary; font-size: $font-caption; }
.fa__quick-list { display: flex; flex-wrap: wrap; gap: $space-2; }
.fa__quick-chip { display: inline-flex; align-items: baseline; gap: 5px; padding: 6px 10px; color: $brand-800; background: $surface-0; border: 1px solid $brand-300; border-radius: $radius-pill; font-size: $font-caption; cursor: pointer; }
.fa__quick-chip:hover { border-color: $brand-500; box-shadow: $shadow-card; }
.fa__quick-chip b { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: $font-body-sm; }
.fa__quick-chip em { color: $text-tertiary; font-style: normal; }
.fa__group-hint { margin: 0 0 $space-2; color: $text-tertiary; font-size: $font-caption; }
.fa-var.is-usable .fa-var__head b { color: $brand-700; }
.fa-var__off { color: $danger-500 !important; }
.fa-var__na { margin: 0; color: $text-secondary; font-size: $font-caption; }
.fa__tabs { flex: 1; min-height: 0; }
.fa__intro { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fa-card { display: flex; flex-direction: column; gap: $space-2; margin-bottom: $space-3; padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.fa-card header { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.fa-card header strong { font-size: $font-body-sm; }
.fa-card header span { padding: 1px 8px; color: $brand-700; background: $brand-50; border-radius: $radius-pill; font-size: $font-caption; }
.fa-card p { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fa-card code { padding: $space-2; color: $brand-800; background: $surface-50; border-radius: $radius-xs; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: $font-body-sm; }
.fa-card__hint { color: $ink-600 !important; }
.fa-card__caution { padding: $space-2; color: $warning-700 !important; background: $warning-50; border-radius: $radius-xs; }
.fa__group { margin-bottom: $space-4; }
.fa__group h4 { margin: 0 0 $space-2; font-size: $font-body-sm; }
.fa-var { margin-bottom: $space-2; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.fa-var.is-open { border-color: $brand-500; }
.fa-var.is-disabled { opacity: .7; }
.fa-var__head { display: flex; align-items: center; gap: $space-2; width: 100%; padding: $space-2 $space-3; text-align: left; background: transparent; border: 0; cursor: pointer; }
.fa-var__head b { min-width: 42px; color: $brand-700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: $font-body-sm; }
.fa-var__head span { flex: 1; color: $ink-800; font-size: $font-caption; }
.fa-var__head small { color: $text-tertiary; font-size: $font-caption; }
.fa-var__head i { color: $brand-700; font-size: $font-caption; font-style: normal; cursor: pointer; }
.fa-var__summary { margin: 0; padding: 0 $space-3 $space-2; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fa-var__body { padding: 0 $space-3 $space-3; }
.fa-var__body p { margin: 0 0 $space-2; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.fa-var__body dl { margin: 0 0 $space-3; }
.fa-var__body dl div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: $space-2; padding: $space-1 0; border-top: 1px dashed $border-color; }
.fa-var__body dt { color: $text-tertiary; font-size: $font-caption; }
.fa-var__body dd { margin: 0; color: $ink-800; font-size: $font-caption; line-height: 1.6; }
</style>
