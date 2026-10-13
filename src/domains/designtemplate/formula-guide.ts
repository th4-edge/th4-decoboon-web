/**
 * 设计模版公式教学与预览。
 *
 * 事实源：BR-040 §2、OBJ-005 §公式变量、ANS-BIZ-20261009-001 §4、DEC-062（区域面积/周长实测录入）、
 * DEC-064（模版参考实测值仅用于校验、不进入工程量与金额；A/P/CP/WP 取实测语义，不得回退到长宽派生）。
 * 本文件只负责“解释 + 预览”，正式工程量与金额一律以服务端重算为准（BR-023 / DEC-025）。
 */
import type { DesignItemType } from '@/domains/design/model'

export type FormulaVariableKind = 'input' | 'derived' | 'aggregate'

/** 变量分组：core = 面积/周长及其派生（最常用）；input = 区域输入；snapshot = 量房快照（不能进公式）。 */
export type FormulaVariableGroup = 'core' | 'input' | 'snapshot'

export interface FormulaVariable {
  symbol: string
  name: string
  /** 分组（常用 / 一般输入 / 量房快照），决定公式助手的展示顺序。 */
  group: FormulaVariableGroup
  /** 是否进入「常用变量」快捷插入区（面积、周长及其派生）。 */
  quick?: boolean
  summary: string
  meaning: string
  unit: string
  /** 0=数量/常量，1=长度，2=面积。 */
  dimension: number
  kind: FormulaVariableKind
  source: string
  howToUse: string
  example: string
  notReady: string
  commonMistake: string
  insertText: string
  available: boolean
}

export interface FormulaFunction {
  name: string
  signature: string
  summary: string
  description: string
  params: string
  example: string
  available: boolean
  /** 点击插入时写入公式栏的文本；缺省用 `NAME()`。 */
  insertText?: string
  note?: string
}

export interface FormulaScenario {
  id: string
  title: string
  when: string
  unitHint: string
  formula: string
  variables: string[]
  explain: string
  caution?: string
  types: DesignItemType[]
}

export interface FormulaErrorInfo {
  title: string
  detail: string
  action: string
}

