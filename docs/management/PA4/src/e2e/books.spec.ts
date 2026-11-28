import { expect, test, type Page } from '@playwright/test'

/**
 * Books & Inventory walkthrough (UC-19 / UC-22 / UC-26).
 *
 * This is deliberately a *walkthrough*, not a per-field feature spec: it signs in
 * as the librarian, opens every tab of the Books screen and exercises every
 * control the screen renders, so that a runtime crash ("bugged when clicking into
 * a book") surfaces as a real browser failure instead of a code-reading guess.
 *
 * Runs serially because the tests share one Supabase database. Mutations are kept
 * to state that the tests themselves restore:
 *   - one copy goes damaged -> available -> damaged (BK-10040)
 *   - one title's collection tier is flipped and flipped back
 *   - one draft write-off slip is created, saved and cancelled
 * No write-off is completed and no copy is retired.
 *
 * NB: write-off slips are never hard-deleted (POL-13), so each run leaves one
 * `cancelled` slip behind (WO-YYYY-NNN). That is intentional and append-only,
 * like any other audit record.
 */

test.describe.configure({ mode: 'serial' })

const ADMIN_EMAIL = 'admin@shelfhelp.edu.vn'
const ADMIN_PASSWORD = 'Password123!'

const CATALOG_LOADING = 'Loading catalog…'
const COPIES_LOADING = 'Loading copies…'
const HISTORY_LOADING = 'Loading audit log…'

/** Collect uncaught JS errors and non-network console errors. */
function watchProblems(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Chromium logs every 4xx/5xx response here; those are asserted via the UI.
    if (text.startsWith('Failed to load resource')) return
    // Vite's own HMR chatter when a module is saved while a run is in progress.
    // These describe a half-written file on disk, not the app; the next navigation
    // loads a fresh page, where a real syntax/import error would surface again.
    if (text.startsWith('[vite]')) return
    problems.push(`console: ${text}`)
  })
  return problems
}

function expectNoProblems(problems: string[]) {
  expect(problems, `uncaught browser errors:\n${problems.join('\n')}`).toEqual([])
}

async function signInAsAdmin(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome Back')
  await page.getByPlaceholder('e.g. reader@campus.edu or 80921').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('••••••••••••').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(
    page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }),
  ).toBeVisible({ timeout: 30_000 })
}

async function openBooks(page: Page) {
  await page.locator('.admin-nav').getByRole('button', { name: 'Books', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Books & Inventory' })).toBeVisible()
}

async function openTab(page: Page, label: string) {
  await page.locator('.books-tab-switcher').getByRole('button', { name: label, exact: false }).click()
}

async function settle(page: Page, loadingText: string) {
  await expect(page.locator('.books-table tbody')).not.toContainText(loadingText, { timeout: 20_000 })
  await expect(page.locator('.books-table tbody tr').first()).toBeVisible({ timeout: 20_000 })
}

async function waitForCatalog(page: Page) {
  await settle(page, CATALOG_LOADING)
}

async function waitForCopies(page: Page) {
  await settle(page, COPIES_LOADING)
}

async function waitForHistory(page: Page) {
  await settle(page, HISTORY_LOADING)
}

/** The title text of a catalog row, without the "Selected" chip. */
async function rowTitle(row: ReturnType<Page['locator']>) {
  return (await row.locator('.books-title-line').first().evaluate((el) => el.childNodes[0]?.textContent ?? '')).trim()
}

test('Books shell: every tab opens and renders its own surface', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)

  const tabs: Array<[string, string]> = [
    ['Books & Catalog', 'Scan or type barcode / ISBN / title…'],
    ['Copies', 'Scan barcode or search title / ISBN…'],
    ['Import CSV', 'Upload input CSV'],
    ['History', 'Export CSV'],
    ['Write-offs', '+ Create Write-Off Slip'],
  ]

  for (const [tab, marker] of tabs) {
    await openTab(page, tab)
    if (tab === 'Books & Catalog') {
      await expect(page.getByPlaceholder(marker)).toBeVisible()
      await waitForCatalog(page)
    } else if (tab === 'Copies') {
      await expect(page.getByPlaceholder(marker)).toBeVisible()
      await waitForCopies(page)
    } else if (tab === 'Import CSV') {
      await expect(page.getByRole('heading', { name: marker })).toBeVisible()
    } else if (tab === 'History') {
      await expect(page.getByRole('button', { name: marker })).toBeVisible()
      await waitForHistory(page)
    } else {
      await expect(page.getByRole('button', { name: marker })).toBeVisible()
    }
    await expect(page.locator('.books-tab-switcher .admin-pill-btn.active')).toContainText(tab)
  }

  expectNoProblems(problems)
})

