<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { useSessionStore } from '@/stores/session'
import { REDIRECT_QUERY_KEY } from '@/core/runtime'
import { homePathForRole } from '@/roles/permission'
import { ProviderError } from '@/core/http'
import { applyCompanyWebBrand } from '@/core/brandTheme'
import { readLastLogin } from '@/core/lastLogin'
import BrandLogo from '@/components/BrandLogo.vue'
import CompanyBrandMark from '@/components/CompanyBrandMark.vue'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const form = reactive({ phone: '', password: '' })
const submitting = ref(false)
const errorMessage = ref('')
const lastLogin = ref(readLastLogin())
const rememberedCompany = computed(() => lastLogin.value?.company ?? null)
const brandName = computed(() => rememberedCompany.value?.name || '装得清')
const pageTitle = computed(() => rememberedCompany.value
  ? `登录${rememberedCompany.value.name}`
  : '登录装得清')

if (typeof document !== 'undefined') {
  document.title = rememberedCompany.value ? pageTitle.value : '登录 | 装得清'
}

const rules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }]
}

function loginRedirect(): string {
  return typeof route.query[REDIRECT_QUERY_KEY] === 'string'
    ? String(route.query[REDIRECT_QUERY_KEY])
    : homePathForRole(session.role)
}

async function completeLogin(): Promise<void> {
  const redirect = loginRedirect()
  ElMessage.success('登录成功')
  await router.replace(redirect)
}

onMounted(async () => {
  if (lastLogin.value?.phone) form.phone = lastLogin.value.phone
  applyCompanyWebBrand(rememberedCompany.value)
  const devToken = route.query.devToken
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'development') || typeof devToken !== 'string') return
  submitting.value = true
  errorMessage.value = ''
  try {
    await session.loginWithToken(devToken)
    await completeLogin()
  } catch (error) {
    errorMessage.value = error instanceof ProviderError ? error.message : '开发令牌无效或已过期'
  } finally {
    submitting.value = false
  }
})

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  errorMessage.value = ''
  try {
    await session.login({ phone: form.phone.trim(), password: form.password })
    await completeLogin()
  } catch (error) {
    errorMessage.value = error instanceof ProviderError ? error.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login">
    <section class="login__story" aria-labelledby="login-story-title">
      <header class="login__identity">
        <span class="login__brand-mark">
          <CompanyBrandMark
            v-if="rememberedCompany"
            :name="rememberedCompany.name"
            :logo="rememberedCompany.logo"
            :color="rememberedCompany.color"
            :size="46"
          />
          <BrandLogo v-else variant="color" :size="44" />
        </span>
        <div class="login__identity-copy">
          <strong>{{ brandName }}</strong>
          <span>{{ rememberedCompany ? '项目进度与记录' : '家装项目经营系统' }}</span>
        </div>
      </header>

      <div class="login__content">
        <div class="login__statement">
          <p class="login__story-label">项目主线</p>
          <h1 id="login-story-title">项目从<span>量房开始</span></h1>
          <p class="login__story-summary">设计、报价、施工与验收，沿同一条项目主线推进。</p>
        </div>

        <ol class="login__trade-path" aria-label="项目主线">
          <span class="login__path-track" aria-hidden="true" />
          <li>
            <span class="login__stage-no">01</span>
            <span class="login__stage-copy"><strong>量房</strong><small>现场交接</small></span>
          </li>
          <li>
            <span class="login__stage-no">02</span>
            <span class="login__stage-copy"><strong>设计</strong><small>方案确认</small></span>
          </li>
          <li>
            <span class="login__stage-no">03</span>
            <span class="login__stage-copy"><strong>报价</strong><small>口径清楚</small></span>
          </li>
          <li>
            <span class="login__stage-no">04</span>
            <span class="login__stage-copy"><strong>施工</strong><small>节点推进</small></span>
          </li>
          <li>
            <span class="login__stage-no">05</span>
            <span class="login__stage-copy"><strong>验收</strong><small>结果留痕</small></span>
          </li>
        </ol>
      </div>
    </section>

    <section class="login__panel">
      <div class="login__card">
        <span class="login__card-accent" aria-hidden="true" />
        <header class="login__form-heading">
          <p class="login__form-label">账号登录</p>
          <h2 class="login__title">{{ pageTitle }}</h2>
          <p class="login__hint">使用手机号和登录密码进入系统。</p>
        </header>

        <el-alert
          v-if="errorMessage"
          class="login__alert"
          :title="errorMessage"
          type="error"
          :closable="false"
          show-icon
        />

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
          <el-form-item label="手机号" prop="phone">
            <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" autocomplete="username" />
          </el-form-item>
          <el-form-item label="登录密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入登录密码"
              show-password
              autocomplete="current-password"
              @keyup.enter="submit"
            />
          </el-form-item>

          <p class="login__guide">密码可从小程序「我的 → 账号密码」设置或修改。</p>

          <el-button class="login__submit" type="primary" :loading="submitting" @click="submit">
            登录
          </el-button>
        </el-form>
      </div>
    </section>
  </main>
</template>


<style scoped lang="scss">
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(420px, .86fr);
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  background: $surface-0;
}