export const FORMULA_VARIABLES: FormulaVariable[] = [
  {
    symbol: 'A',
    name: '面积（区域实测面积）',
    group: 'core',
    quick: true,
    summary: '区域地面净面积，最常用的公式变量。',
    meaning: '实测量房后按 CAD 计算得出的区域地面净面积，是本区域面积类分项的基数；不是套内面积，也不是建筑面积。',
    unit: '㎡',
    dimension: 2,
    kind: 'input',
    source: '设计师实测录入（CAD 计算结果）',
    howToUse: '地面铺贴 =A；顶面用 =CP（与 A 同值）；防水 =A+P*WR；全屋共享项用 =SUM(A)。',
    example: '主卧实测 A=15.30㎡。',
    notReady: '未录入实测面积时该分项显示「待补尺寸」，不会按 0 计算。',
    commonMistake: '用开间 × 进深 推算面积；把 A 当套内面积或建筑面积；区域分项误用其它区域的 A。',
    insertText: 'A',
    available: true
  },
  {
    symbol: 'P',
    name: '周长（区域实测周长）',
    group: 'core',
    quick: true,
    summary: '区域净周长，踢脚线与墙面的基数。',
    meaning: '实测量房后按 CAD 计算的内墙净周长，是踢脚线、墙面展开面积与防水上返的基数。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '设计师实测录入（CAD 计算结果）',
    howToUse: '踢脚线 =P-DW；墙面展开 =P*H-DA-WA（或直接 =WP）；防水上返 P*WR。',
    example: '主卧实测 P=16.20m。',
    notReady: '未录入实测周长时该分项显示「待补尺寸」，不会按 0 计算。',
    commonMistake: '用 2×(开间+进深) 代替实测周长；凹凸、包管、飘窗处会少算。',
    insertText: 'P',
    available: true
  },
  {
    symbol: 'CP',
    name: '顶面面积',
    group: 'core',
    quick: true,
    summary: '区域顶面面积，数值等于 A。',
    meaning: 'A 的顶面语义别名，推荐顶面类分项使用 CP，让公式读起来更清楚。',
    unit: '㎡',
    dimension: 2,
    kind: 'input',
    source: '跟随区域实测面积 A',
    howToUse: '顶面乳胶漆、吊顶基层等。',
    example: '主卧实测 A=15.30㎡，则 CP=15.30㎡。',
    notReady: '未录入实测面积时待补尺寸。',
    commonMistake: '以为 CP 和 A 是两个不同面积；两者数值永远相同。',
    insertText: 'CP',
    available: true
  },
  {
    symbol: 'WP',
    name: '墙面净面积',
    group: 'core',
    quick: true,
    summary: '四面墙展开后扣掉门窗洞的净面积。',
    meaning: '墙面类分项的推荐变量；等价于 P*H-DA-WA。',
    unit: '㎡',
    dimension: 2,
    kind: 'derived',
    source: '系统用实测 P × 层高 H 扣门窗洞计算',
    howToUse: '墙面乳胶漆、墙纸、墙布、墙砖。',
    example: '主卧实测 P=16.20、H=2.80、DA=1.89、WA=2.70，WP=40.77㎡。',
    notReady: '未录入实测周长或未填层高时待补；DA/WA 未填时 WP 按 0 扣减。',
    commonMistake: '把 WP 当建筑面积，或忘记门窗洞扣减。',
    insertText: 'WP',
    available: true
  },
  {
    symbol: 'H',
    name: '层高',
    group: 'input',
    quick: true,
    summary: '地面到顶面的高度。',
    meaning: '区域净高，用于墙面面积和防水上返高度的计算。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '量房 / 设计师输入',
    howToUse: '墙面乳胶漆、墙砖、防水上返等。',
    example: '主卧 H=2.80m。',
    notReady: '未填时 WP 待补尺寸；直接引用 H 的公式也待补。',
    commonMistake: '用吊顶后的完成面高度代替结构层高，导致墙面面积少算。',
    insertText: 'H',
    available: true
  },
  {
    symbol: 'DW',
    name: '门洞总宽',
    group: 'input',
    summary: '该区域所有门洞宽度之和。',
    meaning: '用于踢脚线等按周长扣减门洞的长度类分项。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '设计师输入',
    howToUse: '踢脚线 = P - DW。',
    example: '两个门各 0.90m，则 DW=1.80m。',
    notReady: '未填时引用 DW 的公式显示「待补尺寸」，不会按 0 计算。',
    commonMistake: '把 DW（门洞宽）和 DA（门洞面积）混用。',
    insertText: 'DW',
    available: true
  },
  {
    symbol: 'DA',
    name: '门洞总面积',
    group: 'input',
    summary: '该区域所有门洞面积之和。',
    meaning: '用于墙面展开面积的门洞扣减。',
    unit: '㎡',
    dimension: 2,
    kind: 'input',
    source: '设计师输入',
    howToUse: '墙面净面积扣减；WP 会自动扣减。',
    example: '门宽 0.90m、高 2.10m，则 DA=1.89㎡。',
    notReady: '直接引用 DA 的公式待补尺寸；WP 计算时会把未填 DA 按 0 处理。',
    commonMistake: '把门洞总宽 DW 当面积填进 DA。',
    insertText: 'DA',
    available: true
  },
  {
    symbol: 'WA',
    name: '窗洞总面积',
    group: 'input',
    summary: '该区域所有窗洞面积之和。',
    meaning: '用于墙面展开面积的窗洞扣减。',
    unit: '㎡',
    dimension: 2,
    kind: 'input',
    source: '设计师输入',
    howToUse: '墙面净面积扣减；WP 会自动扣减。',
    example: '飘窗 1.80m×1.50m，则 WA=2.70㎡。',
    notReady: '直接引用 WA 的公式待补尺寸；WP 计算时会把未填 WA 按 0 处理。',
    commonMistake: '把窗洞面积填成窗洞宽度。',
    insertText: 'WA',
    available: true
  },
  {
    symbol: 'WR',
    name: '防水上返高度',
    group: 'input',
    summary: '防水沿墙上返的高度。',
    meaning: '卫生间、厨房等防水面积的上返部分高度。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '设计师输入',
    howToUse: '防水 = A + P*WR。',
    example: '卫生间 WR=0.30m。',
    notReady: '未填时引用 WR 的防水公式待补尺寸。',
    commonMistake: '把上返高度当成上返面积；上返面积是 P*WR。',
    insertText: 'WR',
    available: true
  },
  {
    symbol: 'N',
    name: '同型区域数量',
    group: 'input',
    summary: '同型区域的份数，如次卧 ×2。',
    meaning: '用于同型区域批量或按数量计的分项；默认 1。',
    unit: '个',
    dimension: 0,
    kind: 'input',
    source: '模版定义',
    howToUse: '同型区域数量、按数量计的分项。',
    example: '次卧 ×2，则 N=2。',
    notReady: '默认 1，不会「未就绪」。',
    commonMistake: '把区域数量 N 当成区域面积。',
    insertText: 'N',
    available: true
  },
  {
    symbol: 'L',
    name: '开间（量房快照）',
    group: 'snapshot',
    summary: '现场粗测的长边尺寸，只作记录与对照。',
    meaning: '量房现场粗测的开间/长度。区域多为不规则形状，长宽不能用来推算面积或周长。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '现场量房快照（非工程量依据）',
    howToUse: '不能在公式里使用；工程量请用实测 A / P / CP / WP。',
    example: '主卧现场粗测 L=3.60m，仅作记录。',
    notReady: '量房快照不参与工程量计算。',
    commonMistake: '用开间 × 进深 推算面积、用 2×(开间+进深) 推算周长——不规则房间会系统性偏小。',
    insertText: 'L',
    available: false
  },
  {
    symbol: 'W',
    name: '进深（量房快照）',
    group: 'snapshot',
    summary: '现场粗测的进深尺寸，只作记录与对照。',
    meaning: '量房现场粗测的进深。与开间同属快照，不是工程量依据。',
    unit: 'm',
    dimension: 1,
    kind: 'input',
    source: '现场量房快照（非工程量依据）',
    howToUse: '不能在公式里使用；工程量请用实测 A / P / CP / WP。',
    example: '主卧现场粗测 W=4.20m，仅作记录。',
    notReady: '量房快照不参与工程量计算。',
    commonMistake: '把套内面积或建筑面积直接当进深，或据此推算工程量。',
    insertText: 'W',
    available: false
  }
]

