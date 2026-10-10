<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fileApi } from '@/domains/file/api'
import type { CustomerFollow } from '@/domains/crm/model'

const props = withDefaults(defineProps<{
  follow: CustomerFollow
  limit?: number
}>(), {
  limit: 3
})

const urls = ref<string[]>([])
const loading = ref(false)
const expanded = ref(false)
const refreshed = ref(false)

const shown = computed(() => expanded.value ? urls.value : urls.value.slice(0, props.limit))
const hiddenCount = computed(() => Math.max(0, urls.value.length - shown.value.length))

watch(
  () => [props.follow.id, props.follow.images?.join('|') || '', props.follow.imageUrls?.join('|') || ''],
  () => {
    urls.value = (props.follow.imageUrls || []).filter(Boolean)
    expanded.value = false
    refreshed.value = false
    if (!urls.value.length && props.follow.images?.length) void refresh()
  },
  { immediate: true }
)

async function refresh(): Promise<void> {
  if (loading.value || !props.follow.id || !props.follow.images?.length) return
  loading.value = true
  try {
    urls.value = await fileApi.grantFiles('CustomerFollow', props.follow.id, props.follow.images)
    props.follow.imageUrls = urls.value
  } catch {
    urls.value = []
  } finally {
    loading.value = false
  }
}

async function onImageError(): Promise<void> {
  if (refreshed.value) return
  refreshed.value = true
  await refresh()
}
</script>

<template>
  <div v-if="follow.images?.length" class="follow-images" aria-label="客户跟进图片">
    <div v-if="loading" class="follow-images__state">图片加载中…</div>
    <template v-else-if="urls.length">
      <el-image
        v-for="(url, index) in shown"
        :key="url"
        class="follow-images__thumb"
        :src="url"
        :preview-src-list="urls"
        :initial-index="index"
        fit="cover"
        preview-teleported
        @error="onImageError"
      />
      <button v-if="hiddenCount" type="button" class="follow-images__more" @click="expanded = true">
        +{{ hiddenCount }}
      </button>
    </template>
    <button v-else type="button" class="follow-images__retry" @click="refresh">图片暂不可加载，点击重试</button>
  </div>
</template>

<style scoped lang="scss">
.follow-images { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; margin-top: 8px; }
.follow-images__thumb { width: 72px; height: 72px; border: 1px solid $border-color; border-radius: $radius-sm; cursor: zoom-in; }
.follow-images__more { width: 72px; height: 72px; border: 1px dashed $border-color; border-radius: $radius-sm; background: $surface-50; color: $text-secondary; font: inherit; font-size: $font-caption; cursor: pointer; }
.follow-images__more:hover { border-color: $brand-300; color: $brand-600; }
.follow-images__state, .follow-images__retry { color: $text-tertiary; font-size: $font-caption; }
.follow-images__retry { padding: 0; border: 0; background: transparent; color: $brand-600; cursor: pointer; }
</style>
