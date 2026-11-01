<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EmptyState from '@/components/EmptyState.vue'
import FileUploadField from '@/components/form/FileUploadField.vue'
import MoneyText from '@/components/MoneyText.vue'
import PanelCard from '@/components/PanelCard.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import StatusTag from '@/components/StatusTag.vue'
import SupplierFormDrawer from '@/components/supply/SupplierFormDrawer.vue'
import { supplyApi } from '@/domains/supply/api'
import type { SupplierPartner, SupplierPartnerStatus, SupplierPartnerType } from '@/domains/supply/model'
import type { UploadedFile } from '@/domains/file/model'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const partner = ref<SupplierPartner | null>(null)
const loading = ref(false)
const error = ref('')
const editOpen = ref(false)
const paymentFiles = ref<UploadedFile[]>([])
const savedPaymentSignature = ref('')
const savingPaymentCodes = ref(false)
const uploadError = ref('')

const partnerId = computed(() => String(route.params.partnerId || ''))
const canWrite = computed(() => ['Boss', 'StoreManager', 'Finance'].includes(session.role ?? ''))
const canViewPaymentCodes = computed(() => canWrite.value)
const paymentSignature = computed(() => paymentFiles.value.map((file) => file.path).join('|'))
const paymentCodesDirty = computed(() => paymentSignature.value !== savedPaymentSignature.value)

const typeLabel = computed(() => {
  const labels: Record<SupplierPartnerType, string> = {
    supplier: '材料供应商', factory: '厂家', laborTeam: '劳务班组',
    installer: '安装服务', logistics: '物流', service: '其他服务'
  }
  return partner.value ? labels[partner.value.type] : '供应商'
})

function statusLabel(status: SupplierPartnerStatus): string {
  return status === 'disabled' ? '已停用' : '合作中'
}

function statusTone(status: SupplierPartnerStatus): 'idle' | 'done' {
  return status === 'disabled' ? 'idle' : 'done'
}

function settlementLabel(value: SupplierPartner): string {
  if (value.settlementMode === 'MonthlyCutoff') return `每月 ${value.cutoffDay || '—'} 日对账`
  if (value.settlementMode === 'ReceiptDays') return `收货后 ${value.settlementDays ?? 0} 天`
  return value.settlementTerms || '按约定结算'
}

function syncPaymentFiles(value: SupplierPartner): void {
  const urls = value.paymentCodeImageUrls || []
  paymentFiles.value = value.paymentCodeImages.map((path, index) => ({
    path,
    url: urls[index] || path,
    name: `付款码${index + 1}`,
    contentType: 'image/*'
  }))
  savedPaymentSignature.value = value.paymentCodeImages.join('|')
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  uploadError.value = ''
  try {
    const result = await supplyApi.partnerPage({
      partnerId: partnerId.value,
      status: 'all',
      current: 1,
      size: 1,
      includePaymentCodeUrls: canViewPaymentCodes.value
    })
    const current = result.list[0]
    if (!current) throw new Error('供应商不存在或已超出当前数据范围')
    partner.value = current
    syncPaymentFiles(current)
  } catch (loadError) {
    partner.value = null
    error.value = loadError instanceof Error ? loadError.message : '供应商档案暂不可确认'
  } finally {
    loading.value = false
  }
}

function cancelPaymentChanges(): void {
  if (!partner.value) return
  syncPaymentFiles(partner.value)
  uploadError.value = ''
}

async function savePaymentCodes(): Promise<void> {
  if (!partner.value || !canWrite.value || savingPaymentCodes.value) return
  savingPaymentCodes.value = true
  uploadError.value = ''
  try {
    await supplyApi.partnerUpdate({
      ...partner.value,
      id: partner.value.id,
      paymentCodeImages: paymentFiles.value.map((file) => file.path)
    })
    ElMessage.success('付款码已保存')
    await load()
  } catch (saveError) {
    uploadError.value = saveError instanceof Error ? saveError.message : '付款码保存失败，请保留图片后重试'
  } finally {
    savingPaymentCodes.value = false
  }
}

