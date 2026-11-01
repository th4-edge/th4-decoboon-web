<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { watch } from 'vue'
import { applyCompanyWebBrand } from '@/core/brandTheme'
import { useSessionStore } from '@/stores/session'

/** Element Plus 全局中文：日期、分页、Dialog/Drawer 等默认文案统一为简体中文。 */
const session = useSessionStore()
watch(
  () => [session.company?.title, session.company?.name, session.company?.logo, session.company?.color] as const,
  () => applyCompanyWebBrand(session.company),
  { immediate: true }
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
