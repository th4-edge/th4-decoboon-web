<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import PropertyPicker from '@/components/picker/PropertyPicker.vue'
import DesignTemplateItemSheet from './components/DesignTemplateItemSheet.vue'
import { deleteRoom, instantiateTemplate, publishTemplate, saveRoom, templateInfo } from '@/domains/designtemplate/api'
import { STATUS_LABELS, type DesignTemplate, type TemplateItem, type TemplateRoom } from '@/domains/designtemplate/model'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const templateId = computed(() => String(route.params.templateId ?? ''))
const template = ref<DesignTemplate>()
const rooms = ref<TemplateRoom[]>([])
const items = ref<TemplateItem[]>([])
const loading = ref(false)
const publishing = ref(false)
const savingRoom = ref(false)
const roomDialog = ref(false)
const instantiateVisible = ref(false)
const instantiating = ref(false)
const roomEditingId = ref('')
const actionError = ref('')
const itemSummary = ref({ total: 0, ready: 0, missing: 0, error: 0 })

const instantiateForm = reactive<{ propertyId: string; name: string }>({ propertyId: '', name: '' })

const roomForm = reactive<TemplateRoom & { versionId?: string }>({
  roomKey: '',
  name: '',
  roomType: 'Bedroom',
  sortNo: 0,
  count: 1
})

const version = computed(() => template.value?.currentVersion)
const isDraft = computed(() => version.value?.status === 'Draft' && template.value?.status !== 'Disabled')
const canWrite = computed(() => isDraft.value)
const statusTone = computed<StatusTone>(() => (version.value?.status === 'Published' ? 'done' : version.value?.status === 'Disabled' ? 'muted' : 'doing'))
const statusLabel = computed(() => (version.value?.status ? STATUS_LABELS[version.value.status] : '—'))
const roomTypes = [
  { value: 'Bedroom', label: '卧室' },
  { value: 'LivingRoom', label: '客厅' },
  { value: 'DiningRoom', label: '餐厅' },
  { value: 'Kitchen', label: '厨房' },
  { value: 'Bathroom', label: '卫生间' },
  { value: 'Balcony', label: '阳台' }
]

function roomTypeLabel(value: string): string {
  return roomTypes.find((type) => type.value === value)?.label ?? value ?? '—'
}

function numberText(value: number | undefined): string {
  return value === undefined || value === null ? '待补' : String(value)
}

/** 参考实测值未填显示「—」（不是「待补」：参考值本来就是可选项，DEC-064）。 */
function referenceText(value: number | undefined): string {
  return value === undefined || value === null ? '—' : String(value)
}

async function load(): Promise<void> {
  loading.value = true
  actionError.value = ''
  try {
    const data = await templateInfo(templateId.value)
    template.value = data
    rooms.value = (data.rooms ?? []).map((room) => ({ ...room }))
    items.value = data.items ?? []
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : '模版加载失败，请重试'
  } finally {
    loading.value = false
  }
}

async function removeRoom(room: TemplateRoom): Promise<void> {
  if (!room.roomId) return
  try {
    await ElMessageBox.confirm(
      `删除区域「${room.name}」？如果该区域已被分项公式引用，服务端会阻断删除并提示你先解引用。`,
      '删除区域',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deleteRoom({ roomId: room.roomId })
    ElMessage.success(`区域「${room.name}」已删除`)
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '区域删除失败，请先处理引用该区域的分项')
  }
}

function openRoomDialog(room?: TemplateRoom): void {
  roomEditingId.value = room?.roomId ?? ''
  roomForm.roomId = room?.roomId
  roomForm.roomKey = room?.roomKey ?? ''
  roomForm.name = room?.name ?? ''
  roomForm.roomType = room?.roomType ?? 'Bedroom'
  roomForm.length = room?.length
  roomForm.width = room?.width
  roomForm.height = room?.height
  roomForm.doorWidthTotal = room?.doorWidthTotal
  roomForm.doorAreaTotal = room?.doorAreaTotal
  roomForm.windowAreaTotal = room?.windowAreaTotal
  roomForm.wallRise = room?.wallRise
  roomForm.referenceArea = room?.referenceArea
  roomForm.referencePerimeter = room?.referencePerimeter
  roomForm.count = room?.count ?? 1
  roomForm.remark = room?.remark
  roomForm.sortNo = room?.sortNo ?? rooms.value.length
  roomDialog.value = true
}

async function submitRoom(): Promise<void> {
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
    await saveRoom({ ...roomForm, versionId, sortNo: roomForm.sortNo ?? rooms.value.length })
    roomDialog.value = false
    ElMessage.success(roomEditingId.value ? '区域已保存' : '区域已添加')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '区域保存失败，请重试')
  } finally {
    savingRoom.value = false
  }
}