/** 「常用变量」快捷插入区：面积、周长及其派生，优先展示（改版新增的 A/P 必须一眼可见）。 */
export const QUICK_VARIABLES: FormulaVariable[] = FORMULA_VARIABLES.filter((variable) => variable.quick && variable.available)

const GROUP_LABELS: Record<FormulaVariableGroup, { label: string; hint: string }> = {
  core: { label: '常用变量（面积 / 周长）', hint: '区域分项优先用这四个；顶面用 CP，墙面用 WP。' },
  input: { label: '区域输入变量', hint: '在区域骨架里录入后即可在公式中引用。' },
  snapshot: { label: '量房快照（不能进公式）', hint: '只作记录与对照，不能用来推算工程量。' }
}

/** 按分组返回变量，保证公式助手与变量的展示口径一致。 */
export function variableGroups(): Array<{ key: FormulaVariableGroup; label: string; hint: string; variables: FormulaVariable[] }> {
  const order: FormulaVariableGroup[] = ['core', 'input', 'snapshot']
  return order.map((key) => ({
    key,
    label: GROUP_LABELS[key].label,
    hint: GROUP_LABELS[key].hint,
    variables: FORMULA_VARIABLES.filter((variable) => variable.group === key)
  }))
}

export const FORMULA_FUNCTIONS: FormulaFunction[] = [
  {
    name: 'SUM',
    signature: 'SUM(A) / SUM(P) / SUM(x, y, ...)',
    summary: '把多个同量纲的值相加。',
    description: '全屋共享项用 SUM(A) 汇总所有区域面积，用 SUM(P) 汇总所有区域周长；普通分项也可以相加同量纲变量。',
    params: '1 个及以上参数，所有参数必须同量纲。',
    example: '=SUM(A)*0.5',
    available: true,
    note: 'SUM(A) 只用于全屋共享项；区域分项请直接用 A。'
  },
  {
    name: 'MIN',
    signature: 'MIN(x, y, ...)',
    summary: '取最小值。',
    description: '用于需要保守取值的场景，例如“墙面和顶面取较小值”。',
    params: '1 个及以上同量纲参数。',
    example: '=MIN(WP, CP)',
    available: true
  },
  {
    name: 'MAX',
    signature: 'MAX(x, y, ...)',
    summary: '取最大值。',
    description: '用于取较大值的场景。',
    params: '1 个及以上同量纲参数。',
    example: '=MAX(A, 5)',
    available: true
  },
  {
    name: 'ROUND',
    signature: 'ROUND(x, n)',
    summary: '把 x 四舍五入到 n 位小数。',
    description: '用于控制中间结果精度；工程量最终仍会统一保留 3 位小数。',
    params: '必须 2 个参数；n 为整数。',
    example: '=ROUND(A*1.05, 2)',
    available: true
  },
  {
    name: 'COUNT',
    signature: 'COUNT(room)',
    summary: '统计区域数量。',
    description: '全屋共享项返回当前模版版本的全部区域数；区域分项返回 1（当前区域）。只支持 COUNT(room)，不支持 COUNT(A) 等写法。',
    params: '只支持 COUNT(room)。',
    example: '=COUNT(room)*50',
    available: true,
    insertText: 'COUNT(room)',
    note: 'COUNT(room) 返回区域数量；系数 50 只是示例，必须按企业实际定价确认。'
  }
]

