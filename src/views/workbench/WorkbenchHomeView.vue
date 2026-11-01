<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import WorkbenchIdentityCard from '@/components/workbench/WorkbenchIdentityCard.vue'
import { useSessionStore } from '@/stores/session'
import type { EmployeeRole } from '@/domains/identity/model'
import { homeWorkbenchesOf } from '@/roles/workbenchHome'

const session = useSessionStore()
const router = useRouter()

/** 一人装企岗位视角：仅切换界面上下文，不改身份/范围/审计主体（DEC-032 / BR-028）。 */
const PERSPECTIVES: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'Boss', label: '负责人视角' },
  { value: 'StoreManager', label: '店长视角' },
  { value: 'Marketer', label: '业务员视角' },
  { value: 'Designer', label: '设计师视角' },
  { value: 'Pm', label: '项目经理视角' },
  { value: 'Finance', label: '财务视角' }
]
const perspective = ref<EmployeeRole>('Boss')
const showAllWorkbenches = ref(false)
const isPerspectiveShell = computed(() => session.role === 'Boss')
const effectiveRole = computed(() => (isPerspectiveShell.value ? perspective.value : session.role))
const perspectiveLabel = computed(() => PERSPECTIVES.find((item) => item.value === perspective.value)?.label ?? '')
// 静态清单：按角色直接取整份，不做过滤/排序/落地页解析（`src/roles/workbenchHome.ts`）。
const workbenches = computed(() => homeWorkbenchesOf(effectiveRole.value))

const focusEntries = computed(() => {
  const priority = workbenches.value.filter((entry) => entry.priority === 'P0')
  return (priority.length ? priority : workbenches.value).slice(0, 3)
})
const remainingEntries = computed(() => {
  const focusKeys = new Set(focusEntries.value.map((entry) => entry.key))
  return workbenches.value.filter((entry) => !focusKeys.has(entry.key))
})

watch(perspective, () => { showAllWorkbenches.value = false })

function openFocus(entry: { to: string | null }) {
  if (entry.to) router.push(entry.to)
}

</script>

<template>
  <div class="home">
    <header class="home__head">
      <div>
        <h1 class="home__title">业务工作台</h1>
        <p v-if="isPerspectiveShell && perspective !== 'Boss'" class="home__desc">当前以「{{ perspectiveLabel }}」视角查看；身份和操作权限仍按企业负责人执行。</p>
      </div>
      <el-radio-group v-if="isPerspectiveShell" v-model="perspective" size="small">
        <el-radio-button v-for="item in PERSPECTIVES" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button>
      </el-radio-group>
    </header>

    <WorkbenchIdentityCard :view-label="isPerspectiveShell && perspective !== 'Boss' ? perspectiveLabel : ''" />

    <section class="priority" aria-label="常用工作入口">
      <header class="priority__head">
        <h2>常用入口</h2>
      </header>
      <div class="priority__grid">
        <button
          v-for="entry in focusEntries"
          :key="entry.key"
          class="priority__item"
          type="button"
          :disabled="!entry.to"
          @click="openFocus(entry)"
        >
          <span>{{ entry.domainLabel }}</span>
          <strong>{{ entry.label }}</strong>
          <small>{{ entry.mainAction }}</small>
          <em v-if="entry.to">进入</em>
        </button>
      </div>
    </section>

    <section class="workbenches" aria-label="角色场景工作台">
      <header class="workbenches__head">
        <h2>更多工作台</h2>
        <button v-if="remainingEntries.length" class="workbenches__toggle" type="button" @click="showAllWorkbenches = !showAllWorkbenches">
          {{ showAllWorkbenches ? '收起' : `查看全部 ${remainingEntries.length} 个入口` }}
        </button>
      </header>

      <EmptyState
        v-if="workbenches.length === 0"
        title="当前角色暂无可用工作入口"
        description="请联系企业管理员确认角色和权限，或稍后重试。"
      />

      <div v-else-if="showAllWorkbenches" class="workbench-grid">
        <WorkbenchEntryCard v-for="entry in remainingEntries" :key="entry.key" :entry="entry" />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.home {
  display: flex;
  flex-direction: column;
  gap: $space-5;
}

.home__kicker {
  margin: 0 0 $space-2;
  font-size: $font-caption;
  color: $text-tertiary;
}

.home__title {
  margin: 0 0 $space-2;
  font-size: $font-display;
}

.home__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
}

.priority {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.priority__head h2,
.workbenches__head h2 {
  margin: 0;
  font-size: $font-card-title;
}

.priority__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-3;
}

.priority__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: $space-1 $space-3;
  min-width: 0;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  color: $text-primary;
  text-align: left;
  cursor: pointer;
}

