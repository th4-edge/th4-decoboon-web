/** 客户与画像的枚举字典（值与后端枚举一致，禁止前端自造新值）。 */

export interface Option { value: string; label: string }

export const GENDER_OPTIONS: Option[] = [
  { value: 'M', label: '男' },
  { value: 'F', label: '女' }
]

export const CUSTOMER_SOURCE_OPTIONS: Option[] = [
  { value: 'Lead', label: '主动线索' },
  { value: 'Referral', label: '老客户转介绍' },
  { value: 'WalkIn', label: '到店/自然进店' },
  { value: 'OldCustomer', label: '老客户复购' },
  { value: 'Video', label: '短视频/直播' },
  { value: 'BatchPhone', label: '批量电话' },
  { value: 'Other', label: '其他' }
]

export const PORTRAIT_OPTIONS: Record<string, Option[]> = {
  decisionRole: [
    { value: 'Self', label: '本人决策' },
    { value: 'Couple', label: '夫妻共同' },
    { value: 'Parents', label: '父母决策' },
    { value: 'Children', label: '子女决策' },
    { value: 'Unknown', label: '未知' }
  ],
  purpose: [
    { value: 'FirstHome', label: '首套自住' },
    { value: 'Improve', label: '改善居住' },
    { value: 'Wedding', label: '婚房' },
    { value: 'SchoolDistrict', label: '学区' },
    { value: 'Investment', label: '投资' },
    { value: 'Partial', label: '局部改造' }
  ],
  houseCondition: [
    { value: 'Rough', label: '毛坯' },
    { value: 'Old', label: '旧房' },
    { value: 'Refined', label: '精装' },
    { value: 'Pending', label: '待定' }
  ],
  startWindow: [
    { value: 'WithinOneMonth', label: '一个月内' },
    { value: 'OneToThreeMonths', label: '1-3 个月' },
    { value: 'ThreeToSixMonths', label: '3-6 个月' },
    { value: 'HalfYearPlus', label: '半年以上' },
    { value: 'Undecided', label: '未确定' }
  ],
  style: [
    { value: 'Modern', label: '现代简约' },
    { value: 'Luxury', label: '轻奢' },
    { value: 'NewChinese', label: '新中式' },
    { value: 'Cream', label: '奶油风' },
    { value: 'Wood', label: '原木风' },
    { value: 'Industrial', label: '工业风' },
    { value: 'Undecided', label: '未确定' }
  ],
  eco: [
    { value: 'Elder', label: '老人同住' },
    { value: 'Infant', label: '婴幼儿' },
    { value: 'Pregnant', label: '孕妇' },
    { value: 'None', label: '无特殊要求' }
  ],
  household: [
    { value: 'Single', label: '单身' },
    { value: 'Couple', label: '夫妻二人' },
    { value: 'ThreePlus', label: '三口及以上' },
    { value: 'ThreeGenerations', label: '三代同堂' },
    { value: 'Unknown', label: '未知' }
  ],
  payment: [
    { value: 'Full', label: '全款' },
    { value: 'Installment', label: '分期' },
    { value: 'Loan', label: '贷款' },
    { value: 'Unknown', label: '未知' }
  ],
  competitor: [
    { value: 'None', label: '未对比' },
    { value: 'ComparingOneTwo', label: '对比 1-2 家' },
    { value: 'ComparingThreePlus', label: '对比 3 家以上' },
    { value: 'ChosenOther', label: '已选其他' }
  ]
}

export const PORTRAIT_CONCERN_OPTIONS: Option[] = [
  { value: 'Price', label: '价格' },
  { value: 'Duration', label: '工期' },
  { value: 'Quality', label: '质量' },
  { value: 'Eco', label: '环保' },
  { value: 'AfterSales', label: '售后' }
]

export const PORTRAIT_LABELS: Record<string, string> = {
  decisionRole: '决策角色',
  purpose: '装修目的',
  houseCondition: '房屋状况',
  startWindow: '开工窗口',
  style: '风格偏好',
  eco: '环保要求',
  household: '家庭结构',
  payment: '付款方式',
  competitor: '竞品对比'
}

export function optionLabel(options: Option[], value: string | undefined | null): string {
  if (!value) return '—'
  return options.find((item) => item.value === value)?.label ?? value
}
