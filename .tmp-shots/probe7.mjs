import { chromium } from "file:///D:/SW_LibraryApp/node_modules/@playwright/test/index.mjs"
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent('<button><svg width="11" aria-hidden="true"><path d="M1 1"/></svg> + Stage Copies</button>')
console.log("plus-name", await page.getByRole("button", { name: "+ Stage Copies" }).count())
await browser.close()