.login__story {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: clamp(32px, 4.5vw, 68px) clamp(36px, 5.5vw, 84px) clamp(32px, 4vw, 52px);
  background:
    radial-gradient(circle at 14% 12%, var(--zdq-brand-a06, #{$brand-50}), transparent 36%),
    linear-gradient(90deg, $surface-100 1px, transparent 1px),
    linear-gradient($surface-100 1px, transparent 1px),
    $surface-50;
  background-size: auto, 72px 72px, 72px 72px, auto;
}

.login__identity {
  display: flex;
  align-items: center;
  gap: $space-3;
  min-width: 0;
}

.login__brand-mark {
  display: inline-flex;
  flex: 0 0 auto;
}

.login__identity-copy {
  display: grid;
  min-width: 0;
  gap: 2px;

  strong {
    overflow: hidden;
    color: $text-primary;
    font-size: $font-card-title;
    font-weight: $font-weight-medium;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.45;
  }
}

.login__content {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(250px, .78fr);
  align-items: center;
  gap: clamp(32px, 5vw, 72px);
  flex: 1;
  padding: $space-8 0 $space-6;
}

.login__statement {
  max-width: 500px;
}

.login__story-label {
  margin: 0 0 $space-4;
  color: $brand-700;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  line-height: 1.5;
}

.login__statement h1 {
  margin: 0;
  color: $text-primary;
  font-size: $font-hero;
  font-weight: $font-weight-medium;
  letter-spacing: -.035em;
  line-height: 1.18;

  span { display: block; }
}

.login__story-summary {
  max-width: 390px;
  margin: $space-5 0 0;
  color: $text-secondary;
  font-size: $font-body;
  line-height: 1.8;
}

.login__trade-path {
  position: relative;
  display: grid;
  gap: $space-5;
  margin: 0;
  padding: 0 0 0 $space-5;
  list-style: none;

  li {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    align-items: start;
    gap: $space-3;
  }
}

.login__path-track {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 28px;
  width: 1px;
  background: $brand-200;
  transform-origin: top;
}

.login__stage-no {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid $brand-200;
  border-radius: 50%;
  color: $brand-700;
  background: $surface-0;
  box-shadow: 0 0 0 5px $surface-50;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  line-height: 1;
}

.login__stage-copy {
  display: grid;
  gap: 2px;
  padding-top: 3px;

  strong {
    color: $text-primary;
    font-size: $font-card-title;
    font-weight: $font-weight-medium;
    line-height: 1.35;
  }

  small {
    color: $text-secondary;
    font-size: $font-caption;
    line-height: 1.5;
  }
}

.login__panel {
  display: grid;
  place-items: center;
  min-height: 0;
  overflow-y: auto;
  padding: clamp(32px, 4.5vw, 64px);
  border-left: 1px solid $border-color;
  background: $surface-100;
}

.login__card {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: $space-8;
  border: 1px solid $line-200;
  border-radius: $radius-lg;
  background: $surface-0;
  box-shadow: $shadow-card;
}

.login__card-accent {
  position: absolute;
  top: 0;
  left: $space-8;
  width: 48px;
  height: 3px;
  border-radius: 0 0 $radius-xs $radius-xs;
  background: $brand-500;
}

.login__form-heading {
  margin-bottom: $space-8;
}

.login__form-label {
  margin: 0;
  color: $brand-700;
  font-size: $font-caption;
  font-weight: $font-weight-semibold;
  line-height: 1.5;
}

.login__title {
  margin: $space-3 0 $space-2;
  overflow-wrap: anywhere;
  color: $text-primary;
  font-size: $font-display;
  font-weight: $font-weight-medium;
  letter-spacing: -.02em;
  line-height: 1.38;
}

.login__hint {
  margin: 0;
  color: $text-secondary;
  font-size: $font-body-sm;
  line-height: 1.7;
}

.login__alert {
  margin-bottom: $space-5;
}

.login__guide {
  margin: -$space-1 0 $space-5;
  color: $text-secondary;
  font-size: $font-caption;
  line-height: 1.7;
}

.login__submit {
  width: 100%;
  min-height: 48px;
  font-weight: $font-weight-medium;
  transition: transform $transition-fast, box-shadow $transition-base, background $transition-fast;

  &:active {
    transform: translateY(1px);
  }
}

.login__card :deep(.el-form-item) {
  margin-bottom: $space-5;
}

.login__card :deep(.el-form-item__label) {
  padding-bottom: $space-2;
  color: $text-primary;
  font-size: $font-body-sm;
  font-weight: $font-weight-medium;
  line-height: 1.4;
}

.login__card :deep(.el-input__wrapper) {
  min-height: 48px;
  padding: 1px $space-3;
  border-radius: $radius-sm;
  background: $surface-0;
  box-shadow: 0 0 0 1px $line-200 inset;
  transition: box-shadow $transition-fast;
}

.login__card :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px $ink-400 inset;
}

.login__card :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px $brand-500 inset, $shadow-focus;
}

