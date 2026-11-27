import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`
  <button id="a"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="books-icon"><path d="M12 5v14M5 12h14"></path></svg> Create Write-Off Slip</button>
`)
for (const name of ['+ Create Write-Off Slip', 'Create Write-Off Slip', ' Create Write-Off Slip']) {
  console.log(JSON.stringify(name), await page.getByRole('button', { name }).count())
}
console.log(await page.locator('button').ariaSnapshot())
await browser.close()
