<script setup lang="ts">
/**
 * 账户中心：个人信息 / 企业信息。
 *
 * 对外服务信息（迁移 114「企业对外信息」）：业主端「服务方」区块的数据来源，
 * 由企业自行填写并审核发布（USER-DECISION-20261014-002 §二）。此前只有后端字段与只读展示，
 * 企业无处填写 → 业主端只能显示「暂不可确认」，本次补齐企业负责人可编辑入口。
 *
 * 硬约束：
 * - 写权限与后端 `company/company/update`（requireBoss）一致：仅企业负责人可编辑；
 * - 客服电话/售后专线必须是**企业统一号码**，禁止填写员工个人手机号（同决策 §四「给通道，不给号码」）。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import NavIcon from '@/components/shell/NavIcon.vue'
import PageHeader from '@/components/shell/PageHeader.vue'
import { assetUrl } from '@/core/http'
import { DEFAULT_WEB_BRAND_COLOR, applyCompanyWebBrand, deriveBrandTheme, isValidBrandColor } from '@/core/brandTheme'
import { companyBrandPresetViews } from '@/core/brandPresets'
import { identityApi } from '@/domains/identity/api'
import type { CompanySetting } from '@/domains/identity/model'
import { useSessionStore } from '@/stores/session'

const route = useRoute()
const session = useSessionStore()

const tab = computed(() => route.path.endsWith('/company') ? 'company' : 'profile')
const canEditCompany = computed(() => session.role === 'Boss')

/**
 * 统一客服电话/售后专线：固话、手机号或企业服务号；是否为员工个人号另行拦截。
 *
 * 历史坑（FIX-041 真实浏览器走查发现）：示例与存量数据都带空格分隔（`0551-6558 8899`），
 * 原正则不认空格 → 用户只是「原样保存」也会被误拦。校验前先去掉空白字符（含不间断空格）。
 */
const PHONE_PATTERN = /^(0\d{2,3}-?\d{7,8}(-\d{1,5})?|1[3-9]\d{9}|400-?\d{3}-?\d{4}|95\d{3,5})$/
/** 归一化电话号码：去掉所有空白与不间断空格。 */
function compactPhone(value: string): string {
  return (value || '').replace(/[\s\u00A0]/g, '')
}
/** GB 32100 统一社会信用代码字符集（18 位，去除易混字符 I O S V Z）。 */
const USCC_PATTERN = /^[0-9A-HJ-NPQRTUWXY]{18}$/

const editing = ref(false)
const saving = ref(false)
const logoUploading = ref(false)
let employeePhones: string[] = []

const form = reactive({
  title: '', name: '', addr: '',
  logo: '', color: '',
  serviceArea: '', serviceTel: '', afterSaleTel: '', uscc: '', qualification: '', intro: ''
})
const customColor = ref(DEFAULT_WEB_BRAND_COLOR)

const brandColorOptions = computed(() => companyBrandPresetViews())

const companyInitial = computed(() => Array.from((form.name || form.title || '企').trim())[0] || '企')
const companyLogoSrc = computed(() => assetUrl(form.logo))
const previewTheme = computed(() => deriveBrandTheme(form.color))
const previewColor = computed(() => previewTheme.value.primary)
const brandPreviewStyle = computed(() => ({ background: `linear-gradient(135deg, ${previewTheme.value.lightest}, #fff)` }))
const logoStatus = computed(() => form.logo ? '已上传企业Logo' : '使用企业简称首字')
const colorStatus = computed(() => form.color ? '已自定义品牌色' : '使用装得清默认品牌色')

function hydrate(): void {
  const company = session.company
  const setting = (company?.setting || {}) as CompanySetting
  form.title = company?.title ?? company?.name ?? ''
  form.name = company?.name ?? ''
  form.addr = company?.addr ?? ''
  form.logo = company?.logo ?? ''
  form.color = company?.color ?? ''
  form.serviceArea = setting.serviceArea ?? ''
  form.serviceTel = setting.serviceTel ?? ''
  form.afterSaleTel = setting.afterSaleTel ?? ''
  form.uscc = setting.uscc ?? ''
  form.qualification = setting.qualification ?? ''
  form.intro = setting.intro ?? ''
  customColor.value = form.color || DEFAULT_WEB_BRAND_COLOR
}

