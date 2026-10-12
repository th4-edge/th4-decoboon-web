/**
 * @deprecated 门店维度已泛化为共享上下文 `@/stores/storeScope`（`DEC-067` P0A-01）。
 *
 * 本文件保留为**薄封装**，保证 finance 既有视图行为与导入路径不变；
 * 同一时刻只存在一个门店状态源（`useStoreScopeStore`）。新代码请直接使用 `@/stores/storeScope`。
 */
export { ALL_STORES, toRequestStoreId, useStoreScopeStore } from '@/stores/storeScope'
export { useStoreScopeStore as useFinanceScopeStore } from '@/stores/storeScope'