.login__card :deep(.el-input__inner) {
  color: $text-primary;
  font-size: $font-body;
}

.login__card :deep(.el-input__inner::placeholder) {
  color: $text-placeholder;
}

.login__card :deep(.el-button--primary) {
  min-height: 48px;
  border-color: $brand-500;
  background: $brand-500;
}

.login__card :deep(.el-button--primary:hover),
.login__card :deep(.el-button--primary:focus-visible) {
  border-color: $brand-600;
  background: $brand-600;
}

.login__card :deep(.el-button--primary:focus-visible) {
  outline: 3px solid var(--zdq-brand-a18, #{$brand-100});
  outline-offset: 2px;
}

@media (max-width: 1180px) {
  .login {
    grid-template-columns: minmax(0, 1fr) 420px;
  }

  .login__content {
    grid-template-columns: 1fr;
    align-content: center;
    gap: $space-8;
  }

  .login__story-summary {
    max-width: 520px;
  }

  .login__trade-path {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: $space-2;
    padding: 0;

    li {
      grid-template-columns: 1fr;
      gap: $space-2;
    }
  }

  .login__path-track {
    top: 14px;
    right: 8%;
    bottom: auto;
    left: 2%;
    width: auto;
    height: 1px;
    transform-origin: left;
  }

  .login__stage-no {
    box-shadow: 0 0 0 4px $surface-50;
  }

  .login__stage-copy {
    padding-top: 0;
  }
}

@media (max-width: 840px) {
  .login {
    display: block;
    height: 100dvh;
    overflow-y: auto;
  }

  .login__story {
    height: auto;
    min-height: auto;
    padding: 24px;
  }

  .login__content {
    padding: $space-7 0 $space-5;
  }

  .login__statement h1 {
    font-size: $font-display;
  }

  .login__story-summary {
    margin-top: $space-3;
  }

  .login__panel {
    min-height: auto;
    padding: $space-6 $space-4 $space-8;
    border-top: 1px solid $line-200;
    border-left: 0;
  }

  .login__card {
    max-width: 480px;
  }
}

@keyframes login-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes login-brand-seal {
  from {
    opacity: 0;
    transform: scale(.94);
  }
  60% {
    opacity: 1;
    transform: scale(1.025);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes login-draw-vertical {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}

@keyframes login-draw-horizontal {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@media (prefers-reduced-motion: no-preference) {
  .login__identity {
    animation: login-rise $motion-enter-base $motion-ease-out both;
  }

  .login__brand-mark {
    animation: login-brand-seal $motion-enter-base $motion-ease-out both;
  }

  .login__story-label {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-1 both;
  }

  .login__statement h1 {
    animation: login-rise $motion-enter-base $motion-ease-out $motion-delay-2 both;
  }

  .login__story-summary {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-3 both;
  }

  .login__path-track {
    animation: login-draw-vertical $motion-enter-base $motion-ease-out $motion-delay-2 both;
  }

  .login__trade-path li:nth-child(2) {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-3 both;
  }

  .login__trade-path li:nth-child(3) {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-4 both;
  }

  .login__trade-path li:nth-child(4) {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-5 both;
  }

  .login__trade-path li:nth-child(5) {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-6 both;
  }

  .login__trade-path li:nth-child(6) {
    animation: login-rise $motion-enter-fast $motion-ease-out $motion-delay-7 both;
  }

  .login__card {
    animation: login-rise $motion-enter-base $motion-ease-out $motion-delay-2 both;
  }

  .login__card-accent {
    transform-origin: left;
    animation: login-draw-horizontal $motion-enter-fast $motion-ease-out $motion-delay-4 both;
  }
}

@media (prefers-reduced-motion: no-preference) and (max-width: 1180px) {
  .login__path-track {
    animation-name: login-draw-horizontal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login *,
  .login *::before,
  .login *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }

  .login__path-track {
    transform: none !important;
  }
}

@media (max-width: 520px) {
  .login__story {
    padding: $space-5;
  }

  .login__content {
    gap: $space-6;
    padding: $space-5 0 $space-4;
  }

  .login__story-label,
  .login__story-summary {
    display: none;
  }

  .login__statement h1 {
    font-size: $font-display;
  }

  .login__trade-path li {
    gap: 4px;
  }

  .login__stage-copy small {
    display: none;
  }

  .login__stage-copy strong {
    font-size: $font-body-sm;
  }

  .login__panel {
    padding: $space-5 $space-3 $space-8;
  }

  .login__card {
    padding: $space-5;
    border-radius: $radius-md;
  }

  .login__card-accent {
    left: $space-5;
    width: 40px;
  }

  .login__form-heading {
    margin-bottom: $space-6;
  }

  .login__title {
    margin-top: $space-2;
  }
}
</style>
