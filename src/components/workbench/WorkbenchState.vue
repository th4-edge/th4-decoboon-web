<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'empty' | 'error' | 'building'
  title: string
  description?: string
  actionText?: string
  minHeight?: string
}>(), {
  variant: 'empty',
  description: '',
  actionText: '',
  minHeight: '220px'
})

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div
    class="wb-state"
    :class="`wb-state--${variant}`"
    :style="{ minHeight }"
    role="status"
    aria-live="polite"
  >
    <span class="wb-state__mark" aria-hidden="true">
      <svg v-if="variant === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <svg v-else-if="variant === 'building'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M12 7.5V12l3 2" />
        <path d="M3 21l1.6-4.2L8.8 18z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 7.5 12 4l9 3.5v9L12 20l-9-3.5z" />
        <path d="M3 7.5 12 11l9-3.5M12 11v9" />
      </svg>
    </span>
    <p class="wb-state__title">{{ title }}</p>
    <p v-if="description" class="wb-state__desc">{{ description }}</p>
    <button v-if="actionText" class="wb-state__action" type="button" @click="emit('action')">
      {{ actionText }}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.wb-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-2;
  padding: $space-6 $space-5;
  text-align: center;
}

.wb-state__mark {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  color: $text-tertiary;
  background: $surface-100;

  svg { width: 22px; height: 22px; }
}

.wb-state--error .wb-state__mark {
  color: $danger-500;
  background: $danger-50;
}

.wb-state--building .wb-state__mark {
  color: $warning-700;
  background: $warning-50;
}

.wb-state__title {
  margin: $space-1 0 0;
  color: $text-primary;
  font-size: $font-body;
  font-weight: $font-weight-semibold;
}

.wb-state__desc {
  max-width: 420px;
  margin: 0;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.65;
}

.wb-state__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: $space-2;
  padding: 8px 16px;
  border: 1px solid $brand-300;
  border-radius: $radius-sm;
  color: $brand-600;
  background: $brand-50;
  font: inherit;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background .16s, border-color .16s;

  svg { width: 13px; height: 13px; transition: transform .16s; }
  &:hover { border-color: $brand-500; background: $brand-100; }
  &:hover svg { transform: translateX(2px); }
}
</style>
