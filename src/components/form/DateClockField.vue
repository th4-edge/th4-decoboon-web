<script setup lang="ts">
/**
 * 日期 + 时分 两段式时间控件（替代 el-date-picker type="datetime"）。
 *
 * 背景：默认 datetime 控件要在日历与时间滚轮之间来回操作，现场录预约/量房时间不方便。
 * 拆成「年月日」日期选择 + 「时分」下拉选择，各一步完成；对外 v-model 统一为 `YYYY-MM-DD HH:mm:ss`。
 */
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** 'YYYY-MM-DD HH:mm:ss'；日期与时间都选完才回填 */
  modelValue: string
  datePlaceholder?: string
  timePlaceholder?: string
  /** 可选时段与步长（默认 08:00–21:00，30 分钟一档） */
  start?: string
  end?: string
  step?: string
  disabled?: boolean
}>(), {
  datePlaceholder: '选择日期',
  timePlaceholder: '选择时间',
  start: '08:00',
  end: '21:00',
  step: '00:30',
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const dateValue = ref('')
const timeValue = ref('')

function parse(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const [date = '', clock = ''] = value.split(' ')
  return { date, time: clock.slice(0, 5) }
}

watch(() => props.modelValue, (value) => {
  const parsed = parse(value)
  if (parsed.date !== dateValue.value) dateValue.value = parsed.date
  if (parsed.time !== timeValue.value) timeValue.value = parsed.time
}, { immediate: true })

watch([dateValue, timeValue], ([date, time]) => {
  const next = date && time ? `${date} ${time}:00` : ''
  if (next !== props.modelValue) emit('update:modelValue', next)
})

/** 常见预约日：今天 / 明天 / 后天。 */
const shortcuts = [
  {
    text: '今天',
    value: () => new Date()
  },
  {
    text: '明天',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d
    }
  },
  {
    text: '后天',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() + 2)
      return d
    }
  }
]
</script>

<template>
  <div class="date-clock">
    <el-date-picker
      v-model="dateValue"
      type="date"
      value-format="YYYY-MM-DD"
      format="YYYY-MM-DD"
      :placeholder="datePlaceholder"
      :shortcuts="shortcuts"
      :disabled="disabled"
      class="date-clock__part"
    />
    <el-time-select
      v-model="timeValue"
      :start="start"
      :end="end"
      :step="step"
      :placeholder="timePlaceholder"
      :disabled="disabled"
      class="date-clock__part date-clock__part--time"
    />
  </div>
</template>

<style scoped lang="scss">
.date-clock {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: $space-2;
  width: 100%;
}

.date-clock__part { width: 100%; }
</style>