function onProfileSaved(): void {
  void load()
}

onMounted(load)
</script>

<template>
  <div class="supplier-detail">
    <button class="supplier-detail__back" type="button" @click="router.push('/workbench/suppliers')">返回供应商档案</button>

    <SkeletonBlock v-if="loading" variant="card" :rows="8" />
    <EmptyState
      v-else-if="error"
      title="供应商档案暂不可确认"
      :description="error"
      action-text="重新加载"
      @action="load"
    />
    <template v-else-if="partner">
      <header class="supplier-hero">
        <div class="supplier-hero__identity">
          <div class="supplier-hero__type">{{ typeLabel }}</div>
          <div class="supplier-hero__title-row">
            <h1>{{ partner.name }}</h1>
            <StatusTag :text="statusLabel(partner.status)" :tone="statusTone(partner.status)" />
          </div>
          <div class="supplier-hero__meta">
            <span>{{ partner.contactName || '联系人未维护' }}</span>
            <span>{{ partner.telNo || '电话未维护' }}</span>
            <span>{{ partner.addr || '地址未维护' }}</span>
          </div>
        </div>
        <div class="supplier-hero__actions">
          <div class="supplier-hero__balance">
            <span>未付余额</span>
            <strong><MoneyText :value="partner.outstandingAmount" size="lg" /></strong>
          </div>
          <el-button v-if="canWrite" @click="editOpen = true">编辑供应商资料</el-button>
        </div>
      </header>

      <div class="supplier-layout">
        <main class="supplier-main">
          <PanelCard title="付款码" description="付款前核对收款主体与二维码；图片按当前顺序保存。">
            <template #extra>
              <span class="supplier-code-count">{{ paymentFiles.length }}/9</span>
            </template>
            <template v-if="canViewPaymentCodes">
              <el-alert
                v-if="uploadError"
                type="error"
                :closable="false"
                show-icon
                :title="uploadError"
                class="supplier-code-error"
              />
              <FileUploadField
                v-model="paymentFiles"
                class="supplier-payment-upload"
                business-type="Partner"
                label="付款码"
                hint="支持 JPG、PNG、WEBP，可上传多张；点击图片可放大并左右切换预览。"
                accept="image/jpeg,image/png,image/webp"
                :multiple="true"
                :max="9"
                @error="uploadError = $event"
              />
              <div v-if="paymentCodesDirty" class="supplier-code-actions">
                <el-button @click="cancelPaymentChanges">取消更改</el-button>
                <el-button type="primary" :loading="savingPaymentCodes" @click="savePaymentCodes">保存付款码</el-button>
              </div>
            </template>
            <EmptyState
              v-else
              title="付款码仅负责人、店长和财务可查看"
              description="当前岗位可以查看供应商基础档案，但不能访问付款码图片。"
            />
          </PanelCard>

          <PanelCard title="合作说明">
            <p v-if="partner.remark" class="supplier-remark">{{ partner.remark }}</p>
            <p v-else class="supplier-remark supplier-remark--empty">暂无合作备注</p>
          </PanelCard>
        </main>

        <aside class="supplier-side">
          <section class="supplier-facts" aria-label="结算与付款">
            <header><h2>结算与付款</h2></header>
            <dl>
              <div><dt>结算方式</dt><dd>{{ settlementLabel(partner) }}</dd></div>
              <div><dt>结算说明</dt><dd>{{ partner.settlementTerms || '未维护' }}</dd></div>
              <div><dt>开户行</dt><dd>{{ partner.bankName || '未维护' }}</dd></div>
              <div><dt>银行账号</dt><dd>{{ partner.bankAccount || '未维护' }}</dd></div>
              <div><dt>税号</dt><dd>{{ partner.taxNo || '未维护' }}</dd></div>
            </dl>
          </section>

          <section class="supplier-facts" aria-label="供应商往来">
            <header><h2>供应商往来</h2></header>
            <dl>
              <div><dt>应付总额</dt><dd><MoneyText :value="partner.payableAmount" /></dd></div>
              <div><dt>已付金额</dt><dd><MoneyText :value="partner.paidAmount" /></dd></div>
              <div><dt>未付余额</dt><dd><MoneyText :value="partner.outstandingAmount" /></dd></div>
              <div><dt>供货品牌</dt><dd>{{ partner.brands.length ? partner.brands.join('、') : '未维护' }}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <SupplierFormDrawer
        v-if="canWrite"
        v-model="editOpen"
        mode="edit"
        :partner="partner"
        @saved="onProfileSaved"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.supplier-detail { display: flex; flex-direction: column; gap: $space-4; }
