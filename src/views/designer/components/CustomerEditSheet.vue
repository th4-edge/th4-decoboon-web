<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { crmApi } from '@/domains/crm/api'
import type { Customer } from '@/domains/crm/model'
import {
  CUSTOMER_SOURCE_OPTIONS,
  GENDER_OPTIONS,
  PORTRAIT_CONCERN_OPTIONS,
  PORTRAIT_OPTIONS,
  PORTRAIT_LABELS
} from '@/domains/crm/options'

const props = defineProps<{
  open: boolean
  customer: Customer | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const basic = reactive({
  name: '',
  telNo: '',
  gender: '',
  source: '',
  community: '',
  addr: '',
  area: '' as string | number,
  budget: '' as string | number,
  remark: ''
})

const portrait = reactive<Record<string, string>>({
  decisionRole: '', purpose: '', houseCondition: '', startWindow: '',
  style: '', eco: '', household: '', payment: '', competitor: ''
})
const concerns = ref<string[]>([])

const savingBasic = ref(false)
const savingPortrait = ref(false)
const basicError = ref('')
const portraitError = ref('')
const basicOk = ref(false)
const portraitOk = ref(false)

const portraitFields = computed(() => Object.keys(PORTRAIT_LABELS).map((key) => ({
  key,
  label: PORTRAIT_LABELS[key],
  options: PORTRAIT_OPTIONS[key] ?? []
})))

function toEnumKey(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.key ?? record.value ?? '')
  }
  return ''
}

function reset(): void {
  const source = props.customer
  basicError.value = ''
  portraitError.value = ''
  basicOk.value = false
  portraitOk.value = false
  basic.name = source?.name ?? ''
  basic.telNo = source?.phone ?? ''
  basic.gender = source?.gender ?? ''
  basic.source = source?.source ?? ''
  basic.community = source?.community ?? ''
  basic.addr = source?.addr ?? ''
  basic.area = source?.area !== undefined ? String(source.area) : ''
  basic.budget = source?.budget !== undefined ? String(source.budget) : ''
  basic.remark = source?.remark ?? ''
  const p = source?.portrait ?? {}
  Object.keys(portrait).forEach((key) => { portrait[key] = toEnumKey((p as Record<string, unknown>)[key]) })
  const raw = (p as Record<string, unknown>).concerns
  concerns.value = Array.isArray(raw)
    ? raw.map((item) => toEnumKey((item as Record<string, unknown>)?.concern ?? item)).filter(Boolean)
    : []
}

watch(() => [props.open, props.customer?.id], () => { if (props.open) reset() }, { immediate: true })

/** 数字输入框经 v-model 会自动转成 Number，string/number 都要能处理。 */
function numberOrUndefined(value: string | number | null | undefined): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

async function saveBasic(): Promise<void> {
  if (!props.customer) return
  basicError.value = ''
  basicOk.value = false
  if (!basic.name.trim()) {
    basicError.value = '客户姓名不能为空'
    return
  }
  savingBasic.value = true
  try {
    await crmApi.updateCustomer({
      customerId: props.customer.id,
      name: basic.name.trim(),
      telNo: basic.telNo.trim() || undefined,
      gender: basic.gender || undefined,
      source: basic.source || undefined,
      community: basic.community.trim() || undefined,
      addr: basic.addr.trim() || undefined,
      area: numberOrUndefined(basic.area),
      budget: numberOrUndefined(basic.budget),
      remark: basic.remark.trim() || undefined
    })
    basicOk.value = true
    emit('saved')
  } catch (err) {
    basicError.value = err instanceof Error ? err.message : '保存失败，请稍后重试'
  } finally {
    savingBasic.value = false
  }
}

async function savePortrait(): Promise<void> {
  if (!props.customer) return
  portraitError.value = ''
  portraitOk.value = false
  savingPortrait.value = true
  try {
    await crmApi.savePortrait({
      customerId: props.customer.id,
      decisionRole: portrait.decisionRole || undefined,
      purpose: portrait.purpose || undefined,
      houseCondition: portrait.houseCondition || undefined,
      startWindow: portrait.startWindow || undefined,
      style: portrait.style || undefined,
      eco: portrait.eco || undefined,
      household: portrait.household || undefined,
      payment: portrait.payment || undefined,
      competitor: portrait.competitor || undefined,
      concerns: concerns.value
    })
    portraitOk.value = true
    emit('saved')
  } catch (err) {
    portraitError.value = err instanceof Error ? err.message : '画像保存失败，请稍后重试'
  } finally {
    savingPortrait.value = false
  }
}
</script>

