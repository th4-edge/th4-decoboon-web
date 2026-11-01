<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useFinanceScopeStore } from '@/stores/financeScope'
import StoreScopePicker from '@/components/StoreScopePicker.vue'
import { roleLabel } from '@/roles/permission'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'

interface FinanceNavItem {
  label: string
  path: string
  mark: string
}

interface FinanceNavGroup {
  label: string
  items: FinanceNavItem[]
}

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const scope = useFinanceScopeStore()

const groups: FinanceNavGroup[] = [
  {
    label: '财务总览',
    items: [{ label: '财务工作台', path: '/finance/workbench', mark: '总' }]
  },
  {
    label: '资金收付',
    items: [
      { label: '应收计划', path: '/finance/receivables', mark: '收' },
      { label: '收款记录', path: '/finance/receipts', mark: '进' },
      { label: '客户退款', path: '/finance/refunds', mark: '退' },
      { label: '员工工资', path: '/finance/employee-salaries', mark: '薪' },
      { label: '员工提成', path: '/finance/employee-commissions', mark: '提' },
      { label: '应付账款', path: '/finance/payables', mark: '付' },
      { label: '工人工资', path: '/finance/salaries', mark: '工' },
      { label: '付款记录', path: '/finance/payments', mark: '出' }
    ]
  },
  {
    label: '往来与核算',
    items: [
      { label: '供应商往来', path: '/finance/partners', mark: '商' },
      { label: '资金台账', path: '/finance/ledger', mark: '账' },
      { label: '提成负向调整', path: '/finance/commission-adjustments', mark: '调' },
      { label: '项目账本', path: '/finance/projects', mark: '项' }
    ]
  },
  {
    label: '凭证归档',
    items: [
      { label: '收付凭证', path: '/finance/vouchers', mark: '凭' },
      { label: '凭证模板', path: '/finance/voucher-templates', mark: '模' }
    ]
  }
]

const activePath = computed(() => {
  const candidates = groups.flatMap((group) => group.items).map((item) => item.path)
  return candidates
    .filter((path) => route.path === path || route.path.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0] ?? route.path
})

const isProjectDetail = computed(() => route.path.startsWith('/finance/projects/'))

// 门店维度（DEC-065 / DEC-067）：对齐统一由共享门店上下文在应用启动处注册
// （`REQ-BIZ-20261013-001` §6），这里只做幂等兜底激活；门店范围角色恒为本店。
onMounted(() => {
  scope.activate()
})

async function logout(): Promise<void> {
  await session.logout()
  ElMessage.success('已退出登录')
  await router.replace({ name: 'login' })
}

function open(path: string): void {
  void router.push(path)
}
</script>

<template>
  <div class="finance-shell">
    <aside class="finance-side">
      <div class="finance-brand">
        <CompanyBrandMark :name="session.companyName" :logo="session.company?.logo || ''" :color="session.company?.color || ''" :size="38" />
        <div>
          <strong>{{ session.companyName }}</strong>
          <span>财务经营工作台</span>
        </div>
      </div>

      <div class="finance-scope">
        <span>当前角色 · {{ roleLabel(session.role) }}</span>
        <strong>{{ session.companyName }}</strong>
        <small>{{ session.dataScopeName }} 数据范围</small>
        <StoreScopePicker />
      </div>

      <nav class="finance-nav" aria-label="财务工作台导航">
        <section v-for="group in groups" :key="group.label" class="finance-nav__group">
          <h2>{{ group.label }}</h2>
          <button
            v-for="item in group.items"
            :key="item.path"
            type="button"
            class="finance-nav__item"
            :class="{ 'finance-nav__item--active': activePath === item.path }"
            @click="open(item.path)"
          >
            <span class="finance-nav__mark" aria-hidden="true">{{ item.mark }}</span>
            <span>{{ item.label }}</span>
          </button>
        </section>
      </nav>

      <button class="finance-logout" type="button" @click="logout">退出登录</button>
    </aside>

    <div class="finance-body">
      <header class="finance-topbar">
        <div class="finance-crumbs">
          <button type="button" @click="router.push('/finance/workbench')">财务工作台</button>
          <span>/</span>
          <strong>{{ route.meta.title ?? '财务经营' }}</strong>
          <template v-if="isProjectDetail">
            <span>/</span>
            <strong>项目核算</strong>
          </template>
        </div>
        <div class="finance-identity">
          <span>{{ session.dataScopeName }} · {{ session.companyName }}</span>
          <el-avatar :size="30">{{ session.displayName.slice(0, 1) }}</el-avatar>
          <div>
            <strong>{{ session.displayName }}</strong>
            <small>{{ roleLabel(session.role) }}</small>
          </div>
        </div>
      </header>

      <main class="finance-content">
        <!-- 门店维度对齐前不挂载业务页，避免首屏先请求“全部门店”后被单店结果覆盖。 -->
        <router-view v-slot="{ Component }">
          <component v-if="scope.resolved" :is="Component" :key="`${activePath}-${scope.storeId}`" />
          <div v-else class="finance-scope-loading">正在确认当前门店范围…</div>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-shell {
  display: flex;
  min-height: 100vh;
  background: $bg-page;
}

