import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
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
// open the header stage button (first one)
await page.getByRole('button', { name: '+ Stage Copies' }).first().click()
const stageModal = page.locator('.books-modal').filter({ hasText: 'Stage Copy to Write-off Slip' })
await stageModal.getByPlaceholder('Scan or enter copy barcode (e.g. LIB-2026-00001)…').fill('BK-10050')
await stageModal.getByRole('button', { name: 'Lookup' }).click()
await stageModal.getByRole('button', { name: 'Add to Staged Copies' }).waitFor()
await stageModal.getByRole('button', { name: 'Add to Staged Copies' }).click()
await page.waitForTimeout(800)
const info = await page.locator('.books-staged-list').evaluate((el) => ({
  cards: el.querySelectorAll('.books-staged-card').length,
  empty: el.querySelectorAll('.books-staged-empty').length,
}))
console.log('after staging', JSON.stringify(info))
console.log('match count', await page.getByRole('button', { name: '+ Stage Copies' }).count())
await browser.close()
