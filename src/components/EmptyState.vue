<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  /** 必须给出下一步：不提供动作时，description 应说明原因。 */
  actionText?: string
}>(), { description: '', actionText: '' })

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty" role="status">
    <div class="empty__mark" aria-hidden="true">—</div>
    <p class="empty__title">{{ title }}</p>
    <p v-if="description" class="empty__desc">{{ description }}</p>
    <el-button v-if="actionText" class="empty__action" type="primary" plain @click="emit('action')">
      {{ actionText }}
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-2;
  padding: $space-8 $space-5;
  text-align: center;
}

.empty__mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  background: $surface-100;
  color: $text-tertiary;
  font-size: $font-title;
}

.empty__title {
  margin: $space-2 0 0;
  font-size: $font-body;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.empty__desc {
  margin: 0;
  max-width: 420px;
  font-size: $font-body-sm;
  color: $text-secondary;
  line-height: 1.7;
}

.empty__action { margin-top: $space-2; }
</style>
