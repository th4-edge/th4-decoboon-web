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
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import NavIcon from '@/components/shell/NavIcon.vue'
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
let employeePhones: string[] = []

const form = reactive({
  title: '', name: '', addr: '',
  serviceArea: '', serviceTel: '', afterSaleTel: '', uscc: '', qualification: '', intro: '',
  brandPrimary: 'Company' as 'Company' | 'Platform', custodianCredit: false
})

function hydrate(): void {
  const company = session.company
  const setting = (company?.setting || {}) as CompanySetting
  form.title = company?.title ?? company?.name ?? ''
  form.name = company?.name ?? ''
  form.addr = company?.addr ?? ''
  form.serviceArea = setting.serviceArea ?? ''
  form.serviceTel = setting.serviceTel ?? ''
  form.afterSaleTel = setting.afterSaleTel ?? ''
  form.uscc = setting.uscc ?? ''
  form.qualification = setting.qualification ?? ''
  form.intro = setting.intro ?? ''
  form.brandPrimary = setting.brandPrimary === 'Platform' ? 'Platform' : 'Company'
  form.custodianCredit = setting.custodianCredit === true
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
  editing.value = false
}

/** 表单校验：返回错误文案，空串表示通过。 */
function validate(): string {
  if (!form.title.trim()) return '请填写企业全称'
  if (form.title.trim().length > 128) return '企业全称最长 128 个字符'
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
      setting: {
        serviceArea: form.serviceArea.trim(),
        serviceTel: form.serviceTel.trim(),
        afterSaleTel: form.afterSaleTel.trim(),
        uscc: form.uscc.trim().toUpperCase(),
        qualification: form.qualification.trim(),
        intro: form.intro.trim(),
        brandPrimary: form.brandPrimary,
        custodianCredit: form.custodianCredit
      }
    })
    // 保存后回读会话（企业信息由服务端返回，前端不改写事实）
    await session.loadProfile()
    hydrate()
    editing.value = false
    ElMessage.success('企业信息已更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '企业信息更新失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="account-center">
    <div class="page-head">
      <div class="title-zone">
        <h1>账户中心</h1>
        <div class="sub">查看当前登录员工、企业组织和数据范围事实。</div>
      </div>
      <div class="meta">
        <span class="role-tag">{{ session.roleName }} · {{ session.dataScopeName }}</span>
      </div>
    </div>

    <div class="account-center__layout">
      <aside class="identity-card">
        <div class="identity-card__avatar">{{ session.displayName.slice(-1) }}</div>
        <strong>{{ session.displayName }}</strong>
        <span>{{ session.roleName }}</span>
        <small>{{ session.companyName }}</small>
        <dl>
          <div><dt>员工编号</dt><dd>{{ session.employee?.empId ?? '暂不可确认' }}</dd></div>
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
              <div><dt>员工编号</dt><dd>{{ session.employee?.empId ?? '暂不可确认' }}</dd></div>
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
              <div><NavIcon name="team.overview" /><strong>企业资料</strong></div>
              <span>{{ canEditCompany ? '企业负责人可维护对外信息与署名口径' : '对外信息由企业负责人维护' }}</span>
              <el-button v-if="canEditCompany && !editing" size="small" @click="startEdit">编辑</el-button>
            </header>
            <dl v-if="!editing">
              <div><dt>企业名称</dt><dd>{{ session.companyName }}</dd></div>
              <div><dt>企业编号</dt><dd>{{ session.company?.comId ?? '暂不可确认' }}</dd></div>
              <div><dt>企业地址</dt><dd>{{ form.addr || '暂不可确认' }}</dd></div>
            </dl>
            <div v-else class="account-form">
              <el-form label-position="top" @submit.prevent>
                <el-form-item label="企业全称" required>
                  <el-input v-model="form.title" maxlength="128" show-word-limit placeholder="营业执照上的企业全称" />
                </el-form-item>
                <el-form-item label="企业简称" required>
                  <el-input v-model="form.name" maxlength="12" show-word-limit placeholder="对内展示简称" />
                </el-form-item>
                <el-form-item label="企业地址">
                  <el-input v-model="form.addr" maxlength="256" placeholder="企业办公地址" />
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
              <div><dt>叙事主品牌</dt><dd>{{ form.brandPrimary === 'Platform' ? '平台' : '装企（默认）' }}</dd></div>
              <div><dt>记录存证署名</dt><dd>{{ form.custodianCredit ? '显示「记录存证与保管 · 装得清」' : '不显示（默认）' }}</dd></div>
            </dl>
            <div v-else class="account-form">
              <p class="account-form__hint">
                这 6 项会直接展示给业主（知情权，不是宣传）；客服电话与售后专线请填写企业统一号码，不要填写员工个人手机号。
              </p>
              <el-form label-position="top" @submit.prevent>
                <el-form-item label="服务区域">
                  <el-input v-model="form.serviceArea" maxlength="128" placeholder="例：合肥市（蜀山区、滨湖新区）" />
                </el-form-item>
                <el-form-item label="企业客服电话">
                  <el-input v-model="form.serviceTel" maxlength="32" placeholder="企业统一号码，例：0551-6558 8899" />
                </el-form-item>
                <el-form-item label="售后专线">
                  <el-input v-model="form.afterSaleTel" maxlength="32" placeholder="可留空" />
                </el-form-item>
                <el-form-item label="统一社会信用代码">
                  <el-input v-model="form.uscc" maxlength="18" show-word-limit placeholder="18 位，可留空" />
                </el-form-item>
                <el-form-item label="资质">
                  <el-input v-model="form.qualification" maxlength="128" placeholder="例：建筑装饰装修工程专业承包二级" />
                </el-form-item>
                <el-form-item label="一句话简介">
                  <el-input v-model="form.intro" type="textarea" :rows="3" maxlength="512" show-word-limit
                            placeholder="一句话说明企业主营与服务承诺" />
                </el-form-item>
                <el-form-item label="叙事主品牌">
                  <el-radio-group v-model="form.brandPrimary">
                    <el-radio value="Company">装企（默认）</el-radio>
                    <el-radio value="Platform">平台</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="记录存证署名">
                  <el-switch v-model="form.custodianCredit" active-text="显示「记录存证与保管 · 装得清」" />
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
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $space-5;
  margin-bottom: $space-6;

  h1 {
    margin: 0;
    color: $text-primary;
    font-size: $font-display;
    font-weight: $font-weight-bold;
    letter-spacing: -.02em;
  }
}

.title-zone .sub {
  margin-top: 6px;
  color: $text-secondary;
  font-size: $font-body-sm;
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
  box-shadow: 0 10px 24px rgba(47, 125, 90, .24);
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

.account-form {
  padding: $space-5;

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

@media (max-width: 1200px) {
  .account-center__layout { grid-template-columns: 1fr; }
  .identity-card { position: static; }
}

@media (max-width: 720px) {
  .page-head { align-items: flex-start; flex-direction: column; }
  .detail-card > header { align-items: flex-start; flex-direction: column; }
  .detail-card dl > div { grid-template-columns: 1fr; gap: 2px; }
}
</style>
