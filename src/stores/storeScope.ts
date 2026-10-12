import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { identityApi, type EntityOption } from '@/domains/identity/api'
import { useSessionStore } from '@/stores/session'
import router from '@/core/router'

/** 全部门店哨兵：与后端 `StoreScope.ALL_STORES`（0）语义一致。 */
export const ALL_STORES = '0'

/** 持久化 key（`DESIGN-BIZ-20261012-002` §1）。 */
export const STORE_SCOPE_STORAGE_KEY = 'zdq.storeScope.v1'

/** URL 参数名。 */
export const STORE_SCOPE_QUERY_KEY = 'storeId'

/**
 * 请求层转换：全部门店 → `null`（**绝不把状态值 `'0'` 当门店 ID 传给任何接口**，P0A-06）。
 * 非数字值同样视为无效，返回 `null`。
 */
export function toRequestStoreId(value: string | null | undefined): string | null {
  if (!value || value === ALL_STORES) return null
  return /^\d+$/.test(value) ? value : null
}

/** 门店选项（重名时需要 addr 区分，默认总店需要标签）。 */
export interface StoreScopeOption extends EntityOption {
  addr?: string
  defaultStore?: boolean
}

function readStored(): string {
  try {
    const raw = localStorage.getItem(STORE_SCOPE_STORAGE_KEY)
    return raw && raw.trim() ? raw.trim() : ALL_STORES
  } catch {
    return ALL_STORES
  }
}