test('Catalog: clicking into every title renders its detail drawer', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await waitForCatalog(page)

  const rows = page.locator('.books-table tbody tr')
  const count = await rows.count()
  expect(count, 'catalog should list the seeded titles').toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index)
    const title = await rowTitle(row)
    expect(title.length, `row ${index} should have a title`).toBeGreaterThan(0)

    await row.click()

    await expect(page.locator('.books-detail h2')).toHaveText(title)
    await expect(page.locator('.books-detail')).toContainText('Title metadata')
    await expect(page.locator('.books-detail').getByRole('button', { name: 'Edit metadata' })).toBeVisible()
    await expect(page.locator('.books-detail').getByRole('button', { name: 'Add copies', exact: true })).toBeVisible()
    await expect(page.locator('.books-detail')).toContainText(/Physical copies summary \(\d+\)/)
  }

  // Clicking the last row directly must also open its detail drawer.
  await page.locator('.books-table tbody tr').last().click()
  await expect(page.locator('.books-detail h2')).toBeVisible()

  expectNoProblems(problems)
})

test('Catalog: lookup, filters, pagination, refresh and bulk collection', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await waitForCatalog(page)

  const search = page.getByLabel('Lookup titles by barcode, ISBN, title or publisher')

  // A copy barcode resolves to its title (the hint promises this).
  await search.fill('BK-10040')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.books-table tbody')).toContainText('Dune')
  await expect(page.locator('.books-detail h2')).toHaveText('Dune')

  // The Lookup button repeats the same query.
  await page.getByRole('button', { name: 'Lookup' }).click()
  await expect(page.locator('.books-table tbody tr')).toHaveCount(1)

  // A title search works too.
  await search.fill('brief history')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody')).toContainText('A Brief History of Time')

  // No-match empty state.
  await search.fill('zzz-no-such-title-zzz')
  await search.press('Enter')
  await expect(page.locator('.books-table-empty')).toContainText('No titles match the selected filters.')

  // Clear the search again. The box is debounced, so a press of Enter while the
  // old query is still rendered re-runs the *old* search; wait for the unfiltered
  // table before counting.
  await search.fill('')
  await expect(page.locator('.books-table tbody')).not.toContainText('zzz-no-such-title-zzz')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody tr')).not.toHaveCount(1)
  const fullCount = await page.locator('.books-table tbody tr').count()
  expect(fullCount).toBeGreaterThan(1)

  // Status filter.
  await page.getByLabel('Status filter').selectOption('active')
  await waitForCatalog(page)
  await page.getByLabel('Status filter').selectOption('draft')
  await page.waitForTimeout(300)
  await expect(page.locator('.books-table tbody')).not.toContainText(CATALOG_LOADING)
  await page.getByLabel('Status filter').selectOption('all')
  await waitForCatalog(page)

  // Condition filter (inner join).
  await page.getByLabel('Condition filter').selectOption('good')
  await waitForCatalog(page)
  await page.getByLabel('Condition filter').selectOption('all')
  await waitForCatalog(page)

  // Pagination is disabled for a single page.
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

  // Refresh keeps the table.
  await page.getByRole('button', { name: 'Refresh' }).click()
  await waitForCatalog(page)

  // Select-all then clear.
  const selectAll = page.getByLabel('Select all')
  await selectAll.check()
  await expect(page.getByText(`${fullCount} selected`)).toBeVisible()
  await selectAll.uncheck()
  await expect(page.getByText(`${fullCount} selected`)).toHaveCount(0)

  // Bulk collection change, then restore the original tier.
  const firstRow = page.locator('.books-table tbody tr').first()
  const originalTier = (await firstRow.locator('.books-badge').first().innerText()).trim()
  const targetTier = originalTier === 'Premium' ? 'Standard' : 'Premium'

  await firstRow.locator('input[type=checkbox]').check()
  await expect(page.getByText('1 selected')).toBeVisible()
  await page.getByRole('button', { name: `Set ${targetTier}` }).click()
  await expect(page.locator('.books-alert.success')).toContainText(
    `Collection set to ${targetTier.toLowerCase()} for 1 title(s)`,
  )

  await page.locator('.books-table tbody tr').first().locator('input[type=checkbox]').check()
  await page.getByRole('button', { name: `Set ${originalTier}` }).click()
  await expect(page.locator('.books-alert.success')).toContainText(
    `Collection set to ${originalTier.toLowerCase()} for 1 title(s)`,
  )
  await expect(page.locator('.books-alert.success').getByRole('button', { name: '✕' })).toBeVisible()
  await page.locator('.books-alert.success').getByRole('button', { name: '✕' }).click()
  await expect(page.locator('.books-alert')).toHaveCount(0)

  expectNoProblems(problems)
})

