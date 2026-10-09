<script setup lang="ts">
/**
 * 对象 Hero 骨架（唯一实现）。
 *
 * 依据：`WEB-工作台设计构建规范` §4.7——五种主体（客户 / 房屋 / 方案 / 报价 / 合同）必须共用同一骨架，
 * 差异只在主体字段映射；**L1 关注层由页面插槽传入**，不由主体决定。
 *
 * 结构：L0 主体身份 → 标签行 → L1 关注层 → L2 背景事实（+ 附加区）→ footer 操作。
 * 本组件只负责结构与样式，不含任何业务字段；各主体组件（CustomerHeroCard / PropertyHeroCard …）
 * 通过插槽填充内容。
 */
</script>

<template>
  <section class="ohero">
    <!-- L0 主体身份层 -->
    <div class="ohero__identity">
      <div class="ohero__top">
        <div class="ohero__avatar" aria-hidden="true"><slot name="avatar" /></div>
        <div class="ohero__ident">
          <div class="ohero__title"><slot name="title" /></div>
          <p class="ohero__subtitle"><slot name="subtitle" /></p>
        </div>
      </div>
      <div v-if="$slots.chips" class="ohero__chips"><slot name="chips" /></div>
    </div>

    <!-- 本页对象信息行（唯一 Hero 内追加，如量房页的"本次房屋"；主体仍是客户） -->
    <div v-if="$slots['object-context']" class="ohero__object"><slot name="object-context" /></div>

    <!-- L1 当前阶段关注层（按页面插槽传入） -->
    <div v-if="$slots.focus" class="ohero__focus" aria-label="当前阶段重点"><slot name="focus" /></div>

    <!-- L2 背景事实层 -->
    <div v-if="$slots.facts || $slots.extra" class="ohero__background">
      <div v-if="$slots.facts" class="ohero__facts"><slot name="facts" /></div>
      <div v-if="$slots.extra" class="ohero__extra"><slot name="extra" /></div>
    </div>

    <div v-if="$slots.footer || $slots.actions" class="ohero__footer">
      <slot name="footer" />
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped lang="scss">
.ohero {
  padding: 10px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: linear-gradient(135deg, $brand-50, $surface-0 70%);
}

.ohero__top { display: flex; align-items: flex-start; gap: $space-3; }
.ohero__avatar { width: 50px; height: 50px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: $brand-600; color: $surface-0; font-size: $font-title; font-weight: $font-weight-bold; }
.ohero__avatar :deep(svg) { width: 24px; height: 24px; }
.ohero__ident { flex: 1; min-width: 0; }
.ohero__title { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.ohero__title :deep(h2) { margin: 0; color: $text-primary; font-size: $font-title; }
.ohero__subtitle { margin: 5px 0 0; color: $text-secondary; font-size: $font-body-sm; }

.ohero__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

.ohero__object { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 8px; padding: 7px 9px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.ohero__object :deep(small) { color: $text-tertiary; font-size: $font-caption; }
.ohero__object :deep(strong) { color: $text-primary; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.ohero__object :deep(span) { color: $text-secondary; font-size: $font-caption; }

.ohero__focus { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }

.ohero__background { margin-top: 8px; }
.ohero__facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.ohero__facts :deep(> div) { min-width: 0; padding: 6px 8px; border-radius: $radius-sm; background: rgba(255, 255, 255, .72); }
.ohero__facts :deep(small) { display: block; color: $text-tertiary; font-size: $font-caption; }
.ohero__facts :deep(b) { display: block; margin-top: 3px; overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }

.ohero__extra { margin-top: 6px; padding-top: 6px; border-top: 1px solid $border-color; }

.ohero__footer { display: flex; align-items: center; justify-content: space-between; gap: $space-3; margin-top: $space-3; padding-top: $space-3; border-top: 1px solid $border-color; }
.ohero__footer :deep(small) { display: block; color: $text-tertiary; font-size: $font-caption; }
.ohero__footer :deep(b) { display: block; margin-top: 3px; color: $text-secondary; font-size: $font-body-sm; font-weight: $font-weight-medium; }

@media (max-width: 1024px) {
  .ohero__focus { grid-template-columns: 1fr; }
  .ohero__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
