import { chromium } from 'file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage()
const icon = '<svg width="12" height="12"><path d="M1 1 H2"/></svg>'
const hidden = '<svg width="12" height="12" aria-hidden="true"><path d="M1 1 H2"/></svg>'
await page.setContent(`
  <button id="a">${icon} Create X</button>
  <button id="b">${hidden} Create Y</button>
  <button id="c">+ Create Z</button>
`)
for (const name of [' Create X', 'Create X', ' Create Y', 'Create Y', '+ Create Z']) {
  console.log(JSON.stringify(name), await page.getByRole('button', { name }).count())
}
console.log('textContent a:', JSON.stringify(await page.locator('#a').evaluate((e) => e.textContent)))
console.log('innerText a:', JSON.stringify(await page.locator('#a').evaluate((e) => e.innerText)))
await browser.close()
