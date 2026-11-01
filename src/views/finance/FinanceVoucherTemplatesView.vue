<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ProviderError } from '@/core/http'
import { DEFAULT_DESIGNER_CONFIG, templateApi } from '@/domains/document/api'
import { templateVersionStatusLabel, templateVersionStatusTone } from '@/domains/document/meta'
import type { DocumentLayoutConfig, DocumentTemplateInfo, DocumentTemplateVersionInfo, VoucherDesignerConfig } from '@/domains/document/model'
import PanelCard from '@/components/PanelCard.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import SkeletonBlock from '@/components/SkeletonBlock.vue'
import VoucherDesignerCanvas from '@/components/finance/VoucherDesignerCanvas.vue'

type TemplateType = 'Receipt' | 'Payment'

const DEFAULT_FIELDS: Record<string, boolean> = {
  showCompanyName: true,
  showServiceHotline: true,
  showVoucherNo: true,
  showVoucherDate: true,
  showPartyName: true,
  showWorkerPhone: true,
  showWorkerIdCard: true,
  showWorkerTrade: true,
  showProject: true,
  showAmount: true,
  showAmountWords: true,
  showSignBlock: true,
  showDetailNo: true,
  showDetailDate: true,
  showDetailAccount: true,
  showDetailAmount: true,
  showDetailTarget: true,
  showDetailCategory: false,
  showDetailRemark: false
}

const ORG_FIELDS = [
  { key: 'showCompanyName', label: '企业全称' },
  { key: 'showServiceHotline', label: '服务热线' }
]
const HEADER_FIELDS = [
  { key: 'showVoucherNo', label: '凭证编号' },
  { key: 'showVoucherDate', label: '开具日期' },
  { key: 'showPartyName', label: '对方名称' },
  { key: 'showWorkerPhone', label: '联系电话' },
  { key: 'showWorkerIdCard', label: '身份证号码' },
  { key: 'showWorkerTrade', label: '工种' },
  { key: 'showProject', label: '所属项目' },
  { key: 'showAmount', label: '金额合计' },
  { key: 'showAmountWords', label: '金额大写' },
  { key: 'showSignBlock', label: '签字栏' }
]
const LAYOUT_BLOCKS: Array<{ key: string; label: string }> = [
  { key: 'company', label: '企业抬头' },
  { key: 'title', label: '凭证标题' },
  { key: 'meta', label: '凭证信息' },
  { key: 'amount', label: '金额区' },
  { key: 'detail', label: '明细表' },
  { key: 'sign', label: '签字栏' },
  { key: 'footer', label: '页脚说明' }
]

const DEFAULT_LAYOUT: DocumentLayoutConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginMm: 12,
  blocks: LAYOUT_BLOCKS.map((item, index) => ({ key: item.key, visible: true, sort: (index + 1) * 10 })),
  signatures: ['制单', '审核', '领款/付款人'],
  footer: '本凭证为款项收付单据打印稿，用于企业留档；不属于会计记账凭证，不替代会计做账。'
}

const DETAIL_FIELDS = [
  { key: 'showDetailNo', label: '来源说明' },
  { key: 'showDetailDate', label: '日期' },
  { key: 'showDetailAccount', label: '支付账户' },
  { key: 'showDetailAmount', label: '金额' },
  { key: 'showDetailTarget', label: '到账账户' },
  { key: 'showDetailCategory', label: '款项类型' },
  { key: 'showDetailRemark', label: '备注' }
]

