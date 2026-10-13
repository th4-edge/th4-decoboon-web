<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { projectApi } from '@/domains/project/api'
import type { ProjectBrief } from '@/domains/project/model'
import { materialApi } from '@/domains/material/api'
import type { MaterialSelectionItem, SelectionSnapshot } from '@/domains/material/model'
import type { StatusTone } from '@/core/tone'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const maintainRoles = ['Designer', 'Boss', 'StoreManager', 'Finance']
const canMaintain = computed(() => maintainRoles.includes(session.role ?? ''))
const backPath = computed(() => session.role === 'StoreManager' || session.role === 'Finance' ? '/workbench' : '/designer/projects')

const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  Selected: { label: '已选材', tone: 'done' }
}
/** 已进入采购的计划状态：选材只读，换材必须走增减项（DEC-008）。 */
const PURCHASING_ORDER_STATUS = ['ordering', 'partiallyOrdered', 'ordered', 'partiallyArrived', 'arrived']

type FilterKey = 'all' | 'todo' | 'selected' | 'locked'
const activeFilter = ref<FilterKey>('all')
const projectId = computed(() => String(route.params.projectId ?? ''))
const project = ref<ProjectBrief | null>(null)
const items = ref<MaterialSelectionItem[]>([])
const selectedId = ref('')
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveError = ref('')

const editor = reactive<SelectionSnapshot & { content: string }>({
  color: '',
  spec: '',
  brand: '',
  process: '',
  remark: '',
  content: ''
})

const selectedItem = computed(() => items.value.find((item) => item.itemId === selectedId.value) ?? null)

const filteredItems = computed(() => items.value.filter((item) => {
  if (activeFilter.value === 'all') return true
  if (activeFilter.value === 'todo') return !item.selectionId
  if (activeFilter.value === 'selected') return !!item.selectionId
  if (activeFilter.value === 'locked') return isLocked(item)
  return true
}))

const counts = computed(() => ({
  all: items.value.length,
  todo: items.value.filter((item) => !item.selectionId).length,
  selected: items.value.filter((item) => !!item.selectionId).length,
  locked: items.value.filter((item) => isLocked(item)).length
}))

function statusMeta(item: MaterialSelectionItem): { label: string; tone: StatusTone } {
  if (item.status && STATUS_META[item.status]) return STATUS_META[item.status]
  return { label: item.statusName || '待选样', tone: 'todo' }
}

function isLocked(item: MaterialSelectionItem): boolean {
  return !!item.orderStatus && PURCHASING_ORDER_STATUS.includes(item.orderStatus)
}

function isEditable(item: MaterialSelectionItem): boolean {
  return canMaintain.value && !isLocked(item)
}

