<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { isManagementShell, navFor, roleLabel } from '@/roles/permission'

const session = useSessionStore()

const shellName = computed(() => (isManagementShell(session.role) ? '经营管控中心' : '岗位工作台'))
const nav = computed(() => navFor(session.role))

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
        <h1 class="home__title">{{ session.displayName }}，欢迎回到工作台</h1>
        <p class="home__desc">V3 工程骨架已就绪。业务页面按角色分批接入，接入前不展示任何未经服务端确认的经营数字。</p>
      </div>
    </header>

    <el-alert
      class="home__alert"
      type="info"
      :closable="false"
      show-icon
      title="当前为 V3 重建阶段"
      description="本页只呈现服务端返回的真实身份与数据范围；客户、报价、合同、项目、财务等业务模块尚在按批次重建，未接入前统一显示建设中，不以 0 或空数组冒充完成。"
    />

    <section class="facts" aria-label="当前身份事实">
      <div v-for="fact in facts" :key="fact.label" class="facts__item">
        <span class="facts__label">{{ fact.label }}</span>
        <strong class="facts__value">{{ fact.value }}</strong>
      </div>
    </section>

    <section class="plan" aria-label="本角色导航规划">
      <h2 class="plan__title">本角色导航（{{ nav.length }} 项）</h2>
      <ul class="plan__list">
        <li v-for="item in nav" :key="item.key" class="plan__item">
          <div>
            <strong>{{ item.label }}</strong>
            <span>{{ item.path }}</span>
          </div>
          <el-tag size="small" type="info" effect="plain">{{ item.planned ? '建设中' : '已接入' }}</el-tag>
        </li>
      </ul>
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

.plan {
  padding: $space-5;
  border-radius: $radius-md;
  background: $surface-0;
  border: 1px solid $border-color;
}

.plan__title {
  margin: 0 0 $space-4;
  font-size: $font-title;
}

.plan__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-radius: $radius-sm;
  background: $surface-50;

  div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  strong { font-size: $font-body-sm; }
  span { font-size: $font-caption; color: $text-tertiary; overflow: hidden; text-overflow: ellipsis; }
}
</style>
