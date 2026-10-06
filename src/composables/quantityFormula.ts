export interface QuantityFormulaResult {
  valid: boolean
  value: number
  expression: string
  formatted: string
  error?: string
}

const MAX_EXPRESSION_LENGTH = 200
const QUANTITY_SCALE = 1000

function invalid(expression: string, error: string): QuantityFormulaResult {
  return { valid: false, value: 0, expression, formatted: '', error }
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * QUANTITY_SCALE) / QUANTITY_SCALE
}

export function formatQuantity(value?: number | null, precision = 3): string {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return ''
  const factor = 10 ** precision
  const rounded = Math.round((Number(value) + Number.EPSILON) * factor) / factor
  return String(rounded)
}

export function evaluateQuantityFormula(input: string | number | null | undefined): QuantityFormulaResult {
  const expression = String(input ?? '').trim()
  if (!expression) return invalid(expression, '请输入工程量或计算公式')
  if (expression.length > MAX_EXPRESSION_LENGTH) return invalid(expression, `计算公式不能超过 ${MAX_EXPRESSION_LENGTH} 个字符`)

  const source = expression
    .replace(/^=/, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .trim()

  if (!source) return invalid(expression, '计算公式不能为空')
  let position = 0

  function skipSpaces() {
    while (position < source.length && /\s/.test(source[position])) position += 1
  }

  function parseNumber(): number {
    skipSpaces()
    const start = position
    let dotCount = 0
    while (position < source.length) {
      const char = source[position]
      if (/\d/.test(char)) {
        position += 1
        continue
      }
      if (char === '.' && dotCount === 0) {
        dotCount += 1
        position += 1
        continue
      }
      break
    }
    if (position === start || source.slice(start, position) === '.') throw new Error('数字格式不正确')
    const value = Number(source.slice(start, position))
    if (!Number.isFinite(value)) throw new Error('数字格式不正确')
    return value
  }

  function parseFactor(): number {
    skipSpaces()
    if (source[position] === '+') {
      position += 1
      return parseFactor()
    }
    if (source[position] === '-') {
      position += 1
      return -parseFactor()
    }
    if (source[position] === '(') {
      position += 1
      const value = parseExpression()
      skipSpaces()
      if (source[position] !== ')') throw new Error('括号不匹配')
      position += 1
      return value
    }
    return parseNumber()
  }

  function parseTerm(): number {
    let value = parseFactor()
    while (true) {
      skipSpaces()
      const operator = source[position]
      if (operator !== '*' && operator !== '/') return value
      position += 1
      const right = parseFactor()
      if (operator === '*') value *= right
      else {
        if (right === 0) throw new Error('不能除以 0')
        value /= right
      }
    }
  }

  function parseExpression(): number {
    let value = parseTerm()
    while (true) {
      skipSpaces()
      const operator = source[position]
      if (operator !== '+' && operator !== '-') return value
      position += 1
      const right = parseTerm()
      value = operator === '+' ? value + right : value - right
    }
  }

  try {
    const value = parseExpression()
    skipSpaces()
    if (position !== source.length) throw new Error('包含不支持的字符')
    if (!Number.isFinite(value)) throw new Error('计算结果无效')
    if (value < 0) throw new Error('工程量不能小于 0')
    const rounded = roundQuantity(value)
    return {
      valid: true,
      value: rounded,
      expression,
      formatted: formatQuantity(rounded)
    }
  } catch (error) {
    return invalid(expression, error instanceof Error ? error.message : '计算公式不正确')
  }
}