const templates = ref<DocumentTemplateInfo[]>([])
const presets = ref<DocumentTemplateInfo[]>([])
const versions = ref<DocumentTemplateVersionInfo[]>([])
const loading = ref(false)
const versionLoading = ref(false)
const error = ref('')
const saving = ref(false)
const publishing = ref(false)
const templateType = ref<TemplateType>('Payment')
const activePresetCode = ref('')
const activeTemplateId = ref('')
const designerMode = ref(false)
const designerConfig = ref<VoucherDesignerConfig>(clonePlain(DEFAULT_DESIGNER_CONFIG))
const fields = reactive<Record<string, boolean>>({ ...DEFAULT_FIELDS })
const style = reactive({ primaryColor: '#2f7d5a', fontSize: 12, rowSpacing: 2 })
const layout = reactive<DocumentLayoutConfig>(structuredClone(DEFAULT_LAYOUT))
const form = reactive({ name: '工资发放凭证' })

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const allFields = [...ORG_FIELDS, ...HEADER_FIELDS, ...DETAIL_FIELDS]
const myTemplates = computed(() => templates.value.filter((item) => Boolean(item.templateId)))
const activeEnterpriseTemplate = computed(() => activeTemplateId.value
  ? templates.value.find((item) => item.templateId === activeTemplateId.value)
  : undefined)
const sampleMeta = computed(() => [
  { key: 'showVoucherNo', label: '凭证编号', value: 'PZ20260331121705260671' },
  { key: 'showVoucherDate', label: '开具日期', value: '2026-03-31' },
  { key: 'showPartyName', label: '收款人', value: '张伟' },
  { key: 'showWorkerPhone', label: '联系电话', value: '18660219910' },
  { key: 'showWorkerIdCard', label: '身份证号码', value: '341222********5970' },
  { key: 'showWorkerTrade', label: '工种', value: '木工' },
  { key: 'showProject', label: '所属项目', value: '梦圆小区 222-201' }
].filter((item) => fields[item.key]))
const detailColumns = computed(() => DETAIL_FIELDS.filter((item) => fields[item.key]))
const detailRow: Record<string, string> = {
  showDetailNo: 'PZ20260331121705260671',
  showDetailDate: '2026-03-31',
  showDetailAccount: '企业对公',
  showDetailAmount: '40.00',
  showDetailTarget: '***********1266',
  showDetailCategory: '工人工资',
  showDetailRemark: '3 月工资'
}
const visibleLayoutBlocks = computed(() => layout.blocks
  .filter((item) => item.visible)
  .sort((left, right) => left.sort - right.sort)
  .map((item) => ({ ...item, label: LAYOUT_BLOCKS.find((block) => block.key === item.key)?.label ?? item.key })))
const previewPageStyle = computed(() => ({
  maxWidth: layout.orientation === 'portrait' ? '620px' : '860px',
  margin: '0 auto',
  border: '1px solid #e5e1d8',
  borderRadius: '8px',
  padding: `${Math.max(20, layout.marginMm * 2)}px`
}))
const orgLine = computed(() => {
  const parts: string[] = []
  if (fields.showCompanyName) parts.push('企业全称')
  if (fields.showServiceHotline) parts.push('服务热线 0551-8888 6666')
  return parts.join(' · ')
})

onMounted(boot)

async function boot(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [enterprise, baseline] = await Promise.all([templateApi.templates(), templateApi.presets()])
    templates.value = enterprise
    presets.value = baseline
    apply(templateType.value)
  } catch (loadError) {
    error.value = loadError instanceof ProviderError ? loadError.message : '凭证模板暂不可确认'
  } finally {
    loading.value = false
  }
}

function apply(type: TemplateType): void {
  Object.assign(fields, DEFAULT_FIELDS)
  activePresetCode.value = ''
  activeTemplateId.value = ''
  versions.value = []
  const target = myTemplates.value.find((item) => item.type === type)
  if (target) {
    activeTemplateId.value = target.templateId ?? ''
    activePresetCode.value = target.presetCode ?? ''
    Object.assign(fields, target.fieldConfig)
    form.name = target.name
    style.primaryColor = target.styleConfig.primaryColor
    style.fontSize = target.styleConfig.fontSize
    style.rowSpacing = target.styleConfig.rowSpacing
    Object.assign(layout, clonePlain(target.layoutConfig ?? DEFAULT_LAYOUT))
    designerConfig.value = clonePlain(target.designerConfig ?? DEFAULT_DESIGNER_CONFIG)
  } else {
    form.name = type === 'Receipt' ? '客户收款凭证' : '工资发放凭证'
    style.primaryColor = '#2f7d5a'
    style.fontSize = 12
    style.rowSpacing = 2
    Object.assign(layout, clonePlain(DEFAULT_LAYOUT))
    designerConfig.value = clonePlain(DEFAULT_DESIGNER_CONFIG)
  }
}

