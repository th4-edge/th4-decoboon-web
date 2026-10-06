import type { PickerOption, PickerPage, PickerSource } from '@/domains/common/picker'
import { listFinanceWorkerPage } from '@/domains/finance/api'
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
