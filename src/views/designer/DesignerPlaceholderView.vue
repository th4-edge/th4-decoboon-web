<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkbenchState from '@/components/workbench/WorkbenchState.vue'

const route = useRoute()
const router = useRouter()

/**
 * 菜单已按冻结稿设定，页面按菜单逐个交付。
 * 这里只做「诚实占位」：不放假数据、不放假动作，并说明该页最终由哪个业务口径承载。
 */
const DESCRIPTIONS: Record<string, string> = {
  feedback: '设计师负责受理、回复和关闭客户事项；台账与处理时效以项目域反馈 Provider（project/feedback）为准，不在此堆砌假数据。',
  customers: '客户与设计页按 G1 主链分批接入；在未接入前不展示假客户或假进度。',
  design: '设计转化列表页正在交付：待我设计对象将按方案状态排队，谈单与效果图在设计工作区内进行。',
  contract: '合同签约页正在建设中。设计师侧只做发起与登记，签约确认和生效由企业负责人或店长完成。',
  projects: '项目工地页正在建设中。项目推进、主材选材、增减项与验收/整改将作为页内工作台切换。',
  catalog: '报价项目库正在建设中。设计师只读检索，不显示标准成本、采购价和供应商历史价。',
  performance: '我的业绩页正在建设中。业绩指标必须来自系统统计，不用页面推算或假数据。'
}

const description = computed(() =>
  DESCRIPTIONS[String(route.name).split('-').at(-1) ?? ''] ?? '该页面正在按菜单逐个交付。'
)
</script>

<template>
  <section class="designer-placeholder">
    <WorkbenchState
      variant="building"
      :title="`${route.meta.title || '设计师页面'} · 建设中`"
      :description="description"
      action-text="返回业务工作台"
      min-height="420px"
      @action="router.push('/designer/workbench')"
    />
  </section>
</template>

<style scoped lang="scss">
.designer-placeholder {
  display: grid;
  place-items: center;
  border: 1px dashed $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
}
</style>
