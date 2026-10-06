<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'

/** Element Plus 全局中文：日期、分页、Dialog/Drawer 等默认文案统一为简体中文。 */
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