/** 当前路由上的显式 `?storeId=`（数组取首个；空白视为未传）。 */
function rawFromRoute(): string | null {
  const raw = router.currentRoute.value.query[STORE_SCOPE_QUERY_KEY]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * 共享门店维度上下文（`DEC-067` BOSS-STORE-01/10，`DESIGN-BIZ-20261012-002` P0-a）。
 *
 * - 企业范围（BOSS、总部财务）：可选「全部门店」或下钻任一门店，记忆上次选择；
 * - 门店范围（门店财务、店长）：恒为本店，控件只读；
 * - 优先级：**URL 显式 `?storeId=` > 本地记忆 > 「全部门店」**；切换时同时写回 URL（保留其他 query）与本地记忆。
 *
 * 修复 `REQ-BIZ-20261013-001`（B2/B6）后，对齐**只发生在应用启动处**（见 {@link activate}）：
 * 不依赖任何组件是否挂载、不依赖组件与页面的 setup 顺序，杜绝「先用本地记忆对齐、再回写 URL 覆盖显式参数」。
 *
 * 不变量（`REQ-BIZ-20261013-001` §5）：
 * - I1：URL 显式参数优先于本地记忆，绝不被记忆覆盖；
 * - I2：非法 `storeId` 必须同时「提示 + 回落全部门店 + 同步 URL」；
 * - I3：标题（`activeStoreName`）与请求入参（`requestStoreId`）同源于 `storeId`；
 * - I4：门店候选加载完成前不得用记忆值覆盖显式 URL（本实现先等候选、再决策）；
 * - I5：`resolved === false` 时页面不得取数（页面按 `resolved` 门控首帧请求）；
 * - I6：硬加载与 SPA 内导航（切页、前进/后退）走同一条 `router.afterEach` 对齐路径。
 */
export const useStoreScopeStore = defineStore('store-scope', () => {
  const session = useSessionStore()
  const storeId = ref<string>(ALL_STORES)
  const stores = ref<StoreScopeOption[]>([])
  const loading = ref(false)
  const loadFailed = ref(false)
  const notice = ref('')
  /** 门店范围是否已对齐完成；`false` 时页面不得发起取数（I5）。 */
  const resolved = ref(false)

  /** 应用启动对齐是否已注册（幂等）。 */
  let activated = false
  /** 门店候选是否已成功加载（同一会话内复用）。 */
  let storesLoaded = false
  /** 对齐序列号：并发对齐（路由变化 / 角色变化 / 重试）时只让最后一次生效。 */
  let alignSeq = 0

  const canSwitchStore = computed(() => session.dataScope === 'Company')
  const ownStoreName = computed(() => session.store?.name ?? '本店')
  /** 门店 ≤1 家（或门店范围角色）时控件不渲染。 */
  const showPicker = computed(() => canSwitchStore.value && stores.value.length > 1)
  /**
   * 当前范围展示名（页面标题用）。与 {@link requestStoreId} 同源：
   * 未对齐完成前不展示任何门店名，避免「标题=记忆门店 / 数字=全部门店」的状态错位。
   */
  const activeStoreName = computed(() => {
    if (!canSwitchStore.value) return ownStoreName.value
    if (storeId.value === ALL_STORES) return '全部门店'
    const hit = stores.value.find((item) => item.id === storeId.value)
    if (hit) return hit.name
    return resolved.value ? '全部门店' : '门店加载中…'
  })
  /** 传给服务端的门店维度：`null` = 不传 = 全部门店（门店范围主体恒为本店，无需传参）。 */
  const requestStoreId = computed<string | null>(() => (
    canSwitchStore.value ? toRequestStoreId(storeId.value) : null
  ))

  /**
   * 写回 URL（幂等：URL 已一致时不再导航，避免对齐与导航互相触发）。
   *
   * @param history `push` = 用户主动切换门店（新增历史条目，使浏览器后退回到上一个门店，见
   *   `REQ-BIZ-20261013-001` §7「切 A → 切 B → 后退回到 A」）；`replace`（默认）= 校正性同步
   *   （非法值回落、单门店归一、记忆回填），不污染历史。
   */
  function syncUrl(history: 'push' | 'replace' = 'replace'): void {
    const current = router.currentRoute.value
    const raw = current.query[STORE_SCOPE_QUERY_KEY]
    const present = typeof raw === 'string' && raw.trim() ? raw.trim() : null
    const desired = storeId.value === ALL_STORES ? null : storeId.value
    if (desired === present) return
    const query = { ...current.query }
    if (desired === null) delete query[STORE_SCOPE_QUERY_KEY]
    else query[STORE_SCOPE_QUERY_KEY] = desired
    void (history === 'push' ? router.push({ query }) : router.replace({ query }))
  }

  function persist(): void {
    try {
      localStorage.setItem(STORE_SCOPE_STORAGE_KEY, storeId.value)
    } catch {
      // 本地记忆不可用时不影响功能
    }
  }

  /** 用户主动切换门店（企业范围角色专用）。全部门店写 `'0'`，请求层再转 `null`。 */
  function setStore(next: string): void {
    if (!canSwitchStore.value) return
    const value = toRequestStoreId(next) ?? ALL_STORES
    storeId.value = value
    notice.value = ''
    resolved.value = true
    persist()
    syncUrl('push')
  }

  async function fetchStores(): Promise<void> {
    if (storesLoaded || loading.value) return
    loading.value = true
    loadFailed.value = false
    try {
      stores.value = await identityApi.stores()
      storesLoaded = true
      loadFailed.value = false
    } catch {
      stores.value = []
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * 统一对齐：读 URL（显式优先）→ 等门店候选 → 校正（仍可用 / 属本企业）→ 允许取数。
   *
   * @param explicitRaw 显式指定 URL 值（缺省时读当前路由）；`null` 表示「URL 未传门店」。
   */
  async function align(explicitRaw?: string | null): Promise<void> {
    const my = ++alignSeq
    const raw = explicitRaw === undefined ? rawFromRoute() : explicitRaw

    if (!canSwitchStore.value) {
      // 门店范围角色（店长 / 门店财务）：恒为本店，请求不传参；也不进门店记忆。
      stores.value = []
      storeId.value = ALL_STORES
      notice.value = ''
      resolved.value = true
      return
    }

    // I5：显式 URL 与当前应用值不一致时（深链接 / SPA 内导航携带新门店），先关闭取数门控。
    if (raw !== null && raw !== storeId.value) resolved.value = false

    // 预对齐（同步、只用 URL、绝不用记忆）：让**未接 `resolved` 门控**的既有页面（finance 域）
    // 在候选加载完成前也按链接里的门店取数，保持其上线前行为不回退；校正（是否属本企业/是否可用）
    // 仍由下面 await 候选后的正式对齐完成。
    if (raw !== null && /^\d+$/.test(raw) && raw !== storeId.value) {
      storeId.value = raw
    }

    await fetchStores()
    if (my !== alignSeq) return

    if (loadFailed.value) {
      // 候选不可得：按约定回落「全部门店」+ 提示 + 同步 URL（`DESIGN-BIZ-20261012-002` §5 失败恢复）。
      storeId.value = ALL_STORES
      notice.value = '门店列表加载失败，已回落为「全部门店」'
      resolved.value = true
      persist()
      syncUrl()
      return
    }

    if (stores.value.length <= 1) {
      // 单门店企业：控件不渲染，上下文恒为「全部门店」，请求不传参（与上线前等价）。
      storeId.value = ALL_STORES
      notice.value = ''
      resolved.value = true
      persist()
      syncUrl()
      return
    }

    if (raw !== null) {
      // I1/I4：显式 URL 优先；非法（非数字 / 不存在 / 非本企业门店）必须提示 + 回落 + 同步 URL（I2）。
      const numeric = /^\d+$/.test(raw)
      const usable = numeric && stores.value.some((item) => item.id === raw)
      if (!usable) {
        storeId.value = ALL_STORES
        notice.value = numeric
          ? '链接里的门店不存在或无权访问，已回落为「全部门店」'
          : '链接里的门店参数无效，已回落为「全部门店」'
        resolved.value = true
        persist()
        syncUrl()
        return
      }
      storeId.value = raw
      notice.value = ''
      resolved.value = true
      // 链接里的选择即「最近一次选择」（BOSS-STORE-01 记忆口径）：写记忆，避免切页时回退到过期记忆。
      persist()
      return
    }

    // URL 未传门店 → 本地记忆 → 默认「全部门店」；记忆里的门店已不可用时回落 + 提示。
    // ⚠️ 收敛自身写回 URL 触发的二次对齐：值未变化时**不得清掉上一次对齐给出的提示**（否则
    //    「非法值提示」会被紧随其后的同步导航抹掉，见 `REQ-BIZ-20261013-001` §5-I2）。
    const remembered = readStored()
    const usable = remembered !== ALL_STORES && stores.value.some((item) => item.id === remembered)
    const next = usable ? remembered : ALL_STORES
    if (next !== storeId.value) {
      notice.value = usable ? '' : '上次选择的门店已不可用，已回落为「全部门店」'
    }
    storeId.value = next
    resolved.value = true
    persist()
    syncUrl()
  }

  /** 应用启动处调用（`router.isReady()` 之后）：注册唯一对齐入口，幂等。 */
  function activate(): void {
    if (activated) return
    activated = true
    // I6：硬加载、切页、前进/后退全部收敛到这一条 afterEach 对齐路径（不依赖组件挂载）。
    router.afterEach(() => { void align() })
    // 登录 / 退出 / 岗位视角切换后重新对齐（数据范围变化）。
    watch(() => session.dataScope, () => { void align() })
    void router.isReady().then(() => align())
  }

  /** 门店列表加载失败后的「重试」：重新拉候选并重跑对齐。 */
  async function reload(): Promise<void> {
    storesLoaded = false
    loadFailed.value = false
    await align()
  }

  return {
    storeId, stores, loading, loadFailed, notice, resolved,
    canSwitchStore, ownStoreName, showPicker, activeStoreName, requestStoreId,
    align, activate, setStore, reload
  }
})
