import { expect, test } from '@playwright/test';
import { loginAsAdmin, navigateByGlobalSearch } from './helpers';

test.describe('Smoke routes', () => {
  test('critical routes load and render key headings', async ({ page }) => {
    await loginAsAdmin(page);

    await navigateByGlobalSearch(page, 'list-payments');
    await expect(page.getByRole('heading', { name: 'List Payments' })).toBeVisible();

    await navigateByGlobalSearch(page, 'add-sale');
    await expect(page.getByRole('heading', { name: 'Add Sale' })).toBeVisible();

    await navigateByGlobalSearch(page, 'list-orders');
    await expect(page.getByRole('heading', { name: 'List Orders' })).toBeVisible();

    await navigateByGlobalSearch(page, 'report-profit-loss');
    await expect(page.getByRole('heading', { name: 'Profit / Loss Report' })).toBeVisible();

    await navigateByGlobalSearch(page, 'settings');
    await expect(page.getByRole('heading', { name: 'Business Settings' })).toBeVisible();
  });
});