export const FORMULA_SCENARIOS: FormulaScenario[] = [
  {
    id: 'floor',
    title: '地面铺贴',
    when: '卧室、客厅、餐厅、厨房、卫生间、阳台的地面。',
    unitHint: '㎡',
    formula: '=A',
    variables: ['A'],
    explain: 'A 是当前区域的实测面积（设计师按 CAD 录入），只取本区域，不取套内面积或建筑面积，也不用开间 × 进深 推算。',
    types: ['construction', 'material']
  },
  {
    id: 'skirting',
    title: '踢脚线',
    when: '沿墙脚一圈，并且需要扣门洞。',
    unitHint: 'm',
    formula: '=P-DW',
    variables: ['P', 'DW'],
    explain: 'P 是区域实测周长，DW 是所有门洞宽度之和；结果是踢脚线长度。',
    types: ['construction', 'material']
  },
  {
    id: 'wall-paint',
    title: '墙面乳胶漆',
    when: '四面墙展开，需要扣门窗洞。',
    unitHint: '㎡',
    formula: '=WP',
    variables: ['WP', 'P', 'H', 'DA', 'WA'],
    explain: 'WP 等价于 P*H-DA-WA；推荐直接写 =WP，避免手抄公式出错。',
    types: ['construction', 'material']
  },
  {
    id: 'ceiling',
    title: '顶面乳胶漆',
    when: '顶面满刷、无造型跌级。',
    unitHint: '㎡',
    formula: '=CP',
    variables: ['CP', 'A'],
    explain: 'CP 与 A 数值相同，顶面用 CP 读起来更清楚。',
    types: ['construction', 'material']
  },
  {
    id: 'bathroom-waterproof',
    title: '卫生间防水',
    when: '地面防水 + 墙面按上返高度。',
    unitHint: '㎡',
    formula: '=A+P*WR',
    variables: ['A', 'P', 'WR'],
    explain: 'A 是区域实测面积（地面部分），P*WR 是沿墙上返面积；WR 是上返高度。',
    types: ['construction']
  },
  {
    id: 'kitchen-tile',
    title: '厨房墙地砖',
    when: '墙砖 + 地砖合计，且墙砖按满墙计算。',
    unitHint: '㎡',
    formula: '=A+WP',
    variables: ['A', 'WP'],
    explain: 'A 是区域实测面积（地砖部分），WP 是扣门窗后的墙砖面积。',
    caution: '不是所有厨房都按满墙贴砖；先确认工艺再使用。',
    types: ['construction', 'material']
  },
  {
    id: 'whole-house-protection',
    title: '全屋成品保护',
    when: '全屋共享项，按区域面积的一定系数估算。',
    unitHint: '㎡',
    formula: '=SUM(A)*0.5',
    variables: ['SUM', 'A'],
    explain: 'SUM(A) 汇总所有区域面积，0.5 是示例系数。',
    caution: '0.5 是示例系数，必须按企业工艺确认，不得当行业默认。',
    types: ['construction']
  },
  {
    id: 'door',
    title: '门（固定数量）',
    when: '一樘门或固定数量项。',
    unitHint: '樘',
    formula: '固定数量 1',
    variables: [],
    explain: '计数单位不能使用专业变量公式；直接在固定数量里填 1。',
    types: ['material']
  },
  {
    id: 'water-electricity',
    title: '水电改造',
    when: '全屋共享项，按面积估算。',
    unitHint: '㎡',
    formula: '=SUM(A)*0.35',
    variables: ['SUM', 'A'],
    explain: 'SUM(A) 汇总所有区域面积，0.35 是示例系数。',
    caution: '0.35 是示例系数，必须由企业确认；确认前不得作为默认值发布。',
    types: ['construction']
  },
  {
    id: 'count-room-fee',
    title: '按区域数计费（全屋共享）',
    when: '全屋共享项，每个区域收一次固定费用。',
    unitHint: '项 / 个 / 处 / 套',
    formula: '=COUNT(room)*50',
    variables: ['COUNT(room)'],
    explain: 'COUNT(room) 返回模版区域数；50 是示例单价，需按企业定价确认。',
    caution: '50 是示例系数，必须由企业确认，不得当行业默认；计数单位不能使用面积/长度变量。',
    types: ['construction', 'material']
  }
]

