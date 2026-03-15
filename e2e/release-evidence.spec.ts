import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loginAsAdmin, navigateByGlobalSearch } from './helpers';

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

test.describe('Release evidence', () => {
  test('capture key route screenshots for launch package', async ({ page }) => {
    const outputDir = path.join(process.cwd(), 'qa', 'reports', 'screenshots', '2026-03-12');
    ensureDir(outputDir);

    await loginAsAdmin(page);

    await navigateByGlobalSearch(page, 'dashboard');
    await expect(page.getByText('Stock Action Plan')).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, 'dashboard.png'), fullPage: true });

    await navigateByGlobalSearch(page, 'list-payments');
    await expect(page.getByRole('heading', { name: 'List Payments' })).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, 'list-payments.png'), fullPage: true });

    await navigateByGlobalSearch(page, 'backup-restore');
    await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toBeVisible();
    await page.screenshot({ path: path.join(outputDir, 'backup-restore.png'), fullPage: true });
  });
});

