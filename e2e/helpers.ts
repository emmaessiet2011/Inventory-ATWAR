import { expect, Page } from '@playwright/test';

const E2E_SESSION_KEY = 'atwar_secure_session_user_v1';

const seedFallbackSession = async (page: Page) => {
  await page.evaluate(
    ({ sessionKey }) => {
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
      localStorage.removeItem('atwar_auth_token');
    },
    { sessionKey: E2E_SESSION_KEY },
  );
  await page.reload();
};

export const loginAsAdmin = async (page: Page) => {
  await page.goto('/');
  const searchInput = page.getByPlaceholder('Search module or page...');
  if (await searchInput.isVisible().catch(() => false)) {
    return;
  }

  const loginIdentifierInput = page.getByRole('textbox').first();
  await loginIdentifierInput.fill('admin@atwar.com');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    return;
  }

  // CI preview runs frontend-only and may not have a live auth backend.
  // For route smoke coverage, seed a deterministic authenticated session
  // whenever we're still on the auth screen after submit (including
  // "Signing In..." warm-up states).
  const stillOnLogin =
    await page.getByRole('heading', { name: 'Welcome back' }).isVisible().catch(() => false)
    || await page.getByRole('button', { name: /Sign In|Signing In/i }).isVisible().catch(() => false)
    || await page.locator('input[type="password"]').first().isVisible().catch(() => false);
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
