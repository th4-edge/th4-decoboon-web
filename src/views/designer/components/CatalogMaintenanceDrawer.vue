<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { formatEditableNumber } from '@/core/format'
import { ProviderError } from '@/core/http'
import { catalogApi } from '@/domains/catalog/api'
import type { CatalogItem, CatalogMaintenanceInput } from '@/domains/catalog/model'
import {
  DESIGN_ITEM_TYPE_LABELS,
  DESIGN_ITEM_TYPE_ORDER,
  PRICING_MODE_LABELS
} from '@/domains/design/meta'
import type { DesignItemType, PricingMode } from '@/domains/design/model'

const props = defineProps<{
  modelValue: boolean
  item: CatalogItem | null
  defaultType: DesignItemType
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: [item: CatalogItem]
}>()

const PRICING_MODE_ORDER: PricingMode[] = ['materialAndManual', 'materialOnly', 'manualOnly', 'fixedTotal']
const UNIT_OPTIONS = ['㎡', 'm', 'cm', '个', '项', '处', '套', '户', '樘', '台', '只', '块', '根', '扇', '支', '格', '片']

const saving = ref(false)
const form = reactive({
  itemId: '',
  type: 'construction' as DesignItemType,
  code: '',
  category: '',
  brand: '',
  series: '',
  spec: '',
  name: '',
  unit: '㎡',
  pricingMode: 'materialAndManual' as PricingMode,
  materialPrice: '',
  manualPrice: '',
  fixedTotalPrice: '',
  costPrice: '',
  craft: '',
  criterion: '',
  description: '',
  images: [] as string[],
  active: true,
  sort: 0
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const editing = computed(() => Boolean(form.itemId))
const formula = computed(() => {
  if (form.pricingMode === 'fixedTotal') return '固定总价，不乘工程量'
  const unit = form.pricingMode === 'materialOnly'
    ? '材料单价'
    : form.pricingMode === 'manualOnly' ? '人工单价' : '材料单价 + 人工单价'
  return `(${unit}) × 工程量`
})
const displayPrice = computed(() => {
  const material = inputNumber(form.materialPrice)
  const manual = inputNumber(form.manualPrice)
  if (form.pricingMode === 'fixedTotal') return inputNumber(form.fixedTotalPrice)
  if (form.pricingMode === 'materialOnly') return material
  if (form.pricingMode === 'manualOnly') return manual
  return material + manual
})
const displayPriceText = computed(() => {
  const price = `¥${displayPrice.value.toFixed(2)}`
  return form.pricingMode === 'fixedTotal' ? `${price}（固定总价，不乘工程量）` : `${price} / ${form.unit || '项'}`
})

function inputNumber(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function fill(): void {
  const item = props.item
  form.itemId = item?.id ?? ''
  form.type = item?.type ?? props.defaultType
  form.code = item?.code ?? ''
  form.category = item?.category ?? ''
  form.brand = item?.brand ?? ''
  form.series = item?.series ?? ''
  form.spec = item?.spec ?? ''
  form.name = item?.name ?? ''
  form.unit = item?.unit || '㎡'
  form.pricingMode = item?.pricingMode ?? 'materialAndManual'
  form.materialPrice = formatEditableNumber(item?.materialPrice ?? 0, 2)
  form.manualPrice = formatEditableNumber(item?.manualPrice ?? 0, 2)
  form.fixedTotalPrice = item?.fixedTotalPrice === undefined ? '' : formatEditableNumber(item.fixedTotalPrice, 2)
  form.costPrice = item?.costPrice === null || item?.costPrice === undefined
    ? ''
    : formatEditableNumber(item.costPrice, 2)
  form.craft = item?.craft ?? ''
  form.criterion = item?.criterion ?? ''
  form.description = item?.description ?? ''
  form.images = [...(item?.images ?? [])]
  form.active = item?.active ?? true
  form.sort = item?.sort ?? 0
}

function validateMoney(label: string, value: string, required = false): boolean {
  if (value.trim() === '') {
    if (!required) return true
    ElMessage.warning(`请填写${label}`)
    return false
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    ElMessage.warning(`${label}必须是不小于 0 的数字`)
    return false
  }
  return true
}

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('请填写项目名称')
    return
  }
  if (!form.category.trim()) {
    ElMessage.warning('请填写项目分类')
    return
  }
  if (form.pricingMode === 'fixedTotal' && !validateMoney('固定总价', form.fixedTotalPrice, true)) return
  if (form.pricingMode !== 'fixedTotal' && !validateMoney('材料价', form.materialPrice)) return
  if (form.pricingMode !== 'fixedTotal' && !validateMoney('人工价', form.manualPrice)) return
  if (!validateMoney('标准成本', form.costPrice)) return

  const materialPrice = form.pricingMode === 'materialOnly' || form.pricingMode === 'materialAndManual'
    ? inputNumber(form.materialPrice)
    : 0
  const manualPrice = form.pricingMode === 'manualOnly' || form.pricingMode === 'materialAndManual'
    ? inputNumber(form.manualPrice)
    : 0
  const payload: CatalogMaintenanceInput = {
    itemId: form.itemId || undefined,
    type: form.type,
    code: form.code.trim() || undefined,
    category: form.category.trim(),
    brand: form.brand.trim() || undefined,
    series: form.series.trim() || undefined,
    spec: form.spec.trim() || undefined,
    name: form.name.trim(),
    unit: form.unit,
    pricingMode: form.pricingMode,
    materialPrice,
    manualPrice,
    fixedTotalPrice: form.pricingMode === 'fixedTotal' ? inputNumber(form.fixedTotalPrice) : undefined,
    costPrice: form.costPrice.trim() === '' ? null : inputNumber(form.costPrice),
    formula: formula.value,
    craft: form.craft.trim() || undefined,
    criterion: form.criterion.trim() || undefined,
    description: form.description.trim() || undefined,
    images: form.images,
    active: form.active,
    sort: form.sort
  }

  saving.value = true
  try {
    const saved = editing.value
      ? await catalogApi.updateCatalogItem(payload)
      : await catalogApi.saveCatalogItem(payload)
    ElMessage.success(editing.value ? '报价分项已更新' : '报价分项已新增')
    emit('saved', saved)
    visible.value = false
  } catch (error) {
    ElMessage.error(error instanceof ProviderError ? error.message : '报价分项保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) fill()
}, { immediate: true })
</script>

<template>
  <el-drawer
    v-model="visible"
    direction="rtl"
    size="560px"
    :close-on-click-modal="false"
    :with-header="false"
    class="catalog-editor"
  >
    <div class="catalog-editor__shell">
      <header class="catalog-editor__head">
        <div>
          <span>{{ editing ? '编辑报价分项' : '新增报价分项' }}</span>
          <strong>{{ editing ? item?.name : '建立企业级报价项目库条目' }}</strong>
        </div>
        <button type="button" aria-label="关闭" @click="visible = false">关闭</button>
      </header>

      <div class="catalog-editor__body">
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          title="报价项目库是企业级主数据，本次修改影响全企业所有门店；已签约合同和既有报价继续使用历史快照。"
        />

        <section class="editor-section">
          <h3>项目识别</h3>
          <el-form label-position="top">
            <div class="editor-grid editor-grid--2">
              <el-form-item label="项目类型" required>
                <el-select v-model="form.type" style="width: 100%">
                  <el-option
                    v-for="type in DESIGN_ITEM_TYPE_ORDER"
                    :key="type"
                    :label="DESIGN_ITEM_TYPE_LABELS[type]"
                    :value="type"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="项目编码">
                <el-input v-model="form.code" :placeholder="editing ? '保留原编码' : '留空由系统生成'" />
              </el-form-item>
            </div>
            <el-form-item label="项目名称" required>
              <el-input v-model="form.name" placeholder="例：轻钢龙骨石膏板吊平顶" />
            </el-form-item>
            <el-form-item label="项目分类" required>
              <el-input v-model="form.category" placeholder="例：木工、瓷砖、全屋定制" />
            </el-form-item>
            <div class="editor-grid editor-grid--3">
              <el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item>
              <el-form-item label="系列"><el-input v-model="form.series" /></el-form-item>
              <el-form-item label="规格"><el-input v-model="form.spec" placeholder="如 1200×600mm" /></el-form-item>
            </div>
          </el-form>
        </section>

        <section class="editor-section">
          <h3>销售展示价</h3>
          <p class="editor-section__hint">展示价继续复用报价分项现有的材料价、人工价和固定总价，不新增另一套销售价字段。</p>
          <el-form label-position="top">
            <div class="editor-grid editor-grid--2">
              <el-form-item label="计量单位" required>
                <el-select v-model="form.unit" style="width: 100%">
                  <el-option v-for="unit in UNIT_OPTIONS" :key="unit" :label="unit" :value="unit" />
                </el-select>
              </el-form-item>
              <el-form-item label="计价方式" required>
                <el-select v-model="form.pricingMode" style="width: 100%">
                  <el-option
                    v-for="mode in PRICING_MODE_ORDER"
                    :key="mode"
                    :label="PRICING_MODE_LABELS[mode]"
                    :value="mode"
                  />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item v-if="form.pricingMode === 'fixedTotal'" label="固定总价" required>
              <el-input v-model="form.fixedTotalPrice" inputmode="decimal" placeholder="不按工程量折算" />
            </el-form-item>
            <div v-else class="editor-grid editor-grid--2">
              <el-form-item v-if="form.pricingMode !== 'manualOnly'" label="材料价">
                <el-input v-model="form.materialPrice" inputmode="decimal" placeholder="0.00" />
              </el-form-item>
              <el-form-item v-if="form.pricingMode !== 'materialOnly'" label="人工价">
                <el-input v-model="form.manualPrice" inputmode="decimal" placeholder="0.00" />
              </el-form-item>
            </div>

            <div class="price-preview">
              <span>报价展示</span>
              <strong>{{ displayPriceText }}</strong>
            </div>
            <div class="formula-preview">
              <span>计价公式</span>
              <code>{{ formula }}</code>
            </div>
          </el-form>
        </section>

        <section class="editor-section editor-section--cost">
          <h3>标准成本</h3>
          <p class="editor-section__hint">成本留空表示“成本待维护”，填写 0 表示明确零成本；成本不完整时不得计算可靠利润。</p>
          <el-form label-position="top">
            <el-form-item label="标准成本单价">
              <el-input v-model="form.costPrice" inputmode="decimal" placeholder="留空 = 成本待维护" />
            </el-form-item>
          </el-form>
        </section>

        <section class="editor-section">
          <h3>补充说明</h3>
          <el-form label-position="top">
            <el-form-item label="工艺要求"><el-input v-model="form.craft" type="textarea" :rows="3" /></el-form-item>
            <el-form-item label="验收标准"><el-input v-model="form.criterion" type="textarea" :rows="3" /></el-form-item>
            <el-form-item label="项目说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
            <el-form-item v-if="editing" label="项目状态">
              <el-switch v-model="form.active" active-text="启用" inactive-text="停用" />
            </el-form-item>
          </el-form>
        </section>
      </div>

      <footer class="catalog-editor__footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存报价分项</el-button>
      </footer>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
.catalog-editor__shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.catalog-editor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;

  span,
  strong {
    display: block;
  }

  span {
    color: $text-secondary;
    font-size: $font-caption;
  }

  strong {
    margin-top: $space-1;
    color: $text-primary;
    font-size: $font-card-title;
  }

  button {
    min-height: 32px;
    padding: 0 $space-3;
    border: 1px solid $border-color;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: $surface-0;
    font: inherit;
    cursor: pointer;
  }
}

.catalog-editor__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: $space-5;
}

.editor-section {
  margin-top: $space-5;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;

  h3 {
    margin: 0 0 $space-3;
    color: $text-primary;
    font-size: $font-card-title;
  }
}

.editor-section--cost {
  border-color: $brand-200;
  background: $brand-50;
}

.editor-section__hint {
  margin: -$space-1 0 $space-4;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.7;
}

.editor-grid {
  display: grid;
  gap: 0 $space-3;
}

.editor-grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.editor-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.price-preview,
.formula-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-3;
  border-radius: $radius-sm;
  background: $surface-50;

  span {
    color: $text-secondary;
    font-size: $font-caption;
  }

  strong,
  code {
    color: $text-primary;
    font-size: $font-body-sm;
  }
}

.formula-preview {
  margin-top: $space-2;
}

.catalog-editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: $space-2;
  padding: $space-4 $space-5;
  border-top: 1px solid $border-color;
  background: $surface-0;
}

@media (max-width: 720px) {
  .editor-grid--2,
  .editor-grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