function selectColor(value: string): void {
  form.color = value
  customColor.value = value || DEFAULT_WEB_BRAND_COLOR
  applyCompanyWebBrand({ name: form.name || form.title, logo: form.logo, color: value })
}

function applyCustomColor(): void {
  if (!isValidBrandColor(customColor.value)) {
    ElMessage.warning('请输入正确的颜色值，例如 #5C7C6E')
    return
  }
  form.color = customColor.value.trim().toUpperCase()
  applyCompanyWebBrand({ name: form.name || form.title, logo: form.logo, color: form.color })
}

async function uploadLogo(options: { file: File }): Promise<void> {
  if (logoUploading.value) return
  const file = options.file
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.warning('企业Logo不能超过 2MB')
    return
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.warning('企业Logo仅支持 JPG / PNG / WebP 图片')
    return
  }
  logoUploading.value = true
  try {
    await identityApi.uploadCompanyLogo(file)
    await session.loadProfile()
    hydrate()
    ElMessage.success('企业Logo已更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '企业Logo上传失败')
  } finally {
    logoUploading.value = false
  }
}

async function removeLogo(): Promise<void> {
  if (!form.logo) return
  logoUploading.value = true
  try {
    await identityApi.removeCompanyLogo()
    await session.loadProfile()
    hydrate()
    ElMessage.success('已改为企业简称首字展示')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '移除企业Logo失败')
  } finally {
    logoUploading.value = false
  }
}

hydrate()

function startEdit(): void {
  hydrate()
  editing.value = true
  void identityApi.memberPhones()
    .then((list) => { employeePhones = list.map((item) => compactPhone(item).replace(/-/g, '')) })
    .catch(() => { employeePhones = [] })  // 名单拉取失败不阻断编辑，由后端与服务端口径兜底
}

function cancelEdit(): void {
  hydrate()
  applyCompanyWebBrand(session.company)
  editing.value = false
}

onBeforeUnmount(() => applyCompanyWebBrand(session.company))

/** 表单校验：返回错误文案，空串表示通过。 */
function validate(): string {
  if (!form.title.trim()) return '请填写企业展示名称'
  if (form.title.trim().length > 128) return '企业展示名称最长 128 个字符'
  if (form.name.trim().length > 12) return '企业简称最长 12 个字符'
  if (form.addr.trim().length > 256) return '企业地址最长 256 个字符'
  if (form.serviceArea.trim().length > 128) return '服务区域最长 128 个字符'
  const serviceTel = form.serviceTel.trim()
  const afterSaleTel = form.afterSaleTel.trim()
  if (serviceTel && !PHONE_PATTERN.test(compactPhone(serviceTel))) return '客服电话请填写固话（0551-6558 8899）或企业服务号'
  if (afterSaleTel && !PHONE_PATTERN.test(compactPhone(afterSaleTel))) return '售后专线请填写固话或企业服务号'
  if (serviceTel && employeePhones.includes(compactPhone(serviceTel).replace(/-/g, ''))) return '客服电话不能填写员工个人手机号，请填写企业统一号码'
  if (afterSaleTel && employeePhones.includes(compactPhone(afterSaleTel).replace(/-/g, ''))) return '售后专线不能填写员工个人手机号，请填写企业统一号码'
  const uscc = form.uscc.trim().toUpperCase()
  if (uscc && !USCC_PATTERN.test(uscc)) return '统一社会信用代码需为 18 位（数字与大写字母，不含 I O S V Z）'
  if (form.qualification.trim().length > 128) return '资质最长 128 个字符'
  if (form.intro.trim().length > 512) return '一句话简介最长 512 个字符'
  return ''
}

