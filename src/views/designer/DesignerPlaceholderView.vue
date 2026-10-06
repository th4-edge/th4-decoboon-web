<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const descriptions: Record<string, string> = {
  customers: '客户与设计页正在按 G1 主链分批接入。当前优先交付报价工作台；在未接入前不展示假客户或假进度。',
  contract: '合同交接页正在建设中。设计师侧只做只读摘要与催办，不具备签约和生效权限。',
  projects: '项目工地页正在建设中。设计师在项目中的参与范围、排期协同和只读节点尚未接入。',
  catalog: '报价项目库正在建设中。设计师只读检索，不显示标准成本、采购价和供应商历史价。',
  performance: '我的业绩页正在建设中。业绩指标必须来自服务端统计，不用前端推算或假数据。'
}

const description = descriptions[String(route.name).split('-').at(-1) ?? ''] || '该设计页面正在建设中。'
</script>

<template>
  <div class="designer-placeholder">
    <span class="designer-placeholder__mark" aria-hidden="true">建</span>
    <p class="designer-placeholder__eyebrow">DESIGNER · V3 分批交付</p>
    <h2>{{ route.meta.title || '设计师页面' }}</h2>
    <p>{{ description }}</p>
    <el-button type="primary" @click="router.push('/designer/quotes')">先去报价工作台</el-button>
  </div>
</template>

<style scoped lang="scss">
.designer-placeholder {
  min-height: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-3;
  margin: $space-5;
  padding: $space-8;
  border: 1px dashed $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  text-align: center;

  h2 { margin: 0; font-size: $font-display; }
  p { margin: 0; max-width: 620px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.8; }
}

.designer-placeholder__mark {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: $radius-md;
  background: $brand-50;
  color: $brand-700;
  font-size: $font-display;
  font-weight: $font-weight-bold;
}

.designer-placeholder__eyebrow {
  color: $text-tertiary !important;
  font-size: $font-caption !important;
  letter-spacing: .1em;
}
</style>
