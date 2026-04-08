import { expect, Page } from '@playwright/test';

const E2E_SESSION_KEY = 'atwar_secure_session_user_v1';
const E2E_TOKEN_KEY = 'atwar_auth_token';

const seedFallbackSession = async (page: Page) => {
  await page.evaluate(
    ({ sessionKey, tokenKey }) => {
      const user = {
        id: 'USR-E2E-ADMIN',
        username: 'admin',
        name: 'E2E Admin',
        role: 'Admin',
        email: 'admin@atwar.com',
        status: 'Active',
        lastLogin: new Date().toISOString(),
        accessLocations: ['All Locations'],
        allowLogin: true,
        enableServiceStaffPin: false,
      };
      sessionStorage.setItem(sessionKey, JSON.stringify(user));
      localStorage.setItem(tokenKey, 'e2e-fallback-token');
    },
    { sessionKey: E2E_SESSION_KEY, tokenKey: E2E_TOKEN_KEY },
  );
  await page.reload();
};

export const loginAsAdmin = async (page: Page) => {
  await page.goto('/');
  const searchInput = page.getByPlaceholder('Search module or page...');
  if (await searchInput.isVisible().catch(() => false)) {
    return;
  }

  await page.locator('input[type="email"]').fill('admin@atwar.com');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  // CI preview runs frontend-only and may not have a live auth backend.
  // For route smoke coverage, seed a deterministic authenticated session
  // whenever login is still on the auth screen after submit.
  const stillOnLogin = await page.locator('input[type="email"]').isVisible().catch(() => false);
  if (stillOnLogin) {
    await seedFallbackSession(page);
  }

  await expect(page.getByPlaceholder('Search module or page...')).toBeVisible({ timeout: 15000 });
};

export const navigateByGlobalSearch = async (page: Page, query: string) => {
  const input = page.getByPlaceholder('Search module or page...');
  await input.click();
  await input.fill(query);
  await input.press('Enter');
};
