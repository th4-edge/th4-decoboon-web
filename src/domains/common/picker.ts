export interface PickerOption {
  id: string
  label: string
  description?: string
  keywords?: string
  disabled?: boolean
  raw?: unknown
}

export interface PickerPage {
  list: PickerOption[]
  total: number
  hasMore: boolean
}

export interface PickerSearchParams {
  keyword: string
  current: number
  size: number
}

export interface PickerSource {
  title: string
  placeholder: string
  search: (params: PickerSearchParams) => Promise<PickerPage>
  resolve?: (id: string) => Promise<PickerOption | null>
}

export type PickerResult<T> =
  | { action: 'select'; value: T }
  | { action: 'clear' }
