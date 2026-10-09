<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ProviderError } from '@/core/http'
import { crmApi } from '@/domains/crm/api'
import type { Customer, CustomerFollow, FollowWay } from '@/domains/crm/model'
import { designApi } from '@/domains/design/api'
import type { DesignScheme } from '@/domains/design/model'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import PropertyFormDrawer from '@/components/property/PropertyFormDrawer.vue'
import { propertyApi } from '@/domains/property/api'
import type { Property } from '@/domains/property/model'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import { notifyBlocked } from '@/core/blockedNotice'

function defaultMeasureAt(): string {
  const now = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00:00`
}

const STAGE_LABEL: Record<string, string> = {
  intention: '待首联', following: '跟进中', pendingMeasure: '待量房', quote: '方案报价',
  sign: '已签约', construction: '施工中', done: '已完工', lost: '已流失'
}
const FOLLOW_WAYS: Array<{ value: FollowWay; label: string }> = [
  { value: 'phone', label: '电话' }, { value: 'wechat', label: '微信' }, { value: 'visit', label: '到店/拜访' },
  { value: 'video', label: '视频' }, { value: 'other', label: '其他' }
]

const customers = ref<Customer[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const followVisible = ref(false)
const measureVisible = ref(false)
const detailVisible = ref(false)
const activeCustomer = ref<Customer | null>(null)

const followWay = ref<FollowWay>('phone')
const followContent = ref('')
const followNextAt = ref('')
const propertyId = ref('')
const propertyFormVisible = ref(false)
const propertyFormEditing = ref<Property | null>(null)
const propertyPickerKey = ref(0)
const measureAt = ref('')

const follows = ref<CustomerFollow[]>([])
const schemes = ref<DesignScheme[]>([])
const projects = ref<ProjectBrief[]>([])
const detailLoading = ref(false)

const canFollow = computed(() => activeCustomer.value && activeCustomer.value.stage !== 'lost')
const canMeasure = computed(() => activeCustomer.value && ['following', 'pendingMeasure'].includes(activeCustomer.value.stage))

onMounted(() => { void load() })

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    customers.value = await crmApi.pageCustomers({ keyword: keyword.value.trim() || undefined, size: 200 })
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '我的客户暂不可确认'
  } finally {
    loading.value = false
  }
}

function stageLabel(stage: string): string { return STAGE_LABEL[stage] ?? stage }
function isLost(stage: string): boolean { return stage === 'lost' }

function openFollow(value: unknown): void {
  activeCustomer.value = value as Customer
  followWay.value = 'phone'
  followContent.value = ''
  followNextAt.value = ''
  followVisible.value = true
}

function openCreateProperty(): void {
  if (!activeCustomer.value?.id) {
    notifyBlocked({
      title: '请先选择客户',
      message: '建立房屋需要绑定具体客户：先在左侧客户列表选择一位客户，再建立房屋档案。'
    })
    return
  }
  propertyFormEditing.value = null
  propertyFormVisible.value = true
}

function openEditProperty(property: Property): void {
  propertyFormEditing.value = property
  propertyFormVisible.value = true
}

async function openEditSelectedProperty(): Promise<void> {
  if (!propertyId.value) {
    notifyBlocked({
      title: '请先选择房屋',
      message: '先在上方选择本次要处理的房屋，再编辑房屋资料。'
    })
    return
  }
  try {
    const detail = await propertyApi.getProperty(activeCustomer.value?.id ?? '', propertyId.value)
    if (!detail) {
      ElMessage.error('未读取到房屋档案，请刷新后重试')
      return
    }
    openEditProperty(detail)
  } catch {
    ElMessage.error('房屋档案读取失败，请稍后重试')
  }
}

async function onPropertySaved(property: Property): Promise<void> {
  propertyPickerKey.value += 1
  if (property.id) propertyId.value = property.id
}

function openMeasure(value: unknown): void {
  activeCustomer.value = value as Customer
  propertyId.value = ''
  measureAt.value = defaultMeasureAt()
  measureVisible.value = true
}

async function openDetail(value: unknown): Promise<void> {
  const customer = value as Customer
  activeCustomer.value = customer
  detailVisible.value = true
  detailLoading.value = true
  follows.value = []
  schemes.value = []
  projects.value = []
  try {
    const [followRows, schemeRows, projectRows] = await Promise.all([
      crmApi.customerFollows(customer.id),
      designApi.listSchemes(customer.id).catch(() => [] as DesignScheme[]),
      projectApi.listProjects({ size: 200 }).catch(() => [] as ProjectBrief[])
    ])
    follows.value = followRows
    schemes.value = schemeRows
    projects.value = projectRows.filter((item) => item.customerId === customer.id)
  } catch (loadError) {
    ElMessage.error(loadError instanceof ProviderError ? loadError.message : '客户详情暂不可确认')
  } finally {
    detailLoading.value = false
  }
}

async function submitFollow(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!followContent.value.trim()) { ElMessage.warning('请填写跟进内容'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.saveFollow({
      customerId: customer.id, way: followWay.value, content: followContent.value.trim(),
      nextFollowAt: followNextAt.value ? followNextAt.value.replace('T', ' ') : undefined
    })
    ElMessage.success('已保存跟进')
    followVisible.value = false
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '保存跟进失败，暂不可确认')
  } finally {
    busy.value = false
  }
}

async function submitMeasure(): Promise<void> {
  const customer = activeCustomer.value
  if (!customer) return
  if (!propertyId.value) { ElMessage.warning('请选择房屋'); return }
  if (!measureAt.value) { ElMessage.warning('请选择量房时间'); return }
  if (busy.value) return
  busy.value = true
  try {
    await crmApi.scheduleMeasure(customer.id, propertyId.value, measureAt.value.replace('T', ' '))
    ElMessage.success('已安排量房')
    measureVisible.value = false
    await load()
  } catch (actionError) {
    ElMessage.error(actionError instanceof ProviderError ? actionError.message : '安排量房失败，暂不可确认')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance-page__titles">
        <span class="finance-eyebrow">MY CUSTOMER · 我的客户</span>
        <h1>我的客户</h1>
        <p>按本人客户归属查看并写跟进、安排量房；本人客户的设计与项目为只读，跨业务员客户不返回。</p>
      </div>
      <div class="finance-actions">
        <el-input v-model="keyword" clearable placeholder="搜索客户 / 小区" style="width: 220px" @keyup.enter="load" @clear="load" />
        <el-button @click="load">刷新</el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon>
      <template #default><el-button size="small" plain @click="load">重新加载</el-button></template>
    </el-alert>

    <PanelCard flush>
      <SkeletonBlock v-if="loading && !customers.length" variant="table" :rows="6" />
      <EmptyState v-else-if="!loading && !customers.length" title="当前没有分配给您的客户" description="客户建档并归属到您后，这里会出现跟进入口。" />
      <el-table v-else :data="customers" stripe>
        <el-table-column label="客户" min-width="220">
          <template #default="{ row }">
            <div class="finance-table__main">
              <span class="finance-table__title">{{ row.name }}</span>
              <span class="finance-table__sub">{{ row.community || '未填小区' }} · {{ row.phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="110">
          <template #default="{ row }"><StatusTag :text="stageLabel(row.stage)" :tone="isLost(row.stage) ? 'closed' : 'doing'" /></template>
        </el-table-column>
        <el-table-column label="设计师" width="130">
          <template #default="{ row }">{{ row.designerName || '未指派' }}</template>
        </el-table-column>
        <el-table-column label="预算" width="130" align="right">
          <template #default="{ row }"><MoneyText v-if="row.budget" :value="row.budget" /><span v-else>—</span></template>
        </el-table-column>
        <el-table-column label="最近跟进" width="160">
          <template #default="{ row }">{{ row.lastFollowAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="finance-actions">
              <el-button link type="primary" :disabled="isLost(row.stage)" @click.stop="openFollow(row)">写跟进</el-button>
              <el-button link :disabled="!['following', 'pendingMeasure'].includes(row.stage)" @click.stop="openMeasure(row)">安排量房</el-button>
              <el-button link @click.stop="openDetail(row)">设计与项目</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </PanelCard>

    <el-dialog v-model="followVisible" title="写客户跟进" width="480px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · {{ stageLabel(activeCustomer?.stage ?? '') }}</p>
      <el-select v-model="followWay" style="width: 100%">
        <el-option v-for="way in FOLLOW_WAYS" :key="way.value" :label="way.label" :value="way.value" />
      </el-select>
      <el-input v-model="followContent" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="跟进内容" style="margin-top: 12px" />
      <el-date-picker v-model="followNextAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="下次跟进时间（选填）" style="width: 100%; margin-top: 12px" />
      <template #footer>
        <el-button @click="followVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" :disabled="!canFollow" @click="submitFollow">保存跟进</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="measureVisible" title="安排量房" width="460px" destroy-on-close>
      <p class="finance-drawer__hint">{{ activeCustomer?.name }} · 量房前必须先建立并选择房屋档案。</p>
      <PropertyPicker :key="propertyPickerKey" v-model="propertyId" :customer-id="activeCustomer?.id ?? ''" title="选择量房房屋" placeholder="选择本次量房的房屋" />
      <el-button size="small" style="margin-top: 8px" @click="openCreateProperty">新增房屋</el-button>
      <el-button size="small" style="margin-top: 8px" :disabled="!propertyId" @click="openEditSelectedProperty">维护当前房屋</el-button>
      <el-date-picker v-model="measureAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="量房时间（晚于当前）" style="width: 100%; margin-top: 12px" />
      <template #footer>
        <el-button @click="measureVisible = false">取消</el-button>
        <el-button type="primary" :loading="busy" :disabled="!canMeasure" @click="submitMeasure">确认安排</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="客户设计与项目（只读）" size="560px">
      <SkeletonBlock v-if="detailLoading" variant="table" :rows="5" />
      <template v-else>
        <h3>{{ activeCustomer?.name }}</h3>
        <p class="finance-table__sub">{{ stageLabel(activeCustomer?.stage ?? '') }} · 设计师 {{ activeCustomer?.designerName || '未指派' }}</p>

        <h4>设计（只读）</h4>
        <EmptyState v-if="!schemes.length" title="暂无设计" description="设计师保存方案后，这里会出现只读进展。" />
        <el-table v-else :data="schemes" stripe size="small">
          <el-table-column prop="name" label="方案" min-width="150" />
          <el-table-column prop="version" label="版本" width="70" />
          <el-table-column label="状态" width="110"><template #default="{ row }"><StatusTag :text="String(row.status)" tone="info" /></template></el-table-column>
        </el-table>

        <h4 style="margin-top: 16px">项目（只读）</h4>
        <EmptyState v-if="!projects.length" title="暂无项目" description="客户签约立项后，这里会出现只读进度。" />
        <el-table v-else :data="projects" stripe size="small">
          <el-table-column prop="name" label="项目" min-width="170" />
          <el-table-column prop="progress" label="进度" width="80" align="right" />
          <el-table-column label="当前阶段" min-width="120"><template #default="{ row }">{{ row.currentStageName || '—' }}</template></el-table-column>
        </el-table>

        <h4 style="margin-top: 16px">跟进记录</h4>
        <EmptyState v-if="!follows.length" title="暂无跟进记录" description="保存跟进后，这里会出现留痕。" />
        <el-timeline v-else>
          <el-timeline-item v-for="item in follows" :key="item.id" :timestamp="item.createdAt || ''" placement="top">
            <strong>{{ item.way }}</strong>
            <p class="finance-table__sub">{{ item.empName || '' }}</p>
            <p>{{ item.content }}</p>
          </el-timeline-item>
        </el-timeline>
      </template>
    </el-drawer>
  </div>
    <PropertyFormDrawer
      v-model="propertyFormVisible"
      :customer-id="activeCustomer?.id ?? ''"
      :customer-name="activeCustomer?.name ?? ''"
      :property="propertyFormEditing"
      @saved="onPropertySaved"
    />

</template>