export const FORMULA_ERRORS: Record<string, FormulaErrorInfo> = {
  TEMPLATE_FORMULA_EMPTY: { title: '还没写公式', detail: '这个分项既没有公式，也没有固定数量。', action: '从推荐公式选一个，或填写固定数量。' },
  TEMPLATE_FORMULA_TOO_LONG: { title: '公式太长', detail: '公式超过 512 字。', action: '拆成更短的计算，或去掉不必要的括号。' },
  TEMPLATE_CELL_REFERENCE_FORBIDDEN: { title: '不能用单元格位置', detail: '模版公式不允许 F2、AB12 这类表格位置。', action: '换成专业变量，如 =A、=P-DW。' },
  TEMPLATE_VARIABLE_UNKNOWN: { title: '变量不认识', detail: '公式里出现了系统不认识的字母或单词。', action: '从变量字典点击插入，不要手打。' },
  TEMPLATE_FUNCTION_UNKNOWN: { title: '函数不可用', detail: '公式用了当前引擎不支持的函数。', action: '改用 SUM / MIN / MAX / ROUND / COUNT(room)。' },
  TEMPLATE_FORMULA_SYNTAX: { title: '公式写法有问题', detail: '括号、运算符或函数参数不完整。', action: '检查括号是否成对、函数参数是否齐全。' },
  TEMPLATE_FORMULA_DIVIDE_ZERO: { title: '除数不能是 0', detail: '公式里有除以 0 的位置。', action: '调整公式或改固定数量。' },
  TEMPLATE_FORMULA_NOT_POSITIVE: { title: '结果必须大于 0', detail: '当前公式算出来是 0 或负数。', action: '检查尺寸是否填反、扣减项是否过大。' },
  TEMPLATE_SIZE_MISSING: { title: '尺寸还没填', detail: '公式依赖的某个尺寸为空。', action: '到左侧区域面板补尺寸。' },
  TEMPLATE_UNIT_REQUIRED: { title: '分项没有计价单位', detail: '报价项目库条目的单位为空。', action: '先在报价项目库补全单位。' },
  TEMPLATE_UNIT_DIMENSION_MISMATCH: { title: '公式和单位对不上', detail: '公式算出来的量纲与分项单位不一致。', action: '面积单位用面积公式，长度单位用长度公式；系统不自动换算。' }
}

export interface FormulaRoomLike {
  roomKey: string
  name: string
  /** 量房快照：只作展示，不参与工程量预览（DEC-062）。 */
  length?: number | null
  width?: number | null
  height?: number | null
  /** 实测面积（㎡）：设计师按 CAD 录入，预览的唯一面积来源。 */
  area?: number | null
  /** 实测周长（m）：设计师按 CAD 录入。 */
  perimeter?: number | null
  /**
   * 参考实测面积/周长（模版层专用，DEC-064）：房屋实测值缺失时用于模版内公式校验，
   * 预览结果会标记 `usedReference`，且不得作为工程量基数或进入报价金额。
   */
  referenceArea?: number | null
  referencePerimeter?: number | null
  doorWidthTotal?: number | null
  doorAreaTotal?: number | null
  windowAreaTotal?: number | null
  wallRise?: number | null
  count?: number | null
}

export type FormulaPreviewStatus = 'ready' | 'fixed' | 'missing' | 'error' | 'empty'

export interface FormulaPreview {
  status: FormulaPreviewStatus
  value?: number
  dimension?: number
  unitHint?: string
  usedVariables: string[]
  missingVariables: string[]
  /** 结果是否用到模版层「参考实测值」（DEC-064）：参考值仅供校验，不进入工程量与金额。 */
  usedReference?: boolean
  code?: string
  message?: string
}

interface Dimensioned {
  value: number
  dim: number
}

class FormulaError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const KNOWN_VARIABLES = new Set(FORMULA_VARIABLES.map((variable) => variable.symbol))
const KNOWN_FUNCTIONS = new Set(FORMULA_FUNCTIONS.map((fn) => fn.name))
/**
 * 变量未就绪时给设计师的「需要先准备什么」提示。
 *
 * DEC-062 / DEC-064：`A/P/CP/WP` 取区域**实测**语义（面积/周长只能由设计师 CAD 录入），
 * `L/W` 是量房快照、不在公式命名空间内，因此这里**不得**再回退到长宽派生（线上曾误报「缺 L、W」）。
 */
const REQUIRED_INPUT_LABELS: Record<string, string[]> = {
  A: ['区域实测面积 A'],
  CP: ['区域实测面积 A'],
  P: ['区域实测周长 P'],
  WP: ['区域实测周长 P', '层高 H'],
  H: ['层高 H'],
  DW: ['门洞总宽 DW'],
  DA: ['门洞总面积 DA'],
  WA: ['窗洞总面积 WA'],
  WR: ['上返高度 WR']
}
const AREA_UNITS = new Set(['㎡', '片'])
const LENGTH_UNITS = new Set(['m', 'cm'])
const COUNT_UNITS = new Set(['个', '项', '处', '套', '户', '樘', '块', '根', '扇', '台', '支', '格', '步'])

function normalize(formula: string): string {
  const trimmed = (formula ?? '').trim()
  return trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed
}

