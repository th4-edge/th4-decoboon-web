import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 角色壳层徽标：由业务工作台 Report 写入，壳层只负责展示。 */
export const useWorkbenchShellStore = defineStore('workbench-shell', () => {
  const badges = ref<Record<string, number>>({})

  function setBadges(next: Record<string, number>): void {
    badges.value = { ...next }
  }

  function clear(): void {
    badges.value = {}
  }

  return { badges, setBadges, clear }
})
