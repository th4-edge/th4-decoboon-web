<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'

const props = withDefaults(defineProps<{ viewLabel?: string }>(), { viewLabel: '' })
const session = useSessionStore()

const initials = computed(() => session.displayName.trim().slice(-1) || '员')
const organization = computed(() => {
  const parts = [session.store?.name, session.employee?.team?.name].filter(Boolean)
  return parts.length ? parts.join(' · ') : '未分配门店与团队'
})
</script>

<template>
  <section class="identity-card" aria-label="当前登录身份">
    <span class="identity-card__avatar" aria-hidden="true">{{ initials }}</span>
    <div class="identity-card__body">
      <div class="identity-card__heading">
        <strong>{{ session.displayName }}</strong>
        <span class="identity-card__role">{{ session.roleName }}</span>
      </div>
      <p>{{ session.companyName }}</p>
      <div class="identity-card__meta">
        <span>{{ organization }}</span>
        <span>数据范围 {{ session.dataScopeName }}</span>
        <span v-if="props.viewLabel">当前查看 {{ props.viewLabel }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.identity-card {
  display: flex;
  align-items: center;
  gap: $space-4;
  min-width: 0;
  padding: $space-4 $space-5;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}

.identity-card__avatar {
  display: grid;
  place-items: center;
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  color: $surface-0;
  background: $brand-600;
  font-size: $font-card-title;
  font-weight: $font-weight-bold;
}

.identity-card__body {
  min-width: 0;
  flex: 1;
}

.identity-card__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $space-2;
}

.identity-card__heading strong {
  color: $text-primary;
  font-size: $font-card-title;
}

.identity-card__role {
  padding: 2px $space-2;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.identity-card__body > p {
  margin: 4px 0 0;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.identity-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1 $space-4;
  margin-top: $space-2;
  color: $text-tertiary;
  font-size: $font-caption;
}

@media (max-width: 700px) {
  .identity-card {
    align-items: flex-start;
    padding: $space-4;
  }
}
</style>
