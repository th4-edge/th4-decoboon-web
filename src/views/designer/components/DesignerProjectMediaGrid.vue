<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  media?: string[]
  unavailable?: boolean
}>(), {
  media: () => [],
  unavailable: false
})

interface MediaItem {
  url: string
  kind: 'image' | 'video'
  imageIndex: number
}

const playingVideo = ref('')
const videoVisible = computed({
  get: () => Boolean(playingVideo.value),
  set: (value: boolean) => { if (!value) playingVideo.value = '' }
})

const items = computed<MediaItem[]>(() => {
  let imageIndex = 0
  return props.media.filter(Boolean).map((url) => {
    const kind = isVideoUrl(url) ? 'video' : 'image'
    const item: MediaItem = { url, kind, imageIndex: kind === 'image' ? imageIndex : -1 }
    if (kind === 'image') imageIndex += 1
    return item
  })
})
const imageUrls = computed(() => items.value.filter((item) => item.kind === 'image').map((item) => item.url))

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(?:[?#&]|$)/i.test(decode(url))
}
</script>

<template>
  <div v-if="unavailable" class="media__unavailable">图片 / 视频暂不可确认，请刷新后重试</div>
  <div v-else-if="items.length" class="media-grid" :class="`media-grid--${Math.min(items.length, 3)}`">
    <template v-for="item in items" :key="item.url">
      <el-image
        v-if="item.kind === 'image'"
        class="media-grid__item"
        :src="item.url"
        :preview-src-list="imageUrls"
        :initial-index="item.imageIndex"
        fit="cover"
        preview-teleported
      >
        <template #error>
          <span class="media-grid__error">图片暂不可确认</span>
        </template>
      </el-image>
      <button
        v-else
        type="button"
        class="media-grid__item media-grid__video"
        @click="playingVideo = item.url"
      >
        <video :src="item.url" preload="metadata" muted playsinline />
        <span class="media-grid__video-badge">视频</span>
      </button>
    </template>
  </div>

  <el-dialog v-model="videoVisible" title="查看视频" width="720px" append-to-body destroy-on-close>
    <video v-if="playingVideo" :src="playingVideo" controls autoplay playsinline class="media-grid__player" />
  </el-dialog>
</template>

<style scoped lang="scss">
.media__unavailable { margin-top: 8px; padding: 8px 10px; border: 1px solid $warning-200; border-radius: $radius-sm; background: $warning-50; color: $warning-700; font-size: $font-caption; }

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 8px;
  max-width: 420px;
}

.media-grid--1 { grid-template-columns: minmax(0, 1fr); max-width: 280px; }
.media-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 300px; }

.media-grid__item {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  aspect-ratio: 1;
  overflow: hidden;
  border: 0;
  border-radius: $radius-sm;
  background: $surface-100;
  cursor: zoom-in;
}

.media-grid__item :deep(img) { width: 100%; height: 100%; object-fit: cover; }

.media-grid__error { display: grid; place-items: center; width: 100%; height: 100%; padding: 8px; background: $surface-100; color: $text-tertiary; font-size: $font-caption; text-align: center; }
.media-grid__video { padding: 0; cursor: pointer; }
.media-grid__video video { width: 100%; height: 100%; object-fit: cover; background: $ink-950; }
.media-grid__video-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: $radius-pill;
  background: rgba(0, 0, 0, .58);
  color: $surface-0;
  font-size: $font-caption;
  transform: translate(-50%, -50%);
}

.media-grid__player { display: block; width: 100%; max-height: 70vh; background: $ink-950; }

@media (max-width: 640px) {
  .media-grid { max-width: none; }
  .media-grid--1 { max-width: 240px; }
}
</style>
