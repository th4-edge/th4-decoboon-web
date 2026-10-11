<script setup lang="ts">
/**
 * 业务员「签约后流转」——本人客户的已签约项目**只读**面。
 * App 侧对应：首页快捷「签约后流转」→ `pages/project/list` + `subpackages/project/pages/detail`（`view:myProjects`）。
 *
 * **只读到什么程度（严格照 App 的加载范围）**：App 项目详情对业务员显式跳过
 * 「现场日报 / 项目成员 / 验收 / 意见投诉 / 整改」，只加载 `info + stages + tasks`。
 * 因此本页也只呈现：项目基础事实 + 施工阶段进度 + 任务状态。
 *
 * **金额边界（本页最需要克制的地方）**：
 * - 显示合同额（与「我的业绩」的签约金额同族，App 业绩页对业务员明示）；
 * - **不显示**已收工程款、回款率、实际成本、毛利——业务员无 `view:finance`，成本/毛利更是 `BR-006` 红线。
 *   （App 项目列表页把「已收/回款率」无条件渲染，与其自身详情页的 `canViewFinance` 门禁不一致，属 App 侧口径差异，已登记。）
 *
 * **不做**：任何写操作、邀请业主、现场汇报、成员管理、验收、整改（App 对业务员均有 `role !== 'marketer'` 门禁）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ProviderError } from '@/core/http'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief, ProjectStage, ProjectTask } from '@/domains/project/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'

const route = useRoute()
const router = useRouter()
const projects = ref<ProjectBrief[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref('')

const detailVisible = ref(false)
const detailLoading = ref(false)
const activeProject = ref<ProjectBrief | null>(null)
const stages = ref<ProjectStage[]>([])
const tasks = ref<ProjectTask[]>([])

const filtered = computed(() => {
  const key = keyword.value.trim()
  if (!key) return projects.value
  return projects.value.filter((item) =>
    [item.name, item.no, item.customerName, item.community, item.address].filter(Boolean).some((field) => String(field).includes(key))
  )
})

function addressText(value: unknown): string {
  const project = value as ProjectBrief
  return [project.community, project.address].filter(Boolean).join(' ') || project.propertyName || '地址待补充'
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    projects.value = await projectApi.listProjects({ size: 200 })
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '项目暂不可确认'
  } finally {
    loading.value = false
  }
}

async function openDetail(value: unknown): Promise<void> {
  const project = value as ProjectBrief
  activeProject.value = project
  detailVisible.value = true
  detailLoading.value = true
  stages.value = []
  tasks.value = []
  try {
    const [brief, stageRows, taskRows] = await Promise.all([
      projectApi.projectInfo(project.id),
      projectApi.listStages(project.id).catch(() => [] as ProjectStage[]),
      projectApi.listTasks(project.id).catch(() => [] as ProjectTask[])
    ])
    if (brief) activeProject.value = brief
    stages.value = stageRows
    tasks.value = taskRows
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '项目详情暂不可确认'
  } finally {
    detailLoading.value = false
  }
}

/** 从项目回看客户：进入「我的客户」并消费 customerId（多起点进入同一对象）。 */
function openCustomer(): void {
  const customerId = activeProject.value?.customerId
  if (!customerId) return
  detailVisible.value = false
  void router.push({ path: '/workbench/my-customers', query: { customerId } })
}

/**
 * 深链接消费：`?projectId=` 必须**在列表加载完成之后**才能命中——
 * 之前写成 `void load()` 与 find 并行，`projects` 还是空数组时 find 必然落空，
 * 参数被静默吞掉（就是 `EXP-013` 说的死参数）。这里改成先 await 再消费，并监听后续变化。
 */
async function consumeQuery(): Promise<void> {
  const projectId = String(route.query.projectId ?? '')
  if (!projectId) return
  const target = projects.value.find((item) => item.id === projectId)
  if (!target) return
  if (activeProject.value?.id === projectId && detailVisible.value) return
  await openDetail(target)
}

onMounted(async () => {
  await load()
  await consumeQuery()
})

