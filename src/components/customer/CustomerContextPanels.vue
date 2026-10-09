<script setup lang="ts">
/**
 * 客户跨阶段事实面板（客户诉求 + 跟进记录）。
 *
 * 依据：`WEB-工作台设计构建规范` §4.9——诉求与跟进在 5 个工作台中栏都必须存在，
 * 权重按 §4.5（跟进/量房=重点；设计/报价/签约=常规可折叠）；形态统一，禁止各页各写一套。
 *
 * 页面只负责：传入数据、决定 `order` 与 `emphasis`、接 `record-*` 事件打开自己的抽屉。
 */
import { computed, ref } from 'vue'
import StatusTag from '@/components/StatusTag.vue'
import { CUSTOMER_FOLLOW_WAY_LABELS } from '@/domains/crm/customerMeta'
import type { CustomerFollow } from '@/domains/crm/model'
import type { DesignRequirement } from '@/domains/design/model'
import { REQUIREMENT_CATEGORY_LABELS, REQUIREMENT_KIND_LABELS, REQUIREMENT_PRIORITY_LABELS } from '@/domains/design/requirementOptions'
import { formatDateTime, formatRelativeDay } from '@/core/format'

const props = withDefaults(defineProps<{
  follows: CustomerFollow[]
  requirements: DesignRequirement[]
  /** 面板顺序；默认 客户诉求 → 跟进记录 */
  order?: Array<'requirement' | 'follow'>
  /** primary = 完整展示；normal = 默认折叠（设计/报价/签约阶段） */
  emphasis?: 'primary' | 'normal'
  requirementLimit?: number
  followLimit?: number
  /** 页面是否提供对应的记录入口；没有抽屉时置 false，避免出现死按钮 */
  canRecordRequirement?: boolean
  canRecordFollow?: boolean
}>(), {
  order: () => ['requirement', 'follow'],
  emphasis: 'primary',
  requirementLimit: 4,
  followLimit: 3,
  canRecordRequirement: true,
  canRecordFollow: true
})

defineEmits<{
  'record-requirement': []
  'record-follow': []
}>()

const expanded = ref(props.emphasis === 'primary')

const requirementItems = computed(() => expanded.value
  ? props.requirements
  : props.requirements.slice(0, props.requirementLimit))
const followItems = computed(() => expanded.value
  ? props.follows
  : props.follows.slice(0, props.followLimit))

const collapsible = computed(() =>
  props.requirements.length > props.requirementLimit || props.follows.length > props.followLimit
)
</script>

<template>
  <section class="ccp" :class="{ 'ccp--normal': emphasis === 'normal' }">
    <template v-for="section in order" :key="section">
      <!-- 客户诉求 -->
      <section v-if="section === 'requirement'" class="ccp__panel">
        <header class="ccp__head">
          <div>
            <strong>客户诉求</strong>
            <small>客户要什么、忌讳什么，是设计与报价的输入</small>
          </div>
          <button v-if="canRecordRequirement" type="button" class="ccp__action" @click="$emit('record-requirement')">记录诉求</button>
        </header>
        <div v-if="requirements.length" class="ccp__list">
          <article v-for="item in requirementItems" :key="item.id" class="ccp__item">
            <div class="ccp__item-top">
              <strong>{{ item.title || '诉求待完善' }}</strong>
              <StatusTag :tone="item.kind === 'reject' ? 'blocked' : 'info'" :text="REQUIREMENT_KIND_LABELS[item.kind]" :dot="false" />
            </div>
            <small>{{ REQUIREMENT_CATEGORY_LABELS[item.category] }} · {{ REQUIREMENT_PRIORITY_LABELS[item.priority] }}<template v-if="item.spaceName"> · {{ item.spaceName }}</template></small>
            <p v-if="item.detail">{{ item.detail }}</p>
          </article>
          <p v-if="requirements.length > requirementLimit" class="ccp__note">共 {{ requirements.length }} 条诉求，完整列表见客户 360。</p>
        </div>
        <p v-else class="ccp__empty">还没有诉求记录。现场听到的需求、禁忌和偏好，先原样记录。</p>
      </section>

      <!-- 跟进记录 -->
      <section v-else class="ccp__panel">
        <header class="ccp__head">
          <div>
            <strong>跟进记录</strong>
            <small>量房与设计前后与客户的沟通记录</small>
          </div>
          <button v-if="canRecordFollow" type="button" class="ccp__action" @click="$emit('record-follow')">写跟进</button>
        </header>
        <div v-if="follows.length" class="ccp__list">
          <article v-for="follow in followItems" :key="follow.id" class="ccp__item">
            <div class="ccp__item-top">
              <strong>{{ CUSTOMER_FOLLOW_WAY_LABELS[follow.way] || '沟通' }}</strong>
              <span>{{ formatDateTime(follow.createdAt) || '时间待确认' }}</span>
            </div>
            <p>{{ follow.content || '跟进内容暂不可确认' }}</p>
            <small v-if="follow.nextFollowAt">下次联系 {{ formatRelativeDay(follow.nextFollowAt) }}</small>
          </article>
        </div>
        <p v-else class="ccp__empty">还没有跟进记录。第一次联系后记录结果，后续工作才有依据。</p>
      </section>
    </template>

    <button v-if="collapsible" type="button" class="ccp__toggle" @click="expanded = !expanded">
      {{ expanded ? '收起' : `展开全部（诉求 ${requirements.length} · 跟进 ${follows.length}）` }}
    </button>
  </section>
</template>

<style scoped lang="scss">
.ccp { display: flex; flex-direction: column; gap: $space-3; }

.ccp__panel { display: flex; flex-direction: column; gap: $space-2; padding: $space-4; border: 1px solid $border-color; border-radius: $radius-lg; background: $surface-0; }

.ccp__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; }
.ccp__head strong { color: $text-primary; font-size: $font-body; }
.ccp__head small { display: block; margin-top: 3px; color: $text-tertiary; font-size: $font-caption; }

.ccp__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;
  color: $brand-600;
  font: inherit;
  font-size: $font-caption;
  cursor: pointer;

  &:hover { border-color: $brand-300; background: $brand-50; }
}

.ccp__list { display: flex; flex-direction: column; gap: $space-2; }
.ccp__item { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: $radius-sm; background: $surface-50; }
.ccp__item-top { display: flex; align-items: center; justify-content: space-between; gap: $space-2; }
.ccp__item-top strong { overflow: hidden; color: $text-primary; font-size: $font-body-sm; text-overflow: ellipsis; white-space: nowrap; }
.ccp__item-top span { flex: 0 0 auto; color: $text-tertiary; font-size: $font-caption; }
.ccp__item small { color: $text-tertiary; font-size: $font-caption; }
.ccp__item p { display: -webkit-box; overflow: hidden; margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }

.ccp__empty { margin: 0; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.ccp__note { margin: 0; color: $text-tertiary; font-size: $font-caption; }

.ccp__toggle {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: $brand-600;
  font: inherit;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  cursor: pointer;
}
</style>
