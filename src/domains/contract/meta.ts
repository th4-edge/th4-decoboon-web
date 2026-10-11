import type { ContractChangeStatus, ContractChangeType } from './model'

/**
 * 合同变更（增减项）中文投影唯一来源。
 *
 * 规范 `docs/standards/WEB-业务概念全生命周期规范.md` §5：枚举中文标签必须集中定义，
 * 禁止在页面内各写一份。所有变更类型/状态展示位一律引用本文件。
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
 * 变更单对外状态（`DEC-041`）。
 *
 * 注意：`approved` 在「客户线下确认是创建前置事实」的新时序下不再单独对外，
 * 当前文案沿用历史口径，是否改为「已签认」需业务确认后统一（见交接说明）。
 */
export const CONTRACT_CHANGE_STATUS_LABELS: Record<ContractChangeStatus, string> = {
  pending: '待审批',
  approved: '历史待客户签认',
  customerConfirmed: '已生效',
  rejected: '已驳回',
  cancelled: '已取消'
}