.priority__item:hover:not(:disabled) { border-color: $brand-200; background: $brand-50; }
.priority__item:disabled { cursor: default; opacity: .55; }
.priority__item span { grid-column: 1 / -1; color: $text-tertiary; font-size: $font-caption; }
.priority__item strong { font-size: $font-body; }
.priority__item small { grid-column: 1; color: $text-secondary; font-size: $font-caption; line-height: 1.5; }
.priority__item em { grid-column: 2; grid-row: 2; color: $brand-600; font-size: $font-caption; font-style: normal; font-weight: $font-weight-semibold; }

.workbenches__toggle {
  min-height: 34px;
  padding: 0 $space-3;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  color: $text-secondary;
  background: $surface-0;
  cursor: pointer;
}

.workbenches__toggle:hover { border-color: $brand-200; color: $brand-700; }

@media (max-width: 1000px) {
  .home__head { flex-direction: column; }
  .priority__grid { grid-template-columns: 1fr; }
}

.home__desc {
  margin: 0;
  max-width: 860px;
  font-size: $font-body-sm;
  color: $text-secondary;
  line-height: 1.7;
}

.today {
  display: grid;
  grid-template-columns: minmax(0, .82fr) minmax(0, 1.18fr);
  gap: $space-5;
  padding: $space-5;
  border-radius: $radius-lg;
  color: $surface-0;
  background:
    radial-gradient(circle at 92% 4%, rgba(216, 255, 89, .14), transparent 30%),
    linear-gradient(145deg, $brand-800, $brand-900 72%);
  box-shadow: 0 20px 44px rgba(18, 57, 48, .16);
}

.today__intro {
  align-self: center;
}

.today__eyebrow {
  margin: 0 0 $space-2;
  color: $brand-200;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
}

.today__intro h2 {
  max-width: 560px;
  margin: 0;
  color: $surface-0;
  font-size: $font-title;
  line-height: 1.3;
}

.today__intro > p:not(.today__eyebrow) {
  max-width: 560px;
  margin: $space-3 0 0;
  color: rgba(255, 255, 255, .67);
  font-size: $font-body-sm;
  line-height: 1.75;
}

.today__prompt {
  display: inline-flex;
  margin-top: $space-4;
  padding: $space-2 $space-3;
  border: 1px solid rgba($brand-200, .3);
  border-radius: 999px;
  color: $brand-100;
  background: rgba(216, 255, 89, .08);
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
}

.today__cards {
  display: grid;
  gap: $space-2;
}

.today__card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px $space-3;
  padding: $space-3 $space-4;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: $radius-md;
  color: inherit;
  background: rgba(255, 255, 255, .055);
  text-align: left;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
}

.today__card:hover:not(:disabled) {
  transform: translateX(3px);
  border-color: rgba($brand-200, .4);
  background: rgba(255, 255, 255, .09);
}

.today__card:disabled { cursor: default; opacity: .7; }

.today__card > span {
  grid-column: 1;
  color: rgba(255, 255, 255, .48);
  font-size: $font-caption;
}

.today__card strong {
  grid-column: 1;
  color: $surface-0;
  font-size: $font-card-title;
}

.today__card p {
  grid-column: 1;
  margin: 4px 0 0;
  color: rgba(255, 255, 255, .61);
  font-size: $font-body-sm;
  line-height: 1.55;
}

.today__card small {
  grid-column: 1;
  margin-top: 6px;
  color: rgba(255, 255, 255, .78);
  font-size: $font-caption;
}

.today__card em {
  grid-column: 2;
  grid-row: 1 / 5;
  align-self: center;
  color: $brand-200;
  font-size: $font-caption;
  font-style: normal;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-4;
}

.facts__item {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  padding: $space-4;
  border-radius: $radius-md;
  background: $surface-0;
  border: 1px solid $border-color;
}

.facts__label { font-size: $font-caption; color: $text-secondary; }
.facts__value { font-size: $font-card-title; }

.workbenches {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.workbenches__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 {
    margin: 0 0 $space-1;
    font-size: $font-title;
  }

  p {
    margin: 0;
    font-size: $font-body-sm;
    color: $text-secondary;
  }
}

.workbench-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-4;
}


@media (max-width: 1320px) {
  .workbench-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .today { grid-template-columns: 1fr; }
}

@media (max-width: 1100px) {
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-grid { grid-template-columns: 1fr; }
  .today { padding: $space-4; }
}
.home__perspective {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
}

.home__perspective-head {
  display: flex;
  flex-direction: column;
  gap: 2px;

  small { color: $text-secondary; font-size: $font-body-sm; }
}

.home__perspective-note {
  margin: $space-1 0 0;
  color: $brand-600;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
}
</style>