function parseSnapshot(item: MaterialSelectionItem): SelectionSnapshot {
  if (!item.selectionJson) return {}
  try {
    const raw = JSON.parse(item.selectionJson) as SelectionSnapshot
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function selectItem(item: MaterialSelectionItem): void {
  selectedId.value = item.itemId
  const snapshot = parseSnapshot(item)
  editor.color = snapshot.color ?? ''
  editor.spec = snapshot.spec ?? item.spec ?? ''
  editor.brand = snapshot.brand ?? item.brand ?? ''
  editor.process = snapshot.process ?? ''
  editor.remark = snapshot.remark ?? ''
  editor.content = item.selectionText ?? ''
}

function buildContent(): string {
  if (editor.content.trim()) return editor.content.trim()
  return [
    editor.color?.trim() ? `颜色/花色：${editor.color.trim()}` : '',
    editor.spec?.trim() ? `规格/型号：${editor.spec.trim()}` : '',
    editor.brand?.trim() ? `品牌：${editor.brand.trim()}` : '',
    editor.process?.trim() ? `工艺：${editor.process.trim()}` : '',
    editor.remark?.trim() ? `备注：${editor.remark.trim()}` : ''
  ].filter(Boolean).join('；')
}

async function load(): Promise<void> {
  if (!projectId.value) {
    error.value = '缺少项目编号'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [projectResult, itemResult] = await Promise.all([
      projectApi.projectInfo(projectId.value),
      materialApi.listSelectionItems(projectId.value)
    ])
    project.value = projectResult
    items.value = itemResult
    if (selectedId.value && !items.value.some((item) => item.itemId === selectedId.value)) selectedId.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '主材选材工作区暂不可确认'
  } finally {
    loading.value = false
  }
}

async function save(deliver: boolean): Promise<void> {
  const item = selectedItem.value
  if (!canMaintain.value || !item || !project.value || !isEditable(item)) return
  const content = buildContent()
  if (!content) {
    saveError.value = '请填写选材说明，或至少填写颜色、规格、品牌和工艺中的一项'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const saved = await materialApi.saveSelection({
      propertyId: item.propertyId,
      projectId: project.value.id,
      contractId: item.contractId,
      contractLineId: item.itemId,
      title: item.materialName,
      content,
      selectionJson: JSON.stringify({
        color: editor.color?.trim() ?? '',
        spec: editor.spec?.trim() ?? '',
        brand: editor.brand?.trim() ?? '',
        process: editor.process?.trim() ?? '',
        remark: editor.remark?.trim() ?? ''
      }),
      deliver
    })
    // 保存接口刚写入后列表投影可能短暂滞后；先用服务端返回结果更新本地对象，避免必须手动刷新。
    const index = items.value.findIndex((candidate) => candidate.itemId === item.itemId)
    if (index >= 0) {
      const existing = items.value[index]
      items.value[index] = {
        ...existing,
        selectionId: saved.selectionId ?? existing.selectionId,
        version: saved.version ?? existing.version,
        status: saved.status ?? existing.status,
        statusName: saved.statusName ?? existing.statusName,
        selectionText: saved.selectionText ?? existing.selectionText,
        selectionJson: saved.selectionJson ?? existing.selectionJson,
        attachments: saved.attachments ?? existing.attachments,
        orderStatus: saved.orderStatus ?? existing.orderStatus,
        orderStatusName: saved.orderStatusName ?? existing.orderStatusName,
        nextAction: saved.nextAction ?? existing.nextAction
      }
      selectItem(items.value[index])
    }
    ElMessage.success(deliver ? '选材已保存并交付财务下单' : '选材已保存')
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : '选材保存失败'
  } finally {
    saving.value = false
  }
}


onMounted(load)
</script>

<template>
  <div class="ms">
    <header class="ms__head">
      <div>
        <el-button link @click="router.push(backPath)">← 返回项目工地</el-button>
        <p class="ms__eyebrow">MATERIAL SELECTION</p>
        <h2>主材选材工作区</h2>
        <p v-if="project">{{ project.name }} · {{ project.propertyName || project.community || '房屋待补充' }}</p>
        <p>按合同主材分项维护颜色、规格、品牌和工艺，保存后可交付财务下单；选材文本不改变报价、合同、成本或材料数量。当前维护角色：Designer / Boss / StoreManager / Finance。</p>
      </div>
      <el-button @click="load">刷新选材项</el-button>
    </header>

    <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
    <el-alert v-if="saveError" type="warning" :closable="false" :title="saveError" show-icon />
    <el-alert v-if="!canMaintain" type="info" :closable="false" title="当前角色对主材选材只读；Pm/TeamLeader/Marketer 不得修改选材事实。" show-icon />

    <div class="ms__layout">
      <aside class="ms__pool">
        <div class="ms__panel-head"><strong>主材分项</strong><span>{{ filteredItems.length }} 项</span></div>
        <div class="ms__filters">
          <button v-for="filter in [
            { key: 'all', label: '全部' },
            { key: 'todo', label: '待选材' },
            { key: 'selected', label: '已选材' },
            { key: 'locked', label: '已锁定' }
          ] as Array<{ key: FilterKey; label: string }>" :key="filter.key" type="button" :class="{ active: activeFilter === filter.key }" @click="activeFilter = filter.key">
            {{ filter.label }} <b>{{ counts[filter.key] }}</b>
          </button>
        </div>
        <div v-if="loading && !items.length" class="ms__loading"><el-skeleton :rows="6" animated /></div>
        <EmptyState v-else-if="!filteredItems.length" title="当前筛选下没有主材分项" description="切换筛选条件或刷新服务端数据。" />
        <button v-for="item in filteredItems" v-else :key="item.itemId" type="button" class="ms__item" :class="{ active: item.itemId === selectedItem?.itemId }" @click="selectItem(item)">
          <span class="ms__item-top"><strong>{{ item.materialName }}</strong><StatusTag :tone="statusMeta(item).tone" :text="statusMeta(item).label" /></span>
          <span>{{ item.spaceName || '未标注区域' }} · {{ item.category || '分类待补充' }}</span>
          <span class="ms__item-foot"><small>{{ [item.brand, item.spec].filter(Boolean).join(' · ') || '品牌规格待补充' }}</small><b v-if="item.orderStatusName">{{ item.orderStatusName }}</b></span>
        </button>
      </aside>

      <main class="ms__editor">
        <template v-if="selectedItem">
          <section class="ms__identity">
            <div>
              <p class="ms__eyebrow">SELECTED MATERIAL</p>
              <h3>{{ selectedItem.materialName }}</h3>
              <p>{{ selectedItem.spaceName || '未标注区域' }} · {{ selectedItem.category || '分类待补充' }} · {{ selectedItem.quantity }} {{ selectedItem.unit || '' }}</p>
            </div>
            <StatusTag :tone="statusMeta(selectedItem).tone" :text="statusMeta(selectedItem).label" />
          </section>

          <section class="ms__facts">
            <div><span>合同编号</span><b>{{ selectedItem.contractNo || '暂不可确认' }}</b></div>
            <div><span>合同品牌 / 规格</span><b>{{ [selectedItem.brand, selectedItem.spec].filter(Boolean).join(' · ') || '暂不可确认' }}</b></div>
            <div><span>采购状态</span><b>{{ selectedItem.orderStatusName || '未下单' }}</b></div>
            <div><span>选材状态</span><b>{{ statusMeta(selectedItem).label }}</b></div>
          </section>

          <section class="ms__form">
            <el-alert v-if="!isEditable(selectedItem)" type="warning" :closable="false" title="该主材已进入采购，选材文本已锁定；如需更换必须走增减项。" show-icon />
            <el-form label-position="top" :disabled="!isEditable(selectedItem)">
              <div class="ms__grid">
                <el-form-item label="颜色 / 花色"><el-input v-model="editor.color" placeholder="例如：拉丝香槟金" /></el-form-item>
                <el-form-item label="规格 / 型号"><el-input v-model="editor.spec" placeholder="例如：300×600mm" /></el-form-item>
                <el-form-item label="品牌"><el-input v-model="editor.brand" placeholder="例如：奥普" /></el-form-item>
                <el-form-item label="工艺 / 材质"><el-input v-model="editor.process" placeholder="例如：同色收边" /></el-form-item>
              </div>
              <el-form-item label="选材说明"><el-input v-model="editor.content" type="textarea" :rows="4" placeholder="留空时会根据上方字段自动汇总；也可以直接填写客户沟通确认的选材内容。" /></el-form-item>
              <el-form-item label="备注"><el-input v-model="editor.remark" placeholder="客户偏好、到货要求或需要现场确认的事项" /></el-form-item>
            </el-form>
            <div class="ms__actions">
              <el-button :loading="saving" :disabled="!isEditable(selectedItem)" @click="save(false)">保存</el-button>
              <el-button type="primary" :loading="saving" :disabled="!isEditable(selectedItem)" @click="save(true)">保存并交付财务下单</el-button>
            </div>
          </section>
        </template>
        <EmptyState v-else title="请选择一项主材" description="主材分项来自合同与项目主链，设计师只维护选材文本。" />
      </main>

      <aside class="ms__context">
        <section class="ms__panel">
          <div class="ms__panel-head"><strong>选材边界</strong></div>
          <ul>
            <li>选材文本不改变报价、合同、成本和材料数量</li>
            <li>已进入采购后不能直接改选材文本</li>
            <li>需要换材必须发起增减项，由正式流程承担金额和履约影响</li>
            <li>现场/逐项沟通后代录即视为客户已确认，采购门禁以"已选材"为准</li>
          </ul>
        </section>
        <section class="ms__panel">
          <div class="ms__panel-head"><strong>当前下一步</strong></div>
          <p v-if="selectedItem">{{ selectedItem.nextAction || (isEditable(selectedItem) ? '维护选材结果并交付财务下单。' : '等待采购 / 变更流程处理。') }}</p>
          <p v-else>选择主材后查看下一步。</p>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ms {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-5;
}

.ms__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  h2 { margin: $space-1 0; font-size: $font-display; }
  p { margin: 0; max-width: 820px; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }
}

