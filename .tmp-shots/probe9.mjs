import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173')
await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill('admin@shelfhelp.edu.vn')
await page.getByPlaceholder('••••••••••••').fill('Password123!')
await page.getByRole('button', { name: 'Sign In' }).click()
await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
await page.getByRole('heading', { name: 'Books & Inventory' }).waitFor()
await page.locator('.books-tab-switcher').getByRole('button', { name: 'Write-offs', exact: false }).click()
await page.waitForTimeout(2000)
const info = await page.locator('.books-staged-list').evaluate((el) => ({
  cards: el.querySelectorAll('.books-staged-card').length,
  empty: el.querySelectorAll('.books-staged-empty').length,
  text: el.textContent.slice(0, 200),
}))
console.log(JSON.stringify(info))
console.log('section 2 label:', await page.locator('.books-section-label').nth(1).innerText())
console.log('slip card numbers:', await page.locator('.books-slip-card .books-slip-card-id strong').evaluateAll((e) => e.map((x) => x.textContent)))
await browser.close()
