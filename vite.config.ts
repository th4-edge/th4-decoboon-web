import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = (env.VITE_API_BASE || '/api/').trim()
  const proxyTarget = (env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8090').trim()

  if (mode === 'production' && !apiBase.startsWith('https://')) {
    throw new Error('生产构建 VITE_API_BASE 必须使用 HTTPS')
  }

  return {
    plugins: [
      vue(),
      AutoImport({ resolvers: [ElementPlusResolver()], dts: 'src/types/auto-imports.d.ts' }),
      Components({ resolvers: [ElementPlusResolver()], dts: 'src/types/components.d.ts' })
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    css: {
      preprocessorOptions: {
        scss: {
          // 每个 SFC 自动注入设计 Token；tokens.scss 自身跳过，避免自引用。
          additionalData: (source: string, filename: string) =>
            filename.includes('styles/tokens.scss') ? source : `@use "@/styles/tokens.scss" as *;\n${source}`
        }
      }
    },
    server: {
      port: Number(env.VITE_DEV_PORT || 8092),
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': { target: proxyTarget, changeOrigin: true },
        '/file': { target: proxyTarget, changeOrigin: true }
      }
    },
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: { manualChunks: { vue: ['vue', 'vue-router', 'pinia'], http: ['axios'] } }
      }
    }
  }
})