test('Catalog: Add New Book modal, lookup failure, validation and cancel', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await waitForCatalog(page)

  await page.getByRole('button', { name: 'Add New Book' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add book' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Add a book' })).toBeVisible()

  // A malformed ISBN fails validation inside the edge function; the form must
  // keep working and show the manual-entry warning (UC-19 §2.2.1).
  await dialog.getByLabel('ISBN lookup').fill('123')
  await dialog.getByRole('button', { name: 'Lookup metadata' }).click()
  await expect(dialog.locator('.books-hint.warn')).toContainText('valid 10- or 13-digit ISBN')

  // Initial copies tab.
  await dialog.getByRole('button', { name: 'Initial copies' }).click()
  await expect(dialog.getByLabel('Number of copies')).toHaveValue('1')
  await dialog.getByLabel('Number of copies').fill('2')
  await dialog.getByLabel('Condition').selectOption('fair')
  await dialog.getByLabel('Acquisition source').selectOption('donation')

  // Cover tab.
  await dialog.getByRole('button', { name: 'Cover', exact: true }).click()
  await expect(dialog.getByText('Cover image')).toBeVisible()
  await dialog.getByLabel('Or use an image URL / stored path').fill('https://example.com/e2e-cover.jpg')
  await expect(dialog.getByText('https://example.com/e2e-cover.jpg')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Remove cover' }).click()
  await expect(dialog.getByLabel('Or use an image URL / stored path')).toHaveValue('')

  // Metadata validation (native `required` is on Title, so give it a value).
  await dialog.getByRole('button', { name: 'Metadata' }).click()
  await dialog.locator('#book-title').fill('E2E Validation Probe')
  await dialog.locator('#book-isbn13').fill('123')
  await dialog.getByRole('button', { name: 'Save and create copies' }).click()
  await expect(dialog.locator('.books-alert.danger')).toContainText('ISBN-13 must contain 13 digits.')

  // Cancel closes without writing.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.books-table tbody')).not.toContainText('E2E Validation Probe')

  expectNoProblems(problems)
})

test('Catalog: Add copies modal opens from both entry points and validates', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await waitForCatalog(page)

  // Footer action.
  await page.locator('.books-detail').getByRole('button', { name: 'Add copies', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Add copies' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Add copies to existing title')

  // Barcode count must match the requested copy count.
  await dialog.getByLabel('Number of copies').fill('2')
  await dialog.getByLabel('Optional barcodes (one per line)').fill('E2E-ONLY-1')
  await dialog.getByRole('button', { name: 'Create copies' }).click()
  await expect(dialog.locator('.books-alert.danger')).toContainText(
    'The number of barcodes must match the copy count',
  )

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  // Inline "+ Add Copies" link in the copies summary.
  await page.locator('.books-detail').getByRole('button', { name: '+ Add Copies' }).click()
  dialog = page.getByRole('dialog', { name: 'Add copies' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  expectNoProblems(problems)
})

test('Catalog: Edit metadata opens the prefilled editor without saving', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await waitForCatalog(page)

  const title = await page.locator('.books-detail h2').innerText()
  await page.locator('.books-detail').getByRole('button', { name: 'Edit metadata' }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit book' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Edit book metadata' })).toBeVisible()
  await expect(dialog.locator('#book-title')).toHaveValue(title)

  // The copies tab explains that stock is managed elsewhere.
  await dialog.getByRole('button', { name: 'Copies', exact: true }).click()
  await expect(dialog).toContainText('Copies are managed from the catalog detail pane')

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  expectNoProblems(problems)
})

