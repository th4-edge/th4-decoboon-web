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

const snapshot = async () => page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr.grid__row')][0]
  return {
    url: location.href,
    save: document.querySelector('.qhead__save')?.textContent?.trim() || null,
    firstCell: row?.querySelector('[data-cell$=":materialPrice"] input')?.value || null
  }
})

try {
  await login()
  await page.goto(`${BASE}/__preview/quote?quoteId=${QID}`)
  await page.waitForSelector('.grid__table tbody tr.grid__row', { timeout: 30000 })
  await page.waitForTimeout(1500)

  // 制造未保存修改
  const input = page.locator(`[data-cell="${ITEM}:materialPrice"] input`)
  const oldValue = await input.inputValue()
  const newValue = String((Number(oldValue) + 1).toFixed(2))
  await input.fill(newValue)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(400)
  log.push({ step: '脏状态', ...(await snapshot()), oldValue, newValue })

  // ① 路由离开 → 应弹原生 confirm；先"取消"
  let dialogMsg = null
  const onDialog = async (d) => { dialogMsg = d.message(); await d.dismiss() }
  page.on('dialog', onDialog)
  await page.goto(`${BASE}/workbench`).catch(() => {})
  await page.waitForTimeout(2500)
  log.push({ step: '路由离开(取消)', dialog: dialogMsg, ...(await snapshot()) })

  // ② 再离开一次 → "确定"
  dialogMsg = null
  page.off('dialog', onDialog)
  const onDialogAccept = async (d) => { dialogMsg = d.message(); await d.accept() }
  page.on('dialog', onDialogAccept)
  await page.goto(`${BASE}/workbench`).catch(() => {})
  await page.waitForTimeout(2500)
  log.push({ step: '路由离开(确定)', dialog: dialogMsg, ...(await snapshot()) })
  page.off('dialog', onDialogAccept)

  // ③ 回到报价页，制造脏数据，测 beforeunload（刷新）
  await page.goto(`${BASE}/__preview/quote?quoteId=${QID}`)
  await page.waitForSelector('.grid__table tbody tr.grid__row', { timeout: 30000 })
  await page.waitForTimeout(1500)
  const input2 = page.locator(`[data-cell="${ITEM}:materialPrice"] input`)
  await input2.fill(String((Number(oldValue) + 2).toFixed(2)))
  await page.keyboard.press('Tab')
  await page.waitForTimeout(400)
  let unloadMsg = null
  const onUnload = async (d) => { unloadMsg = `${d.type()}: ${d.message()}`; await d.accept() }
  page.on('dialog', onUnload)
  await page.reload().catch(() => {})
  await page.waitForTimeout(2500)
  log.push({ step: '刷新(beforeunload)', dialog: unloadMsg, ...(await snapshot()) })
  page.off('dialog', onUnload)

  // ④ 还原服务端数据
  await page.goto(`${BASE}/__preview/quote?quoteId=${QID}`)
  await page.waitForSelector('.grid__table tbody tr.grid__row', { timeout: 30000 })
  await page.waitForTimeout(1500)
  const input3 = page.locator(`[data-cell="${ITEM}:materialPrice"] input`)
  await input3.fill(oldValue)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Control+s')
  await page.waitForTimeout(8000)
  log.push({ step: '还原服务端', ...(await snapshot()) })

  console.log(JSON.stringify({ log }, null, 1))
} catch (e) {
  console.log(JSON.stringify({ error: String(e), log }, null, 1))
  process.exitCode = 2
} finally {
  await browser.close()
}
