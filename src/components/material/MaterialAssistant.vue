<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ProviderError } from '@/core/http'
import { useSessionStore } from '@/stores/session'
import { createIdempotencyKey } from '@/core/idempotency'
import { materialAssistantApi } from '@/domains/material/api'
import type {
  MaterialAssistantAnswer,
  MaterialAssistantAnswerType
} from '@/domains/material/model'

type ContextType = 'project' | 'sheet' | 'purchase' | 'settlement' | 'general'

const session = useSessionStore()

function displayText(value?: string): string {
  if (!value) return ''
  return value
    .replace(/priceState=Unpriced/g, '采购价未填')
    .replace(/costComplete=false/g, '成本未完整')
    .replace(/Selection 为空或不是 Selected/g, '尚未完成选材')
    .replace(/利润保持 null/g, '利润暂不显示')
    .replace(/利润：null（暂不确认）/g, '利润：暂不显示')
    .replace(/\bSelected\b/g, '已选材')
    .replace(/\bnull\b/g, '暂不显示')
}

const props = withDefaults(defineProps<{
  contextType?: ContextType
  projectId?: string
  sheetId?: string
  contextTitle?: string
  contextSubtitle?: string
}>(), {
  contextType: 'general',
  projectId: '',
  sheetId: '',
  contextTitle: '',
  contextSubtitle: ''
})

const CONTEXT_LABELS: Record<ContextType, string> = {
  project: '项目上下文',
  sheet: '作业单上下文',
  purchase: '采购上下文',
  settlement: '结算上下文',
  general: '材料规则'
}

const ANSWER_TYPE_META: Record<MaterialAssistantAnswerType, { label: string; type: 'success' | 'warning' | 'danger' | 'info' | 'primary' }> = {
  EXPLANATION: { label: '规则', type: 'info' },
  LIVE_DATA: { label: '当前情况', type: 'success' },
  PERMISSION_DENIED: { label: '无权限', type: 'warning' },
  REFUSAL: { label: '不支持', type: 'danger' },
  NO_EVIDENCE: { label: '暂不可确认', type: 'info' }
}

const visible = ref(false)
const question = ref('')
const loading = ref(false)
const suggestionsLoading = ref(false)
const error = ref('')
const answer = ref<MaterialAssistantAnswer | null>(null)
const suggestions = ref<string[]>([])
const boundProjectId = ref('')
const boundSheetId = ref('')
const manuallyCleared = ref(false)
const lastInput = ref<{ question: string; projectId?: string; sheetId?: string; requestId: string; idempotencyKey: string } | null>(null)

const contextLabel = computed(() => CONTEXT_LABELS[props.contextType] || CONTEXT_LABELS.general)
const bound = computed(() => Boolean(boundProjectId.value || boundSheetId.value))
const answerMeta = computed(() => answer.value ? ANSWER_TYPE_META[answer.value.answerType] : null)
const canViewCost = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(String(session.role || '')))
const visibleCitations = computed(() => (answer.value?.citations || []).filter((citation) =>
  canViewCost.value || !/成本|定价|利润|priceState|costComplete/.test(`${citation.label || ''} ${citation.detail || ''}`)))
const displayAnswerText = computed(() => displayText(answer.value?.answer))
const canRestore = computed(() => Boolean(props.projectId || props.sheetId))
const contextTitleText = computed(() => {
  if (bound.value) return props.contextTitle || '当前业务对象'
  if (manuallyCleared.value) return '仅解释材料规则'
  return props.contextTitle || '仅解释材料规则'
})
const contextSubtitleText = computed(() => {
  if (bound.value) return props.contextSubtitle || contextLabel.value
  if (manuallyCleared.value || !props.contextTitle) return '未绑定业务单据，仅解释材料规则，不读取实时项目数据'
  return `${props.contextSubtitle || contextLabel.value} · 未绑定业务单据，仅解释材料规则`
})

watch(() => [props.projectId, props.sheetId], () => {
  if (!manuallyCleared.value) syncContext()
})

function syncContext(): void {
  boundProjectId.value = props.projectId || ''
  boundSheetId.value = props.sheetId || ''
}

function openAssistant(): void {
  visible.value = true
}

function prepare(): void {
  answer.value = null
  error.value = ''
  question.value = ''
  lastInput.value = null
  manuallyCleared.value = false
  syncContext()
  void loadSuggestions()
}

async function loadSuggestions(): Promise<void> {
  suggestionsLoading.value = true
  try {
    const result = await materialAssistantApi.suggestions({
      projectId: boundProjectId.value || undefined,
      sheetId: boundSheetId.value || undefined,
      contextType: props.contextType
    })
    suggestions.value = result.suggestions
  } catch {
    suggestions.value = []
  } finally {
    suggestionsLoading.value = false
  }
}

