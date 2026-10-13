<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BusinessStateTag from '@/components/business-state/BusinessStateTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import NavIcon from '@/components/shell/NavIcon.vue'
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

/** 参考实测值未填显示「—」（不是「待补」：参考值本来就是可选项，只用于公式校验）。 */
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
    <header class="te-head">
      <div class="te-head__main">
        <el-button link class="te-head__back" @click="back">
          <NavIcon name="back" />
          返回方案库
        </el-button>
        <h1>{{ version?.name ?? '方案模版' }}</h1>
        <div class="te-head__meta">
          <span>房型 {{ version?.houseType || '—' }}</span>
          <span class="te-head__sep">·</span>
          <span>版本 V{{ version?.version ?? 0 }}</span>
          <BusinessStateTag :text="statusLabel" :tone="statusTone" />
        </div>
        <p class="te-head__desc">
          先搭区域骨架，再为分项写工程量公式。模版只沉淀公式与区域变量，不含价格，也不承载房屋实测事实。
        </p>
      </div>
      <div class="te-head__actions">
        <el-button :disabled="!canWrite" @click="openRoomDialog()">
          <NavIcon name="add" />
          添加区域
        </el-button>
        <el-button
          :disabled="version?.status !== 'Published' || itemSummary.error > 0"
          @click="openInstantiate"
        >
          <NavIcon name="send" />
          生成设计方案
        </el-button>
        <el-button
          type="primary"
          :loading="publishing"
          :disabled="!canWrite || itemSummary.error > 0"
          @click="publish"
        >
          <NavIcon name="publish" />
          发布模版
        </el-button>
      </div>
    </header>

    <div class="te-stats">
      <div class="te-stat">
        <small>区域</small>
        <b>{{ rooms.length }}</b>
      </div>
      <div class="te-stat">
        <small>分项</small>
        <b>{{ itemSummary.total }}</b>
      </div>
      <div class="te-stat is-ready">
        <small>公式就绪</small>
        <b>{{ itemSummary.ready }}</b>
      </div>
      <div class="te-stat is-warning">
        <small>待补尺寸</small>
        <b>{{ itemSummary.missing }}</b>
      </div>
      <div class="te-stat is-danger">
        <small>公式异常</small>
        <b>{{ itemSummary.error }}</b>
      </div>
    </div>

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

    <div v-if="actionError" class="te-error">
      {{ actionError }}
      <el-button link type="primary" @click="load">重试</el-button>
    </div>

    <section class="panel">
      <header class="panel__head">
        <div class="panel__title">
          <span class="panel__icon"><NavIcon name="layers" /></span>
          <div>
            <h2>区域骨架</h2>
            <p>下表每一列都是一个公式变量。区域分项优先用 A（面积）和 P（周长）；量房快照的开间、进深只作记录，不能进公式。</p>
          </div>
        </div>
        <el-button size="small" :disabled="!canWrite" @click="openRoomDialog()">
          <NavIcon name="add" />
          添加区域
        </el-button>
      </header>

      <div class="vars">
        <span class="vars__title">公式变量</span>
        <span class="vars__item"><b>A</b>面积 · ㎡</span>
        <span class="vars__item"><b>P</b>周长 · m</span>
        <span class="vars__item"><b>CP</b>顶面 · ㎡</span>
        <span class="vars__item"><b>WP</b>墙面净面积 · ㎡</span>
        <span class="vars__item"><b>H</b>层高 · m</span>
        <span class="vars__item"><b>DW</b>门洞总宽 · m</span>
        <span class="vars__item"><b>DA</b>门洞面积 · ㎡</span>
        <span class="vars__item"><b>WA</b>窗洞面积 · ㎡</span>
        <span class="vars__item"><b>WR</b>防水上返 · m</span>
        <span class="vars__item"><b>N</b>同型数量</span>
        <span class="vars__note"><NavIcon name="help" />L / W 是量房快照，不能用于公式</span>
      </div>

      <div v-if="rooms.length" class="rooms__scroll">
        <div class="room-row room-row--group">
          <span class="g g--basic">基本信息</span>
          <span class="g g--snapshot">量房快照 · 不参与公式</span>
          <span class="g g--vars">区域变量 · 参与公式</span>
          <span class="g g--ref">参考实测 · 仅校验</span>
          <span class="g g--other">其他</span>
        </div>
        <div class="room-row room-row--head">
          <span>区域键</span>
          <span>名称</span>
          <span>类型</span>
          <span>开间 L</span>
          <span>进深 W</span>
          <span>层高 H</span>
          <span>门洞宽 DW</span>
          <span>门洞面积 DA</span>
          <span>窗洞面积 WA</span>
          <span>防水上返 WR</span>
          <span class="is-var">面积 A ㎡</span>
          <span class="is-var">周长 P m</span>
          <span>同型 N</span>
          <span>操作</span>
        </div>
        <div v-for="room in rooms" :key="room.roomId || room.roomKey" class="room-row">
          <span class="room-row__key">{{ room.roomKey }}</span>
          <strong>{{ room.name }}</strong>
          <span>{{ roomTypeLabel(room.roomType) }}</span>
          <span class="is-muted">{{ numberText(room.length) }}</span>
          <span class="is-muted">{{ numberText(room.width) }}</span>
          <span>{{ numberText(room.height) }}</span>
          <span>{{ numberText(room.doorWidthTotal) }}</span>
          <span>{{ numberText(room.doorAreaTotal) }}</span>
          <span>{{ numberText(room.windowAreaTotal) }}</span>
          <span>{{ numberText(room.wallRise) }}</span>
          <span class="is-var">{{ referenceText(room.referenceArea) }}</span>
          <span class="is-var">{{ referenceText(room.referencePerimeter) }}</span>
          <span>{{ room.count ?? 1 }}</span>
          <span class="room-row__actions">
            <el-button link type="primary" :disabled="!canWrite" @click="openRoomDialog(room)">
              <NavIcon name="edit" />
              编辑
            </el-button>
            <el-button link type="danger" :disabled="!canWrite" @click="removeRoom(room)">
              <NavIcon name="trash" />
              删除
            </el-button>
          </span>
        </div>
      </div>
      <EmptyState
        v-else-if="!loading"
        title="还没有区域"
        description="先添加区域骨架，把面积、周长等公式变量录进来，再配置分项公式。"
        action-text="添加区域"
        @action="openRoomDialog()"
      />
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

    <el-dialog
      v-model="roomDialog"
      :title="roomEditingId ? '编辑区域' : '添加区域'"
      width="760px"
      class="room-dialog"
    >
      <el-form label-position="top" class="room-form">
        <section class="room-form__block">
          <h4><span>1</span>区域标识</h4>
          <div class="room-form__grid room-form__grid--2">
            <el-form-item label="区域键（公式锚点，保存后不可改）" required>
              <el-input v-model="roomForm.roomKey" :disabled="!!roomEditingId" placeholder="如 R1 或 主卧" />
            </el-form-item>
            <el-form-item label="区域名称" required>
              <el-input v-model="roomForm.name" maxlength="32" placeholder="如 主卧" />
            </el-form-item>
          </div>
          <el-form-item label="区域类型">
            <el-select v-model="roomForm.roomType" style="width: 100%">
              <el-option v-for="type in roomTypes" :key="type.value" :label="type.label" :value="type.value" />
            </el-select>
          </el-form-item>
        </section>

        <section class="room-form__block">
          <h4><span>2</span>参考实测 · 面积 A / 周长 P（公式校验用）</h4>
          <p class="room-form__hint">
            这两个字段对应公式里的 <code>A</code> 和 <code>P</code>，是模版里最常用的两个变量。填了可以立刻校验公式（结果显示「按参考值」）；不填就显示「待补」。
            参考值只是打底，不进入工程量与金额；实例化到方案后，录入该房屋的实测面积 / 周长才参与金额。
          </p>
          <div class="room-form__grid room-form__grid--2">
            <el-form-item label="面积 A（㎡）">
              <el-input-number
                v-model="roomForm.referenceArea"
                :precision="3"
                :step="0.1"
                controls-position="right"
                placeholder="可留空"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="周长 P（m）">
              <el-input-number
                v-model="roomForm.referencePerimeter"
                :precision="3"
                :step="0.1"
                controls-position="right"
                placeholder="可留空"
                style="width: 100%"
              />
            </el-form-item>
          </div>
        </section>

        <section class="room-form__block">
          <h4><span>3</span>区域变量 · 参与公式</h4>
          <div class="room-form__grid room-form__grid--3">
            <el-form-item label="层高 H（m）">
              <el-input-number v-model="roomForm.height" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="门洞总宽 DW（m）">
              <el-input-number v-model="roomForm.doorWidthTotal" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="门洞总面积 DA（㎡）">
              <el-input-number v-model="roomForm.doorAreaTotal" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="窗洞总面积 WA（㎡）">
              <el-input-number v-model="roomForm.windowAreaTotal" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="防水上返 WR（m）">
              <el-input-number v-model="roomForm.wallRise" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="同型区域数量 N">
              <el-input-number v-model="roomForm.count" :min="1" :step="1" controls-position="right" style="width: 100%" />
            </el-form-item>
          </div>
        </section>

        <section class="room-form__block is-collapsed">
          <h4><span>4</span>量房快照 · 开间 / 进深（不参与公式）</h4>
          <p class="room-form__hint">现场粗测尺寸，只作记录与对照。区域多为不规则形状，长宽不能用来推算面积或周长。</p>
          <div class="room-form__grid room-form__grid--2">
            <el-form-item label="开间 L（m）">
              <el-input-number v-model="roomForm.length" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
            <el-form-item label="进深 W（m）">
              <el-input-number v-model="roomForm.width" :precision="3" :step="0.1" controls-position="right" placeholder="可留空" style="width: 100%" />
            </el-form-item>
          </div>
        </section>

        <section class="room-form__block">
          <h4><span>5</span>备注</h4>
          <el-form-item label="备注（可选）">
            <el-input v-model="roomForm.remark" type="textarea" :rows="2" maxlength="256" placeholder="如：含飘窗，周长按 CAD 实测" />
          </el-form-item>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="roomDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingRoom" @click="submitRoom">
          <NavIcon name="save" />
          保存区域
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="instantiateVisible" title="从模版生成设计方案" width="560px">
      <el-alert
        type="info"
        :closable="false"
        title="只有已发布版本可实例化；同一房屋 + 同一模版版本重复生成只会得到同一份设计方案（幂等）。生成后进入设计工作区补齐尺寸与公式结果。"
      />
      <el-form label-width="100px" class="room-form__instantiate">
        <el-form-item label="客户房屋" required>
          <PropertyPicker v-model="instantiateForm.propertyId" />
        </el-form-item>
        <el-form-item label="方案名称">
          <el-input v-model="instantiateForm.name" maxlength="128" :placeholder="version?.name ?? ''" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="instantiateVisible = false">取消</el-button>
        <el-button type="primary" :loading="instantiating" @click="submitInstantiate">
          <NavIcon name="send" />
          生成设计方案
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped lang="scss">
.template-editor { display: flex; flex-direction: column; gap: $space-4; padding: $space-5; }