function identifiers(formula: string): Array<{ name: string; nextChar: string }> {
  const result: Array<{ name: string; nextChar: string }> = []
  const matcher = /[A-Za-z_][A-Za-z0-9_]*/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(formula)) !== null) {
    const after = formula.slice(matcher.lastIndex).trimStart()
    result.push({ name: match[0].toUpperCase(), nextChar: after.slice(0, 1) })
  }
  return result
}

function usedVariables(formula: string): string[] {
  const used = identifiers(formula)
    .filter((entry) => KNOWN_VARIABLES.has(entry.name))
    .map((entry) => entry.name)
  return [...new Set(used)]
}

interface RoomVariables {
  values: Map<string, Dimensioned>
  /** 是否用到了模版层参考实测值（DEC-064）：用到即必须在前端标注「按参考值」，且不得当作工程量基数。 */
  usedReference: boolean
}

function variablesOfRoom(room: FormulaRoomLike | undefined): RoomVariables {
  const map = new Map<string, Dimensioned>()
  if (!room) return { values: map, usedReference: false }
  const put = (key: string, value: number | null | undefined, dim: number) => {
    if (value !== null && value !== undefined && Number.isFinite(value)) map.set(key, { value, dim })
  }
  // DEC-062：L/W 是量房快照，不进入变量表；面积与周长只取实测录入值。
  put('H', room.height, 1)
  put('DW', room.doorWidthTotal, 1)
  put('DA', room.doorAreaTotal, 2)
  put('WA', room.windowAreaTotal, 2)
  put('WR', room.wallRise, 1)
  map.set('N', { value: room.count ?? 1, dim: 0 })

  // DEC-064：模版层没有房屋实测值，可用「参考实测值」做模版内公式校验；
  // 实测值优先，参考值只作兜底并标记来源，绝不进入工程量与金额。
  const area = room.area ?? room.referenceArea ?? null
  const perimeter = room.perimeter ?? room.referencePerimeter ?? null
  const areaFromReference =
    (room.area === null || room.area === undefined) && room.referenceArea !== null && room.referenceArea !== undefined
  const perimeterFromReference =
    (room.perimeter === null || room.perimeter === undefined) &&
    room.referencePerimeter !== null &&
    room.referencePerimeter !== undefined
  const usedReference = areaFromReference || perimeterFromReference

  put('A', area, 2)
  put('CP', area, 2)
  put('P', perimeter, 1)
  const perimeterValue = map.get('P')
  const height = map.get('H')
  if (perimeterValue && height) {
    const walls = perimeterValue.value * height.value - (map.get('DA')?.value ?? 0) - (map.get('WA')?.value ?? 0)
    map.set('WP', { value: walls, dim: 2 })
  }
  return { values: map, usedReference }
}

function variablesOfWholeHouse(rooms: FormulaRoomLike[]): RoomVariables {
  const map = new Map<string, Dimensioned>()
  if (!rooms.length) return { values: map, usedReference: false }
  let area = 0
  let perimeter = 0
  let walls = 0
  let areaReady = true
  let perimeterReady = true
  let wallsReady = true
  let usedReference = false
  for (const room of rooms) {
    const { values: variables, usedReference: roomReference } = variablesOfRoom(room)
    if (roomReference) usedReference = true
    if (!variables.has('A')) areaReady = false
    else area += variables.get('A')!.value
    if (!variables.has('P')) perimeterReady = false
    else perimeter += variables.get('P')!.value
    if (!variables.has('WP')) wallsReady = false
    else walls += variables.get('WP')!.value
  }
  if (areaReady) {
    map.set('A', { value: area, dim: 2 })
    map.set('CP', { value: area, dim: 2 })
  }
  if (perimeterReady) map.set('P', { value: perimeter, dim: 1 })
  if (wallsReady) map.set('WP', { value: walls, dim: 2 })
  map.set('N', { value: 1, dim: 0 })
  return { values: map, usedReference }
}

function expectedDimension(unit: string | undefined): number | undefined {
  if (!unit) return undefined
  if (AREA_UNITS.has(unit)) return 2
  if (LENGTH_UNITS.has(unit)) return 1
  if (COUNT_UNITS.has(unit)) return 0
  return undefined
}

class DimensionParser {
  private position = 0
  constructor(private readonly source: string, private readonly variables: Map<string, Dimensioned>) {}

  parseAll(): Dimensioned {
    const value = this.expression()
    this.skipSpace()
    if (this.position < this.source.length) {
      throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', `公式存在无法解析的内容：${this.source.slice(this.position)}`)
    }
    return value
  }

  private skipSpace(): void {
    while (this.position < this.source.length && /\s/.test(this.source[this.position]!)) this.position += 1
  }

