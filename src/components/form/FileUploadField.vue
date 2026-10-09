<script setup lang="ts">
/**
 * 标准上传字段（Web 统一实现）。
 *
 * 依据：`WEB-工作台设计构建规范` §8 表单落地规则。
 * - 图片类文件（contentType=image/* 或图片扩展名）用缩略图 + `el-image` 点击预览（支持左右切换）；
 * - 非图片文件用「文件名 + 新窗口打开」；
 * - 上传/移除/上限/禁用/失败恢复统一在这里处理，各页禁止再自写上传块。
 *
 * 对外 `v-model` 为 `UploadedFile[]`（`{ path, url, name, contentType, size }`）。
 */
import { computed, ref } from 'vue'
import { fileApi } from '@/domains/file/api'
import type { PrivateFileScope, UploadedFile } from '@/domains/file/model'

const props = withDefaults(defineProps<{
  modelValue: UploadedFile[]
  /** 私有文件业务域，决定后端授权范围 */
  businessType: PrivateFileScope
  label?: string
  hint?: string
  /** 原生 accept，如 `image/*` / `image/*,.pdf` */
  accept?: string
  /** 项目级私有文件需要显式项目上下文（如验收证据） */
  projectId?: string
  multiple?: boolean
  max?: number
  disabled?: boolean
  /** 图片是否可点击预览（默认开启） */
  preview?: boolean
}>(), {
  label: '',
  hint: '',
  accept: 'image/*',
  projectId: '',
  multiple: true,
  max: 9,
  disabled: false,
  preview: true
})

