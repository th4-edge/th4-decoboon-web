import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/index.scss'
import App from './App.vue'
import router from './core/router'

// Element Plus 组件与 ElMessage 由 unplugin 按需引入（含样式），禁止整库导入。
createApp(App).use(createPinia()).use(router).mount('#app')
