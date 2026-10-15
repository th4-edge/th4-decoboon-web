import type { PickerOption, PickerPage, PickerSource } from '@/domains/common/picker'
import { listFinanceWorkerPage, listPartnerOptions, type PartnerOption } from '@/domains/finance/api'
import type { WorkerRef } from '@/domains/finance/model'

function workerOption(item: WorkerRef): PickerOption {
  return {
    id: item.id,
    label: item.name || '未命名工人',
    description: [item.trade, item.phone].filter(Boolean).join(' · '),
    keywords: [item.name, item.trade, item.phone].filter(Boolean).join(' '),
    raw: item
  }
}

export const workerPickerSource: PickerSource = {
  title: '选择发放工人',
  placeholder: '选择工人',
  search: async ({ keyword, current, size }): Promise<PickerPage> => {
    const page = await listFinanceWorkerPage(keyword, current, size)
    return {
      list: page.list.map(workerOption),
      total: page.total,
      hasMore: page.hasMore
    }
  }
}

/* ------------------------------------------------------------------ *
 * 供应商/经销商选择器数据源（业务概念 supplier，BR-019）
 *
 * 登记表要求：合作状态筛选、结算方式/账期展示、已选摘要卡、清除。
 * 合作方数量在企业范围内有限，分页壳按关键字在本地过滤后返回。
 * ------------------------------------------------------------------ */

function partnerOption(item: PartnerOption): PickerOption {
  const settlement = [item.settlementTerms, item.settlementMode, item.settlementDays ? `${item.settlementDays} 天` : '']
    .filter(Boolean)
    .join(' · ')
  return {
    id: item.id,
    label: item.name,
    description: [partnerStatusLabel(item.status), settlement, item.contactName, item.telNo].filter(Boolean).join(' · '),
    keywords: [item.name, item.contactName, item.telNo, ...(item.brands || [])].filter(Boolean).join(' '),
    raw: item
  }
}

function partnerStatusLabel(status: string): string {
  if (status === 'Active') return '合作中'
  if (status === 'Disabled' || status === 'Inactive') return '已停用'
  return status || ''
}

export const partnerPickerSource: PickerSource = {
  title: '选择供应商/经销商',
  placeholder: '选择合作方',
  search: async ({ keyword, current, size }): Promise<PickerPage> => {
    const list = await listPartnerOptions(keyword)
    const start = Math.max(0, (current - 1) * size)
    return {
      list: list.slice(start, start + size).map(partnerOption),
      total: list.length,
      hasMore: start + size < list.length
    }
  }
}
