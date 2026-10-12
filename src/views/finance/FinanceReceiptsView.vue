<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ProviderError } from '@/core/http'
import { financeApi } from '@/domains/finance/api'
import { useFinanceAccess } from '@/domains/finance/access'
import { ACCOUNT_LABEL } from '@/domains/finance/meta'
import type { Receipt } from '@/domains/finance/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import FinanceCollectionDrawer from '@/components/finance/FinanceCollectionDrawer.vue'
import { useFinanceScopeStore } from '@/stores/financeScope'

const scope = useFinanceScopeStore()

const route = useRoute()
const { canWrite, readOnly } = useFinanceAccess()
const items = ref<Receipt[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const projectId = ref('')
const page = ref(1)
const pageSize = 50
const total = ref(0)
const drawerVisible = ref(false)

const filtered = computed(() => items.value.filter((item) => {
  const search = keyword.value.trim().toLowerCase()
  if (!search) return true
  return [item.id, item.payerName, item.project.name, item.project.no, item.remark]
    .some((value) => String(value ?? '').toLowerCase().includes(search))
}))
const totalAmount = computed(() => items.value.reduce((sum, item) => sum + item.amount, 0))

onMounted(() => {
  projectId.value = String(route.query.projectId ?? '')
  void load()
})

/**
 * 门店维度（DEC-067 / P1-a）：切换「全部门店 ↔ 单店」后按门店重新取数，
 * 全部门店时不传 `storeId`（绝不传状态值 '0'）。
 */
watch(() => scope.requestStoreId, () => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await financeApi.receipts({
      projectId: projectId.value || undefined,
      storeId: scope.requestStoreId ?? undefined,
      current: page.value,
      size: pageSize
    })
    items.value = result.list
    total.value = result.total
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '收款记录暂不可确认'
  } finally {
    loading.value = false
  }
}

function resetAndLoad(): void {
  page.value = 1
  void load()
}

function accountLabel(value: unknown): string {
  const item = value as Receipt
  return ACCOUNT_LABEL[item.account]
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">RECEIPT · 回款核销</span>
        <h1>收款记录</h1>
        <p>每笔收款都保留来源应收、到账账户和经办人；如需凭证，可在资金台账选择该笔收款生成。</p>
      </div>
      <div class="finance-actions">
        <el-button @click="load">刷新</el-button>
        <el-button v-if="readOnly" plain disabled>本店财务只读</el-button>
        <el-button v-if="canWrite" type="primary" @click="drawerVisible = true">登记客户收款</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />

    <section class="finance-kpis">
      <article class="finance-kpi">
        <span>当前列表收款</span>
        <strong><MoneyText :value="totalAmount" size="lg" /></strong>
        <small>当前页明细合计，正式汇总以服务端为准</small>
      </article>
      <article class="finance-kpi">
        <span>收款笔数</span>
        <strong>{{ total }}</strong>
        <small>已登记并生效的收款记录</small>
      </article>
      <article class="finance-kpi">
        <span>资金去向</span>
        <strong>资金台账</strong>
        <small>每笔收款自动写入台账，不重复计算</small>
      </article>
      <article class="finance-kpi">
        <span>凭证归档</span>
        <strong>可生成</strong>
        <small>凭证金额取来源收款，不二次计算</small>
      </article>
    </section>

    <PanelCard flush>
      <div class="finance-toolbar">
        <el-input v-model="keyword" clearable placeholder="搜索付款方 / 项目 / 备注" style="width: 260px" @keyup.enter="resetAndLoad" @clear="resetAndLoad" />
        <el-button @click="resetAndLoad">应用筛选</el-button>
        <span class="finance-toolbar__spacer" />
        <span class="finance-toolbar__result">共 {{ total }} 笔</span>
      </div>

      <SkeletonBlock v-if="loading && !items.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !items.length" title="暂无收款记录" description="从应收节点登记收款后，这里会出现回款与核销记录。" :action-text="canWrite ? '登记客户收款' : ''" @action="drawerVisible = true" />
      <el-table v-else :data="filtered" stripe>
        <el-table-column label="收款项目" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.project.name }}</span>
              <span class="finance-table__sub">{{ row.project.no }} · {{ row.payerName || '付款方未填' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="核销应收" min-width="180">
          <template #default="{ row }">{{ row.receivable?.name || '未关联应收节点' }}</template>
        </el-table-column>
        <el-table-column prop="receivedAt" label="到账日期" width="120" />
        <el-table-column label="收款账户" width="120">
          <template #default="{ row }">{{ accountLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="经办人" width="110">
          <template #default="{ row }">{{ row.createdBy?.name || '—' }}</template>
        </el-table-column>
        <el-table-column label="收款金额" width="150" align="right">
          <template #default="{ row }"><MoneyText :value="row.amount" /></template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
      <div v-if="total > pageSize" class="finance-pagination">
        <el-pagination v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev, pager, next" @current-change="load" />
      </div>
    </PanelCard>

    <FinanceCollectionDrawer v-model:visible="drawerVisible" :project-id="projectId" @saved="load" />
  </div>
</template>
