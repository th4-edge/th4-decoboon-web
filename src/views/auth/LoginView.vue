<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { useSessionStore } from '@/stores/session'
import { DEFAULT_AUTHENTICATED_PATH, REDIRECT_QUERY_KEY } from '@/core/runtime'
import { ProviderError } from '@/core/http'

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const formRef = ref<FormInstance>()
const form = reactive({ phone: '', password: '' })
const submitting = ref(false)
const errorMessage = ref('')

const rules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }]
}

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  errorMessage.value = ''
  try {
    await session.login({ phone: form.phone.trim(), password: form.password })
    const redirect = typeof route.query[REDIRECT_QUERY_KEY] === 'string'
      ? String(route.query[REDIRECT_QUERY_KEY])
      : DEFAULT_AUTHENTICATED_PATH
    ElMessage.success('登录成功')
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof ProviderError ? error.message : '登录失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <section class="login__brand">
      <div class="login__mark" aria-hidden="true">装</div>
      <p class="login__eyebrow">DECOB00N · 装企经营协同</p>
      <h1 class="login__slogan">让每一个家装项目，<br />同一张进度页同频共管。</h1>
      <p class="login__desc">客户、设计、报价、合同、施工、材料、验收与财务，以项目为枢纽形成企业完整经营闭环。</p>
      <ul class="login__points">
        <li>全角色工作台</li>
        <li>岗位权限清晰</li>
        <li>项目经营闭环</li>
        <li>财务资金穿透</li>
      </ul>
    </section>

    <section class="login__panel">
      <div class="login__card">
        <p class="login__kicker">ENTERPRISE WORKSPACE</p>
        <h2 class="login__title">登录企业工作台</h2>
        <p class="login__hint">使用在小程序“我的 → 账号密码”中设置的手机号与密码登录。</p>

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
            <el-input v-model="form.phone" placeholder="请输入手机号码" maxlength="11" autocomplete="username" />
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
          <div class="login__meta">
            <span>登录账号由企业员工手机号确定</span>
            <span>忘记密码请联系企业管理员</span>
          </div>
          <el-button class="login__submit" type="primary" :loading="submitting" @click="submit">
            进入工作台
          </el-button>
        </el-form>

        <p class="login__footnote">密码由小程序设置，仅以加密形式保存，不展示明文密码。</p>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.login {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  min-height: 100vh;
}

.login__brand {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: $space-5;
  padding: $space-10;
  background: linear-gradient(160deg, $brand-700 0%, $brand-500 60%, $brand-400 100%);
  color: $surface-0;
}

.login__mark {
  width: 52px;
  height: 52px;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, .16);
  display: grid;
  place-items: center;
  font-size: $font-h1;
  font-weight: $font-weight-bold;
}

.login__eyebrow {
  margin: 0;
  font-size: $font-caption;
  letter-spacing: .14em;
  opacity: .82;
}

.login__slogan {
  margin: 0;
  font-size: $font-display;
  line-height: 1.35;
}

.login__desc {
  margin: 0;
  max-width: 520px;
  font-size: $font-body;
  line-height: 1.7;
  opacity: .9;
}

.login__points {
  display: flex;
  flex-wrap: wrap;
  gap: $space-2 $space-4;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: $font-body-sm;

  li::before { content: '· '; opacity: .7; }
}

.login__panel {
  display: grid;
  place-items: center;
  padding: $space-10;
  background: $surface-0;
}

.login__card {
  width: 100%;
  max-width: 380px;
}

.login__kicker {
  margin: 0;
  font-size: $font-caption;
  letter-spacing: .12em;
  color: $text-tertiary;
}

.login__title {
  margin: $space-2 0 $space-1;
  font-size: $font-h1;
}

.login__hint {
  margin: 0 0 $space-5;
  font-size: $font-body-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.login__alert { margin-bottom: $space-4; }

.login__meta {
  display: flex;
  justify-content: space-between;
  gap: $space-3;
  margin-bottom: $space-4;
  font-size: $font-caption;
  color: $text-secondary;
}

.login__submit { width: 100%; }

.login__footnote {
  margin: $space-5 0 0;
  font-size: $font-caption;
  color: $text-tertiary;
  line-height: 1.6;
}
</style>
