import { expect, test } from '@playwright/test';
import { navigateByGlobalSearch } from './helpers';

test.describe('Large data behavior', () => {
  test('List Payments handles 1500 rows with pagination', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      const currentUser = {
        id: 'USR-001',
        username: 'admin_main',
        name: 'Admin User',
        role: 'Admin',
        email: 'admin@atwar.com',
        status: 'Active',
        lastLogin: now,
      };

      const customer = {
        id: 'CUST-LARGE-1',
        businessName: 'Large Dataset Customer',
        name: 'Large Dataset Customer',
        email: '',
        taxNumber: '',
        creditLimit: 0,
        payTerm: '',
        openingBalance: 0,
        advanceBalance: 0,
        addedOn: now.slice(0, 10),
        customerGroup: '',
        address: '',
        mobile: '',
        totalSellDue: 0,
        totalSellReturnDue: 0,
        status: 'Active',
      };

      const payments = Array.from({ length: 1500 }, (_, index) => ({
        id: `PAY-LARGE-${index + 1}`,
        date: now,
        contactId: customer.id,
        contactName: customer.businessName,
        contactType: 'Customer',
        amount: 10 + (index % 5),
        method: 'Cash',
        account: '',
        location: 'CR:1450968',
        referenceNo: `PAY-${String(index + 1).padStart(5, '0')}`,
        note: '',
        type: 'received',
        linkedInvoices: [],
        addedBy: 'Admin User',
      }));

      window.localStorage.setItem('app_current_user', JSON.stringify(currentUser));
      window.localStorage.setItem('app_customers_v2', JSON.stringify([customer]));
      window.localStorage.setItem('app_payments', JSON.stringify(payments));
    });

    await page.goto('/');
    await expect(page.getByPlaceholder('Search module or page...')).toBeVisible();

    await navigateByGlobalSearch(page, 'list-payments');
    await expect(page.getByRole('heading', { name: 'List Payments' })).toBeVisible();
    await expect(page.getByText('Showing 1 to 25 of 1500 entries')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Showing 26 to 50 of 1500 entries')).toBeVisible();

    await page.locator('select').first().selectOption('100');
    await expect(page.getByText('Showing 1 to 100 of 1500 entries')).toBeVisible();
  });
});