  private eat(char: string): boolean {
    this.skipSpace()
    if (this.source[this.position] === char) {
      this.position += 1
      return true
    }
    return false
  }

  private expression(): Dimensioned {
    let value = this.term()
    while (true) {
      this.skipSpace()
      if (this.eat('+')) {
        const right = this.term()
        this.requireSameDimension(value, right, '公式加减项维度不一致，禁止自动换算')
        value = { value: value.value + right.value, dim: value.dim }
      } else if (this.eat('-')) {
        const right = this.term()
        this.requireSameDimension(value, right, '公式加减项维度不一致，禁止自动换算')
        value = { value: value.value - right.value, dim: value.dim }
      } else {
        return value
      }
    }
  }

  private term(): Dimensioned {
    let value = this.factor()
    while (true) {
      this.skipSpace()
      if (this.eat('*')) {
        const right = this.factor()
        value = { value: value.value * right.value, dim: value.dim + right.dim }
      } else if (this.eat('/')) {
        const right = this.factor()
        if (right.value === 0) throw new FormulaError('TEMPLATE_FORMULA_DIVIDE_ZERO', '工程量公式除数为 0')
        value = { value: value.value / right.value, dim: value.dim - right.dim }
      } else {
        return value
      }
    }
  }

  private factor(): Dimensioned {
    this.skipSpace()
    if (this.eat('+')) return this.factor()
    if (this.eat('-')) {
      const value = this.factor()
      return { value: -value.value, dim: value.dim }
    }
    if (this.eat('(')) {
      const value = this.expression()
      if (!this.eat(')')) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', '工程量公式括号不匹配')
      return value
    }
    if (this.position >= this.source.length) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', '工程量公式不完整')
    const current = this.source[this.position]!
    if (/\d/.test(current) || current === '.') return this.number()
    if (/[A-Za-z_]/.test(current)) return this.identifier()
    throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', `工程量公式存在非法字符：${current}`)
  }

  private number(): Dimensioned {
    const start = this.position
    while (this.position < this.source.length && /[\d.]/.test(this.source[this.position]!)) this.position += 1
    const text = this.source.slice(start, this.position)
    const value = Number(text)
    if (!Number.isFinite(value)) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', `工程量公式数字非法：${text}`)
    return { value, dim: 0 }
  }

  private identifier(): Dimensioned {
    const start = this.position
    while (this.position < this.source.length && /[A-Za-z0-9_]/.test(this.source[this.position]!)) this.position += 1
    const raw = this.source.slice(start, this.position)
    const name = raw.toUpperCase()
    this.skipSpace()
    if (this.eat('(')) return this.functionCall(name, raw)
    const variable = this.variables.get(name)
    if (!variable) {
      if (KNOWN_VARIABLES.has(name)) {
        throw new FormulaError('TEMPLATE_SIZE_MISSING', `「${name}」所需尺寸未填，暂不可计算`)
      }
      throw new FormulaError('TEMPLATE_VARIABLE_UNKNOWN', `未识别的专业变量：${raw}`)
    }
    return variable
  }

  private functionCall(name: string, raw: string): Dimensioned {
    if (!KNOWN_FUNCTIONS.has(name) || !FORMULA_FUNCTIONS.find((fn) => fn.name === name)?.available) {
      throw new FormulaError('TEMPLATE_FUNCTION_UNKNOWN', `未识别的函数：${raw}`)
    }
    const args: Dimensioned[] = []
    if (!this.eat(')')) {
      do {
        args.push(this.expression())
      } while (this.eat(','))
      if (!this.eat(')')) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', `函数 ${raw} 缺少右括号`)
    }
    if (name === 'COUNT') {
      throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', 'COUNT 只支持 COUNT(room)')
    }
    if (name === 'ROUND') {
      if (args.length !== 2) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', 'ROUND 需要 2 个参数')
      const [value, digits] = args
      if (!value || !digits || digits.dim !== 0) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', 'ROUND 的第二个参数必须是整数位数')
      const factor = 10 ** Math.trunc(digits.value)
      return { value: Math.round(value.value * factor) / factor, dim: value.dim }
    }
    if (!args.length) throw new FormulaError('TEMPLATE_FORMULA_SYNTAX', `${name} 至少需要 1 个参数`)
    const first = args[0]!
    for (const arg of args) this.requireSameDimension(first, arg, `${name} 的参数维度不一致，禁止自动换算`)
    const values = args.map((arg) => arg.value)
    const value = name === 'SUM' ? values.reduce((sum, item) => sum + item, 0)
      : name === 'MIN' ? Math.min(...values)
        : Math.max(...values)
    return { value, dim: first.dim }
  }

