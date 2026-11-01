# 装得清 Web V3 前端工程规范

> 状态：V3 重建基线。与旧工程规范冲突时，以本文件为准。

## 1. 分层与边界

```text
core/     技术能力（runtime / http / router）——不得依赖 domains、views
domains/  业务域（model + api）——不得依赖 views
roles/    角色 → 壳层 / 导航 / 数据范围
layouts/  壳层
views/    页面
stores/   跨页状态（最小集）
styles/   tokens.scss 唯一视觉真源
```

- 视图只能通过 `domains/*/api` 访问服务端；禁止直接 `axios` 或拼接 Provider 路由。
- 角色判断集中在 `roles/permission.ts`。

## 2. 请求与错误

- 统一走 `src/core/http.ts`，返回 Provider 的 `data`，失败抛 `ProviderError(code, message, system)`。
- 认证失效（401 / tokenIsUndefined / tokenInvalid / tokenExpired）由 `setUnauthorizedHandler` 统一清理并跳登录，保留回跳地址。
- 错误必须可表达：页面展示「暂不可确认」+ 重试，不得用 0 或空数组伪装成功。

## 3. TypeScript

- `strict`、`noUnusedLocals`、`noUnusedParameters` 开启。
- 禁止 `any`；外部数据用 `unknown` + 收窄。
- 领域实体使用 `domains/*/model.ts` 定义，禁止在视图层另建重复结构。

## 4. 样式

- 所有 SFC 通过 Vite `additionalData` 自动注入 `tokens.scss`；页面直接使用 `$brand-500` 等变量。
- 禁止裸色值、裸字号、裸圆角、`outline: none`。
- 断点只用 1440 / 1280 / 1024 / 768。

## 5. 构建与依赖

- Element Plus 必须按需引入（`unplugin-vue-components` + `unplugin-auto-import`）。
- `manualChunks` 不得引用整个 `element-plus`，否则会使 tree-shaking 失效。
- 新增依赖必须说明体积影响与替代方案。

## 6. 提交前验证

```bash
npm run type-check
npm run build
```

涉及运行时/权限/金额/跨端的改动，必须补真实浏览器冒烟与负向用例。
