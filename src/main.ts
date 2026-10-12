import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/index.scss'
import App from './App.vue'
import router from './core/router'
import { useStoreScopeStore } from './stores/storeScope'

// Element Plus 组件与 ElMessage 由 unplugin 按需引入（含样式），禁止整库导入。
const pinia = createPinia()
createApp(App).use(pinia).use(router).mount('#app')

/**
 * 门店维度对齐（`REQ-BIZ-20261013-001` §6）：在应用启动处、`router.isReady()` 之后**统一做一次**，
 * 不依赖任何具体组件是否挂载（避免「组件挂载早于路由解析 → 读到空 query → 用本地记忆回写 URL」）。
 */
void router.isReady().then(() => {
  useStoreScopeStore(pinia).activate()
})