  private requireSameDimension(left: Dimensioned, right: Dimensioned, message: string): void {
    if (left.dim !== right.dim) throw new FormulaError('TEMPLATE_UNIT_DIMENSION_MISMATCH', message)
  }
}

function dependenciesOf(missing: string): string[] {
  return REQUIRED_INPUT_LABELS[missing] ?? [missing]
}

export function previewFormula(
  formula: string,
  room: FormulaRoomLike | undefined,
  rooms: FormulaRoomLike[],
  unit?: string
): FormulaPreview {
  const normalized = normalize(formula)
  if (!normalized) {
    return { status: 'empty', usedVariables: [], missingVariables: [] }
  }
  const usesCountRoom = /COUNT\s*\(\s*room\s*\)/i.test(normalized)
  // COUNT(room) 的语义：区域分项=1（当前区域），全屋共享项=模版区域数。
  const evalFormula = normalized.replace(/COUNT\s*\(\s*room\s*\)/gi, String(room ? 1 : rooms.length))
  if (/(^|[^A-Za-z0-9_])[A-Za-z]{1,3}\d{1,7}([^A-Za-z0-9_]|$)/.test(evalFormula)) {
    return { status: 'error', code: 'TEMPLATE_CELL_REFERENCE_FORBIDDEN', usedVariables: [], missingVariables: [] }
  }

  const parsedIdentifiers = identifiers(evalFormula)
  for (const entry of parsedIdentifiers) {
    if (entry.nextChar !== '(' && !KNOWN_VARIABLES.has(entry.name)) {
      return { status: 'error', code: 'TEMPLATE_VARIABLE_UNKNOWN', usedVariables: [], missingVariables: [] }
    }
    if (entry.nextChar === '(' && !KNOWN_FUNCTIONS.has(entry.name)) {
      return { status: 'error', code: 'TEMPLATE_FUNCTION_UNKNOWN', usedVariables: [], missingVariables: [] }
    }
  }

  const roomVariables = room ? variablesOfRoom(room) : variablesOfWholeHouse(rooms)
  const variables = roomVariables.values
  const usedReference = roomVariables.usedReference
  const used = usedVariables(evalFormula)
  const displayUsed = usesCountRoom ? [...used, 'COUNT(room)'] : used
  const missing = used.filter((name) => !variables.has(name))
  if (missing.length) {
    const required = [...new Set(missing.flatMap(dependenciesOf))]
    return { status: 'missing', usedVariables: displayUsed, missingVariables: required, usedReference }
  }

  const expected = expectedDimension(unit)
  if (expected === 0 && used.length) {
    return { status: 'error', code: 'TEMPLATE_UNIT_DIMENSION_MISMATCH', usedVariables: displayUsed, missingVariables: [], usedReference }
  }

  try {
    const result = new DimensionParser(evalFormula, variables).parseAll()
    if (result.value <= 0) {
      return { status: 'error', code: 'TEMPLATE_FORMULA_NOT_POSITIVE', usedVariables: displayUsed, missingVariables: [] }
    }
    if (expected !== undefined && expected > 0 && result.dim !== expected) {
      return { status: 'error', code: 'TEMPLATE_UNIT_DIMENSION_MISMATCH', usedVariables: displayUsed, missingVariables: [], usedReference }
    }
    return {
      status: 'ready',
      value: Math.round((result.value + Number.EPSILON) * 1000) / 1000,
      dimension: result.dim,
      usedVariables: displayUsed,
      missingVariables: [],
      usedReference
    }
  } catch (error) {
    if (error instanceof FormulaError) {
      return { status: 'error', code: error.code, message: error.message, usedVariables: used, missingVariables: [], usedReference }
    }
    return { status: 'error', code: 'TEMPLATE_FORMULA_SYNTAX', usedVariables: used, missingVariables: [], usedReference }
  }
}

export function previewFixedQuantity(quantity: number | undefined): FormulaPreview {
  if (quantity === undefined || quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
    return { status: 'empty', usedVariables: [], missingVariables: [] }
  }
  return { status: 'fixed', value: quantity, dimension: 0, usedVariables: [], missingVariables: [] }
}

export function formulaErrorMessage(code: string | undefined, fallback?: string): string {
  if (!code) return fallback ?? '公式暂不可确认，请检查后重试'
  const info = FORMULA_ERRORS[code]
  return info ? `${info.title}：${info.detail}${info.action ? ` ${info.action}` : ''}` : (fallback ?? '公式暂不可确认，请检查后重试')
}

export function scenarioForUnit(scenarios: FormulaScenario[], unit?: string): FormulaScenario[] {
  if (!unit) return scenarios
  return scenarios.filter((scenario) => scenario.unitHint === unit)
}
