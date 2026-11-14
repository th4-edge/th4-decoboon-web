import type { ContractChangeStatus, ContractChangeType } from './model'

/**
 * 合同变更（增减项）中文投影唯一来源。
 *
 * 枚举中文标签集中定义，禁止在页面内各写一份。所有变更类型/状态展示位一律引用本文件。
 */

/** 顶层动作三类 + 历史兼容两类（`DEC-055`：新入口只提供 新增/减项/替换）。 */
export const CONTRACT_CHANGE_TYPE_LABELS: Record<ContractChangeType, string> = {
  add: '新增分项',
  remove: '减项',
  replace: '替换',
  quantity: '部分减少',
  price: '价格调整（历史）'
}

/**
 * 变更单对外状态（`DEC-068`）。
 *
 * 业务状态只有「待审批 → 已生效 / 已驳回 / 已取消」；`approved` 为历史遗留的
 * 旧“待客户确认”中间态，新单据不再产生，展示统一收敛为「待审批」；
 * `customerConfirmed` 为历史字面量，对外显示「已生效」。
 * 系统不建模业主确认，展示位不再出现“客户已确认/待客户确认”（见 `GAP-049`）。
 */
export const CONTRACT_CHANGE_STATUS_LABELS: Record<ContractChangeStatus, string> = {
  pending: '待审批',
  approved: '待审批',
  customerConfirmed: '已生效',
  rejected: '已驳回',
  cancelled: '已取消'
}
