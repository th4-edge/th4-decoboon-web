<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import DesignerLayout from './DesignerLayout.vue'
import FinanceLayout from './FinanceLayout.vue'
import PmLayout from './PmLayout.vue'
import WorkbenchLayout from './WorkbenchLayout.vue'

/**
 * 业务域壳层由「登录角色」裁决，不由路由前缀裁决。
 *
 * DEC-032 / BR-028：一人装企 BOSS 可以切换岗位视角查看各域工作台，
 * 但界面上下文、数据范围和审计主体仍是企业负责人本人。
 * 因此企业负责人进入 /designer、/pm、/finance 时仍停留在负责人壳（WorkbenchLayout），
 * 不得因为 URL 前缀变成设计师/项目经理/财务角色的壳层。
 *
 * 设计师、项目经理、财务仍使用各自的岗位壳层。
 */
const session = useSessionStore()

const shell = computed(() => {
  switch (session.role) {
    case 'Designer': return DesignerLayout
    case 'Pm': return PmLayout
    case 'Finance': return FinanceLayout
    default: return WorkbenchLayout
  }
})
</script>

<template>
  <component :is="shell" />
</template>
