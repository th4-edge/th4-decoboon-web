/**
 * 求值「按角色静态化」的三份静态源，供治理门禁与报表共用。
 *
 * 为什么用 esbuild 求值而不是正则解析：
 * 正则解析 `routes.ts` 的路由组装（`workbenchArea(...)` / `...DESIGNER_FULL` / `sharedOf(role)`）
 * 会在重构时**静默漂移**——门禁猜错比门禁缺失更危险。这里直接打包成 CJS 后 require，拿到真值。
 *
 * 依赖：本地 `node_modules/.bin/esbuild`（vite 自带依赖）。缺失时**抛出**，由调用方转成门禁失败。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

export const ROLES = ['Boss', 'StoreManager', 'TeamLeader', 'Marketer', 'Designer', 'Pm', 'Finance']

/**
 * **锁定角色（Web 页面锁定不做）**——用户裁决 2026-10-11。
 *
 * 这些角色的 Web 页面是**冻结基线**：只允许缺陷修复，不得新增/改造页面、菜单项或首页卡片。
 * `menu` / `home` 是冻结基线的数量（菜单项数 / 首页卡片数），门禁据此提示"有人在改动锁定角色"——
 * 让「锁定」成为可执行约束，而不只是一句文档说明。
 * **只有缺陷修复**才允许改基线，且必须同步本文件与 `AGENTS.md` 的角色范围表。
 */
export const LOCKED_ROLES = {
  TeamLeader: {
    reason: '用户裁决 2026-10-11：TeamLeader 的 Web 页面锁定不做（App 侧能力仍有效）',
    menu: 4,
    home: 5
  }
}

const ENTRY = [
  "export { routesByRole } from '@/roles/routes'",
  "export { ROLE_WORKBENCH_CONFIGS } from '@/roles/workbenchConfig'",
  "export { HOME_WORKBENCHES } from '@/roles/workbenchHome'"
].join('\n')

export function loadStaticSources(root = process.cwd()) {
  const esbuildBin = path.join(root, 'node_modules', '.bin', 'esbuild')
  if (!fs.existsSync(esbuildBin)) {
    throw new Error('缺少 node_modules/.bin/esbuild（vite 自带依赖）。请先 npm install。')
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staticsrc-'))
  const entry = path.join(tmp, 'entry.ts')
  const outfile = path.join(tmp, 'entry.cjs')
  fs.writeFileSync(entry, ENTRY)
  try {
    execFileSync(esbuildBin, [
      entry, '--bundle', '--platform=node', '--format=cjs', `--outfile=${outfile}`,
      `--alias:@=${path.join(root, 'src')}`, '--external:*.vue',
      '--define:import.meta.env={"DEV":false,"PROD":true,"MODE":"production"}',
      '--log-level=error'
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim().split('\n').slice(0, 3).join(' ')
    throw new Error(`静态源打包失败：${detail}`)
  }
  try {
    const mod = createRequire(import.meta.url)(outfile)
    return { routesByRole: mod.routesByRole, configs: mod.ROLE_WORKBENCH_CONFIGS, home: mod.HOME_WORKBENCHES }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }) } catch { /* 清理失败不影响结论 */ }
  }
}

/**
 * 把 vue-router 路由树摊平成「本角色可到达的路径集合」（含区域根与命名父级）。
 * 刻意**不**收集 `redirect` 目标：重定向目标是「指向哪里」，不是「存在这条路由」——
 * 把重定向目标算进去会让「叶子被删掉、只见重定向」的坏情况被静默放过（负向测试抓到过）。
 */
export function flattenRolePaths(records) {
  const paths = new Set()
  const walk = (list, base) => {
    for (const record of list ?? []) {
      const raw = record.path
      let full = base
      if (typeof raw === 'string') {
        full = raw.startsWith('/') ? raw : `${base}/${raw}`.replace(/\/{2,}/g, '/')
        if (!full.startsWith('/')) full = `/${full}`
        if (!full.includes('(') && !full.includes(':')) paths.add(full)
      }
      if (Array.isArray(record.children) && record.children.length) walk(record.children, full)
    }
  }
  walk(records, '')
  return paths
}

/** 摊平某角色的菜单项，保留所在分组。 */
export function menuItemsOf(config) {
  const items = []
  for (const group of config?.navGroups ?? []) {
    for (const item of group.items ?? []) items.push({ group: group.key, groupLabel: group.label, ...item })
  }
  return items
}