<template>
  <div v-if="open" class="sheet" role="dialog" aria-modal="true" aria-label="编辑客户信息">
    <div class="sheet__mask" @click="emit('close')" />
    <aside class="sheet__panel">
      <header class="sheet__head">
        <div>
          <h2>编辑客户信息</h2>
          <p>{{ customer?.name }} · 保存后重新读取服务端事实</p>
        </div>
        <button class="sheet__close" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div class="sheet__body">
        <section class="sheet__section">
          <h3>客户基本信息</h3>
          <div class="grid">
            <label><span>客户姓名 *</span><input v-model="basic.name" type="text" placeholder="请输入姓名" /></label>
            <label><span>手机号</span><input v-model="basic.telNo" type="tel" placeholder="11 位手机号" /></label>
            <label>
              <span>性别</span>
              <select v-model="basic.gender">
                <option value="">未填写</option>
                <option v-for="item in GENDER_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label>
              <span>客户来源</span>
              <select v-model="basic.source">
                <option value="">未填写</option>
                <option v-for="item in CUSTOMER_SOURCE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label><span>小区</span><input v-model="basic.community" type="text" placeholder="小区名称" /></label>
            <label><span>详细地址</span><input v-model="basic.addr" type="text" placeholder="楼栋房号或详细地址" /></label>
            <label><span>面积（㎡）</span><input v-model="basic.area" type="number" min="0" placeholder="如 120" /></label>
            <label><span>预算（元）</span><input v-model="basic.budget" type="number" min="0" placeholder="如 200000" /></label>
            <label class="grid__wide"><span>备注</span><textarea v-model="basic.remark" rows="2" placeholder="补充说明" /></label>
          </div>
          <p v-if="basicError" class="sheet__error">{{ basicError }}</p>
          <p v-if="basicOk" class="sheet__ok">已保存</p>
          <footer class="sheet__foot">
            <button class="sheet__btn" type="button" :disabled="savingBasic" @click="saveBasic">
              {{ savingBasic ? '保存中…' : '保存基本信息' }}
            </button>
          </footer>
        </section>

        <section class="sheet__section">
          <h3>客户画像</h3>
          <p class="sheet__hint">画像用于约束设计方案；未填写的项保持为空，不用默认值补齐。</p>
          <div class="grid">
            <label v-for="field in portraitFields" :key="field.key">
              <span>{{ field.label }}</span>
              <select v-model="portrait[field.key]">
                <option value="">未填写</option>
                <option v-for="item in field.options" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
          </div>
          <div class="concerns">
            <span>关注点（可多选）</span>
            <div class="concerns__list">
              <label v-for="item in PORTRAIT_CONCERN_OPTIONS" :key="item.value" class="concern">
                <input v-model="concerns" type="checkbox" :value="item.value" />
                {{ item.label }}
              </label>
            </div>
          </div>
          <p v-if="portraitError" class="sheet__error">{{ portraitError }}</p>
          <p v-if="portraitOk" class="sheet__ok">已保存</p>
          <footer class="sheet__foot">
            <button class="sheet__btn" type="button" :disabled="savingPortrait" @click="savePortrait">
              {{ savingPortrait ? '保存中…' : '保存画像' }}
            </button>
          </footer>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.sheet { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
.sheet__mask { position: absolute; inset: 0; background: rgba(26, 26, 23, .34); }

.sheet__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  height: 100%;
  background: $surface-0;
  box-shadow: -12px 0 32px rgba(26, 26, 23, .16);
}

.sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: 20px 24px;
  border-bottom: 1px solid $border-color;

  h2 { margin: 0; color: $text-primary; font-size: $font-title; font-weight: $font-weight-bold; }
  p { margin: 4px 0 0; color: $text-tertiary; font-size: 11px; }
}

.sheet__close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-100;
  cursor: pointer;

  svg { width: 16px; height: 16px; }
  &:hover { color: $text-primary; }
}

.sheet__body { flex: 1; overflow-y: auto; padding: 20px 24px 32px; }

.sheet__section {
  padding-bottom: $space-5;
  margin-bottom: $space-5;
  border-bottom: 1px dashed $border-color;

  &:last-child { border-bottom: 0; margin-bottom: 0; }
  h3 { margin: 0 0 $space-3; color: $text-primary; font-size: $font-card-title; font-weight: $font-weight-semibold; }
}

.sheet__hint { margin: 0 0 $space-3; color: $text-tertiary; font-size: 11px; line-height: 1.6; }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.grid__wide { grid-column: 1 / -1; }

.grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;

  span { color: $text-secondary; font-size: $font-caption; }
}

.grid input,
.grid select,
.grid textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-primary;
  background: $surface-50;
  font: inherit;
  font-size: $font-body-sm;
  outline: none;

  &:focus { border-color: $brand-300; background: $surface-0; box-shadow: $shadow-focus; }
}

.grid textarea { resize: vertical; }

.concerns { margin-top: $space-3; }
.concerns > span { color: $text-secondary; font-size: $font-caption; }
.concerns__list { display: flex; flex-wrap: wrap; gap: $space-3; margin-top: 6px; }

.concern { display: inline-flex; align-items: center; gap: 5px; color: $text-primary; font-size: $font-caption; }

.sheet__foot { display: flex; justify-content: flex-end; margin-top: $space-4; }

.sheet__btn {
  padding: 9px 20px;
  border: 0;
  border-radius: $radius-sm;
  color: $surface-0;
  background: $brand-500;
  font: inherit;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;

  &:hover { background: $brand-600; }
  &:disabled { background: $surface-100; color: $text-tertiary; cursor: not-allowed; }
}

.sheet__error { margin: $space-2 0 0; color: $danger-500; font-size: $font-caption; }
.sheet__ok { margin: $space-2 0 0; color: $success-500; font-size: $font-caption; }

@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
