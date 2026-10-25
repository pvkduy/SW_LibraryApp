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

test.describe('M0 smoke', () => {
  test('app shell renders', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.status(), 'index.html should be served').toBe(200)
    await expect(page.locator('#root')).toBeAttached()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SW Library')
  })

  test('signed-out visitor settles with no permission error', async ({ page }) => {
    await page.goto('/')

    // AuthProvider resolves the session before App renders its <main>.
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })

    // The loading line is replaced once getSession() settles.
    await expect(page.getByText('Đang tải...')).toHaveCount(0, { timeout: 15_000 })

    // Wait for in-flight requests to finish BEFORE asserting. This matters:
    // `toHaveCount(0)` passes immediately when the count is already 0, so it
    // cannot catch an error that arrives a few ms later. Verified: without this
    // wait the assertion passed while `.error` appeared 4 ms afterwards.
    await page.waitForLoadState('networkidle')

    // No session yet (M1 adds the login screen), so the signed-out state shows.
    await expect(page.getByText('Chưa đăng nhập')).toBeVisible()

    // The regression guard: Supabase/RLS problems land in the inline error slot
    // (§14 load error). M0 must reach the stack cleanly, never "permission denied".
    await expect(page.locator('.error')).toHaveCount(0)
  })
})