/* ── 页头 ── */
.te-head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-5; padding: $space-4 $space-5; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.te-head__main { display: flex; flex-direction: column; gap: $space-1; min-width: 0; }
.te-head__back { align-self: flex-start; padding: 0; color: $text-secondary; font-size: $font-caption; }
.te-head__main h1 { margin: $space-1 0 0; font-size: $font-h1; }
.te-head__meta { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; color: $text-secondary; font-size: $font-body-sm; }
.te-head__sep { color: $text-tertiary; }
.te-head__desc { margin: $space-1 0 0; max-width: 640px; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.te-head__actions { display: flex; flex-shrink: 0; flex-wrap: wrap; gap: $space-2; }

/* ── 概览指标 ── */
.te-stats { display: flex; flex-wrap: wrap; gap: $space-3; }
.te-stat { display: flex; align-items: baseline; gap: $space-2; min-width: 116px; padding: $space-2 $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.te-stat small { color: $text-secondary; font-size: $font-caption; }
.te-stat b { color: $ink-950; font-size: $font-title; font-variant-numeric: tabular-nums; }
.te-stat.is-ready b { color: $success-500; }
.te-stat.is-warning b { color: $warning-700; }
.te-stat.is-danger b { color: $danger-500; }

.te-error { padding: $space-2 $space-3; color: $danger-500; background: $danger-50; border: 1px solid $danger-200; border-radius: $radius-sm; font-size: $font-caption; }

/* ── 面板 ── */
.panel { overflow: hidden; border: 1px solid $border-color; border-radius: $radius-md; background: $surface-0; box-shadow: $shadow-card; }
.panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: $space-3; padding: $space-3 $space-4; border-bottom: 1px solid $border-color; }
.panel__title { display: flex; align-items: flex-start; gap: $space-3; min-width: 0; }
.panel__title h2 { margin: 0 0 2px; font-size: $font-card-title; }
.panel__title p { margin: 0; max-width: 780px; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.panel__icon { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 30px; color: $brand-700; background: $brand-50; border-radius: $radius-sm; }

/* ── 变量对照 ── */
.vars { display: flex; flex-wrap: wrap; align-items: center; gap: $space-2; padding: $space-2 $space-4; background: $surface-50; border-bottom: 1px solid $border-color; }
.vars__title { color: $text-tertiary; font-size: $font-caption; }
.vars__item { display: inline-flex; align-items: baseline; gap: 4px; padding: 2px 10px; color: $ink-800; background: $surface-0; border: 1px solid $border-color; border-radius: $radius-pill; font-size: $font-caption; }
.vars__item b { color: $brand-700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.vars__note { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; color: $text-tertiary; font-size: $font-caption; }

/* ── 区域表 ── */
.rooms__scroll { max-width: 100%; overflow-x: auto; }
.room-row {
  display: grid;
  grid-template-columns: 96px 110px 76px 84px 84px 84px 92px 100px 100px 88px 100px 100px 64px 132px;
  align-items: center;
  gap: $space-2;
  /* 列宽合计 1310 + 13 个 8px 间隙 = 1414px；写死 min-width 会让行盒比内容短、表头底色与行分隔线右侧截断，
     因此按内容撑开、仅在容器更宽时拉伸到满宽。 */
  width: max-content;
  min-width: 100%;
  padding: $space-2 $space-4;
  border-bottom: 1px solid $border-color;
  font-size: $font-caption;
}
.room-row:last-child { border-bottom: 0; }
.room-row--group { padding: $space-1 $space-4 0; border-bottom: 0; color: $text-tertiary; font-size: $font-caption; }
.room-row--group .g { padding-bottom: $space-1; border-bottom: 2px solid $border-color; text-align: center; }
.room-row--group .g--basic { grid-column: span 3; }
.room-row--group .g--snapshot { grid-column: span 2; }
.room-row--group .g--vars { grid-column: span 5; }
.room-row--group .g--ref { grid-column: span 2; color: $brand-600; border-color: $brand-200; }
.room-row--group .g--other { grid-column: span 2; }
.room-row--head { color: $text-secondary; background: $surface-50; font-weight: $font-weight-semibold; }
.room-row__key { color: $brand-700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.room-row strong { color: $ink-950; }
.room-row .is-muted { color: $text-tertiary; }
.room-row .is-var { color: $brand-800; font-weight: $font-weight-semibold; }
.room-row__actions { display: flex; gap: $space-1; justify-content: flex-end; }

/* ── 区域表单 ── */
.room-form { display: flex; flex-direction: column; gap: $space-3; }
.room-form__block { padding: $space-3 $space-4; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-0; }
.room-form__block.is-collapsed { background: $surface-50; }
.room-form__block h4 { display: flex; align-items: center; gap: $space-2; margin: 0 0 $space-2; font-size: $font-body-sm; }
.room-form__block h4 span { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; color: $brand-700; background: $brand-50; border-radius: $radius-pill; font-size: $font-caption; font-weight: $font-weight-semibold; }
.room-form__hint { margin: 0 0 $space-3; color: $text-secondary; font-size: $font-caption; line-height: 1.6; }
.room-form__hint code { padding: 1px 5px; color: $brand-800; background: $brand-50; border-radius: $radius-xs; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.room-form__grid { display: grid; gap: 0 $space-3; }
.room-form__grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.room-form__grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.room-form__block :deep(.el-form-item) { margin-bottom: $space-3; }
.room-form__block :deep(.el-form-item:last-child) { margin-bottom: 0; }
.room-form__block :deep(.el-form-item__label) { color: $text-secondary; font-size: $font-caption; }
.room-form__instantiate { margin-top: $space-3; }

@media (max-width: 1024px) {
  .template-editor { padding: $space-3; }
  .te-head { flex-direction: column; }
  .room-form__grid--2, .room-form__grid--3 { grid-template-columns: minmax(0, 1fr); }
}
</style>
