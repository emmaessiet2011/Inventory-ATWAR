import { expect, Page } from '@playwright/test';

const E2E_SESSION_KEY = 'atwar_secure_session_user_v1';
const E2E_AUTH_TOKEN_KEY = 'atwar_auth_token';

const buildE2EFallbackJwt = (): string => {
  const encode = (value: Record<string, unknown>): string =>
    Buffer
      .from(JSON.stringify(value), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: 'USR-E2E-ADMIN',
    role: 'Admin',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e-signature`;
};

const seedFallbackSession = async (page: Page) => {
  const fallbackToken = buildE2EFallbackJwt();
  await page.evaluate(
    ({ sessionKey, tokenKey, fallbackTokenValue }) => {
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
      localStorage.setItem(tokenKey, fallbackTokenValue);
    },
    { sessionKey: E2E_SESSION_KEY, tokenKey: E2E_AUTH_TOKEN_KEY, fallbackTokenValue: fallbackToken },
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