test('Copies: clicking into every copy renders its status drawer', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Copies')
  await waitForCopies(page)

  const rows = page.locator('.books-table tbody tr')
  const count = await rows.count()
  expect(count, 'copies table should list seeded copies').toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index)
    const barcode = (await row.locator('.books-barcode-pill').innerText()).trim()

    await row.click()

    await expect(page.locator('.books-detail')).toContainText('Change copy status')
    await expect(page.locator('.books-detail .books-barcode-pill')).toHaveText(barcode)
    await expect(page.locator('.books-detail')).toContainText('Recent copy history')

    // The chevron must target the same copy.
    await row.getByRole('button', { name: `Open ${barcode} history` }).click()
    await expect(page.locator('.books-detail .books-barcode-pill')).toHaveText(barcode)
  }

  expectNoProblems(problems)
})

test('Copies: every filter, sort and the focus chip', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Copies')
  await waitForCopies(page)

  for (const status of ['available', 'held', 'borrowed', 'damaged', 'under_repair', 'lost', 'retired', 'all']) {
    await page.getByLabel('Copy status filter').selectOption(status)
    await page.waitForTimeout(300)
    await expect(page.locator('.books-table tbody')).not.toContainText(COPIES_LOADING)
    await expect(page.locator('.books-table tbody tr').first()).toBeVisible()
  }

  for (const condition of ['good', 'fair', 'poor', 'damaged', 'all']) {
    await page.getByLabel('Condition filter').selectOption(condition)
    await page.waitForTimeout(300)
    await expect(page.locator('.books-table tbody')).not.toContainText(COPIES_LOADING)
  }

  const shelf = page.getByLabel('Shelf filter')
  const shelfCount = await shelf.locator('option').count()
  if (shelfCount > 1) {
    await shelf.selectOption({ index: 1 })
    await page.waitForTimeout(300)
    await expect(page.locator('.books-table tbody')).not.toContainText(COPIES_LOADING)
    await shelf.selectOption('all')
  }

  for (const sort of ['barcode_asc', 'status_asc', 'created_desc']) {
    await page.getByLabel('Sort copies').selectOption(sort)
    await page.waitForTimeout(300)
    await expect(page.locator('.books-table tbody')).not.toContainText(COPIES_LOADING)
    await expect(page.locator('.books-table tbody tr').first()).toBeVisible()
  }

  // Search by title, then no-match.
  const search = page.getByLabel('Look up copies by barcode, title or ISBN')
  await search.fill('Dune')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody')).toContainText('Dune')
  await expect(page.locator('.books-table tbody tr')).toHaveCount(2)
  await search.fill('zzz-no-such-copy-zzz')
  await search.press('Enter')
  await expect(page.locator('.books-table-empty')).toContainText('No copies match the selected filters.')
  await search.fill('')
  await search.press('Enter')
  await waitForCopies(page)

  // Pagination disabled for one page.
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

  expectNoProblems(problems)
})

