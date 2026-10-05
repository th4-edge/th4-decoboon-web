import { chromium } from '/Users/zhangwei/.npm/_npx/31e32ef8478fbf80/node_modules/playwright/index.mjs'

const BASE = 'http://127.0.0.1:8080'
const QID = process.env.QID
const ITEM = process.env.ITEM
const log = []

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

async function login() {
  await page.goto(`${BASE}/login`)
  await page.getByRole('textbox', { name: '*手机号' }).fill('19900000005')
  await page.getByRole('textbox', { name: '*登录密码' }).fill('Design2026!')
  await page.getByRole('button', { name: '进入工作台' }).click()
  await page.waitForURL(/workbench|management/, { timeout: 20000 })
}

async function openQuote() {
  await page.goto(`${BASE}/__preview/quote?quoteId=${QID}`)
  await page.waitForSelector('.grid__table tbody tr.grid__row', { timeout: 30000 })
  await page.waitForTimeout(1500)
}

const state = async () => page.evaluate(() => ({
  alert: document.querySelector('.el-alert__title')?.textContent?.trim() || null,
  alertDesc: document.querySelector('.el-alert__description')?.textContent?.trim() || null,
  save: document.querySelector('.qhead__save')?.textContent?.trim() || null,
  decision: document.querySelector('.decision .tag')?.textContent?.trim() || null,
  note: document.querySelector('.decision__foot')?.textContent?.trim() || null,
  total: document.querySelector('.decision__list dd')?.textContent?.trim() || null
}))

try {
  await login()
  await openQuote()

  const before = await state()
  log.push({ step: '初始', ...before })

  // ① 注入失败：拦截 quote/lines/save
  let failOn = true
  await page.route('**/api/quote/lines/save', (route) => {
    if (failOn) return route.abort('failed')
    return route.continue()
  })

  // ② 制造未保存修改
  const input = page.locator(`[data-cell="${ITEM}:materialPrice"] input`)
  const oldValue = await input.inputValue()
  await input.fill(String((Number(oldValue) + 1).toFixed(2)))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  log.push({ step: '编辑后', ...(await state()), oldValue })

  // ③ 手动保存 → 应失败
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(4000)
  const failed = await state()
  log.push({ step: '失败保存后', ...failed })

  // ④ 等待自动保存窗口 → 仍不得显示已保存
  await page.waitForTimeout(6000)
  const afterWait = await state()
  log.push({ step: '失败后等待6s', ...afterWait })

  // ⑤ 恢复网络 → 手动重试 → 应成功
  failOn = false
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(8000)
  const recovered = await state()
  log.push({ step: '恢复网络重试后', ...recovered })

  // ⑥ 还原数据
  await page.route('**/api/quote/lines/save', (route) => route.continue())
  await input.fill(oldValue)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(8000)
  const restored = await state()
  log.push({ step: '还原后', ...restored })

  console.log(JSON.stringify({ log }, null, 1))
} catch (e) {
  console.log(JSON.stringify({ error: String(e), log }, null, 1))
  process.exitCode = 2
} finally {
  await browser.close()
}