function clearContext(): void {
  manuallyCleared.value = true
  boundProjectId.value = ''
  boundSheetId.value = ''
  answer.value = null
  error.value = ''
  void loadSuggestions()
}

function restoreContext(): void {
  manuallyCleared.value = false
  syncContext()
  answer.value = null
  error.value = ''
  void loadSuggestions()
}

async function ask(text?: string): Promise<void> {
  const value = (text ?? question.value).trim()
  if (!value || loading.value) return
  question.value = value
  const input = {
    question: value,
    projectId: boundProjectId.value || undefined,
    sheetId: boundSheetId.value || undefined,
    requestId: `web-material-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey: createIdempotencyKey('web-material-assistant')
  }
  lastInput.value = input
  loading.value = true
  error.value = ''
  try {
    const result = await materialAssistantApi.ask(input)
    answer.value = result
    if (result.suggestedQuestions.length) suggestions.value = result.suggestedQuestions
  } catch (askError) {
    answer.value = null
    error.value = askError instanceof ProviderError ? askError.message : '材料助手暂不可确认，请稍后重试'
  } finally {
    loading.value = false
  }
}

function retry(): void {
  if (lastInput.value) void ask(lastInput.value.question)
}
</script>

<template>
  <div class="ma">
    <button class="ma__fab" type="button" aria-label="问材料" @click="openAssistant">
      <span class="ma__fab-mark">问</span>
      <span>问材料</span>
    </button>

    <el-drawer
      v-model="visible"
      title="问材料"
      size="min(520px, 96vw)"
      append-to-body
      @open="prepare"
    >
      <div class="ma__body">
        <section class="ma__context" :class="{ 'ma__context--unbound': !bound }">
          <div class="ma__context-head">
            <el-tag size="small" effect="plain">{{ contextLabel }}</el-tag>
            <span class="ma__readonly">只读</span>
            <span v-if="bound" class="ma__bound">已绑定</span>
            <span v-else class="ma__unbound">未绑定业务单据</span>
          </div>
          <strong>{{ contextTitleText }}</strong>
          <p>{{ contextSubtitleText }}</p>
          <div class="ma__context-actions">
            <el-button v-if="bound" link type="primary" size="small" @click="clearContext">清除上下文</el-button>
            <el-button v-else-if="canRestore" link type="primary" size="small" @click="restoreContext">恢复当前页面上下文</el-button>
          </div>
        </section>

        <div class="ma__thread">
          <div v-if="loading" class="ma__loading">
            <span class="ma__spinner" aria-hidden="true"></span>
            正在校核材料事实…
          </div>

          <div v-else-if="error" class="ma__error">
            <strong>材料助手暂不可确认</strong>
            <p>{{ error }}</p>
            <el-button size="small" @click="retry">重试</el-button>
          </div>

          <div v-else-if="answer" class="ma__answer">
            <div class="ma__answer-meta">
              <el-tag v-if="answerMeta" size="small" :type="answerMeta.type" effect="light">{{ answerMeta.label }}</el-tag>
              <span v-if="answer.readOnly">只读</span>
            </div>
            <p class="ma__answer-text">{{ displayAnswerText }}</p>

            <section v-if="visibleCitations.length" class="ma__section">
              <h4>依据</h4>
              <ul class="ma__citations">
                <li v-for="citation in visibleCitations" :key="`${citation.type}-${citation.id}`">
                  <div>
                    <strong>{{ citation.label || citation.type }}</strong>
                    <p v-if="citation.detail">{{ displayText(citation.detail) }}</p>
                  </div>
                </li>
              </ul>
            </section>

            <section v-if="answer.nextActions.length" class="ma__section">
              <h4>下一步</h4>
              <ol class="ma__next">
                <li v-for="action in answer.nextActions" :key="action">{{ action }}</li>
              </ol>
            </section>
          </div>

          <div v-else class="ma__intro">
            <strong>基于当前上下文问一个材料问题</strong>
            <p>回答只基于当前页面材料和已登记规则；没有依据、越权或超出范围时会明确说明，不会用兜底话术伪装成功。</p>
          </div>
        </div>

        <section v-if="suggestions.length" class="ma__suggestions">
          <h4>{{ answer ? '建议追问' : '可以这样问' }}</h4>
          <div class="ma__chips">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              type="button"
              class="ma__chip"
              :disabled="loading"
              @click="ask(suggestion)"
            >{{ suggestion }}</button>
          </div>
          <span v-if="suggestionsLoading" class="ma__suggestions-loading">正在加载建议问题…</span>
        </section>

        <section class="ma__composer">
          <el-input
            v-model="question"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            resize="none"
            placeholder="例如：这个项目的材料为什么还没有闭环？"
            @keydown.ctrl.enter.prevent="ask()"
            @keydown.meta.enter.prevent="ask()"
          />
          <div class="ma__composer-foot">
            <span>单轮问答 · Ctrl/⌘ + Enter 发送</span>
            <el-button type="primary" :loading="loading" :disabled="!question.trim()" @click="ask()">发送</el-button>
          </div>
        </section>

        <p class="ma__boundary">助手不会审批、付款、删除或修改权限；金额/成本以服务端口径为准。</p>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ma__fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 18px 0 12px;
  border: 1px solid rgba(47, 125, 90, 0.24);
  border-radius: 999px;
  background: $brand-primary;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(12, 34, 26, 0.22);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(12, 34, 26, 0.26);
  }

  &:focus-visible {
    outline: 3px solid $brand-200;
    outline-offset: 2px;
  }
}

.ma__fab-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 13px;
}

.ma__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ma__context {
  padding: 14px 16px;
  border: 1px solid $brand-100;
  border-radius: 14px;
  background: linear-gradient(180deg, $brand-50 0%, #fff 100%);

  strong {
    display: block;
    margin-top: 8px;
    color: $ink-950;
    font-size: 15px;
  }

  p {
    margin: 4px 0 0;
    color: $ink-600;
    font-size: 12px;
    line-height: 1.6;
  }
}

.ma__context--unbound {
  border-color: $warning-200;
  background: linear-gradient(180deg, $warning-50 0%, #fff 100%);
}

.ma__context-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.ma__readonly,
.ma__bound,
.ma__unbound {
  font-size: 12px;
  color: $ink-600;
}

.ma__bound {
  color: $success-500;
  font-weight: 600;
}

.ma__unbound {
  color: $warning-700;
  font-weight: 600;
}

.ma__context-actions {
  margin-top: 4px;
}

.ma__thread {
  min-height: 180px;
}

.ma__intro,
.ma__loading,
.ma__error {
  padding: 18px;
  border: 1px dashed $line-200;
  border-radius: 14px;
  background: $surface-50;
  color: $ink-600;
  font-size: 13px;
  line-height: 1.7;

  strong {
    display: block;
    margin-bottom: 4px;
    color: $ink-950;
    font-size: 14px;
  }
}

.ma__loading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ma__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid $brand-100;
  border-top-color: $brand-primary;
  border-radius: 50%;
  animation: ma-spin 0.8s linear infinite;
}

@keyframes ma-spin {
  to { transform: rotate(360deg); }
}

.ma__error {
  border-color: $danger-200;
  background: $danger-50;

  strong { color: $danger-500; }
  p { margin: 0 0 10px; }
}

.ma__answer {
  padding: 16px;
  border: 1px solid $line-200;
  border-radius: 14px;
  background: #fff;
}

.ma__answer-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: $ink-600;
  font-size: 12px;
}

.ma__answer-text {
  margin: 12px 0 0;
  color: $ink-950;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.ma__section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid $line-200;

  h4 {
    margin: 0 0 8px;
    color: $ink-600;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
}

.ma__citations,
.ma__tools,
.ma__next {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ma__citations li,
.ma__tools li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed $line-200;
  font-size: 12px;
  color: $ink-600;

  &:last-child { border-bottom: none; }
}

.ma__citations p {
  margin: 2px 0 0;
  line-height: 1.55;
}

.ma__citation-id {
  flex: none;
  padding: 2px 6px;
  border-radius: 6px;
  background: $surface-100;
  color: $ink-600;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.ma__tools li {
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.ma__tool-status {
  color: $ink-400;
  font-size: 11px;
}

.ma__next {
  counter-reset: ma-next;

  li {
    position: relative;
    padding: 6px 0 6px 26px;
    color: $ink-600;
    font-size: 13px;
    line-height: 1.6;

    &::before {
      counter-increment: ma-next;
      content: counter(ma-next);
      position: absolute;
      left: 0;
      top: 7px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: $brand-50;
      color: $brand-700;
      font-size: 11px;
      font-weight: 700;
    }
  }
}

.ma__suggestions h4 {
  margin: 0 0 8px;
  color: $ink-600;
  font-size: 12px;
  font-weight: 700;
}

.ma__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ma__chip {
  padding: 7px 12px;
  border: 1px solid $brand-100;
  border-radius: 999px;
  background: $brand-50;
  color: $brand-700;
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) { background: $brand-100; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

.ma__suggestions-loading {
  display: block;
  margin-top: 8px;
  color: $ink-400;
  font-size: 11px;
}

.ma__composer {
  padding-top: 4px;
}

.ma__composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;

  span {
    color: $ink-400;
    font-size: 11px;
  }
}

.ma__boundary {
  margin: 0;
  color: $ink-400;
  font-size: 11px;
  line-height: 1.6;
}
</style>