.ms__eyebrow {
  color: $brand-600 !important;
  font-size: $font-caption !important;
  font-weight: $font-weight-semibold;
  letter-spacing: .1em;
}

.ms__layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 320px;
  gap: $space-4;
  align-items: start;
}

.ms__pool,
.ms__editor,
.ms__context {
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.ms__pool,
.ms__context { position: sticky; top: $space-4; max-height: calc(100vh - #{$topbar-height} - #{$space-8}); overflow: auto; }

.ms__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  span { color: $text-tertiary; font-size: $font-caption; }
}

.ms__filters {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border-color;

  button { padding: 4px 8px; border: 1px solid $border-color; border-radius: $radius-pill; background: $surface-0; color: $text-secondary; font-size: $font-caption; cursor: pointer; }
  button.active { border-color: $brand-300; background: $brand-50; color: $brand-700; font-weight: $font-weight-semibold; }
}

.ms__item {
  width: 100%;
  padding: $space-3 $space-4;
  border: 0;
  border-bottom: 1px solid $border-color;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &.active { background: $brand-50; }
  > span { display: block; margin-top: $space-1; color: $text-secondary; font-size: $font-caption; }
}

.ms__item-top,
.ms__item-foot { display: flex !important; align-items: center; justify-content: space-between; gap: $space-2; }
.ms__item-top strong { color: $text-primary; font-size: $font-body-sm; }
.ms__item-foot b { color: $brand-700; }

.ms__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;
  padding: $space-5;
  border-bottom: 1px solid $border-color;
  background: linear-gradient(135deg, $brand-50 0%, $surface-0 72%);

  h3 { margin: $space-1 0; font-size: $font-h1; }
  p { margin: 0; color: $text-secondary; font-size: $font-body-sm; }
}

.ms__facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $space-3;
  padding: $space-4;
  border-bottom: 1px solid $border-color;

  div { padding: $space-3; border: 1px solid $border-color; border-radius: $radius-sm; background: $surface-50; }
  span { display: block; color: $text-secondary; font-size: $font-caption; }
  b { display: block; margin-top: 3px; font-size: $font-body-sm; }
}

.ms__form { padding: $space-4; }
.ms__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 $space-4; }
.ms__actions { display: flex; gap: $space-2; }

.ms__panel { padding: $space-4; border-bottom: 1px solid $border-color; }
.ms__panel ul { margin: 0; padding: 0; list-style: none; }
.ms__panel li { padding: $space-2 0; border-bottom: 1px solid $border-color; color: $text-secondary; font-size: $font-body-sm; line-height: 1.6; }
.ms__panel p { margin: 0; color: $text-secondary; font-size: $font-body-sm; line-height: 1.7; }

.ms__loading { padding: $space-5; }

@media (max-width: 1280px) {
  .ms__layout { grid-template-columns: 280px minmax(0, 1fr); }
  .ms__context { grid-column: 1 / -1; position: static; max-height: none; }
}

@media (max-width: 1024px) {
  .ms__head { flex-direction: column; }
  .ms__layout { grid-template-columns: 1fr; }
  .ms__pool { position: static; max-height: none; }
  .ms__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ms__grid { grid-template-columns: 1fr; }
}
</style>
