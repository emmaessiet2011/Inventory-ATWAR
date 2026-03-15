import { expect, Page, test } from '@playwright/test';
import { loginAsAdmin, navigateByGlobalSearch } from './helpers';

const assertNoHorizontalOverflow = async (page: Page) => {
  const hasOverflow = await page.evaluate(() => {
    const tolerance = 1;
    return document.documentElement.scrollWidth - window.innerWidth > tolerance;
  });
  expect(hasOverflow).toBe(false);
};

test.describe('UI fit', () => {
  test('desktop pages do not force horizontal page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await loginAsAdmin(page);

    await navigateByGlobalSearch(page, 'dashboard');
    await expect(page.getByText('Stock Action Plan')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await navigateByGlobalSearch(page, 'add-order');
    await expect(page.getByText('Order Items')).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await navigateByGlobalSearch(page, 'list-payments');
    await expect(page.getByRole('heading', { name: 'List Payments' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('mobile shell remains usable without horizontal page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page);

    await navigateByGlobalSearch(page, 'dashboard');
    await expect(page.getByText('Stock Action Plan')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
