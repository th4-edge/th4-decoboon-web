/** 业务承接（在跑项目）最小 Web 投影，用于店长本店代确认（DEC-076）。 */
export interface CarryoverBatch {
  id?: string
  asOfDate?: string
  status: string
}

export interface CarryoverProject {
  id: string
  status: string
  customerName: string
  customerPhone: string
  community?: string
  address: string
  contractNo: string
  currentAmount: number
  receivableOutstanding: number
  payableOutstanding: number
  costStatus: string
  validationBlockers: string[]
  carryoverReady: boolean
  projectId?: string
}

export type CarryoverConfirmationRole = 'Boss' | 'Finance' | 'Pm'