const emit = defineEmits<{
  'update:modelValue': [value: UploadedFile[]]
  error: [message: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
/** 视频预览弹窗（Element Plus 无内建视频查看器） */
const playingVideo = ref<UploadedFile | null>(null)

function isVideo(file: UploadedFile): boolean {
  if (file.contentType?.startsWith('video/')) return true
  const name = file.name ?? file.path
  return /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(name)
}

function isImage(file: UploadedFile): boolean {
  if (file.contentType?.startsWith('image/')) return true
  const name = file.name ?? file.path
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(name)
}

const imageFiles = computed(() => props.modelValue.filter(isImage))
const imageSrcList = computed(() => imageFiles.value.map((file) => file.url))
const reachedMax = computed(() => props.modelValue.length >= props.max)

function imageIndex(file: UploadedFile): number {
  return imageFiles.value.findIndex((item) => item.path === file.path)
}

async function onPick(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  if (!picked.length) return

  const room = props.multiple ? Math.max(0, props.max - props.modelValue.length) : 1
  if (room <= 0) {
    emit('error', `最多上传 ${props.max} 个文件`)
    return
  }
  const accepted = picked.slice(0, room)
  if (accepted.length < picked.length) {
    emit('error', `最多上传 ${props.max} 个文件，超出部分已忽略`)
  }

  uploading.value = true
  const next = [...props.modelValue]
  try {
    for (const file of accepted) {
      next.push(await fileApi.uploadFile(props.businessType, file, { projectId: props.projectId || undefined }))
    }
    emit('update:modelValue', next)
  } catch (uploadError) {
    // 部分成功也要回写，避免已上传的文件丢失
    if (next.length !== props.modelValue.length) emit('update:modelValue', next)
    emit('error', uploadError instanceof Error ? uploadError.message : '文件上传失败')
  } finally {
    uploading.value = false
  }
}

function openVideo(file: UploadedFile): void {
  playingVideo.value = file
}

function remove(path: string): void {
  emit('update:modelValue', props.modelValue.filter((file) => file.path !== path))
}
</script>

<template>
  <div class="upload">
    <div class="upload__head">
      <div class="upload__meta">
        <strong v-if="label">{{ label }}</strong>
        <small v-if="hint">{{ hint }}</small>
      </div>
      <button
        type="button"
        class="upload__btn"
        :disabled="disabled || uploading || reachedMax"
        @click="inputRef?.click()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {{ uploading ? '上传中…' : '上传' }}
        <em>{{ modelValue.length }}/{{ max }}</em>
      </button>
    </div>

    <input ref="inputRef" type="file" :accept="accept" :multiple="multiple" hidden @change="onPick" />

    <div v-if="modelValue.length" class="upload__grid">
      <template v-for="file in modelValue" :key="file.path">
        <div v-if="preview && isImage(file)" class="upload__thumb">
          <el-image
            :src="file.url"
            :preview-src-list="imageSrcList"
            :initial-index="imageIndex(file)"
            fit="cover"
            preview-teleported
            class="upload__thumb-img"
          />
          <button v-if="!disabled" type="button" class="upload__remove" title="移除" @click.stop="remove(file.path)">×</button>
        </div>
        <div v-else-if="preview && isVideo(file)" class="upload__thumb upload__thumb--video" @click="openVideo(file)">
          <video :src="file.url" preload="metadata" muted playsinline class="upload__thumb-video" />
          <span class="upload__play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <button v-if="!disabled" type="button" class="upload__remove" title="移除" @click.stop="remove(file.path)">×</button>
        </div>
        <div v-else class="upload__file">
          <a :href="file.url" target="_blank" rel="noopener">{{ file.name || '文件' }}</a>
          <button v-if="!disabled" type="button" class="upload__remove upload__remove--inline" @click.stop="remove(file.path)">移除</button>
        </div>
      </template>
    </div>
    <p v-else class="upload__empty">还没有上传{{ label || '文件' }}</p>

    <el-dialog
      :model-value="!!playingVideo"
      :title="playingVideo?.name || '视频预览'"
      width="min(760px, 92vw)"
      append-to-body
      destroy-on-close
      @update:model-value="playingVideo = null"
    >
      <video v-if="playingVideo" :src="playingVideo.url" controls autoplay playsinline class="upload__player" />
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.upload { display: flex; flex-direction: column; gap: $space-2; }

.upload__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.upload__meta strong { color: $text-primary; font-size: $font-body-sm; }
.upload__meta small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }

.upload__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $brand-600;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover:not(:disabled) { border-color: $brand-300; background: $brand-50; }
  &:disabled { cursor: not-allowed; opacity: .55; }
  svg { width: 13px; height: 13px; }
  em { color: $text-tertiary; font-style: normal; font-variant-numeric: tabular-nums; }
}

.upload__grid { display: flex; flex-wrap: wrap; gap: $space-2; }

.upload__thumb { position: relative; width: 84px; height: 84px; }
.upload__thumb-img { width: 84px; height: 84px; border: 1px solid $border-color; border-radius: $radius-sm; overflow: hidden; cursor: zoom-in; }

.upload__thumb--video { cursor: pointer; }
.upload__thumb-video { width: 84px; height: 84px; border: 1px solid $border-color; border-radius: $radius-sm; object-fit: cover; background: $ink-950; }
.upload__play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: $surface-0;
  pointer-events: none;

  svg { width: 26px; height: 26px; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .5)); }
}
.upload__player { width: 100%; max-height: 70vh; border-radius: $radius-sm; background: $ink-950; }

.upload__file {
  display: inline-flex;
  align-items: center;
  gap: $space-2;
  padding: 6px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;

  a { color: $brand-600; font-size: $font-caption; text-decoration: none; }
  a:hover { text-decoration: underline; }
}

.upload__remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: $danger-500;
  color: $surface-0;
  font-size: $font-caption;
  line-height: 1;
  cursor: pointer;
}
.upload__remove--inline { position: static; width: auto; height: auto; padding: 2px 6px; border-radius: $radius-sm; background: transparent; color: $danger-500; font-size: $font-caption; }

.upload__empty { margin: 0; color: $text-tertiary; font-size: $font-caption; }
</style>