function switchType(type: TemplateType): void {
  templateType.value = type
  apply(type)
}

function applyPreset(preset: DocumentTemplateInfo): void {
  activePresetCode.value = preset.presetCode ?? ''
  activeTemplateId.value = ''
  versions.value = []
  templateType.value = preset.type === 'Receipt' ? 'Receipt' : 'Payment'
  Object.assign(fields, DEFAULT_FIELDS, preset.fieldConfig)
  form.name = preset.name
  style.primaryColor = preset.styleConfig.primaryColor
  style.fontSize = preset.styleConfig.fontSize
  style.rowSpacing = preset.styleConfig.rowSpacing
  Object.assign(layout, clonePlain(preset.layoutConfig ?? DEFAULT_LAYOUT))
  designerConfig.value = clonePlain(preset.designerConfig ?? DEFAULT_DESIGNER_CONFIG)
}

function moveLayoutBlock(index: number, delta: number): void {
  const ordered = [...layout.blocks].sort((left, right) => left.sort - right.sort)
  const target = index + delta
  if (target < 0 || target >= ordered.length) return
  const current = ordered[index]
  ordered[index] = ordered[target]
  ordered[target] = current
  ordered.forEach((item, order) => { item.sort = (order + 1) * 10 })
  layout.blocks = ordered
}

function updateSignature(index: number, value: string): void {
  layout.signatures[index] = value
}

async function applyEnterprise(template: DocumentTemplateInfo): Promise<void> {
  if (!template.templateId) return
  activeTemplateId.value = template.templateId
  activePresetCode.value = template.presetCode ?? ''
  templateType.value = template.type === 'Receipt' ? 'Receipt' : 'Payment'
  Object.assign(fields, DEFAULT_FIELDS, template.fieldConfig)
  form.name = template.name
  style.primaryColor = template.styleConfig.primaryColor
  style.fontSize = template.styleConfig.fontSize
  style.rowSpacing = template.styleConfig.rowSpacing
  await loadVersions(template.templateId)
}

async function loadVersions(templateId: string): Promise<void> {
  versionLoading.value = true
  try {
    versions.value = await templateApi.templateVersions(templateId)
  } catch (loadError) {
    ElMessage.error(loadError instanceof ProviderError ? loadError.message : '版本历史暂不可确认')
  } finally {
    versionLoading.value = false
  }
}

async function publish(): Promise<void> {
  const template = activeEnterpriseTemplate.value
  if (!template?.templateId || publishing.value) return
  publishing.value = true
  try {
    const saved = await templateApi.publishTemplate(template.templateId)
    replaceTemplate(saved)
    ElMessage.success(`模板 V${saved.publishedVersion ?? saved.version} 已发布`)
    await loadVersions(saved.templateId!)
  } catch (publishError) {
    ElMessage.error(publishError instanceof ProviderError ? publishError.message : '模板发布失败，暂不可确认')
  } finally {
    publishing.value = false
  }
}

async function disable(): Promise<void> {
  const template = activeEnterpriseTemplate.value
  if (!template?.templateId || publishing.value) return
  publishing.value = true
  try {
    const saved = await templateApi.disableTemplate(template.templateId)
    replaceTemplate(saved)
    ElMessage.success('模板当前发布版本已停用')
    await loadVersions(saved.templateId!)
  } catch (disableError) {
    ElMessage.error(disableError instanceof ProviderError ? disableError.message : '模板停用失败，暂不可确认')
  } finally {
    publishing.value = false
  }
}

function replaceTemplate(saved: DocumentTemplateInfo): void {
  const index = templates.value.findIndex((item) => item.templateId === saved.templateId)
  if (index >= 0) templates.value.splice(index, 1, saved)
  else templates.value.push(saved)
  activeTemplateId.value = saved.templateId ?? ''
  activePresetCode.value = saved.presetCode ?? ''
}

