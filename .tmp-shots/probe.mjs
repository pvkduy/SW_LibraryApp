import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('http://localhost:5173')
await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill('admin@shelfhelp.edu.vn')
await page.getByPlaceholder('••••••••••••').fill('Password123!')
await page.getByRole('button', { name: 'Sign In' }).click()
await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
await page.getByRole('heading', { name: 'Books & Inventory' }).waitFor()
await page.locator('.books-tab-switcher').getByRole('button', { name: 'Import CSV', exact: false }).click()
await page.waitForTimeout(1500)
console.log('count', await page.getByRole('button', { name: '↓ CSV template download' }).count())
const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
await page.getByRole('button', { name: '↓ CSV template download' }).click()
const download = await downloadPromise
console.log('download', download ? download.suggestedFilename() : 'none')
await browser.close()