test('Copies: no-op guard, mandatory reason, status change and restore', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Copies')
  await waitForCopies(page)

  const search = page.getByLabel('Look up copies by barcode, title or ISBN')
  await search.fill('BK-10040')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody tr')).toHaveCount(1)
  await page.locator('.books-table tbody tr').first().click()

  const drawer = page.locator('.books-detail')
  await expect(drawer.locator('.books-barcode-pill')).toHaveText('BK-10040')
  await expect(drawer).toContainText('Damaged')

  // The copy is already damaged, so re-applying that target is blocked.
  const update = page.getByRole('button', { name: 'Update status' })
  await expect(update).toBeDisabled()
  await expect(update).toHaveAttribute('title', /choose a different status/)

  // Pick a different target: Reset restores the current status.
  await drawer.locator('.books-status-options').getByRole('button', { name: /Available/ }).click()
  await expect(update).toBeEnabled()
  await page.locator('#status-reason').fill('E2E probe reason')
  await drawer.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('#status-reason')).toHaveValue('')
  await expect(update).toBeDisabled()

  // Missing reason is rejected before any write.
  await drawer.locator('.books-status-options').getByRole('button', { name: /Available/ }).click()
  await update.click()
  await expect(page.locator('.books-alert.danger')).toContainText(
    'A mandatory reason is required for a status change.',
  )

  // Real transition.
  await page.locator('#status-reason').fill('E2E inspection: spine intact, returned to shelf')
  await update.click()
  await expect(page.locator('.books-alert.success')).toContainText('Copy BK-10040 is now Available.')
  await expect(drawer).toContainText('Available')

  // Restore the seeded damaged state.
  await drawer.locator('.books-status-options').getByRole('button', { name: /Damaged/ }).click()
  await page.locator('#status-reason').fill('E2E cleanup: restore seeded damaged state')
  await update.click()
  await expect(page.locator('.books-alert.success')).toContainText('Copy BK-10040 is now Damaged.')

  // The immutable timeline recorded both transitions with their target status.
  await expect(drawer).toContainText('Status change')
  await expect(drawer.locator('.books-timeline')).toContainText('E2E cleanup')

  expectNoProblems(problems)
})

test('Copies: print barcode labels for one copy and for a selection', async ({ page }) => {
  const problems = watchProblems(page)
  await page.context().addInitScript(() => {
    // Printing opens a popup that calls window.print(); keep it headless-safe.
    window.print = () => {}
  })
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Copies')
  await waitForCopies(page)

  const search = page.getByLabel('Look up copies by barcode, title or ISBN')
  await search.fill('BK-10041')
  await search.press('Enter')
  await expect(page.locator('.books-table tbody tr')).toHaveCount(1)
  await page.locator('.books-table tbody tr').first().click()

  const singlePopupPromise = page.waitForEvent('popup')
  await page.locator('.books-detail').getByRole('button', { name: 'Print barcode' }).click()
  const singlePopup = await singlePopupPromise
  await expect(singlePopup.locator('h1')).toHaveText('Barcode label sheet')
  await expect(singlePopup.locator('.label')).toHaveCount(1)
  await expect(singlePopup.locator('.label .code')).toHaveText('BK-10041')
  await singlePopup.close()

  // Bulk print from the filter row.
  await search.fill('')
  await search.press('Enter')
  await waitForCopies(page)
  const checks = page.locator('.books-table tbody input[type=checkbox]')
  await checks.nth(0).check()
  await checks.nth(1).check()

  const bulkPopupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Print Barcode Labels (2)' }).click()
  const bulkPopup = await bulkPopupPromise
  await expect(bulkPopup.locator('.label')).toHaveCount(2)
  await bulkPopup.close()

  expectNoProblems(problems)
})

test('Import: template download, CSV validation, wrong file type and remove', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Import CSV')

  const confirm = page.getByRole('button', { name: 'Confirm Import' })
  await expect(confirm).toBeDisabled()

  // Template download.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '↓ CSV template download' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('catalog-import-template.csv')

  // A mixed file: one valid row, one invalid row.
  const mixed = [
    'title,isbn13,year,copies,collection',
    'E2E Valid Row,9780306406157,2020,1,standard',
    'E2E Bad Year,,20xx,1,standard',
  ].join('\r\n')
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e-mixed.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(mixed, 'utf8'),
  })

  await expect(page.locator('.books-file-card')).toContainText('e2e-mixed.csv')
  await expect(page.locator('.books-file-card')).toContainText('2 data rows parsed · 1 valid')
  await expect(page.locator('.books-alert.danger')).toContainText('1 row(s) have validation errors')
  await expect(page.locator('.import-errors-table tbody')).toContainText('Year must be four digits')
  await expect(confirm).toBeEnabled()

  // Remove resets the uploader.
  await page.locator('.books-file-card').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByRole('button', { name: 'Choose a CSV file or drop it here' })).toBeVisible()
  await expect(confirm).toBeDisabled()

  // Wrong extension is rejected.
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e-wrong.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('title\nnope', 'utf8'),
  })
  await expect(page.locator('.books-alert.danger')).toContainText('Choose a UTF-8 .csv file.')

  // A header-only file validates but has nothing to import, so Confirm stays off.
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e-empty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('title,isbn13,copies\r\n', 'utf8'),
  })
  await expect(page.locator('.books-alert.success')).toContainText('0 row(s) validated')
  await expect(confirm).toBeDisabled()

  expectNoProblems(problems)
})

