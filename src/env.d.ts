/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string
  readonly VITE_DEV_PROXY_TARGET: string
  readonly VITE_DEV_PORT: string
  readonly VITE_RELEASE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __WEB_VERSION__: string
declare const __WEB_RELEASE_VERSION__: string
declare const __WEB_BUILD_ID__: string
