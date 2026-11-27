import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('response', async (r) => {
  if (r.url().includes('save-writeoff-slip')) {
    let body = ''
    try { body = (await r.text()).slice(0, 300) } catch { body = '<no body>' }
    console.log('[response]', r.status(), body)
  }
})
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 300)) })
await page.goto('http://localhost:5173')
await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill('admin@shelfhelp.edu.vn')
await page.getByPlaceholder('••••••••••••').fill('Password123!')
await page.getByRole('button', { name: 'Sign In' }).click()
await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
await page.getByRole('heading', { name: 'Books & Inventory' }).waitFor()
await page.locator('.books-tab-switcher').getByRole('button', { name: 'Write-offs', exact: false }).click()
await page.waitForTimeout(1500)
await page.getByRole('button', { name: '+ Create Write-Off Slip' }).click()
await page.waitForTimeout(2000)
await page.getByRole('button', { name: '+ Stage Copies' }).first().click()
const modal = page.locator('.books-modal').filter({ hasText: 'Stage Copy to Write-off Slip' })
await modal.getByPlaceholder('Scan or enter copy barcode (e.g. LIB-2026-00001)…').fill('BK-10040')
await modal.getByRole('button', { name: 'Lookup' }).click()
await page.waitForTimeout(800)
await modal.getByRole('button', { name: 'Add to Staged Copies' }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Save Draft' }).click()
await page.waitForTimeout(4000)
console.log('alerts:', await page.locator('.books-alert').evaluateAll((e) => e.map((x) => x.className + ' :: ' + x.textContent.slice(0, 140))))
await browser.close()
