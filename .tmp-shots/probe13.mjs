import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)) })
await page.goto('http://localhost:5173')
await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill('admin@shelfhelp.edu.vn')
await page.getByPlaceholder('••••••••••••').fill('Password123!')
await page.getByRole('button', { name: 'Sign In' }).click()
await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
await page.getByRole('heading', { name: 'Books & Inventory' }).waitFor()
await page.locator('.books-tab-switcher').getByRole('button', { name: 'Write-offs', exact: false }).click()
await page.waitForTimeout(1500)
const drawer = page.locator('.books-detail')
const bk = drawer.getByRole('button', { name: 'BK-10050' })
if ((await bk.count()) === 0) {
  console.log('need to stage first')
} else {
  await bk.first().click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Complete Slip' }).click()
  await page.waitForTimeout(1000)
  console.log('alerts:', await page.locator('.books-alert').evaluateAll((e) => e.map((x) => x.className + ' :: ' + x.textContent.slice(0, 120))))
}
await browser.close()
