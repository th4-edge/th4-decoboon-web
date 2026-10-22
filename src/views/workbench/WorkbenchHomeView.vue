<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, roleLabel } from '@/roles/permission'
import type { EmployeeRole } from '@/domains/identity/model'
import { homeWorkbenchesOf } from '@/roles/workbenchHome'

const session = useSessionStore()
const router = useRouter()

const shellName = computed(() => (isManagementShell(session.role) ? '经营管控中心' : '岗位工作台'))

/** 一人装企岗位视角：仅切换界面上下文，不改身份/范围/审计主体（DEC-032 / BR-028）。 */
const PERSPECTIVES: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'Boss', label: '负责人视角' },
  { value: 'StoreManager', label: '店长视角' },
  { value: 'TeamLeader', label: '团队负责人视角' },
  { value: 'Marketer', label: '业务员视角' },
  { value: 'Designer', label: '设计师视角' },
  { value: 'Pm', label: '项目经理视角' },
  { value: 'Finance', label: '财务视角' }
]
const perspective = ref<EmployeeRole>('Boss')
const isPerspectiveShell = computed(() => session.role === 'Boss')
const effectiveRole = computed(() => (isPerspectiveShell.value ? perspective.value : session.role))
const perspectiveLabel = computed(() => PERSPECTIVES.find((item) => item.value === perspective.value)?.label ?? '')
// 静态清单：按角色直接取整份，不做过滤/排序/落地页解析（`src/roles/workbenchHome.ts`）。
const workbenches = computed(() => homeWorkbenchesOf(effectiveRole.value))

const ROLE_FOCUS: Record<EmployeeRole, { eyebrow: string; title: string; description: string; prompt: string }> = {
  Boss: {
    eyebrow: '今日经营判断',
    title: '今天先看会影响结果的事，而不是先找菜单。',
    description: '从经营风险、门店结果和关键交接进入，优先处理会影响经营结果的事项。',
    prompt: '今天哪几件事处理完，经营会更稳？'
  },
  StoreManager: {
    eyebrow: '今日门店判断',
    title: '本店客户、项目和资金，今天先看哪里卡住。',
    description: '按本店范围查看风险、客户推进、项目履约和资金异常，先处理最影响经营的事项。',
    prompt: '本店今天最需要先干预的是哪一件事？'
  },
  TeamLeader: {
    eyebrow: '今日团队判断',
    title: '团队的单子有没有跟散，项目有没有卡住。',
    description: '客户分配、跟进、报价和项目风险按团队数据范围进入首页，帮助负责人先判断下一步该找谁。',
    prompt: '团队今天最需要补位的是哪一段？'
  },
  Marketer: {
    eyebrow: '今日客户判断',
    title: '客户跟到哪一步，下一步该做什么。',
    description: '从客户跟进、量房和项目参与进入，优先处理今天最需要推进的客户。',
    prompt: '今天哪一位客户最不能继续等？'
  },
  Designer: {
    eyebrow: '今日设计推进',
    title: '客户、方案、报价和签约，先推进最靠前的那一步。',
    description: '围绕客户与房屋连续推进，报价保留版本，合同发起和签约确认按角色边界执行。',
    prompt: '今天哪一单最接近下一步决策？'
  },
  Pm: {
    eyebrow: '今日现场判断',
    title: '今天哪些节点要完成，哪些问题不能再拖。',
    description: '从项目、任务、现场留证、整改和验收提交进入。项目经理只处理参与项目，不替代设计、财务或业主确认。',
    prompt: '今天哪个现场节点最影响后续履约？'
  },
  Finance: {
    eyebrow: '今日财务判断',
    title: '款项、台账和成本，先核对真正有影响的事项。',
    description: '应收、收款、应付、付款和结算按项目归集；成本未完整时利润暂不显示。',
    prompt: '今天哪一笔钱或哪一项成本最需要先核对？'
  }
}

const focusCopy = computed(() => ROLE_FOCUS[effectiveRole.value ?? 'Boss'])
const focusEntries = computed(() => {
  const priority = workbenches.value.filter((entry) => entry.priority === 'P0')
  return (priority.length ? priority : workbenches.value).slice(0, 3)
})

function openFocus(entry: { to: string | null }) {
  if (entry.to) router.push(entry.to)
}

const facts = computed(() => [
  { label: '员工', value: session.employee?.name ?? '—' },
  { label: '企业', value: session.companyName },
  { label: '门店', value: session.store?.name ?? '—' },
  { label: '团队', value: session.employee?.team?.name ?? '未分团队' },
  { label: '角色', value: roleLabel(session.role) },
  { label: '数据范围', value: session.dataScopeName }
])
</script>

<template>
  <div class="home">
    <header class="home__head">
      <div>
        <p class="home__kicker">当前查看范围 · {{ shellName }}</p>
        <h1 class="home__title">{{ session.displayName }}，业务工作台</h1>
        <p class="home__desc">
          从当前角色常用入口进入客户、项目和经营工作。待办、金额与操作范围按当前账号实际权限展示。
        </p>
      </div>
    </header>

    <section class="today" aria-label="今日经营判断">
      <div class="today__intro">
        <p class="today__eyebrow">{{ focusCopy.eyebrow }}</p>
        <h2>{{ focusCopy.title }}</h2>
        <p>{{ focusCopy.description }}</p>
        <div class="today__prompt">{{ focusCopy.prompt }}</div>
      </div>
      <div class="today__cards">
        <button
          v-for="entry in focusEntries"
          :key="entry.key"
          class="today__card"
          type="button"
          :disabled="!entry.to"
          @click="openFocus(entry)"
        >
          <span>{{ entry.domainLabel }} · {{ entry.groupLabel }}</span>
          <strong>{{ entry.label }}</strong>
          <p>{{ entry.scenario }}</p>
          <small>{{ entry.mainAction }}</small>
          <em v-if="entry.to">进入场景 →</em>
        </button>
      </div>
    </section>

    <section v-if="isPerspectiveShell" class="home__perspective" aria-label="岗位视角">
      <div class="home__perspective-head">
        <strong>岗位视角</strong>
        <small>仅切换查看视角；身份、数据范围和实际操作权限仍按企业负责人本人执行。</small>
      </div>
      <el-radio-group v-model="perspective" size="small">
        <el-radio-button v-for="item in PERSPECTIVES" :key="item.value" :value="item.value">{{ item.label }}</el-radio-button>
      </el-radio-group>
    </section>

    <section class="facts" aria-label="当前身份事实">
      <div v-for="fact in facts" :key="fact.label" class="facts__item">
        <span class="facts__label">{{ fact.label }}</span>
        <strong class="facts__value">{{ fact.value }}</strong>
      </div>
    </section>

    <section class="workbenches" aria-label="角色场景工作台">
      <header class="workbenches__head">
        <div>
          <h2>需要我处理</h2>
          <p v-if="isPerspectiveShell && perspective !== 'Boss'" class="home__perspective-note">当前以「{{ perspectiveLabel }}」视角查看；实际操作权限仍按企业负责人执行。</p>
          <p>从当前需要处理的业务入口进入，常用事项优先。</p>
        </div>
        <StatusTag tone="info" :text="`${workbenches.length} 个场景入口`" />
      </header>

      <EmptyState
        v-if="workbenches.length === 0"
        title="当前角色暂无可用工作入口"
        description="请联系企业管理员确认角色和权限，或稍后重试。"
      />

      <div v-else class="workbench-grid">
        <WorkbenchEntryCard v-for="entry in workbenches" :key="entry.key" :entry="entry" />
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
