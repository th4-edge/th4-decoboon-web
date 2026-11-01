<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { assetUrl } from '@/core/http'
import { DEFAULT_WEB_BRAND_COLOR, contrastRatio, isValidBrandColor } from '@/core/brandTheme'

const props = withDefaults(defineProps<{
  name?: string
  logo?: string
  color?: string
  size?: number
}>(), {
  name: '企业',
  logo: '',
  color: '',
  size: 48
})

const imageFailed = ref(false)
watch(() => props.logo, () => { imageFailed.value = false })

const logoUrl = computed(() => assetUrl(props.logo))
const showImage = computed(() => Boolean(logoUrl.value) && !imageFailed.value)
const initial = computed(() => Array.from((props.name || '企').trim())[0] || '企')
const baseColor = computed(() => isValidBrandColor(props.color) ? String(props.color) : DEFAULT_WEB_BRAND_COLOR)
const textColor = computed(() => contrastRatio(baseColor.value, '#FFFFFF') >= 3 ? '#FFFFFF' : '#17212B')
const rootStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: textColor.value,
  backgroundColor: showImage.value ? '#FFFFFF' : baseColor.value,
  borderColor: baseColor.value
}))
</script>

<template>
  <span class="company-brand-mark" :style="rootStyle">
    <img v-if="showImage" :src="logoUrl" :alt="name" @error="imageFailed = true" />
    <span v-else>{{ initial }}</span>
  </span>
</template>

<style scoped>
.company-brand-mark {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  overflow: hidden;
  box-sizing: border-box;
  border: 2px solid transparent;
  border-radius: 14px;
  font-size: 20px;
  font-weight: 500;
  line-height: 1;
}
.company-brand-mark img { width: 78%; height: 78%; object-fit: contain; }
</style>
