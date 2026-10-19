/** Excel/表格粘贴与键盘单元格跳转工具（自 V2 设计报价表基线复制）。 */

export type SpreadsheetRow = string[]

export function parseSpreadsheetText(text: string): SpreadsheetRow[] {
  if (!text.trim()) return []
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(cleanCell))
    .filter((row) => row.some((cell) => cell !== ''))
}

export function clipboardRows(event: ClipboardEvent): SpreadsheetRow[] {
  return parseSpreadsheetText(event.clipboardData?.getData('text/plain') || '')
}

function cleanCell(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"')
  }
  return trimmed
}

export function toNumber(value: string | number | undefined | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/[¥￥,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

/** 焦点跳到下一行同列（没有则顺延下一格）；配合 `data-grid-cell/row/column` 使用。 */
export function nextGridCell(row: number, column: number): void {
  const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-grid-cell]'))
    .filter((cell) => cell.offsetParent !== null)
  if (!cells.length) return
  const current = cells.find((cell) => Number(cell.dataset.gridRow) === row && Number(cell.dataset.gridColumn) === column)
  if (!current) return
  const currentIndex = cells.indexOf(current)
  const sameColumn = cells.find((cell) => Number(cell.dataset.gridRow) > row && Number(cell.dataset.gridColumn) === column)
  const next = sameColumn || cells[Math.min(currentIndex + 1, cells.length - 1)]
  next?.focus()
  if (next instanceof HTMLInputElement) next.select()
}
