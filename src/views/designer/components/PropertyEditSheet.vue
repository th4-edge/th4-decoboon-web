<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'

const props = defineProps<{
  open: boolean
  customerId: string
  property: Property | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const form = reactive({
  community: '',
  building: '',
  roomNo: '',
  address: '',
  area: '' as string | number,
  layout: '',
  remark: ''
})

const saving = ref(false)
const error = ref('')

watch(() => [props.open, props.property?.id], () => {
  if (!props.open) return
  error.value = ''
  const source = props.property
  form.community = source?.community ?? ''
  form.building = source?.building ?? ''
  form.roomNo = source?.roomNo ?? ''
  form.address = source?.address ?? ''
  form.area = source?.area !== undefined ? String(source.area) : ''
  form.layout = source?.layout ?? ''
  form.remark = source?.remark ?? ''
}, { immediate: true })

/**
 * 数字输入框经 Vue v-model 会自动转成 Number（type="number" 的既定行为），
 * 所以这里必须同时接受 string / number —— 曾经因为直接 .trim() 导致新增房屋报错。
 */
function numberOrUndefined(value: string | number | null | undefined): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

async function submit(): Promise<void> {
  error.value = ''
  if (!form.address.trim()) {
    error.value = '详细地址不能为空'
    return
  }
  const area = numberOrUndefined(form.area)
  if (area !== undefined && area <= 0) {
    error.value = '面积必须大于 0'
    return
  }
  saving.value = true
  try {
    const payload = {
      community: form.community.trim() || undefined,
      building: form.building.trim() || undefined,
      roomNo: form.roomNo.trim() || undefined,
      address: form.address.trim(),
      area,
      layout: form.layout.trim() || undefined,
      remark: form.remark.trim() || undefined
    }
    if (props.property) {
      await propertyApi.updateProperty({ propertyId: props.property.id, ...payload })
    } else {
      await propertyApi.saveProperty({ customerId: props.customerId, ...payload })
    }
    emit('saved')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="psheet" role="dialog" aria-modal="true" :aria-label="property ? '编辑房屋' : '新增房屋'">
    <div class="psheet__mask" @click="emit('close')" />
    <aside class="psheet__panel">
      <header class="psheet__head">
        <div>
          <h2>{{ property ? '编辑房屋' : '新增房屋' }}</h2>
          <p>量房、设计与报价都必须绑定房屋，不能用客户地址代替房屋档案。</p>
        </div>
        <button class="psheet__close" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>

      <div class="psheet__body">
        <div class="grid">
          <label><span>小区</span><input v-model="form.community" type="text" placeholder="小区名称" /></label>
          <label><span>楼栋</span><input v-model="form.building" type="text" placeholder="如 3 栋" /></label>
          <label><span>房号</span><input v-model="form.roomNo" type="text" placeholder="如 1502" /></label>
          <label><span>面积（㎡）</span><input v-model="form.area" type="number" min="0" placeholder="如 120" /></label>
          <label><span>户型</span><input v-model="form.layout" type="text" placeholder="如 三室两厅一厨两卫" /></label>
          <label class="grid__wide"><span>详细地址 *</span><input v-model="form.address" type="text" placeholder="楼栋房号或详细地址" /></label>
          <label class="grid__wide"><span>备注</span><textarea v-model="form.remark" rows="2" placeholder="补充说明" /></label>
        </div>
        <p v-if="error" class="psheet__error">{{ error }}</p>
      </div>

      <footer class="psheet__foot">
        <button class="psheet__ghost" type="button" @click="emit('close')">取消</button>
        <button class="psheet__btn" type="button" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : property ? '保存修改' : '新增房屋' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.psheet { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; }
.psheet__mask { position: absolute; inset: 0; background: rgba(26, 26, 23, .34); }

.psheet__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  height: 100%;
  background: $surface-0;
  box-shadow: -12px 0 32px rgba(26, 26, 23, .16);
}

.psheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  padding: 20px 24px;
  border-bottom: 1px solid $border-color;

  h2 { margin: 0; color: $text-primary; font-size: $font-title; font-weight: $font-weight-bold; }
  p { margin: 4px 0 0; color: $text-tertiary; font-size: 11px; line-height: 1.6; }
}

.psheet__close {
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

.psheet__body { flex: 1; overflow-y: auto; padding: 20px 24px; }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: $space-3; }
.grid__wide { grid-column: 1 / -1; }

.grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;

  span { color: $text-secondary; font-size: $font-caption; }
}

.grid input,
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

.psheet__foot {
  display: flex;
  justify-content: flex-end;
  gap: $space-2;
  padding: 16px 24px;
  border-top: 1px solid $border-color;
}

.psheet__ghost {
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

.psheet__btn {
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

.psheet__error { margin: $space-3 0 0; color: $danger-500; font-size: $font-caption; }

@media (max-width: 720px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
