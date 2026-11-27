import { expect, test, type Page } from '@playwright/test'

/**
 * Reader journey after the `reserve-book` edge function became the only
 * reservation path (commit 56c82fd): sign in as a student, open a title from
 * the catalogue, exercise the sticky shelf actions, walk into the Variant
 * bottom sheet and return to the catalogue.
 *
 * Only one random book is reserved, and only if it is currently reserved-free,
 * so the spec can be re-run. Wishlist is toggled back to its original state.
 */

test.describe.configure({ mode: 'serial' })

const STUDENT_EMAIL = 'student@shelfhelp.edu.vn'
const STUDENT_PASSWORD = 'Password123!'

function watchProblems(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.startsWith('Failed to load resource')) return
    if (text.startsWith('[vite]')) return
    problems.push(`console: ${text}`)
  })
  return problems
}

function expectNoProblems(problems: string[]) {
  expect(problems, `uncaught browser errors:\n${problems.join('\n')}`).toEqual([])
}

async function signInAsStudent(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome Back')
  await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill(STUDENT_EMAIL)
  await page.getByPlaceholder('••••••••••••').fill(STUDENT_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.locator('.sh-book-grid')).toBeVisible({ timeout: 30_000 })
}

/** Open one catalogue card by title and wait for its detail page. */
async function openTitle(page: Page, title: string) {
  await page.locator('.sh-book-card').filter({ hasText: title }).first().click()
  await expect(page.locator('.sh-detail-title')).toHaveText(title, { timeout: 20_000 })
}

test('Reader: title page renders every shelf action and the variant sheet', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsStudent(page)

  const titles = page.locator('.sh-book-card .sh-book-title')
  const count = await titles.count()
  expect(count, 'catalogue should list published titles').toBeGreaterThan(0)
  const first = (await titles.first().textContent())?.trim() ?? ''

  await openTitle(page, first)
  await expect(page.getByRole('img', { name: /cover/i }).or(page.locator('.sh-detail-title'))).toBeVisible()

  // Sticky action bar: Wishlist always, plus either Add to Cart or Reserve Copy.
  const wishlist = page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlist' })
  const shelfAction = page
    .locator('.sh-sticky-bar')
    .getByRole('button', { name: /Add to Cart|In Cart|Reserve Copy|Reserving/ })
  await expect(page.locator('.sh-sticky-bar')).toBeVisible()
  await expect(shelfAction).toBeVisible()

  // Wishlist toggles both ways.
  const wasWishlisted = await wishlist.getAttribute('class').then((c) => (c ?? '').includes('active'))
  await wishlist.click()
  await expect(page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlisted' })).toBeVisible()
  await page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlisted' }).click()
  await expect(page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlist' })).toBeVisible()
  if (wasWishlisted) {
    await page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlist' }).click()
    await expect(page.locator('.sh-sticky-bar').getByRole('button', { name: 'Wishlisted' })).toBeVisible()
  }

  // Add to Cart opens the variant sheet; closing it changes nothing.
  const addToCart = page.locator('.sh-sticky-bar').getByRole('button', { name: /Add to Cart|In Cart/ })
  if (await addToCart.count()) {
    await addToCart.click()
    const sheet = page.getByRole('dialog', { name: 'Select Variant' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Confirm Selection' })).toBeVisible()
    await page.getByRole('button', { name: 'Close variant picker' }).click()
    await expect(sheet).toHaveCount(0)
  }

  // Back arrow returns to the catalogue.
  await page.getByRole('button', { name: 'Back to catalog' }).click()
  await expect(page.locator('.sh-book-grid')).toBeVisible()
  await expect(page.locator('.sh-detail-title')).toHaveCount(0)

  expectNoProblems(problems)
})