test('History: every quick filter, date range, exports and audit inspection', async ({ page }) => {
  const problems = watchProblems(page)
  await page.context().addInitScript(() => {
    window.print = () => {}
  })
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'History')
  await waitForHistory(page)

  const filterTabs = page.locator('.books-tab .admin-filter-tabs').first()

  for (const label of ['Batch receipts', 'Manual additions', 'Stock reductions', 'Status changes', 'All']) {
    await filterTabs.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('.books-table tbody')).not.toContainText(HISTORY_LOADING)
    await expect(page.locator('.books-table tbody tr').first()).toBeVisible()
  }

  // Date range.
  const dates = page.locator('.books-date-range input[type=date]')
  await dates.nth(0).fill('2020-01-01')
  await dates.nth(1).fill('2030-12-31')
  await page.waitForTimeout(400)
  await expect(page.locator('.books-table tbody')).not.toContainText(HISTORY_LOADING)

  // Exports.
  const csvPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const csv = await csvPromise
  expect(csv.suggestedFilename()).toBe('inventory-history.csv')

  const xlsPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel' }).click()
  const xls = await xlsPromise
  expect(xls.suggestedFilename()).toBe('inventory-history.xls')

  const pdfPopupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Export PDF' }).click()
  const pdfPopup = await pdfPopupPromise
  await expect(pdfPopup.locator('h1')).toHaveText('Inventory audit log')
  await expect(pdfPopup.locator('table')).toBeVisible()
  await pdfPopup.close()

  // Reset filters clears the dates and the search.
  await page.locator('.books-filter-row').getByRole('button', { name: 'Reset filters' }).click()
  await expect(dates.nth(0)).toHaveValue('')
  await expect(dates.nth(1)).toHaveValue('')
  await waitForHistory(page)

  // Inspect a copy-level transaction.
  const row = page.locator('.books-table tbody tr').filter({ hasText: 'BK-' }).first()
  await expect(row).toBeVisible()
  await row.click()
  await expect(page.locator('.books-detail')).toContainText('Audit inspection')
  await expect(page.locator('.books-detail')).toContainText('Transaction detail')
  await expect(page.locator('.books-detail')).toContainText('Mandatory stated reason')

  // Drill into that copy's lifecycle.
  await page.getByRole('button', { name: 'Drill into copy history' }).click()
  const search = page.getByPlaceholder('Search book title, author, ISBN, or copy barcode…')
  await expect(search).toHaveValue(/BK-/)
  await waitForHistory(page)

  // Hand-off to the catalog.
  await page.locator('.books-table tbody tr').first().click()
  await page.getByRole('button', { name: 'Open title in catalog →' }).click()
  await expect(page.locator('.books-tab-switcher .admin-pill-btn.active')).toContainText('Books & Catalog')
  await waitForCatalog(page)

  expectNoProblems(problems)
})