async function save(): Promise<void> {
  if (saving.value) return
  const error = validate()
  if (error) { ElMessage.warning(error); return }
  saving.value = true
  try {
    await identityApi.updateCompany({
      title: form.title.trim(),
      name: form.name.trim(),
      addr: form.addr.trim(),
      color: form.color,
      setting: {
        serviceArea: form.serviceArea.trim(),
        serviceTel: form.serviceTel.trim(),
        afterSaleTel: form.afterSaleTel.trim(),
        uscc: form.uscc.trim().toUpperCase(),
        qualification: form.qualification.trim(),
        intro: form.intro.trim()
      }
    })
    // 保存后回读会话（企业信息由服务端返回，前端不改写事实）
    await session.loadProfile()
    hydrate()
    editing.value = false
    ElMessage.success('企业信息已更新，Web 主题已同步')
  } catch (err) {
    applyCompanyWebBrand(session.company)
    ElMessage.error(err instanceof Error ? err.message : '企业信息更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="account-center">
    <PageHeader title="账户中心" summary="查看当前登录员工、企业组织和数据范围事实。">
      <template #actions>
        <span class="role-tag">{{ session.roleName }} · {{ session.dataScopeName }}</span>
      </template>
    </PageHeader>

    <div class="account-center__layout">
      <aside class="identity-card">
        <div class="identity-card__avatar">{{ session.displayName.slice(-1) }}</div>
        <strong>{{ session.displayName }}</strong>
        <span>{{ session.roleName }}</span>
        <small>{{ session.companyName }}</small>
        <dl>
          <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
        </dl>
      </aside>

      <section class="account-center__main">
        <nav class="account-tabs" aria-label="账户信息导航">
          <router-link to="/account/profile" :class="{ active: tab === 'profile' }">
            <NavIcon name="customer.followup" />
            个人信息
          </router-link>
          <router-link to="/account/company" :class="{ active: tab === 'company' }">
            <NavIcon name="team.overview" />
            企业信息
          </router-link>
        </nav>

        <template v-if="tab === 'profile'">
          <section class="detail-card">
            <header>
              <div><NavIcon name="customer.followup" /><strong>基本资料</strong></div>
              <span>当前登录员工的身份事实</span>
            </header>
            <dl>
              <div><dt>姓名</dt><dd>{{ session.displayName }}</dd></div>
              <div><dt>手机号</dt><dd>{{ session.employee?.telNo ?? session.profile?.phone ?? '暂不可确认' }}</dd></div>
              <div><dt>状态</dt><dd>{{ session.employee?.status?.name ?? '暂不可确认' }}</dd></div>
            </dl>
          </section>

          <section class="detail-card">
            <header>
              <div><NavIcon name="today.mainline" /><strong>组织与权限</strong></div>
              <span>角色和组织范围由登录会话推导</span>
            </header>
            <dl>
              <div><dt>角色</dt><dd>{{ session.roleName }}</dd></div>
              <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
              <div><dt>所属门店</dt><dd>{{ session.employee?.store?.name ?? '未分门店' }}</dd></div>
              <div><dt>所属团队</dt><dd>{{ session.employee?.team?.name ?? '未分团队' }}</dd></div>
            </dl>
          </section>
        </template>

        <template v-else>
          <section class="detail-card">
            <header>
              <div><NavIcon name="team.overview" /><strong>企业品牌与身份</strong></div>
              <span>{{ canEditCompany ? '修改后同步到小程序品牌展示与对外服务资料' : '企业信息由企业负责人维护' }}</span>
              <el-button v-if="canEditCompany && !editing" size="small" @click="startEdit">编辑</el-button>
            </header>
            <div v-if="!editing" class="company-brand-view" :style="brandPreviewStyle">
              <div class="company-brand-view__mark" :style="{ backgroundColor: form.logo ? '#fff' : previewColor, borderColor: previewColor, color: previewTheme.onPrimary }">
                <img v-if="form.logo" :src="companyLogoSrc" alt="" />
                <span v-else>{{ companyInitial }}</span>
              </div>
              <div class="company-brand-view__copy">
                <strong>{{ form.title || session.companyName }}</strong>
                <span>{{ logoStatus }} · {{ colorStatus }}</span>
                <small>员工邀请、业主首页与业主分享页会使用这套企业识别。</small>
              </div>
            </div>
            <dl v-if="!editing">
              <div><dt>企业展示名称</dt><dd>{{ form.title || '暂不可确认' }}</dd></div>
              <div><dt>企业简称</dt><dd>{{ form.name || '暂未填写' }}</dd></div>
              <div><dt>企业办公地址</dt><dd>{{ form.addr || '暂未填写' }}</dd></div>
            </dl>
            <div v-else class="account-form">
              <div class="company-brand-editor">
                <div class="company-brand-view__mark company-brand-view__mark--large" :style="{ backgroundColor: form.logo ? '#fff' : previewColor, borderColor: previewColor, color: previewTheme.onPrimary }">
                  <img v-if="form.logo" :src="companyLogoSrc" alt="" />
                  <span v-else>{{ companyInitial }}</span>
                </div>
                <div class="company-brand-editor__copy">
                  <strong>{{ logoStatus }}</strong>
                  <p>建议上传正方形 PNG/JPG，主体清晰，不超过 2MB。未上传时自动显示简称首字。</p>
                  <div class="company-brand-editor__actions">
                    <el-upload :show-file-list="false" accept="image/png,image/jpeg,image/webp" :http-request="uploadLogo">
                      <el-button :loading="logoUploading">{{ form.logo ? '更换 Logo' : '上传 Logo' }}</el-button>
                    </el-upload>
                    <el-button v-if="form.logo" link type="danger" @click="removeLogo">移除</el-button>
                  </div>
                </div>
              </div>
              <div class="brand-color-editor">
                <div class="brand-color-editor__head">
                  <div>
                    <strong>品牌色</strong>
                    <p>企业品牌色会生成 Web、小程序与 App 的完整主题色阶；成功、警告、危险等业务状态色保持不变。</p>
                  </div>
                  <span>{{ colorStatus }}</span>
                </div>
                <div class="brand-color-editor__options" role="group" aria-label="推荐品牌主题">
                  <button
                    v-for="item in brandColorOptions"
                    :key="item.label"
                    type="button"
                    class="brand-color-option"
                    :class="{ active: form.color === item.value }"
                    :aria-pressed="form.color === item.value"
                    @click="selectColor(item.value)"
                  >
                    <span class="brand-color-option__tones" aria-hidden="true">
                      <i :style="{ backgroundColor: item.lighter }" />
                      <i :style="{ backgroundColor: item.soft }" />
                      <i :style="{ backgroundColor: item.base }" />
                      <i :style="{ backgroundColor: item.deep }" />
                    </span>
                    <span class="brand-color-option__copy">
                      <strong>{{ item.label }}</strong>
                      <small>{{ item.description }}</small>
                    </span>
                    <span class="brand-color-option__state">{{ form.color === item.value ? '已选' : '' }}</span>
                  </button>
                </div>
                <div class="brand-color-custom">
                  <el-color-picker v-model="customColor" @change="applyCustomColor" />
                  <el-input v-model="customColor" maxlength="7" placeholder="#5C7C6E" @keyup.enter="applyCustomColor" />
                  <el-button @click="applyCustomColor">应用自定义色</el-button>
                </div>
                <p class="field-help">支持 #RGB 或 #RRGGBB。系统自动计算浅色、深色、悬停、选中态和对比文字，保证交互可读性。</p>
                <div class="brand-theme-preview">
                  <div class="brand-theme-preview__head">
                    <strong>主题效果</strong>
                    <span>{{ previewTheme.primaryBase }}</span>
                  </div>
                  <div class="brand-theme-preview__surface">
                    <div class="brand-theme-preview__tabs">
                      <span :style="{ color: previewTheme.primaryDark, background: previewTheme.lightest }">工作台</span>
                      <span>客户</span>
                      <span>项目</span>
                    </div>
                    <button type="button" :style="{ background: `linear-gradient(135deg, ${previewTheme.primary}, ${previewTheme.primaryDeep})`, color: previewTheme.onPrimary }">主要操作</button>
                    <div class="brand-theme-preview__palette">
                      <i :style="{ backgroundColor: previewTheme.lightest }" />
                      <i :style="{ backgroundColor: previewTheme.lighter }" />
                      <i :style="{ backgroundColor: previewTheme.primaryBase }" />
                      <i :style="{ backgroundColor: previewTheme.primaryDark }" />
                      <i :style="{ backgroundColor: previewTheme.ink }" />
                    </div>
                  </div>
                </div>
              </div>
              <el-form label-position="top" @submit.prevent>
                <el-form-item label="企业展示名称" required>
                  <el-input v-model="form.title" maxlength="128" show-word-limit placeholder="例如：合肥麦鸿装饰" />
                  <p class="field-help">用于小程序首页、员工邀请和业主识别；正式合同前仍需补全企业法定全称。</p>
                </el-form-item>
                <el-form-item label="企业简称" required>
                  <el-input v-model="form.name" maxlength="12" show-word-limit placeholder="例如：麦鸿装饰" />
                  <p class="field-help">建议 2–12 个字。未上传 Logo 时，系统会使用简称首字作为企业占位。</p>
                </el-form-item>
                <el-form-item label="企业办公地址">
                  <el-input v-model="form.addr" maxlength="256" placeholder="例如：合肥市蜀山区××路××号" />
                  <p class="field-help">填写客户能找到企业的办公或通讯地址，不要填写某个工地的施工地址。</p>
                </el-form-item>
              </el-form>
            </div>
          </section>

          <section class="detail-card">
            <header>
              <div><NavIcon name="today.mainline" /><strong>对外服务信息</strong></div>
              <span>业主在「我的家」可见 · 服务主体知情权事实 · 平台不代填</span>
            </header>
            <dl v-if="!editing">
              <div><dt>服务区域</dt><dd>{{ form.serviceArea || '暂不可确认' }}</dd></div>
              <div><dt>企业客服电话</dt><dd>{{ form.serviceTel || '暂不可确认' }}</dd></div>
              <div><dt>售后专线</dt><dd>{{ form.afterSaleTel || '暂不可确认' }}</dd></div>
              <div><dt>统一社会信用代码</dt><dd>{{ form.uscc || '暂不可确认' }}</dd></div>
              <div><dt>资质</dt><dd>{{ form.qualification || '暂不可确认' }}</dd></div>
              <div><dt>一句话简介</dt><dd>{{ form.intro || '暂不可确认' }}</dd></div>
            </dl>
            <div v-else class="account-form">
              <p class="account-form__hint">以下信息会直接展示给业主，用于确认服务主体和联系通道。请由企业负责人填写并审核，平台不代为填写或背书。</p>
              <el-form label-position="top" @submit.prevent>
                <el-form-item label="服务区域">
                  <el-input v-model="form.serviceArea" type="textarea" :rows="2" maxlength="128" show-word-limit placeholder="例如：合肥市蜀山区、包河区、滨湖新区" />
                  <p class="field-help">填写实际承接业务的城市和区域，不要只写“全国”或“本地”。</p>
                </el-form-item>
                <el-form-item label="企业客服电话">
                  <el-input v-model="form.serviceTel" maxlength="32" placeholder="例如：0551-6558 8899" />
                  <p class="field-help">填写企业统一客服固话或服务号，不能填写员工个人手机号。</p>
                </el-form-item>
                <el-form-item label="售后专线">
                  <el-input v-model="form.afterSaleTel" maxlength="32" placeholder="没有独立售后电话可留空" />
                  <p class="field-help">用于业主入住后的维修、质保和售后联系。</p>
                </el-form-item>
                <el-form-item label="统一社会信用代码">
                  <el-input v-model="form.uscc" maxlength="18" show-word-limit placeholder="营业执照上的 18 位代码，可留空" />
                  <p class="field-help">从营业执照复制，共 18 位，不含 I、O、S、V、Z。</p>
                </el-form-item>
                <el-form-item label="施工资质">
                  <el-input v-model="form.qualification" type="textarea" :rows="2" maxlength="128" show-word-limit placeholder="例如：建筑装修装饰工程专业承包二级" />
                  <p class="field-help">填写证书上的资质名称；没有可留空，平台不会代为填写或背书。</p>
                </el-form-item>
                <el-form-item label="企业简介">
                  <el-input v-model="form.intro" type="textarea" :rows="3" maxlength="512" show-word-limit
                            placeholder="例如：专注合肥住宅设计与施工，提供透明报价、节点验收和售后保障。" />
                  <p class="field-help">用 1–3 句话说明企业主营、服务特点和真实承诺，不要填写无法证明的数据。</p>
                </el-form-item>
                <div class="account-form__actions">
                  <el-button @click="cancelEdit">取消</el-button>
                  <el-button type="primary" :loading="saving" @click="save">保存企业信息</el-button>
                </div>
              </el-form>
            </div>
          </section>

          <section class="detail-card">
            <header>
              <div><NavIcon name="pm.project" /><strong>当前组织上下文</strong></div>
              <span>当前登录会话的企业、门店和团队</span>
            </header>
            <dl>
              <div><dt>当前门店</dt><dd>{{ session.employee?.store?.name ?? '未分门店' }}</dd></div>
              <div><dt>当前团队</dt><dd>{{ session.employee?.team?.name ?? '未分团队' }}</dd></div>
              <div><dt>数据范围</dt><dd>{{ session.dataScopeName }}</dd></div>
            </dl>
          </section>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.account-center {
  display: flex;
  flex-direction: column;
  gap: $space-6;
}

.role-tag {
  padding: 4px 10px;
  border-radius: $radius-pill;
  color: $brand-700;
  background: $brand-50;
  font-size: $font-caption;
}

.account-center__layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: $space-5;
  align-items: start;
}

.identity-card {
  position: sticky;
  top: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $space-6;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
  text-align: center;

  > strong { margin-top: $space-3; font-size: $font-title; }
  > span { margin-top: 2px; color: $brand-600; font-size: $font-body-sm; }
  > small { margin-top: $space-1; color: $text-tertiary; font-size: $font-caption; }

  dl {
    width: 100%;
    margin: $space-5 0 0;
    padding-top: $space-4;
    border-top: 1px solid $border-color;
  }

  dl > div {
    display: flex;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-2 0;
  }

  dt { color: $text-tertiary; font-size: $font-caption; }
  dd { margin: 0; color: $text-secondary; font-size: $font-caption; word-break: break-all; }
}

.identity-card__avatar {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  color: $surface-0;
  background: linear-gradient(145deg, $brand-500, $brand-700);
  box-shadow: 0 10px 24px var(--zdq-brand-a24, rgba(47, 125, 90, .24));
  font-size: $font-display;
  font-weight: $font-weight-bold;

}

.account-center__main {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.account-tabs {
  display: flex;
  gap: $space-2;
  padding: $space-2;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-0;
  box-shadow: $shadow-card;

  a {
    flex: 1;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    border-radius: $radius-sm;
    color: $text-secondary;
    text-decoration: none;
    font-size: $font-body-sm;
    transition: color .15s, background .15s;

    &:hover { color: $brand-600; background: $brand-50; }
    &.active { color: $brand-700; background: $brand-50; font-weight: $font-weight-semibold; }
  }
}

.detail-card {
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;

  > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-3;
    padding: $space-4 $space-5;
    border-bottom: 1px solid $border-color;

    > div { display: flex; align-items: center; gap: $space-2; }
    svg { color: $brand-600; }
    strong { font-size: $font-body; }
    > span { color: $text-tertiary; font-size: $font-caption; }
  }

  dl {
    margin: 0;
    padding: 0 $space-5;
  }

  dl > div {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: $space-4;
    padding: $space-4 0;
    border-bottom: 1px solid $border-color;

    &:last-child { border-bottom: 0; }
  }

  dt { color: $text-tertiary; font-size: $font-body-sm; }
  dd { margin: 0; color: $text-primary; font-size: $font-body-sm; word-break: break-all; }
}

.company-brand-view {
  display: flex;
  align-items: center;
  gap: $space-4;
  margin: $space-5 $space-5 0;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: linear-gradient(135deg, $brand-50, $surface-0);
}

.company-brand-view__mark {
  width: 64px;
  height: 64px;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 3px solid transparent;
  border-radius: 18px;
  color: $surface-0;
  font-size: 26px;
  font-weight: $font-weight-bold;
  box-sizing: border-box;

  img { width: 78%; height: 78%; object-fit: contain; }
}

.company-brand-view__mark--large { width: 84px; height: 84px; font-size: 34px; }

.company-brand-view__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong { overflow: hidden; color: $text-primary; font-size: $font-title; text-overflow: ellipsis; white-space: nowrap; }
  span { color: $brand-700; font-size: $font-body-sm; }
  small { color: $text-tertiary; font-size: $font-caption; line-height: 1.55; }
}

.account-form {
  padding: $space-5;

  :deep(.el-form-item__content) { display: block; width: 100%; }
  :deep(.el-form-item) { margin-bottom: $space-5; }

  &__hint {
    margin: 0 0 $space-4;
    padding: $space-3 $space-4;
    border-radius: $radius-sm;
    color: $text-secondary;
    background: $brand-50;
    font-size: $font-caption;
    line-height: 1.6;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: $space-3;
    padding-top: $space-2;
  }
}

.company-brand-editor {
  display: flex;
  align-items: flex-start;
  gap: $space-4;
  margin-bottom: $space-5;
  padding: $space-4;
  border: 1px dashed $border-color;
  border-radius: $radius-md;
  background: $surface-50;
}

.company-brand-editor__copy {
  min-width: 0;
  flex: 1;

  strong { color: $text-primary; font-size: $font-body; }
  p { margin: 6px 0 12px; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
}

.company-brand-editor__actions { display: flex; align-items: center; gap: $space-2; }

.brand-color-editor {
  margin-bottom: $space-5;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
}

.brand-color-editor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $space-4;

  strong { color: $text-primary; font-size: $font-body; }
  p { max-width: 600px; margin: 6px 0 0; color: $text-tertiary; font-size: $font-caption; line-height: 1.6; }
  > span { flex: none; padding: 4px 10px; border-radius: 999px; color: $brand-700; background: $brand-50; font-size: $font-caption; }
}

.brand-color-editor__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $space-3;
  margin-top: $space-4;
}

