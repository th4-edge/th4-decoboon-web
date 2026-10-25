import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const model = read('src/domains/project/model.ts')
const api = read('src/domains/project/api.ts')
const panel = read('src/components/project/ProjectFactPhasePanel.vue')
const view = read('src/views/workbench/ProjectExecutionView.vue')
const failures = []
const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(label)
}
const forbidText = (source, text, label) => {
  if (source.includes(text)) failures.push(label)
}

const stages = ['source', 'preSale', 'signing', 'fulfillment', 'change', 'acceptance', 'finance', 'afterSales']
const stageBlock = panel.slice(panel.indexOf('const STAGES'), panel.indexOf('const FACT_LABELS'))
let cursor = -1
for (const stage of stages) {
  const position = stageBlock.indexOf(`key: '${stage}'`)
  if (position <= cursor) failures.push(`8 阶段顺序缺失或错序：${stage}`)
  cursor = position
}

requireText(model, 'factTrace?: ProjectFactTrace', 'ProjectBrief 未映射 factTrace')
requireText(api, 'normalizeProjectFactTrace', 'API 未归一化 factTrace')
requireText(api, "FACT_STAGE[enumValue(raw.stage)]", 'API 未严格映射 stage')
requireText(api, "typeof raw.current !== 'boolean'", 'API 未严格校验 current')
requireText(api, "Number.isInteger(version)", 'API 未严格校验 version')
requireText(api, '项目事实项目绑定暂不可确认', 'API 未校验事实 projectId')
forbidText(api, "FACT_STAGE[enumValue(raw.stage)] || 'source'", 'API 仍将未知 stage 兜底为 source')
forbidText(api, 'raw.current !== false', 'API 仍将缺失 current 兜底为 true')
forbidText(api, 'raw.version ?? 1', 'API 仍将缺失 version 兜底为 1')

requireText(panel, 'const serverNodes = computed(() => props.trace?.nodes ?? [])', 'PHASE 未按服务端 nodes 原顺序消费')
forbidText(panel, '[...(props.trace?.nodes ?? [])].sort', 'PHASE 仍重排服务端 nodes')
requireText(panel, 'const map = new Map<string, ProjectFactNode[]>()', '历史版本未按 nodeKey 分组')
requireText(panel, 'grouped.find((node) => node.current) ?? grouped[0]', '历史分组未选择当前主卡')
requireText(panel, 'expandedHistories', '历史版本未提供卡内折叠')
requireText(panel, 'gap.required', '来源缺口未区分必须/可选')
requireText(panel, 'node.uncertainty', '异常事实未展示 uncertainty')
requireText(panel, 'costComplete', '成本完整性未展示')
requireText(panel, 'focusAnchor', '未支持返回锚点定位')
requireText(panel, 'anchorId(node.nodeId)', '事实节点未生成稳定锚点')
requireText(panel, ':id="anchorId(history.nodeId)"', '历史事实项缺少 DOM 锚点')
requireText(panel, '暂无 Web 来源入口', '摘要-only 事实未显式标注')
requireText(view, "case 'Purchase'", '采购来源路由缺失')

requireText(view, "workspaceView === 'facts'", '项目执行页缺少 facts 视图切换')
requireText(view, 'ProjectFactPhasePanel', '项目执行页未接入 PHASE 面板')
requireText(view, "query.view = 'facts'", '未写入 facts 路由状态')
requireText(view, "query.anchor = factAnchor.value", '未写入返回锚点')
requireText(view, 'returnPath', '来源导航未携带 returnPath')
requireText(view, 'returnAnchor', '来源导航未携带 returnAnchor')
requireText(view, 'scrollIntoView', '返回锚点未滚动恢复')
requireText(view, "case 'Design'", '设计来源路由缺失')
requireText(view, "case 'Quote'", '报价来源路由缺失')
requireText(view, "case 'Contract'", '合同来源路由缺失')
requireText(view, "case 'MaterialSelection'", '材料来源路由缺失')
requireText(view, "case 'ContractChange'", '变更来源路由缺失')
requireText(view, "case 'Acceptance'", '验收来源路由缺失')
requireText(view, "case 'Feedback'", '反馈来源路由缺失')
requireText(view, 'router.hasRoute', '来源路由未按当前角色路由集合校验')
requireText(view, "return `execution-stage-${node.objectId}`", '阶段来源锚点缺失')
requireText(view, "return `execution-task-${node.objectId}`", '任务来源锚点缺失')
requireText(view, "return 'execution-report'", '现场日报来源锚点缺失')

if (failures.length) {
  console.error('U5-D source guard FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('U5-D source guard PASS: PHASE/order/history/gaps/anchor/routes/factTrace')
