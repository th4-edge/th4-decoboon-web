<template>
  <section class="template-editor" v-loading="loading">
    <header class="template-editor__head">
      <div>
        <el-button link @click="back">← 返回方案库</el-button>
        <h1>{{ version?.name ?? '方案模版' }}</h1>
        <p>
          {{ version?.houseType ?? '—' }} · 版本 V{{ version?.version ?? 0 }} ·
          <el-tag :type="template?.status === 'Published' ? 'success' : 'info'" size="small">
            {{ template?.status ? STATUS_LABELS[template.status] : '—' }}
          </el-tag>
        </p>
      </div>
      <div class="template-editor__actions">
        <el-button :disabled="template?.status !== 'Published'" @click="openInstantiate">生成设计方案</el-button>
        <el-button @click="openRoomDialog">添加区域</el-button>
        <el-button type="primary" :loading="publishing" :disabled="template?.status === 'Published'" @click="publish">
          发布模版
        </el-button>
      </div>
    </header>

    <el-alert
      v-if="template?.status === 'Published'"
      type="success"
      :closable="false"
      title="已发布版本不可修改；如需调整请新建版本（本期先支持编辑草稿版本）。"
    />

    <h2 class="template-editor__section">区域骨架（公式专业变量来源）</h2>
    <el-table :data="rooms" border>
      <el-table-column label="区域键" width="110" prop="roomKey" />
      <el-table-column label="名称" width="120">
        <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
      </el-table-column>
      <el-table-column label="开间 L(m)" width="110">
        <template #default="{ row }"><el-input-number v-model="row.length" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="进深 W(m)" width="110">
        <template #default="{ row }"><el-input-number v-model="row.width" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="层高 H(m)" width="110">
        <template #default="{ row }"><el-input-number v-model="row.height" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="门洞宽 DW" width="110">
        <template #default="{ row }"><el-input-number v-model="row.doorWidthTotal" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="门洞面积 DA" width="120">
        <template #default="{ row }"><el-input-number v-model="row.doorAreaTotal" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="窗洞面积 WA" width="120">
        <template #default="{ row }"><el-input-number v-model="row.windowAreaTotal" :precision="3" :step="0.1" size="small" controls-position="right" /></template>
      </el-table-column>
      <el-table-column label="面积 A(㎡)" width="110">
        <template #default="{ row }">{{ areaOf(row as TemplateRoom) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="saveRoomRow(row as TemplateRoom)">保存</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!rooms.length" description="还没有区域，先「添加区域」" />

    <h2 class="template-editor__section">分项（名称/单位/价格取自报价项目库）</h2>
    <el-alert
      type="info"
      :closable="false"
      title="分项只保存「引用哪个项目库条目 + 工程量公式 + 固定数量」；公式统一专业变量（如 =P*H-DA-WA），禁止单元格引用。分项编辑界面将复用报价项目库选择器（下一步接入）。"
    />
    <el-table :data="items" border>
      <el-table-column label="归属区域" width="120">
        <template #default="{ row }">{{ row.roomKey ?? '全屋共享' }}</template>
      </el-table-column>
      <el-table-column label="分项名称（项目库）" min-width="180">
        <template #default="{ row }">{{ row.catalogItem?.name ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="单位" width="80">
        <template #default="{ row }">{{ row.catalogItem?.unit ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="工程量公式" min-width="180">
        <template #default="{ row }">{{ row.quantityFormula ?? `固定数量 ${row.defaultQuantity ?? '—'}` }}</template>
      </el-table-column>
      <el-table-column label="销售价（材/人）" width="160">
        <template #default="{ row }">
          {{ row.catalogItem?.materialPrice ?? '—' }} / {{ row.catalogItem?.manualPrice ?? '—' }}
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="roomDialog" title="添加区域" width="480px">
      <el-form label-width="100px">
        <el-form-item label="区域键" required>
          <el-input v-model="roomForm.roomKey" placeholder="如 R1 或 主卧（公式锚点）" />
        </el-form-item>
        <el-form-item label="区域名称" required>
          <el-input v-model="roomForm.name" placeholder="如 主卧" />
        </el-form-item>
        <el-form-item label="区域类型">
          <el-select v-model="roomForm.roomType" style="width: 100%">
            <el-option label="卧室" value="Bedroom" />
            <el-option label="客厅" value="LivingRoom" />
            <el-option label="餐厅" value="DiningRoom" />
            <el-option label="厨房" value="Kitchen" />
            <el-option label="卫生间" value="Bathroom" />
            <el-option label="阳台" value="Balcony" />
          </el-select>
        </el-form-item>
        <el-form-item label="开间 / 进深">
          <div class="template-editor__pair">
            <el-input-number v-model="roomForm.length" :precision="3" :step="0.1" controls-position="right" />
            <el-input-number v-model="roomForm.width" :precision="3" :step="0.1" controls-position="right" />
          </div>
        </el-form-item>
        <el-form-item label="层高">
          <el-input-number v-model="roomForm.height" :precision="3" :step="0.1" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingRoom" @click="submitRoom">保存区域</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="instantiateVisible" title="从模版生成设计方案" width="520px">
      <el-alert
        type="info"
        :closable="false"
        title="只有已发布版本可实例化；同一房屋 + 同一模版版本重复生成只会得到同一份设计方案（幂等）。生成后请在方案里调整区域尺寸。"
      />
      <el-form label-width="100px" class="template-editor__instantiate">
        <el-form-item label="客户房屋" required>
          <PropertyPicker v-model="instantiateForm.propertyId" />
        </el-form-item>
        <el-form-item label="方案名称">
          <el-input v-model="instantiateForm.name" maxlength="128" :placeholder="version?.name ?? ''" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="instantiateVisible = false">取消</el-button>
        <el-button type="primary" :loading="instantiating" @click="submitInstantiate">生成设计方案</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import { instantiateTemplate, publishTemplate, saveRoom, templateInfo } from '@/domains/designtemplate/api'
