<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavIcon from '@/components/shell/NavIcon.vue'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const session = useSessionStore()

const tab = computed(() => route.path.endsWith('/company') ? 'company' : 'profile')
</script>

<template>
  <div class="account-center">
    <div class="page-head">
      <div class="title-zone">
        <h1>账户中心</h1>
        <div class="sub">查看当前登录员工、企业组织和数据范围事实。</div>
      </div>
      <div class="meta">
        <span class="role-tag">{{ session.roleName }} · {{ session.dataScopeName }}</span>
      </div>
    </div>

    <div class="account-center__layout">
      <aside class="identity-card">
        <div class="identity-card__avatar">{{ session.displayName.slice(-1) }}</div>
        <strong>{{ session.displayName }}</strong>
        <span>{{ session.roleName }}</span>
        <small>{{ session.companyName }}</small>
        <dl>
          <div><dt>员工编号</dt><dd>{{ session.employee?.empId ?? '暂不可确认' }}</dd></div>
          <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
        </dl>
      </aside>

      <section class="account-center__main">
        <nav class="account-tabs" aria-label="账户信息导航">
          <router-link to="/account/profile" :class="{ active: tab === 'profile' }">
            <NavIcon name="customer.followup" />
            个人信息
          </router-link>
          <router-link to="/account/company" :class="{ active: tab === 'company' }">
            <NavIcon name="team.overview" />
            企业信息
          </router-link>
        </nav>

        <template v-if="tab === 'profile'">
          <section class="detail-card">
            <header>
              <div><NavIcon name="customer.followup" /><strong>基本资料</strong></div>
              <span>当前登录员工的身份事实</span>
            </header>
            <dl>
              <div><dt>姓名</dt><dd>{{ session.displayName }}</dd></div>
              <div><dt>员工编号</dt><dd>{{ session.employee?.empId ?? '暂不可确认' }}</dd></div>
              <div><dt>手机号</dt><dd>{{ session.employee?.telNo ?? session.profile?.phone ?? '暂不可确认' }}</dd></div>
              <div><dt>状态</dt><dd>{{ session.employee?.status?.name ?? '暂不可确认' }}</dd></div>
            </dl>
          </section>

          <section class="detail-card">
            <header>
              <div><NavIcon name="today.mainline" /><strong>组织与权限</strong></div>
              <span>角色和组织范围由登录会话推导</span>
            </header>
            <dl>
              <div><dt>角色</dt><dd>{{ session.roleName }}</dd></div>
              <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
              <div><dt>所属门店</dt><dd>{{ session.employee?.store?.name ?? '未分门店' }}</dd></div>
              <div><dt>所属团队</dt><dd>{{ session.employee?.team?.name ?? '未分团队' }}</dd></div>
            </dl>
          </section>
        </template>

        <template v-else>
          <section class="detail-card">
            <header>
              <div><NavIcon name="team.overview" /><strong>企业资料</strong></div>
              <span>当前租户的只读身份信息</span>
            </header>
            <dl>
              <div><dt>企业名称</dt><dd>{{ session.companyName }}</dd></div>
              <div><dt>企业编号</dt><dd>{{ session.company?.comId ?? '暂不可确认' }}</dd></div>
              <div><dt>企业地址</dt><dd>{{ session.company?.addr ?? '暂不可确认' }}</dd></div>
            </dl>
          </section>

          <section class="detail-card">
            <header>
              <div><NavIcon name="pm.project" /><strong>当前组织上下文</strong></div>
              <span>当前登录会话的企业、门店和团队</span>
            </header>
            <dl>
              <div><dt>当前门店</dt><dd>{{ session.employee?.store?.name ?? '未分门店' }}</dd></div>
              <div><dt>当前团队</dt><dd>{{ session.employee?.team?.name ?? '未分团队' }}</dd></div>
              <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
            </dl>
          </section>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.account-center {
  display: flex;
  flex-direction: column;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  margin-bottom: $space-6;

  h1 {
    margin: 0;
    color: $text-primary;
    font-size: $font-display;
    font-weight: $font-weight-bold;
    letter-spacing: -.02em;
  }
}

.title-zone .sub {
  margin-top: 6px;
  color: $text-secondary;
  font-size: $font-body-sm;
}

.role-tag {
  padding: 4px 10px;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;
}

.account-center__layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: $space-5;
  align-items: start;
}

.identity-card {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $space-6;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  text-align: center;

  > strong { margin-top: $space-3; font-size: $font-title; }
  > span { margin-top: 2px; color: $brand-600; font-size: $font-body-sm; }
  > small { margin-top: $space-1; color: $text-tertiary; font-size: $font-caption; }

  dl {
    width: 100%;
    margin: $space-5 0 0;
    padding-top: $space-4;
    border-top: 1px solid $border-color;
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-2 0;
  }

  dt { color: $text-tertiary; font-size: $font-caption; }
  dd { margin: 0; color: $text-secondary; font-size: $font-caption; word-break: break-all; }
}

.identity-card__avatar {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  color: $surface-0;
  background: linear-gradient(145deg, $brand-500, $brand-700);
  box-shadow: 0 10px 24px rgba(47, 125, 90, .24);
  font-size: $font-display;
  font-weight: $font-weight-bold;
}

.account-center__main {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.account-tabs {
  display: flex;
  gap: $space-2;
  padding: $space-2;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;

  a {
    flex: 1;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    border-radius: $radius-sm;
    color: $text-secondary;
    text-decoration: none;
    font-size: $font-body-sm;
    transition: color .15s, background .15s;

    &:hover { color: $brand-600; background: $brand-50; }
    &.active { color: $brand-700; background: $brand-50; font-weight: $font-weight-semibold; }
  }
}

.detail-card {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-4 $space-5;
    border-bottom: 1px solid $border-color;

    > div { display: flex; align-items: center; gap: $space-2; }
    svg { color: $brand-600; }
    strong { font-size: $font-body; }
    > span { color: $text-tertiary; font-size: $font-caption; }
  }

  dl {
    margin: 0;
    padding: 0 $space-5;
  }

  dl > div {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: $space-4;
    padding: $space-4 0;
    border-bottom: 1px solid $border-color;

    &:last-child { border-bottom: 0; }
  }

  dt { color: $text-tertiary; font-size: $font-body-sm; }
  dd { margin: 0; color: $text-primary; font-size: $font-body-sm; word-break: break-all; }
}

@media (max-width: 1200px) {
  .account-center__layout { grid-template-columns: 1fr; }
  .identity-card { position: static; }
}

@media (max-width: 720px) {
  .page-head { align-items: flex-start; flex-direction: column; }
  .detail-card > header { align-items: flex-start; flex-direction: column; }
  .detail-card dl > div { grid-template-columns: 1fr; gap: 2px; }
}
</style>