test('Write-offs: create, stage, guard, save draft and cancel', async ({ page }) => {
  const problems = watchProblems(page)
  await signInAsAdmin(page)
  await openBooks(page)
  await openTab(page, 'Write-offs')

  // Filter pills and search.
  const pills = page.locator('.books-tab .admin-filter-tabs').first()
  for (const label of ['Drafts', 'Completed', 'Cancelled', 'All slips']) {
    await pills.getByRole('button', { name: label, exact: true }).click()
    await page.waitForTimeout(300)
  }

  const search = page.getByPlaceholder('Search write-off slip number, reason, or notes…')
  await search.fill('zzz-no-such-slip-zzz')
  await page.waitForTimeout(400)
  await expect(page.locator('.books-table tbody')).toContainText('No write-off slips found matching criteria.')
  await search.fill('')
  await page.waitForTimeout(400)

  // Create a draft.
  await page.getByRole('button', { name: '+ Create Write-Off Slip' }).click()
  await expect(page.locator('.books-alert.success')).toContainText('Draft write-off slip')
  const drawer = page.locator('.books-detail')
  await expect(drawer).toContainText('Staged Copies (0)')
  await expect(page.getByRole('button', { name: 'Complete Slip' })).toBeDisabled()

  // Stage a copy: bad barcode, borrowed copy, then an available copy.
  await page.getByRole('button', { name: '+ Stage Copies' }).click()
  const stageModal = page.locator('.books-modal').filter({ hasText: 'Stage Copy to Write-off Slip' })
  await expect(stageModal).toBeVisible()

  const barcodeInput = stageModal.getByPlaceholder('Scan or enter copy barcode (e.g. LIB-2026-00001)…')
  await barcodeInput.fill('E2E-NO-SUCH-COPY')
  await stageModal.getByRole('button', { name: 'Lookup' }).click()
  await expect(stageModal.locator('.books-alert.danger')).toContainText('No copy found matching barcode')

  await barcodeInput.fill('BK-10060')
  await stageModal.getByRole('button', { name: 'Lookup' }).click()
  await expect(stageModal.locator('.books-alert.danger')).toContainText('currently borrowed on loan')

  await barcodeInput.fill('BK-10050')
  await stageModal.getByRole('button', { name: 'Lookup' }).click()
  await expect(stageModal).toContainText('A Brief History of Time')
  // The "Assessment Note" <label> has no htmlFor, so target the input directly.
  await stageModal
    .getByPlaceholder('e.g. Severe water damage on pages 40-120; binding snapped')
    .fill('E2E probe: torn cover')
  await stageModal.getByRole('button', { name: 'Add to Staged Copies' }).click()

  await expect(drawer).toContainText('Staged Copies (1)')
  await expect(drawer).toContainText('BK-10050')

  // Completing without photographic evidence is refused before any write.
  await page.getByRole('button', { name: 'Complete Slip' }).click()
  await expect(page.locator('.books-alert.danger')).toContainText(
    'At least one photographic evidence file is mandatory',
  )

  // Save the draft.
  await page.getByRole('button', { name: 'Save Draft' }).click()
  await expect(page.locator('.books-alert.success')).toContainText('Draft slip updated successfully.')

  // The staged barcode links into the Copies tab scoped to that title.
  await drawer.getByRole('button', { name: 'BK-10050' }).click()
  await expect(page.locator('.books-tab-switcher .admin-pill-btn.active')).toContainText('Copies')
  await expect(page.getByText('Showing copies for one title')).toBeVisible()
  await waitForCopies(page)
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByText('Showing copies for one title')).toHaveCount(0)

  // Return to the draft and cancel it (Keep Draft first, then the real cancel).
  await openTab(page, 'Write-offs')
  await expect(page.locator('.books-table tbody tr').first()).toBeVisible()
  await page.locator('.books-table tbody tr').first().click()
  await expect(page.locator('.books-detail')).toContainText('Staged Copies (1)')

  await page.locator('.books-detail').getByRole('button', { name: 'Cancel Slip' }).click()
  let cancelModal = page.locator('.books-modal').filter({ hasText: 'Cancel Write-off Slip' })
  await expect(cancelModal).toBeVisible()
  await cancelModal.getByRole('button', { name: 'Keep Draft' }).click()
  await expect(cancelModal).toHaveCount(0)
  await expect(page.locator('.books-detail')).toContainText('Draft')

  await page.locator('.books-detail').getByRole('button', { name: 'Cancel Slip' }).click()
  cancelModal = page.locator('.books-modal').filter({ hasText: 'Cancel Write-off Slip' })
  await expect(cancelModal).toBeVisible()
  await cancelModal
    .getByPlaceholder('e.g. Draft created in error / copy salvaged')
    .fill('E2E cleanup: draft created by the automated walkthrough')
  await cancelModal.getByRole('button', { name: 'Cancel Slip' }).click()

  await expect(page.locator('.books-alert.success')).toContainText('has been cancelled')
  await expect(page.locator('.books-detail')).toContainText('Cancelled:')

  expectNoProblems(problems)
})