async function publish(): Promise<void> {
  if (itemSummary.value.error > 0) {
    ElMessage.warning(`还有 ${itemSummary.value.error} 个分项公式异常，请先处理后再发布`)
    return
  }
  try {
    await ElMessageBox.confirm(
      `发布确认：${rooms.value.length} 个区域 · ${itemSummary.value.total} 个分项 · 公式就绪 ${itemSummary.value.ready} · 待补尺寸 ${itemSummary.value.missing}。\n发布后版本不可修改；待补尺寸可在实例化后补齐，但补齐前不能生成正式报价。`,
      '发布模版',
      { confirmButtonText: '发布', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  publishing.value = true
  try {
    await publishTemplate(templateId.value)
    ElMessage.success('模版已发布')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发布失败，请检查区域与公式')
  } finally {
    publishing.value = false
  }
}

function openInstantiate(): void {
  instantiateForm.propertyId = ''
  instantiateForm.name = ''
  instantiateVisible.value = true
}

async function submitInstantiate(): Promise<void> {
  if (!instantiateForm.propertyId) {
    ElMessage.warning('请选择客户房屋')
    return
  }
  if (itemSummary.value.error > 0) {
    ElMessage.warning('公式异常未处理，暂不能生成设计方案')
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

function back(): void {
  void router.push('/designer/templates')
}

onMounted(load)
</script>

<template>
  <section class="template-editor" v-loading="loading">
    <header class="template-editor__head">
      <div>
        <el-button link @click="back">← 返回方案库</el-button>
        <h1>{{ version?.name ?? '方案模版' }}</h1>
        <p>
          {{ version?.houseType ?? '—' }} · 版本 V{{ version?.version ?? 0 }} ·
          <BusinessStateTag :text="statusLabel" :tone="statusTone" />
        </p>
      </div>
      <div class="template-editor__actions">
        <el-button :disabled="!canWrite" @click="openRoomDialog()">添加区域</el-button>
        <el-button :disabled="version?.status !== 'Published' || itemSummary.error > 0" @click="openInstantiate">生成设计方案</el-button>
        <el-button type="primary" :loading="publishing" :disabled="!canWrite || itemSummary.error > 0" @click="publish">发布模版</el-button>
      </div>
    </header>

    <el-alert
      v-if="template?.status === 'Disabled'"
      type="info"
      :closable="false"
      title="模版已停用，只读；如需继续使用，请在方案库复制为新的个人模版。"
    />
    <el-alert
      v-else-if="version?.status === 'Published'"
      type="success"
      :closable="false"
      title="已发布版本不可修改；如需调整请新建版本。实例化后请在设计工作区补齐尺寸再生成正式报价。"
    />

    <div v-if="actionError" class="template-editor__error">
      {{ actionError }} <el-button link type="primary" @click="load">重试</el-button>
    </div>

    <section class="rooms">
      <header class="rooms__head">
        <div>
          <h2>区域骨架</h2>
          <p>
            区域尺寸是公式专业变量的事实来源；可留空，实例化后在设计工作区补齐。
            <strong>参考实测面积/周长</strong>只用于模版内公式校验与实例化打底，不进入工程量与金额（DEC-064）。
          </p>
        </div>
        <el-button size="small" :disabled="!canWrite" @click="openRoomDialog()">添加区域</el-button>
      </header>
      <div class="rooms__scroll">
        <div class="room-row room-row--head">
          <span>区域键</span><span>名称</span><span>类型</span><span>开间 L（快照）</span><span>进深 W（快照）</span><span>层高 H</span><span>门洞宽 DW</span><span>门洞面积 DA</span><span>窗洞面积 WA</span><span>防水上返 WR</span><span>参考面积（校验）</span><span>参考周长（校验）</span><span>同型 N</span><span>操作</span>
        </div>
        <div v-for="room in rooms" :key="room.roomId || room.roomKey" class="room-row">
          <span>{{ room.roomKey }}</span>
          <strong>{{ room.name }}</strong>
          <span>{{ roomTypeLabel(room.roomType) }}</span>
          <span>{{ numberText(room.length) }}</span>
          <span>{{ numberText(room.width) }}</span>
          <span>{{ numberText(room.height) }}</span>
          <span>{{ numberText(room.doorWidthTotal) }}</span>
          <span>{{ numberText(room.doorAreaTotal) }}</span>
          <span>{{ numberText(room.windowAreaTotal) }}</span>
          <span>{{ numberText(room.wallRise) }}</span>
          <span>{{ referenceText(room.referenceArea) }}</span>
          <span>{{ referenceText(room.referencePerimeter) }}</span>
          <span>{{ room.count ?? 1 }}</span>
          <span class="room-row__actions">
            <el-button link type="primary" :disabled="!canWrite" @click="openRoomDialog(room)">编辑</el-button>
            <el-button link type="danger" :disabled="!canWrite" @click="removeRoom(room)">删除</el-button>
          </span>
        </div>
      </div>
      <EmptyState v-if="!rooms.length && !loading" title="还没有区域" description="先添加区域骨架，再配置分项公式。" action-text="添加区域" @action="openRoomDialog()" />
    </section>

    <DesignTemplateItemSheet
      v-if="version?.versionId"
      :template-id="templateId"
      :version-id="version.versionId"
      :can-write="canWrite"
      :rooms="rooms"
      :items="items"
      @summary="itemSummary = $event"
      @saved="items = $event"
    />

    <el-dialog v-model="roomDialog" :title="roomEditingId ? '编辑区域' : '添加区域'" width="560px">
      <el-form label-width="110px">
        <el-form-item label="区域键" required>
          <el-input v-model="roomForm.roomKey" :disabled="!!roomEditingId" placeholder="如 R1 或 主卧（公式锚点）" />
        </el-form-item>
        <el-form-item label="区域名称" required>
          <el-input v-model="roomForm.name" maxlength="32" placeholder="如 主卧" />
        </el-form-item>
        <el-form-item label="区域类型">
          <el-select v-model="roomForm.roomType" style="width: 100%">
            <el-option v-for="type in roomTypes" :key="type.value" :label="type.label" :value="type.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="现场快照 开间 / 进深">
          <div class="template-editor__pair">
            <el-input-number v-model="roomForm.length" :precision="3" :step="0.1" controls-position="right" placeholder="L（可留空）" />
            <el-input-number v-model="roomForm.width" :precision="3" :step="0.1" controls-position="right" placeholder="W（可留空）" />
          </div>
        </el-form-item>
        <el-form-item label="层高">
          <el-input-number v-model="roomForm.height" :precision="3" :step="0.1" controls-position="right" placeholder="H（可留空）" />
        </el-form-item>
        <el-form-item label="门洞总宽 / 面积">
          <div class="template-editor__pair">
            <el-input-number v-model="roomForm.doorWidthTotal" :precision="3" :step="0.1" controls-position="right" placeholder="DW" />
            <el-input-number v-model="roomForm.doorAreaTotal" :precision="3" :step="0.1" controls-position="right" placeholder="DA" />
          </div>
        </el-form-item>
        <el-form-item label="窗洞面积 / 上返">
          <div class="template-editor__pair">
            <el-input-number v-model="roomForm.windowAreaTotal" :precision="3" :step="0.1" controls-position="right" placeholder="WA" />
            <el-input-number v-model="roomForm.wallRise" :precision="3" :step="0.1" controls-position="right" placeholder="WR" />
          </div>
        </el-form-item>
        <el-form-item label="参考实测 面积 / 周长">
          <div class="template-editor__pair">
            <el-input-number v-model="roomForm.referenceArea" :precision="3" :step="0.1" controls-position="right" placeholder="参考面积（㎡，可留空）" />
            <el-input-number v-model="roomForm.referencePerimeter" :precision="3" :step="0.1" controls-position="right" placeholder="参考周长（m，可留空）" />
          </div>
        </el-form-item>
        <p class="template-editor__hint">
          参考实测值只用于模版内公式校验与实例化打底；不承载房屋实测事实，不进入工程量与报价金额。
          实例化后在方案的区域里录入该房屋实测面积/周长才参与金额（DEC-064 / DEC-062）。
        </p>
        <el-form-item label="同型区域数量">
          <el-input-number v-model="roomForm.count" :min="1" :step="1" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="roomForm.remark" type="textarea" :rows="2" maxlength="256" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roomDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingRoom" @click="submitRoom">保存区域</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="instantiateVisible" title="从模版生成设计方案" width="560px">
      <el-alert
        type="info"
        :closable="false"
        title="只有已发布版本可实例化；同一房屋 + 同一模版版本重复生成只会得到同一份设计方案（幂等）。生成后进入设计工作区补齐尺寸与公式结果。"
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

<style scoped lang="scss">
.template-editor { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }
.template-editor__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-4; }
.template-editor__head h1 { margin: $space-1 0; font-size: $font-h1; }
.template-editor__head p { display: flex; align-items: center; gap: $space-2; margin: 0; color: $text-secondary; font-size: $font-body-sm; }
.template-editor__actions { display: flex; flex-wrap: wrap; gap: $space-2; }
.template-editor__error { padding: $space-2 $space-3; color: $danger-500; background: $danger-50; border: 1px solid $danger-200; border-radius: $radius-sm; font-size: $font-caption; }
.template-editor__pair { display: flex; gap: $space-2; width: 100%; }
.template-editor__pair :deep(.el-input-number) { flex: 1; }
.template-editor__instantiate { margin-top: $space-3; }
.rooms { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.rooms__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.rooms__head h2 { margin: 0 0 2px; font-size: $font-card-title; }
.rooms__head p { margin: 0; color: $text-secondary; font-size: $font-caption; }
.rooms__scroll { max-width: 100%; overflow-x: auto; }
.room-row { display: grid; grid-template-columns: 96px 110px 80px 86px 86px 86px 94px 100px 100px 100px 64px 72px; align-items: center; gap: $space-2; min-width: 1180px; padding: $space-2 $space-4; border-bottom: 1px solid $border-color; font-size: $font-caption; }
.room-row:last-child { border-bottom: 0; }
.room-row--head { color: $text-secondary; background: $surface-50; font-weight: $font-weight-semibold; }
.room-row strong { color: $ink-950; }
.room-row__actions { display: flex; gap: $space-1; }
@media (max-width: 1024px) {
  .template-editor { padding: $space-3; }
  .template-editor__head { flex-direction: column; }
}
</style>