watch(() => route.query.projectId, () => { void consumeQuery() })
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">POST-SIGN · 签约后流转</span>
        <h1>签约后流转</h1>
        <p>本人客户签约立项后的项目进展（只读）：施工阶段与任务状态。现场日报、成员、验收与整改不在业务员范围，页面不生成这些区块。</p>
      </div>
      <div class="finance-actions">
        <el-input v-model="keyword" clearable placeholder="搜索项目 / 客户 / 小区" style="width: 240px" />
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard flush>
      <SkeletonBlock v-if="loading && !projects.length" variant="table" :rows="6" />
      <EmptyState
        v-else-if="!filtered.length"
        :title="keyword ? '没有匹配的项目' : '当前没有签约后的项目'"
        :description="keyword ? '换个关键词再试。' : '客户签约立项后，项目会出现在这里（只读）。'"
      />
      <el-table v-else :data="filtered" stripe>
        <el-table-column label="项目" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.no }} · {{ addressText(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="客户" width="120">
          <template #default="{ row }">{{ row.customerName || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }"><BusinessStateTag object-key="project" :server-value="row.status" /></template>
        </el-table-column>
        <el-table-column label="当前阶段" min-width="140">
          <template #default="{ row }">{{ row.currentStageName || '待开工' }}</template>
        </el-table-column>
        <el-table-column label="进度" width="90" align="right">
          <template #default="{ row }">{{ row.progress }}%</template>
        </el-table-column>
        <el-table-column label="合同额" width="130" align="right">
          <template #default="{ row }"><MoneyText v-if="row.contractAmount" :value="row.contractAmount" /><span v-else>—</span></template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }"><el-button link type="primary" @click.stop="openDetail(row)">查看进度</el-button></template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-drawer v-model="detailVisible" title="项目进度（只读）" size="620px">
      <SkeletonBlock v-if="detailLoading" variant="table" :rows="6" />
      <template v-else-if="activeProject">
        <div class="proj-detail__head">
          <div>
            <h3>{{ activeProject.name }}</h3>
            <p class="finance-table__sub">
              {{ activeProject.no }} ·
              <BusinessStateTag object-key="project" :server-value="activeProject.status" />
              · 进度 {{ activeProject.progress }}%
            </p>
          </div>
          <el-button v-if="activeProject.customerId" size="small" @click="openCustomer">查看客户</el-button>
        </div>

        <dl class="proj-detail__facts">
          <div><dt>客户</dt><dd>{{ activeProject.customerName || '—' }}</dd></div>
          <div><dt>地址</dt><dd>{{ addressText(activeProject) }}</dd></div>
          <div><dt>面积</dt><dd>{{ activeProject.area ? `${activeProject.area} ㎡` : '—' }}</dd></div>
          <div><dt>合同额</dt><dd><MoneyText v-if="activeProject.contractAmount" :value="activeProject.contractAmount" /><span v-else>—</span></dd></div>
          <div><dt>设计师</dt><dd>{{ activeProject.designerName || '未指派' }}</dd></div>
          <div><dt>项目经理</dt><dd>{{ activeProject.managerName || '未指派' }}</dd></div>
          <div><dt>履约负责人</dt><dd>{{ activeProject.supportName || '—' }}</dd></div>
          <div><dt>开工日期</dt><dd>{{ activeProject.startDate || '待开工' }}</dd></div>
        </dl>

        <h4>施工阶段</h4>
        <EmptyState v-if="!stages.length" title="暂无阶段" description="项目开工后，阶段会依次出现在这里。" />
        <el-table v-else :data="stages" size="small" stripe>
          <el-table-column prop="name" label="阶段" min-width="140" />
          <el-table-column label="状态" width="110"><template #default="{ row }"><BusinessStateTag object-key="projectStage" :status-key="row.status" /></template></el-table-column>
          <el-table-column label="实际开始" width="120"><template #default="{ row }">{{ row.actualStart || row.plannedStart || '—' }}</template></el-table-column>
          <el-table-column label="实际完成" width="120"><template #default="{ row }">{{ row.actualEnd || row.plannedEnd || '—' }}</template></el-table-column>
        </el-table>

        <h4 style="margin-top: 16px">施工任务</h4>
        <EmptyState v-if="!tasks.length" title="暂无任务" description="项目经理排期后，任务会出现在这里。" />
        <el-table v-else :data="tasks" size="small" stripe>
          <el-table-column prop="name" label="任务" min-width="160" />
          <el-table-column label="状态" width="110"><template #default="{ row }"><BusinessStateTag object-key="projectTask" :status-key="row.status" /></template></el-table-column>
          <el-table-column prop="ownerName" label="负责人" width="110"><template #default="{ row }">{{ row.ownerName || '—' }}</template></el-table-column>
          <el-table-column prop="plannedEnd" label="计划完成" width="130"><template #default="{ row }">{{ row.plannedEnd || '—' }}</template></el-table-column>
        </el-table>

        <p class="proj-detail__note">
          只读：业务员不参与项目写操作（开工、任务、阶段、成员调整由项目经理 / 店长 / 企业负责人执行）；
          现场日报、项目成员、验收与整改不在业务员范围，故不生成区块。
        </p>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.proj-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-3;
  flex-wrap: wrap;

  h3 { margin: 0 0 $space-1; }
}

.proj-detail__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: $space-2 $space-4;
  margin: $space-3 0 $space-4;

  div {
    display: flex;
    gap: $space-2;
    min-width: 0;
  }

  dt {
    flex-shrink: 0;
    font-size: $font-caption;
    color: $text-tertiary;
  }

  dd {
    margin: 0;
    min-width: 0;
    font-size: $font-caption;
    color: $text-primary;
  }
}

.proj-detail__note {
  margin: $space-4 0 0;
  font-size: $font-caption;
  color: $text-tertiary;
  line-height: 1.7;
}
</style>