.brand-color-custom {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: $space-2;
  margin-top: $space-4;
}

.brand-theme-preview {
  margin-top: $space-4;
  padding: $space-4;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $surface-50;
}

.brand-theme-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-3;

  strong { color: $text-primary; font-size: $font-body-sm; }
  span { color: $text-tertiary; font-family: monospace; font-size: $font-caption; }
}

.brand-theme-preview__surface {
  margin-top: $space-3;
  padding: $space-4;
  border-radius: $radius-sm;
  background: $surface-0;
}

.brand-theme-preview__tabs {
  display: flex;
  gap: $space-2;

  span { padding: 5px 12px; border-radius: $radius-pill; color: $text-tertiary; background: $surface-100; font-size: $font-caption; }
}

.brand-theme-preview__surface > button {
  width: 100%;
  min-height: 38px;
  margin-top: $space-4;
  border: 0;
  border-radius: $radius-sm;
  font-size: $font-body-sm;
  font-weight: $font-weight-semibold;
  cursor: default;
}

.brand-theme-preview__palette {
  display: flex;
  gap: 6px;
  margin-top: $space-4;

  i { height: 14px; flex: 1; border-radius: 4px; }
}

.brand-color-option {
  position: relative;
  min-height: 88px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: $space-3;
  padding: $space-3;
  color: $text-secondary;
  text-align: left;
  background: $surface-0;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  transition: border-color $transition-fast, background $transition-fast, box-shadow $transition-fast;

  &:hover {
    border-color: $brand-300;
    background: $surface-50;
  }

  &:focus-visible {
    outline: 2px solid $brand-500;
    outline-offset: 2px;
  }

  &.active {
    background: $brand-50;
    border-color: $brand-500;
    box-shadow: 0 0 0 1px $brand-500 inset;
  }
}