import { STATUS_LABELS, type DesignTemplate, type TemplateItem, type TemplateRoom } from '@/domains/designtemplate/model'

const route = useRoute()
const router = useRouter()
const templateId = computed(() => String(route.params.templateId ?? ''))
const loading = ref(false)
const publishing = ref(false)
const savingRoom = ref(false)
const roomDialog = ref(false)
const instantiateVisible = ref(false)
const instantiating = ref(false)
const template = ref<DesignTemplate>()
const rooms = ref<TemplateRoom[]>([])
const items = ref<TemplateItem[]>([])
const version = computed(() => template.value?.currentVersion)

const instantiateForm = reactive<{ propertyId: string; name: string }>({ propertyId: '', name: '' })

const roomForm = reactive<TemplateRoom & { versionId?: string }>({
  roomKey: '',
  name: '',
  roomType: 'Bedroom',
  sortNo: 0,
  count: 1
})

async function load() {
  loading.value = true
  try {
    const data = await templateInfo(templateId.value)
    template.value = data
    rooms.value = (data.rooms ?? []).map((room) => ({ ...room }))
    items.value = data.items ?? []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '模版加载失败，请重试')
  } finally {
    loading.value = false
  }
}

function areaOf(room: TemplateRoom): string {
  if (!room.length || !room.width) return '待补尺寸'
  return (room.length * room.width).toFixed(2)
}

function openRoomDialog() {
  roomForm.roomKey = ''
  roomForm.name = ''
  roomForm.roomType = 'Bedroom'
  roomForm.length = undefined
  roomForm.width = undefined
  roomForm.height = undefined
  roomForm.count = 1
  roomDialog.value = true
}

async function submitRoom() {
  const versionId = version.value?.versionId
  if (!versionId) {
    ElMessage.warning('模版版本未加载完成')
    return
  }
  if (!roomForm.roomKey.trim() || !roomForm.name.trim()) {
    ElMessage.warning('区域键与名称为必填')
    return
  }
  savingRoom.value = true
  try {
    await saveRoom({ ...roomForm, versionId, sortNo: rooms.value.length })
    roomDialog.value = false
    ElMessage.success('区域已保存')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '区域保存失败，请重试')
  } finally {
    savingRoom.value = false
  }
}

async function saveRoomRow(row: TemplateRoom) {
  const versionId = version.value?.versionId
  if (!versionId) return
  try {
    await saveRoom({ ...row, versionId })
    ElMessage.success(`「${row.name}」尺寸已保存`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败，请重试')
  }
}

async function publish() {
  publishing.value = true
  try {
    await publishTemplate(templateId.value)
    ElMessage.success('模版已发布')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发布失败，请检查区域与分项')
  } finally {
    publishing.value = false
  }
}

function openInstantiate() {
  instantiateForm.propertyId = ''
  instantiateForm.name = ''
  instantiateVisible.value = true
}

async function submitInstantiate() {
  if (!instantiateForm.propertyId) {
    ElMessage.warning('请选择客户房屋')
    return
  }
  instantiating.value = true
  try {
    const design = await instantiateTemplate({
      templateId: templateId.value,
      propertyId: instantiateForm.propertyId,
      name: instantiateForm.name || undefined
    })
    instantiateVisible.value = false
    ElMessage.success(`已生成设计方案 ${design.no}`)
    await router.push(`/designer/design/${design.designId}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '生成失败，请重试')
  } finally {
    instantiating.value = false
  }
}

function back() {
  void router.push('/designer/templates')
}

onMounted(load)
</script>

<style scoped lang="scss">
.template-editor {
  padding: 16px 20px;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;

    h1 {
      margin: 4px 0;
      font-size: 20px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }
  }

  &__section {
    margin: 20px 0 8px;
    font-size: 15px;
  }

  &__instantiate {
    margin-top: 12px;
  }

  &__pair {
    display: flex;
    gap: 8px;
  }
}
</style>
