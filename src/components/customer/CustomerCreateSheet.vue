<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { crmApi } from '@/domains/crm/api'
import { CUSTOMER_SOURCE_OPTIONS, GENDER_OPTIONS } from '@/domains/crm/options'
import type { Customer } from '@/domains/crm/model'
import NavIcon from '@/components/shell/NavIcon.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [customer: Customer] }>()

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

const saving = ref(false)
const error = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  error.value = ''
  basic.name = ''
  basic.telNo = ''
  basic.gender = ''
  basic.source = ''
  basic.community = ''
  basic.addr = ''
  basic.area = ''
  basic.budget = ''
  basic.remark = ''
}, { immediate: true })

/** number 输入框经 v-model 会自动转 Number，string/number 都要能处理。 */
function numberOrUndefined(value: string | number | null | undefined): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

async function submit(): Promise<void> {
  error.value = ''
  if (!basic.name.trim()) {
    error.value = '客户姓名不能为空'
    return
  }
  if (!basic.telNo.trim()) {
    error.value = '手机号不能为空'
    return
  }
  if (!/^\d{6,20}$/.test(basic.telNo.trim())) {
    error.value = '手机号格式不正确'
    return
  }
  saving.value = true
  try {
    const created = await crmApi.saveCustomer({
      name: basic.name.trim(),
      telNo: basic.telNo.trim(),
      gender: basic.gender || undefined,
      source: basic.source || undefined,
      community: basic.community.trim() || undefined,
      addr: basic.addr.trim() || undefined,
      area: numberOrUndefined(basic.area),
      budget: numberOrUndefined(basic.budget),
      remark: basic.remark.trim() || undefined
    })
    emit('created', created)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '新增客户失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="csheet" role="dialog" aria-modal="true" aria-label="新增客户">
    <div class="csheet__mask" @click="emit('close')" />
    <aside class="csheet__panel">
      <header class="csheet__head">
        <div>
          <h2>新增客户</h2>
          <p>姓名与手机号必填；企业、门店和负责人按当前登录账号自动确定。</p>
        </div>
        <button class="csheet__close" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div class="csheet__body">
        <div class="grid">
          <label><span>客户姓名 *</span><input v-model="basic.name" type="text" placeholder="请输入姓名" /></label>
          <label><span>手机号 *</span><input v-model="basic.telNo" type="tel" placeholder="11 位手机号" /></label>
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
        <p v-if="error" class="csheet__error">{{ error }}</p>
        <p class="csheet__hint">新增后请为该客户建立房屋档案 —— 量房、设计与报价都必须绑定房屋，不能用客户地址代替。</p>
      </div>

      <footer class="csheet__foot">
        <button class="csheet__ghost" type="button" @click="emit('close')"><NavIcon name="back" />取消</button>
        <button class="csheet__btn" type="button" :disabled="saving" @click="submit">
          <NavIcon :name="saving ? 'refresh' : 'add'" />{{ saving ? '提交中…' : '新增客户' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.csheet { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
.csheet__mask { position: absolute; inset: 0; background: rgba(26, 26, 23, .34); }

.csheet__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(540px, 100%);
  height: 100%;
  background: $surface-0;
  box-shadow: -12px 0 32px rgba(26, 26, 23, .16);
}

.csheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: 20px 24px;
  border-bottom: 1px solid $border-color;

  h2 { margin: 0; color: $text-primary; font-size: $font-title; font-weight: $font-weight-bold; }
  p { margin: 4px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
}

.csheet__close {
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
}

.csheet__body { flex: 1; overflow-y: auto; padding: 20px 24px; }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.grid__wide { grid-column: 1 / -1; }

.grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;

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

.csheet__hint { margin: $space-4 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.7; }
.csheet__error { margin: $space-3 0 0; color: $danger-500; font-size: $font-caption; }

.csheet__foot {
  display: flex;
  justify-content: flex-end;
  gap: $space-2;
  padding: 16px 24px;
  border-top: 1px solid $border-color;
}

.csheet__ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  font: inherit;
  font-size: $font-body-sm;
  cursor: pointer;

  &:hover { color: $text-primary; border-color: $brand-300; }
}

.csheet__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
