<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, roleLabel } from '@/roles/permission'
import { workbenchesForRole } from '@/domains/workbench/navigation'

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
}

@media (max-width: 1100px) {
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .workbench-grid { grid-template-columns: 1fr; }
}
</style>
