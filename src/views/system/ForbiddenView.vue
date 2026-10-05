<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="state">
    <h1 class="state__title">无权访问该页面</h1>
    <p class="state__desc">当前账号的角色或数据范围不允许打开该对象。如确实需要处理，请联系企业负责人调整岗位职责。</p>
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
.state__desc { margin: 0; max-width: 520px; font-size: $font-body-sm; color: $text-secondary; line-height: 1.7; }
</style>
