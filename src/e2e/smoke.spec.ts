import { expect, test } from '@playwright/test'

/**
 * M0 smoke test — SRS §19 exit criterion ("a Playwright smoke test").
 *
 * Deliberately NOT a feature test. M0 delivers zero reader/admin screens
 * (M0-PLAN.md §1), so this asserts the two things M0 actually guarantees:
 *
 *   1. the app boots and serves the shell
 *   2. it reaches the local Supabase stack without an RLS/permission error, and
 *      lands on a defined state for a logged-out visitor
 *
 * On point 2: SRS §12.3 restricts catalog reads to signed-in users, and §2.2
 * limits unauthenticated visitors to the auth routes. The app is therefore
 * expected to show the signed-out state (not a book list, not an error) until
 * M1 adds login. This test fails if the app queries the catalog while logged
 * out and surfaces "permission denied" — which is exactly the regression that
 * a column-level GRANT change can introduce.
 */

test.describe('App smoke', () => {
  test('app shell renders', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.status(), 'index.html should be served').toBe(200)
    await expect(page.locator('#root')).toBeAttached()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome Back')
  })

  test('signed-out visitor lands on login page', async ({ page }) => {
    await page.goto('/')

    // AuthProvider resolves the session before App renders its <main>.
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

    // The loading line is replaced once getSession() settles.
    await expect(page.getByText('Đang tải ShelfHelp...')).toHaveCount(0, { timeout: 15_000 })

    await page.waitForLoadState('networkidle')

    // Signed-out visitor sees login screen
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()

    // No load/runtime error
    await expect(page.locator('.error')).toHaveCount(0)
  })
})