.supplier-detail__back { align-self: flex-start; padding: 0; border: 0; color: $text-secondary; background: transparent; font: inherit; font-size: $font-body-sm; cursor: pointer; }
.supplier-detail__back:hover { color: $brand-700; }
.supplier-hero { display: flex; justify-content: space-between; gap: $space-5; padding-bottom: $space-4; border-bottom: 1px solid $border-color; }
.supplier-hero__identity { min-width: 0; }
.supplier-hero__type { color: $text-tertiary; font-size: $font-caption; }
.supplier-hero__title-row { display: flex; align-items: center; flex-wrap: wrap; gap: $space-3; margin-top: $space-1; }
.supplier-hero h1 { margin: 0; color: $text-primary; font-size: $font-display; }
.supplier-hero__meta { display: flex; flex-wrap: wrap; gap: $space-2 $space-4; margin-top: $space-2; color: $text-secondary; font-size: $font-body-sm; }
.supplier-hero__actions { display: flex; align-items: flex-end; gap: $space-4; flex-shrink: 0; }
.supplier-hero__balance { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.supplier-hero__balance span { color: $text-tertiary; font-size: $font-caption; }
.supplier-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: $space-4; align-items: start; }
.supplier-main { display: flex; flex-direction: column; gap: $space-4; min-width: 0; }
.supplier-side { display: flex; flex-direction: column; gap: $space-4; }
.supplier-code-count { color: $text-tertiary; font-size: $font-caption; font-variant-numeric: tabular-nums; }
.supplier-code-error { margin-bottom: $space-3; }
.supplier-payment-upload { padding: $space-4; border: 1px dashed $border-color; border-radius: $radius-md; background: $surface-50; }
.supplier-payment-upload :deep(.upload__btn) { padding: 8px 14px; border-color: $brand-600; color: $surface-0; background: $brand-600; font-size: $font-body-sm; font-weight: $font-weight-semibold; }
.supplier-payment-upload :deep(.upload__btn:hover:not(:disabled)) { border-color: $brand-700; color: $surface-0; background: $brand-700; }
.supplier-payment-upload :deep(.upload__empty) { padding-top: $space-2; text-align: center; }
.supplier-code-actions { display: flex; justify-content: flex-end; gap: $space-2; margin-top: $space-3; padding-top: $space-3; border-top: 1px solid $border-color; }
.supplier-facts { padding: $space-4; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; }
.supplier-facts header h2 { margin: 0; color: $text-primary; font-size: $font-card-title; }
.supplier-facts dl { margin: $space-3 0 0; }
.supplier-facts dl > div { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: $space-2; padding: $space-2 0; border-top: 1px solid $border-color; }
.supplier-facts dt { color: $text-tertiary; font-size: $font-caption; }
.supplier-facts dd { margin: 0; color: $text-primary; font-size: $font-body-sm; overflow-wrap: anywhere; text-align: right; }
.supplier-remark { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; white-space: pre-wrap; }
.supplier-remark--empty { color: $text-tertiary; }
@media (max-width: 1180px) {
  .supplier-layout { grid-template-columns: 1fr; }
  .supplier-side { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 800px) {
  .supplier-hero { flex-direction: column; }
  .supplier-hero__actions { align-items: center; justify-content: space-between; width: 100%; }
  .supplier-side { grid-template-columns: 1fr; }
}
</style>