.brand-color-option__tones {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  width: 58px;
  height: 58px;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $surface-0;

  i { min-width: 0; min-height: 0; }
}

.brand-color-option__copy {
  min-width: 0;
  display: grid;
  gap: 3px;

  strong {
    overflow: hidden;
    color: $text-primary;
    font-size: $font-body-sm;
    font-weight: $font-weight-semibold;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.5;
  }
}

.brand-color-option__state {
  position: absolute;
  top: $space-2;
  right: $space-2;
  color: $brand-700;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
}

.field-help {
  width: 100%;
  margin: 6px 0 0;
  color: $text-tertiary;
  font-size: $font-caption;
  line-height: 1.65;
  white-space: normal;
  word-break: break-word;
}

@media (max-width: 900px) {
  .brand-color-editor__options { grid-template-columns: 1fr; }
  .brand-color-custom { grid-template-columns: 40px minmax(0, 1fr); }
  .brand-color-custom .el-button { grid-column: 1 / -1; }
}

@media (max-width: 1200px) {
  .account-center__layout { grid-template-columns: 1fr; }
  .identity-card { position: static; }
}

@media (max-width: 720px) {
  .detail-card > header { align-items: flex-start; flex-direction: column; }
  .detail-card dl > div { grid-template-columns: 1fr; gap: 2px; }
}
</style>
