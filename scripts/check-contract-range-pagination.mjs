#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiPath = path.join(root, 'src/domains/contract/api.ts')
const viewPath = path.join(root, 'src/views/designer/DesignerContractChangesView.vue')

export function findings(api, view) {
  const issues = []
  const req = (source, pattern, message) => { if (!pattern.test(source)) issues.push(message) }
  req(api, /contractChangeRange\(input:\s*\{[^}]*current\?: number[^}]*size\?: number/, 'range API 必须接收 current/size')
  req(api, /Math\.min\(50,\s*Math\.max\(1,\s*Math\.trunc\(input\.size \?\? 20\)\)\)/, 'range 页大小必须钳制为 1..50')
  req(api, /current,\s*size,[\s\S]*?keyword:/, 'range 请求必须发送分页和关键词')
  req(view, /rangeCurrent = ref\(1\)/, '页面必须保留服务端页码')
  req(view, /rangeTotal = ref\(0\)/, '页面必须消费服务端 total')
  req(view, /changeSourcePage/, '页面必须提供服务端翻页')
  req(view, /current:\s*page,[\s\S]*?size:\s*rangeSize\.value/, '页面请求必须发送 current/size')
  return issues
}

const [api, view] = [fs.readFileSync(apiPath, 'utf8'), fs.readFileSync(viewPath, 'utf8')]
if (process.argv.includes('--self-test')) {
  const samples = [
    findings(api.replace('current?: number', 'page?: number'), view),
    findings(api.replace('Math.min(50, Math.max(1, Math.trunc(input.size ?? 20)))', 'input.size ?? 200'), view),
    findings(api, view.replace('current: page,', 'current: 1,')),
    findings(api, view.replace('const rangeTotal = ref(0)\n', ''))
  ]
  if (samples.some((sample) => sample.length === 0)) {
    console.error('合同来源分页门禁自测失败：负向样本未拦截')
    process.exit(1)
  }
  console.log(`合同来源分页门禁自测：PASS（${samples.length}/${samples.length} 个负向样本被拦截）`)
  process.exit(0)
}
const issues = findings(api, view)
if (issues.length) {
  console.error('合同来源分页门禁失败：')
  for (const issue of issues) console.error(`- ${issue}`)
  process.exit(1)
}
console.log('合同来源分页门禁通过：服务端 current/size、最多 50 条、服务端翻页。')
