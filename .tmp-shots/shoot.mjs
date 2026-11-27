import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const tag = process.argv[2] || 'now'
const base = process.argv[3] || 'http://localhost:5173'
const outDir = 'C:/Users/17820/AppData/Local/Temp/opencode/shots'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 400)) })
page.on('pageerror', (e) => console.log('PAGE ERROR:', String(e).slice(0, 600)))

await page.goto(base)
await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill('admin@shelfhelp.edu.vn')
await page.getByPlaceholder('••••••••••••').fill('Password123!')
await page.getByRole('button', { name: 'Sign In' }).click()
await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
await page.getByRole('heading', { name: 'Books & Inventory' }).waitFor()

const tabs = ['Books & Catalog', 'Copies', 'Import CSV', 'History', 'Write-offs']
for (const tab of tabs) {
  const slug = tab.toLowerCase().replace(/[^a-z]+/g, '-')
  await page.locator('.books-tab-switcher').getByRole('button', { name: tab, exact: false }).click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outDir}/${tag}-${slug}.png` })
  if (tab === 'Write-offs') {
    await page.locator('.books-inspector').first().waitFor()
    await page.screenshot({ path: `${outDir}/${tag}-writeoffs-drawer.png` })
  }
}

await browser.close()
console.log('done', base)
