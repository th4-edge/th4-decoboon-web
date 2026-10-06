export interface RiskCenterReport {
  asOf: string
  totalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  typeDistribution: RiskTypeDistribution[]
  responsibilityDistribution: RiskResponsibility[]
  items: RiskItemView[]
}

export interface RiskTypeDistribution {
  key: string
  label: string
  description: string
  count: number
  highCount: number
}

export interface RiskResponsibility {
  name: string
  count: number
  highCount: number
}

export interface RiskItemView {
  key: string
  type: string
  typeLabel: string
  level: string
  levelLabel: string
  title: string
  message: string
  projectName: string
  customerName: string
  ownerName: string
  amount: number
  dueDate: string
  timeText: string
  timeTone: string
  nextAction: string
  /** 处置单主键；为空表示同步异常，前端必须禁用动作。 */
  riskId: string | null
  status: string
  statusLabel: string
  disposerName: string
  dueAt: string
  dueText: string
  dueTone: string
  roundNo: number
  recurrenceCount: number
}

export interface RiskLogView {
  logId: string
  action: string
  actionLabel: string
  fromStatusLabel: string
  toStatusLabel: string
  operatorName: string
  note: string
  evidenceUrls: string[]
  occurredAt: string
}
