#!/usr/bin/env node
/**
 * 列表分页静态门禁：业务视图/API 中不得新增大页固定值来冒充全量。
 * 允许 20 条以内的单页默认值；>=50 的 size/pageSize 必须经服务端分页或进入存量基线。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = [
  'src/domains',
  'src/views',
  'src/components/picker',
  'src/components/finance',
  'src/components/customer'
].map((item) => path.join(root, item))
const baselinePath = path.join(root, '.pagination-baseline.json')
const LIMIT = 50
const patterns = [
  /\bsize\s*:\s*(\d{2,4})\b/g,
  /\b(?:pageSize|PAGE_SIZE|PAGE_LIMIT)\b\s*[:=]\s*(\d{2,4})\b/g,
  /\bMath\.min\s*\([^,\n]+,\s*(\d{2,4})\s*\)/g
]

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(full)
    return /\.(vue|ts)$/.test(entry.name) ? [full] : []
  })
}

function findings() {
  const result = new Map()
  for (const file of sourceRoots.flatMap(walk)) {
    const relative = path.relative(root, file)
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) return
      for (const pattern of patterns) {
        pattern.lastIndex = 0
        for (const match of line.matchAll(pattern)) {
          const value = Number(match[1])
          if (!Number.isFinite(value) || value < LIMIT) continue
          const key = `${relative}:${value}`
          const current = result.get(key) ?? { key, file: relative, value, count: 0, lines: [] }
          current.count += 1
          current.lines.push(index + 1)
          result.set(key, current)
        }
      }
    })
  }
  return [...result.values()].sort((left, right) => left.key.localeCompare(right.key))
}

const current = findings()
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {}
const violations = current.filter((item) => item.count > (baseline[item.key] ?? 0))
const resolved = Object.entries(baseline).filter(([key]) => !current.some((item) => item.key === key))

if (process.argv.includes('--write')) {
  const next = Object.fromEntries(current.map((item) => [item.key, item.count]))
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`已更新 ${path.relative(root, baselinePath)}：${current.length} 类固定大页调用，共 ${current.reduce((sum, item) => sum + item.count, 0)} 处。`)
  process.exit(0)
}

console.log(`列表分页门禁：当前 ${current.length} 类 / ${current.reduce((sum, item) => sum + item.count, 0)} 处存量固定大页调用。`)
if (resolved.length) console.log(`已清理 ${resolved.length} 类基线项，请运行 --write 收缩基线。`)
if (violations.length) {
  console.error('\n发现新增大页固定值（禁止合并）：')
  for (const item of violations) {
    console.error(`- ${item.file} 第 ${item.lines.join(', ')} 行：size=${item.value}，请改服务端分页/统计接口`)
  }
  process.exit(1)
}
console.log('通过：没有新增大页固定值。')
