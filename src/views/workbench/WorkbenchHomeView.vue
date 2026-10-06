<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, roleLabel } from '@/roles/permission'
import { domainLabelOf, groupOf, resolveWorkbenchLink, workbenchesForRole } from '@/domains/workbench/navigation'

const session = useSessionStore()

const shellName = computed(() => (isManagementShell(session.role) ? '经营管控中心' : '岗位工作台'))
const workbenches = computed(() => workbenchesForRole(session.role))

const facts = computed(() => [
  { label: '员工', value: session.employee?.name ?? '—' },
  { label: '企业', value: session.companyName },
  { label: '门店', value: session.store?.name ?? '—' },
  { label: '团队', value: session.employee?.team?.name ?? '未分团队' },
  { label: '角色', value: roleLabel(session.role) },
  { label: '数据范围', value: session.dataScope }
])
</script>

<template>
  <div class="home">
    <header class="home__head">
      <div>
        <p class="home__kicker">{{ session.dataScope }} DataScope · {{ shellName }}</p>
        <h1 class="home__title">{{ session.displayName }}，今日主线</h1>
        <p class="home__desc">
          从当前角色对应的场景工作台进入业务对象。工作台只负责入口、当前对象上下文和完成后交接，
          不替代服务端状态机、权限或金额裁决。
        </p>
      </div>
    </header>

    <el-alert
      class="home__alert"
      type="info"
      :closable="false"
      show-icon
      title="按角色与场景组织，不伪造待办数量"
      description="今日主线已消费工作台注册表；队列数据按对应批次接入。未返回服务端事实前，不显示 0、不把空数组当作完成。部分数据读取失败时保留恢复路径。"
    />

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
          <p>可从合法起点直接进入对象工作面；高频工作台优先，低频入口保留搜索与深链接。</p>
        </div>
        <StatusTag tone="info" :text="`${workbenches.length} 个场景入口`" />
      </header>

      <EmptyState
        v-if="workbenches.length === 0"
        title="当前角色暂无已注册工作台"
        description="请确认角色、企业范围和产品批次；系统不会用空列表伪装完成。"
      />

      <div v-else class="workbench-grid">
        <article v-for="entry in workbenches" :key="entry.key" class="workbench-card">
          <div class="workbench-card__top">
            <span class="workbench-card__domain">{{ domainLabelOf(entry) }} · {{ groupOf(entry)?.label ?? entry.group }}</span>
            <StatusTag
              :tone="entry.decisionStatus === 'approved' ? 'done' : 'pending'"
              :text="entry.decisionStatus === 'approved' ? entry.priority : '待业务确认'"
            />
          </div>

          <h3>{{ entry.label }}</h3>
          <p class="workbench-card__scenario">{{ entry.entryScenario }}</p>

          <dl class="workbench-card__facts">
            <div>
              <dt>对象锚点</dt>
              <dd>{{ entry.objectAnchor }}</dd>
            </div>
            <div>
              <dt>当前任务</dt>
              <dd>{{ entry.mainAction }}</dd>
            </div>
            <div>
              <dt>完成后</dt>
              <dd>{{ entry.handoff }}</dd>
            </div>
          </dl>

          <router-link
            v-if="entry.decisionStatus === 'approved' && resolveWorkbenchLink(entry)"
            class="workbench-card__link"
            :to="resolveWorkbenchLink(entry)!"
          >
            进入工作台
          </router-link>
          <el-tooltip
            v-else
            content="该工作台的动作策略或对象入口尚未通过业务裁决，暂不可进入执行。"
            placement="top"
          >
            <span class="workbench-card__disabled">待业务确认</span>
          </el-tooltip>
        </article>
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

.workbench-card {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  min-width: 0;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;

  h3 {
    margin: 0;
    font-size: $font-card-title;
  }
}

.workbench-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.workbench-card__domain {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: $font-caption;
  color: $text-tertiary;
}

.workbench-card__scenario {
  min-height: 42px;
  margin: 0;
  font-size: $font-body-sm;
  color: $text-secondary;
  line-height: 1.65;
}

.workbench-card__facts {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin: 0;

  div {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: $space-2;
  }

  dt {
    font-size: $font-caption;
    color: $text-tertiary;
  }

  dd {
    margin: 0;
    min-width: 0;
    font-size: $font-caption;
    color: $text-primary;
    line-height: 1.5;
  }
}

.workbench-card__link,
.workbench-card__disabled {
  margin-top: auto;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  font-size: $font-body-sm;
}

.workbench-card__link {
  border: 1px solid $brand-500;
  color: $brand-600;
  text-decoration: none;

  &:hover { background: $brand-50; }
  &:focus-visible { outline: 2px solid $brand-500; outline-offset: 2px; }
}

.workbench-card__disabled {
  border: 1px solid $border-color;
  color: $text-tertiary;
  background: $surface-50;
  cursor: not-allowed;
}

@media (max-width: 1320px) {
  .workbench-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1100px) {
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-grid { grid-template-columns: 1fr; }
}
</style>