.finance-side {
  width: 248px;
  flex: 0 0 248px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5 $space-3 $space-4;
  color: rgba(255, 255, 255, .78);
  background: $brand-900;
}

.finance-brand {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: 0 $space-2;

  > div:last-child {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  strong {
    color: $surface-0;
    font-size: $font-title;
    letter-spacing: .04em;
  }

  span {
    color: rgba(255, 255, 255, .58);
    font-size: $font-caption;
  }
}

.finance-scope {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0 $space-2;
  padding: $space-3;
  border: 1px solid rgba(255, 255, 255, .09);
  border-radius: $radius-md;
  background: rgba(255, 255, 255, .05);

  span,
  small {
    color: rgba(255, 255, 255, .58);
    font-size: $font-caption;
  }

  strong {
    color: $surface-0;
    font-size: $font-body-sm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.finance-scope__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: $space-1;

  select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid rgba(255, 255, 255, .16);
    border-radius: $radius-sm;
    background: rgba(0, 0, 0, .22);
    color: $surface-0;
    font-size: $font-body-sm;
  }
}

.finance-scope__locked {
  margin-top: $space-1;
}

.finance-nav {
  flex: 1;
  overflow: auto;
  padding: 0 $space-1;
}

.finance-nav__group + .finance-nav__group {
  margin-top: $space-4;
}

.finance-nav__group h2 {
  margin: 0 0 $space-2;
  padding: 0 $space-2;
  color: rgba(255, 255, 255, .4);
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  letter-spacing: .08em;
}

.finance-nav__item,
.finance-logout {
  display: flex;
  align-items: center;
  gap: $space-3;
  width: 100%;
  min-height: 40px;
  padding: 0 $space-3;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: $radius-sm;
  text-align: left;
  cursor: pointer;
  transition: color $transition-fast, background $transition-fast;
}

.finance-nav__item:hover,
.finance-logout:hover {
  color: $surface-0;
  background: rgba(255, 255, 255, .08);
}

.finance-nav__item--active {
  color: $surface-0;
  background: rgba(82, 158, 119, .34);
  box-shadow: inset 3px 0 0 $brand-300;
  font-weight: $font-weight-semibold;
}

.finance-nav__mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: $radius-xs;
  background: rgba(255, 255, 255, .08);
  font-size: $font-caption;
}

.finance-logout {
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, .1);
}

.finance-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.finance-topbar {
  height: $topbar-height;
  flex: 0 0 $topbar-height;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-4;
  padding: 0 $space-6;
  border-bottom: 1px solid $border-color;
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(8px);
}

.finance-crumbs,
.finance-identity {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
}

.finance-crumbs {
  color: $text-secondary;
  font-size: $font-body-sm;

  button {
    padding: 0;
    color: $brand-600;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  strong {
    color: $text-primary;
  }
}

.finance-identity {
  > span {
    padding: 4px 10px;
    border: 1px solid $border-color;
    border-radius: $radius-pill;
    color: $text-secondary;
    background: $surface-50;
    font-size: $font-caption;
  }

  > div {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  strong { font-size: $font-body-sm; }
  small { color: $text-secondary; font-size: $font-caption; }
}

.finance-scope-loading {
  padding: 64px 24px;
  color: $text-tertiary;
  text-align: center;
}
.finance-content {
  flex: 1;
  min-width: 0;
  padding: $space-5;
}

@media (max-width: 1180px) {
  .finance-side {
    width: 220px;
    flex-basis: 220px;
  }

  .finance-content {
    padding: $space-4;
  }
}
</style>
