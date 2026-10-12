#!/usr/bin/env node
/**
 * 门店维度请求层护栏（DEC-067 BOSS-STORE-10 / P0A-06 / REQ-BIZ-20261013-001 §5 六条不变量）。
 *
 * 断言：
 * 1. 共享门店上下文与请求层转换存在且未被绕过（唯一状态源）；
 * 2. 源码中不存在把状态值 '0' 当作门店 ID 传给接口的写法；
 * 3. 对齐只发生在应用启动处（`router.isReady()` 之后 `activate()`），不依赖组件挂载（I1/I4/I6）；
 * 4. `resolved` 门控存在，且 BOSS 工作台页面按 `resolved` 门控首帧取数（I5）；
 * 5. 组件不得自行读 `route.query` 做门店对齐（避免「空 query → 记忆回写 URL」复发，B2/B6 根因）；
 * 6. P0D-02：`statistic/store/report` 调用只传真实门店 ID（`'0'` 一律不传）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const failures = []

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const info = statSync(full)
    if (info.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|vue)$/.test(name)) out.push(full)
  }
  return out
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8')
}

const files = walk(join(root, 'src'))

// 1) 唯一状态源与转换函数
const scopeSource = read('src/stores/storeScope.ts')
for (const token of ['zdq.storeScope.v1', 'toRequestStoreId', 'ALL_STORES', 'resolved', 'activate', 'syncUrl']) {
  if (!scopeSource.includes(token)) failures.push(`src/stores/storeScope.ts 缺少 ${token}`)
}

// finance 必须是薄封装（不得再自建状态）
if (read('src/stores/financeScope.ts').includes('defineStore(')) {
  failures.push('src/stores/financeScope.ts 不得再自建门店状态（应为 storeScope 的薄封装）')
}

// 2) 禁止把状态值 '0' 当门店 ID 传给接口
const forbidden = [
  { pattern: /storeId:\s*['"]0['"]/g, why: "storeId: '0'（状态值不得作为门店 ID 传出）" },
  { pattern: /storeId\s*=\s*['"]0['"]/g, why: "storeId = '0'（状态值不得作为门店 ID 传出）" }
]
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  for (const { pattern, why } of forbidden) {
    if (pattern.test(source)) failures.push(`${relative(root, file)}: ${why}`)
    pattern.lastIndex = 0
  }
}

// 3) 应用启动处统一对齐（router.isReady 之后）
const mainSource = read('src/main.ts')
if (!/router\.isReady\(\)/.test(mainSource) || !/activate\(\)/.test(mainSource)) {
  failures.push('src/main.ts 必须在 router.isReady() 之后调用门店上下文 activate()（I1/I4/I6）')
}

// 4) 门店维度接入页必须按 resolved 门控首帧取数
const gatedPages = [
  'src/views/workbench/BossOverviewView.vue',
  'src/views/workbench/BossOrganizationView.vue',
  'src/views/workbench/StoreCustomerView.vue',
  'src/views/workbench/StoreOverviewView.vue'
]
for (const page of gatedPages) {
  if (!read(page).includes('scope.resolved')) {
    failures.push(`${page} 必须按 scope.resolved 门控首帧取数（REQ-BIZ-20261013-001 §5-I5）`)
  }
}

// 5) 组件不得自行读 route.query.storeId 做对齐（B2/B6 根因）
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  if (/route\.query\.(storeId|\[STORE_SCOPE_QUERY_KEY\])/.test(source)) {
    failures.push(`${relative(root, file)}: 门店对齐只能在 stores/storeScope 内完成，组件不得自读 route.query.storeId`)
  }
}

// 6) statistic/store/report 只传真实门店 ID
const statisticApi = read('src/domains/statistic/api.ts')
if (!/storeReport\(storeId/.test(statisticApi) || !/storeId !== '0'/.test(statisticApi)) {
  failures.push("src/domains/statistic/api.ts: storeReport 必须只传真实门店 ID（'0' 不传）")
}
const crmApi = read('src/domains/crm/api.ts')
if (!/storeId\?: string \| null/.test(crmApi) || !/storeId !== '0'/.test(crmApi)) {
  failures.push("src/domains/crm/api.ts: CustomerPageQuery 必须暴露 storeId 且 '0' 不传")
}

if (failures.length) {
  console.error('门店维度护栏检查未通过：')
  for (const item of failures) console.error(` - ${item}`)
  process.exit(1)
}
console.log('门店维度请求层护栏检查通过（唯一状态源 + 不传状态值 0 + 启动对齐/resolved 门控）。')
