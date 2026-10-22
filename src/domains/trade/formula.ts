/**
 * 工程量公式白名单校验（前端预检）。
 *
 * 依据 `ANS-BIZ-20261002-002` Q2：
 * P0 仅支持数字、正负号、小数点、`+ - * /`、中英文括号、百分比、
 * 同表单元格引用（`B12` / `$B$12` / `B2:B8`）与函数 `SUM / ROUND / MIN / MAX`；
 * 公式长度 ≤ 512。
 *
 * ⚠️ 前端只做**语法预检**，最终以服务端求值为准。
 */
const MAX_FORMULA_LENGTH = 512

const ALLOWED_FUNCTIONS = ['SUM', 'ROUND', 'MIN', 'MAX']

/** 明确不支持、且给出更友好提示的常见函数。 */
const UNSUPPORTED_FUNCTIONS = ['IF', 'VLOOKUP', 'XLOOKUP', 'INDEX', 'MATCH', 'SUMIF', 'COUNTIF', 'AVERAGE']

export interface FormulaCheck {
  ok: boolean
  /** 空公式视为"无公式"，合法 */
  empty: boolean
  error?: string
}

export function checkQuantityFormula(raw: string): FormulaCheck {
  const input = (raw ?? '').trim()
  if (!input) return { ok: true, empty: true }

  if (input.length > MAX_FORMULA_LENGTH) {
    return { ok: false, empty: false, error: `公式不能超过 ${MAX_FORMULA_LENGTH} 个字符` }
  }
  if (!input.startsWith('=')) {
    return { ok: false, empty: false, error: '公式需以 = 开头，例如 =F1*2' }
  }

  const body = input.slice(1).toUpperCase()

  for (const fn of UNSUPPORTED_FUNCTIONS) {
    if (new RegExp(`(^|[^A-Z])${fn}\\s*\\(`).test(body)) {
      return { ok: false, empty: false, error: `暂不支持函数 ${fn}；当前支持 ${ALLOWED_FUNCTIONS.join(' / ')}` }
    }
  }

  // 移除允许的构造后，不应再残留字母（残留即说明用了非白名单标识符）
  const withoutFunctions = ALLOWED_FUNCTIONS.reduce(
    (acc, fn) => acc.replace(new RegExp(`${fn}\\s*\\(`, 'g'), '('),
    body
  )
  // 单元格引用：可选的 $ + 列字母 + 可选的 $ + 行号（范围用 : 连接）
  const withoutRefs = withoutFunctions.replace(/\$?[A-Z]{1,3}\$?\d{1,7}/g, '0')
  const residual = withoutRefs.replace(/[\d+\-*/().%（）\s:,]/g, '')

  if (residual.length > 0) {
    return { ok: false, empty: false, error: `包含不支持的写法：${residual.slice(0, 12)}（仅支持数字、+ - * /、括号、%、单元格引用与 ${ALLOWED_FUNCTIONS.join('/')}）` }
  }
  if (/[+\-*/]\s*$/.test(input)) {
    return { ok: false, empty: false, error: '公式以运算符结尾，不完整' }
  }
  if ((input.match(/\(/g) ?? []).length !== (input.match(/\)/g) ?? []).length
      || (input.match(/（/g) ?? []).length !== (input.match(/）/g) ?? []).length) {
    return { ok: false, empty: false, error: '括号不匹配' }
  }
  return { ok: true, empty: false }
}
