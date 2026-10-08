<template>
  <section class="template-library">
    <header class="template-library__head">
      <div>
        <h1>方案模版</h1>
        <p>沉淀常用房型的区域骨架、报价分项与工程量公式；新建设计时一键起稿。模版与价格无关，分项价格取自报价项目库。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建模版</el-button>
    </header>

    <div class="template-library__filters">
      <el-select v-model="query.scope" placeholder="归属范围" clearable style="width: 140px" @change="load">
        <el-option label="个人" value="Personal" />
        <el-option label="门店" value="Store" />
        <el-option label="企业" value="Company" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
        <el-option label="草稿" value="Draft" />
        <el-option label="已发布" value="Published" />
        <el-option label="已停用" value="Disabled" />
      </el-select>
    </div>

    <el-table v-loading="loading" :data="templates" border>
      <el-table-column label="模版名称" min-width="220">
        <template #default="{ row }">{{ row.currentVersion?.name ?? '（未命名草稿）' }}</template>
      </el-table-column>
      <el-table-column label="房型" min-width="160">
        <template #default="{ row }">{{ row.currentVersion?.houseType ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="适用面积（套内）" min-width="150">
        <template #default="{ row }">
          <span v-if="row.currentVersion?.areaMin || row.currentVersion?.areaMax">
            {{ row.currentVersion?.areaMin ?? '—' }} – {{ row.currentVersion?.areaMax ?? '—' }} ㎡
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="归属" width="90">
        <template #default="{ row }">{{ SCOPE_LABELS[row.scope as TemplateScope] }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'Published' ? 'success' : 'info'" size="small">
            {{ STATUS_LABELS[row.status as TemplateStatus] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="80">
        <template #default="{ row }">V{{ row.currentVersion?.version ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEditor(row.templateId)">编辑</el-button>
          <el-button
            link
            type="primary"
            :disabled="row.status === 'Published'"
            @click="publish(row.templateId)"
          >发布</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && !templates.length" description="还没有方案模版，从「新建模版」沉淀第一个常用房型" />

    <el-dialog v-model="createVisible" title="新建方案模版" width="520px">
      <el-form label-width="110px">
        <el-form-item label="模版名称" required>
          <el-input v-model="form.name" maxlength="64" placeholder="如：三室两厅一厨一卫 · 标准" />
        </el-form-item>
        <el-form-item label="房型" required>
          <el-input v-model="form.houseType" maxlength="64" placeholder="如：3室2厅1厨1卫" />
        </el-form-item>
        <el-form-item label="适用面积">
          <div class="template-library__range">
            <el-input-number v-model="form.areaMin" :min="0" :precision="2" controls-position="right" />
            <span>–</span>
            <el-input-number v-model="form.areaMax" :min="0" :precision="2" controls-position="right" />
            <span>㎡（套内）</span>
          </div>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tags" maxlength="256" placeholder="如：现代简约,全屋整装" />
        </el-form-item>
        <el-form-item label="归属范围">
          <el-select v-model="form.scope" style="width: 100%">
            <el-option label="个人（仅本人可用）" value="Personal" />
            <el-option label="门店（门店内共享）" value="Store" />
            <el-option label="企业（企业内共享）" value="Company" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="512" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitCreate">创建并编辑</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { pageTemplates, publishTemplate, saveTemplate } from '@/domains/designtemplate/api'
import { SCOPE_LABELS, STATUS_LABELS, type DesignTemplate, type TemplateScope, type TemplateStatus } from '@/domains/designtemplate/model'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const createVisible = ref(false)
const templates = ref<DesignTemplate[]>([])
const query = reactive<{ scope?: TemplateScope; status?: TemplateStatus }>({})
const form = reactive<{ name: string; houseType: string; areaMin?: number; areaMax?: number; tags?: string; scope: TemplateScope; remark?: string }>({
  name: '',
  houseType: '',
  scope: 'Personal'
})

async function load() {
  loading.value = true
  try {
    const page = await pageTemplates({ current: 1, size: 50, scope: query.scope, status: query.status })
    templates.value = page.content ?? []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '方案模版加载失败，请重试')
    templates.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.name = ''
  form.houseType = ''
  form.areaMin = undefined
  form.areaMax = undefined
  form.tags = ''
  form.scope = 'Personal'
  form.remark = ''
  createVisible.value = true
}

async function submitCreate() {
  if (!form.name.trim() || !form.houseType.trim()) {
    ElMessage.warning('模版名称与房型为必填')
    return
  }
  saving.value = true
  try {
    const created = await saveTemplate({ ...form })
    createVisible.value = false
    ElMessage.success('模版已创建（草稿）')
    await router.push(`/designer/templates/${created.templateId}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败，请重试')
  } finally {
    saving.value = false
  }
}

function openEditor(templateId: string) {
  void router.push(`/designer/templates/${templateId}`)
}

async function publish(templateId: string) {
  try {
    await publishTemplate(templateId)
    ElMessage.success('模版已发布')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发布失败，请检查区域与分项后重试')
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.template-library {
  padding: 16px 20px;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;

    h1 {
      margin: 0 0 4px;
      font-size: 20px;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }
  }

  &__filters {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__range {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