async function save(): Promise<void> {
  saving.value = true
  try {
    const composite: Record<string, boolean> = {}
    Object.keys(DEFAULT_FIELDS).forEach((key) => { composite[key] = Boolean(fields[key]) })
    const saved = await templateApi.saveTemplate({
      type: templateType.value,
      presetCode: activePresetCode.value || undefined,
      name: form.name.trim() || (templateType.value === 'Receipt' ? '客户收款凭证' : '工资发放凭证'),
      fieldConfig: composite,
      styleConfig: { ...style },
      layoutConfig: clonePlain(layout),
      designerConfig: clonePlain(designerConfig.value)
    })
    replaceTemplate(saved)
    await loadVersions(saved.templateId!)
    ElMessage.success(`企业模板已保存（版本 ${saved.version}）`)
  } catch (saveError) {
    ElMessage.error(saveError instanceof ProviderError ? saveError.message : '模板保存失败，暂不可确认')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="finance-page">
    <header class="finance-page__head">
      <div class="finance__titles finance-page__titles">
        <span class="finance-eyebrow">凭证据款模板</span>
        <h1>凭证模板</h1>
        <p>平台基线零配置可用；企业可调整字段显隐、字号、行距和主色。模板是款项打印载体，不是法定会计凭证。</p>
      </div>
      <div class="finance-actions">
        <el-radio-group v-model="designerMode" size="small">
          <el-radio-button :value="false">快速版式</el-radio-button>
          <el-radio-button :value="true">高级设计器</el-radio-button>
        </el-radio-group>
        <el-button @click="boot">重新加载</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ activeTemplateId ? '保存新版本' : '复制并保存为企业模板' }}
        </el-button>
      </div>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert
      v-else-if="activePresetCode && !activeTemplateId"
      type="info"
      :closable="false"
      show-icon
      title="当前是平台行业模板副本。修改字段和样式后，点击右上角“复制并保存为企业模板”即可完成自定义。"
    />

    <VoucherDesignerCanvas v-if="designerMode" v-model="designerConfig" />

    <div v-else class="finance-template-layout">
      <PanelCard title="模板库" description="企业模板优先展示，平台基础模板可复制后修改。" flush>
        <SkeletonBlock v-if="loading && !presets.length" variant="text" :rows="6" />
        <EmptyState v-else-if="!presets.length" title="暂无平台模板" description="模板服务不可用时不会伪造模板内容。" />
        <div v-else class="finance-template-list">
          <div class="finance-template-section">我的模板</div>
          <button
            v-for="template in myTemplates"
            :key="template.templateId"
            type="button"
            class="finance-template-item"
            :class="{ 'finance-template-item--active': activeTemplateId === template.templateId }"
            @click="applyEnterprise(template)"
          >
            <div>
              <strong>{{ template.name }}</strong>
              <span>{{ template.type === 'Receipt' ? '收款单' : '付款单' }} · V{{ template.version }} · {{ template.publishedVersion ? `已发布 V${template.publishedVersion}` : '草稿未发布' }}</span>
            </div>
            <span>编辑</span>
          </button>
          <div v-if="!myTemplates.length" class="finance-template-empty">还没有企业模板，从下方平台模板复制一份开始。</div>

          <div class="finance-template-section">平台基础模板</div>
          <button
            v-for="preset in presets"
            :key="preset.presetCode ?? preset.name"
            type="button"
            class="finance-template-item"
            :class="{ 'finance-template-item--active': activePresetCode === preset.presetCode && !activeTemplateId }"
            @click="applyPreset(preset)"
          >
            <div>
              <strong>{{ preset.name }}</strong>
              <span>{{ preset.type === 'Receipt' ? '收款单' : '付款单' }} · {{ preset.presetNote || '平台基线' }}</span>
            </div>
            <span>复制并编辑</span>
          </button>
        </div>
      </PanelCard>

      <PanelCard class="finance-template-editor-panel" :title="templateType === 'Receipt' ? '收款凭证模板' : '付款凭证模板'" description="字段显隐和样式会在保存时逐项核对。" flush>
        <div class="finance-template-preview">
          <section class="finance-template-settings">
            <el-form label-position="top" class="finance-form-grid">
            <el-form-item label="模板名称">
              <el-input v-model="form.name" maxlength="60" />
            </el-form-item>
            <el-form-item label="单据类型">
              <el-select :model-value="templateType" style="width: 100%" @change="switchType($event as TemplateType)">
                <el-option label="收款单" value="Receipt" />
                <el-option label="付款单" value="Payment" />
              </el-select>
            </el-form-item>
            <el-form-item label="主色">
              <el-color-picker v-model="style.primaryColor" />
            </el-form-item>
            <el-form-item label="正文字号">
              <el-input-number v-model="style.fontSize" :min="10" :max="18" />
            </el-form-item>
            <el-form-item label="行距">
              <el-input-number v-model="style.rowSpacing" :min="0" :max="12" />
            </el-form-item>
          </el-form>

          <el-divider content-position="left">显示字段</el-divider>
          <div class="finance-template-fields">
            <el-checkbox v-for="field in allFields" :key="field.key" v-model="fields[field.key]">
              {{ field.label }}
            </el-checkbox>
          </div>

          <el-divider content-position="left">版式设计</el-divider>
          <el-form label-position="top" class="finance-form-grid">
            <el-form-item label="纸张">
              <el-select v-model="layout.pageSize" style="width: 100%">
                <el-option label="A3" value="A3" />
                <el-option label="A4" value="A4" />
                <el-option label="A5" value="A5" />
              </el-select>
            </el-form-item>
            <el-form-item label="方向">
              <el-select v-model="layout.orientation" style="width: 100%">
                <el-option label="纵向" value="portrait" />
                <el-option label="横向" value="landscape" />
              </el-select>
            </el-form-item>
            <el-form-item label="页边距（毫米）">
              <el-input-number v-model="layout.marginMm" :min="8" :max="20" />
            </el-form-item>
          </el-form>
          <div class="finance-layout-blocks">
            <div v-for="(block, index) in [...layout.blocks].sort((a, b) => a.sort - b.sort)" :key="block.key" class="finance-layout-block">
              <el-checkbox v-model="block.visible">{{ LAYOUT_BLOCKS.find((item) => item.key === block.key)?.label ?? block.key }}</el-checkbox>
              <div class="finance-layout-block__actions">
                <el-button size="small" :disabled="index === 0" @click="moveLayoutBlock(index, -1)">上移</el-button>
                <el-button size="small" :disabled="index === layout.blocks.length - 1" @click="moveLayoutBlock(index, 1)">下移</el-button>
              </div>
            </div>
          </div>
          <el-form label-position="top" class="finance-form-grid">
            <el-form-item v-for="(label, index) in layout.signatures" :key="index" :label="`签字栏 ${index + 1}`">
              <el-input :model-value="label" maxlength="20" @update:model-value="updateSignature(index, $event)" />
            </el-form-item>
            <el-form-item label="页脚说明">
              <el-input v-model="layout.footer" maxlength="200" />
            </el-form-item>
            </el-form>
          </section>

          <aside class="finance-template-result">
            <header class="finance-template-result__head">
              <div>
                <strong>实时结果</strong>
                <span>{{ form.name || '凭证模板' }} · {{ templateType === 'Receipt' ? '收款单' : '付款单' }}</span>
              </div>
              <StatusTag text="实时预览" tone="doing" />
            </header>
            <div class="finance-template-preview__paper" :style="{ color: style.primaryColor, ...previewPageStyle }">
            <template v-for="block in visibleLayoutBlocks" :key="block.key">
              <div v-if="block.key === 'company'" class="finance-template-preview__org" :style="{ color: '#66665f' }">{{ orgLine }}</div>
              <h2 v-else-if="block.key === 'title'" class="finance-template-preview__title">{{ form.name || '凭证' }}</h2>
              <div v-else-if="block.key === 'meta'" class="finance-template-preview__meta">
                <span v-for="item in sampleMeta" :key="item.key">{{ item.label }}：{{ item.value }}</span>
              </div>
              <div v-else-if="block.key === 'amount' && (fields.showAmount || fields.showAmountWords)" class="finance-template-preview__amount">
                <strong v-if="fields.showAmount">金额合计：¥40.00</strong>
                <span v-if="fields.showAmountWords">肆拾元整</span>
              </div>
              <table v-else-if="block.key === 'detail'" class="finance-template-preview__table">
                <thead>
                  <tr>
                    <th v-for="column in detailColumns" :key="column.key">{{ column.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td v-for="column in detailColumns" :key="column.key">{{ detailRow[column.key] }}</td>
                  </tr>
                </tbody>
              </table>
              <div v-else-if="block.key === 'sign' && fields.showSignBlock" class="finance-template-preview__sign">
                <span v-for="label in layout.signatures" :key="label">{{ label }}：________</span>
              </div>
              <p v-else-if="block.key === 'footer'" class="finance-template-preview__note">{{ layout.footer }}</p>
            </template>
            </div>
          </aside>
        </div>
      </PanelCard>
    </div>

    <PanelCard v-if="activeEnterpriseTemplate" title="当前企业模板" description="发布后凭证按当前发布版本生成；再次编辑会产生新草稿版本。">
      <div class="finance-list__row">
        <div class="finance-list__main">
          <strong>{{ activeEnterpriseTemplate.name }}</strong>
          <span>
            {{ activeEnterpriseTemplate.type === 'Receipt' ? '收款单' : '付款单' }}
            · 草稿 V{{ activeEnterpriseTemplate.version }}
            · {{ activeEnterpriseTemplate.publishedVersion ? `已发布 V${activeEnterpriseTemplate.publishedVersion}` : '未发布' }}
          </span>
        </div>
        <StatusTag :text="activeEnterpriseTemplate.publishedVersion ? '已发布' : '草稿'" :tone="activeEnterpriseTemplate.publishedVersion ? 'done' : 'doing'" />
        <div class="finance-actions">
          <el-button :loading="publishing" @click="publish">发布当前版本</el-button>
          <el-button :disabled="!activeEnterpriseTemplate.publishedVersion" @click="disable">停用发布版本</el-button>
        </div>
      </div>

      <el-divider content-position="left">版本历史</el-divider>
      <el-table v-loading="versionLoading" :data="versions" size="small">
        <el-table-column prop="version" label="版本" width="80" />
        <el-table-column prop="name" label="模板名称" min-width="180" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :text="templateVersionStatusLabel(row.status)" :tone="templateVersionStatusTone(row.status)" />
          </template>
        </el-table-column>
        <el-table-column prop="publishedAt" label="发布时间" min-width="180" />
      </el-table>
    </PanelCard>
  </div>
</template>

<style scoped lang="scss">
.finance-template-editor-panel,
.finance-template-editor-panel :deep(.panel__body) {
  overflow: visible;
}

.finance-template-section {
  padding: $space-3 $space-4 8px;
  color: $text-tertiary;
  font-size: $font-caption;
  font-weight: 600;
}

.finance-template-empty {
  padding: 0 $space-4 $space-3;
  color: $text-tertiary;
  font-size: $font-caption;
}

.finance-template-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $space-2;
  margin-bottom: $space-5;
}

.finance-layout-blocks {
  display: grid;
  gap: $space-2;
  margin-bottom: $space-4;
}

.finance-layout-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
}

.finance-layout-block__actions {
  display: flex;
  gap: 6px;
}

.finance-template-preview__org {
  margin-bottom: $space-2;
  text-align: center;
  font-size: $font-caption;
}

.finance-template-preview__amount {
  display: flex;
  justify-content: space-between;
  gap: $space-4;
  margin-top: $space-5;
  font-size: $font-body-sm;
}

.finance-template-preview__note {
  margin-top: $space-5;
  padding-top: $space-3;
  border-top: 1px dashed $border-color;
  color: $text-tertiary;
  font-size: $font-caption;
  text-align: center;
}
</style>
