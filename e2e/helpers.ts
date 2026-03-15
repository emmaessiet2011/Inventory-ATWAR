import { expect, Page } from '@playwright/test';

export const loginAsAdmin = async (page: Page) => {
  await page.goto('/');
  const searchInput = page.getByPlaceholder('Search module or page...');
  if (await searchInput.isVisible().catch(() => false)) {
    return;
  }

  await page.locator('input[type="email"]').fill('admin@atwar.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByPlaceholder('Search module or page...')).toBeVisible();
};

export const navigateByGlobalSearch = async (page: Page, query: string) => {
  const input = page.getByPlaceholder('Search module or page...');
  await input.click();
  await input.fill(query);
  await input.press('Enter');
};
