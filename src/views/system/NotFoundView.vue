<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="state">
    <h1 class="state__title">页面不存在</h1>
    <p class="state__desc">地址可能已变更，或该页面尚未在 V3 中接入。</p>
    <el-button type="primary" @click="router.replace('/workbench')">返回工作台</el-button>
  </div>
</template>

<style scoped lang="scss">
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-3;
  padding: $space-10;
  text-align: center;
}

.state__title { margin: 0; font-size: $font-h1; }
.state__desc { margin: 0; font-size: $font-body-sm; color: $text-secondary; }
</style>
