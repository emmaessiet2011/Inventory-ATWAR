/**
 * clean-db.mjs
 * Wipes all business/transaction data from the production PostgreSQL database.
 * Preserves: AppUser (users) and Location (+ LocationPaymentMethod).
 * Uses the server database connection only; business data is not cleared from browser storage.
 *
 * Run from project root: node scripts/clean-db.mjs
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../server/.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database…');
  await prisma.$connect();
  console.log('Connected.\n');

  // ── 1. Delete in dependency order (children before parents) ──────────────

  const steps = [
    // Leaf / child tables
    ['activityLog',              () => prisma.activityLog.deleteMany()],
    ['notification',             () => prisma.notification.deleteMany()],
    ['customFieldValue',         () => prisma.customFieldValue.deleteMany()],
    ['helpCenterArticle',        () => prisma.helpCenterArticle.deleteMany()],
    ['helpCenterCategory',       () => prisma.helpCenterCategory.deleteMany()],
    ['registerTransaction',      () => prisma.registerTransaction.deleteMany()],
    ['fieldPaymentAllocation',   () => prisma.fieldPaymentAllocation.deleteMany()],
    ['paymentAllocation',        () => prisma.paymentAllocation.deleteMany()],
    ['stockLedger',              () => prisma.stockLedger.deleteMany()],
    ['stockLot',                 () => prisma.stockLot.deleteMany()],
    ['productInventory',         () => prisma.productInventory.deleteMany()],
    ['paymentAccountTransaction',() => prisma.paymentAccountTransaction.deleteMany()],
    ['saleShippingActivity',     () => prisma.saleShippingActivity.deleteMany()],
    ['saleItem',                 () => prisma.saleItem.deleteMany()],
    ['sellReturnItem',           () => prisma.sellReturnItem.deleteMany()],
    ['purchaseItem',             () => prisma.purchaseItem.deleteMany()],
    ['purchaseReturnItem',       () => prisma.purchaseReturnItem.deleteMany()],
    ['salesOrderItem',           () => prisma.salesOrderItem.deleteMany()],
    ['stockTransferItem',        () => prisma.stockTransferItem.deleteMany()],
    ['stockAdjustmentItem',      () => prisma.stockAdjustmentItem.deleteMany()],
    ['customFieldDefinition',    () => prisma.customFieldDefinition.deleteMany()],

    // Parent / transaction tables
    ['sellReturn',               () => prisma.sellReturn.deleteMany()],
    ['purchaseReturn',           () => prisma.purchaseReturn.deleteMany()],
    ['fieldPayment',             () => prisma.fieldPayment.deleteMany()],
    ['expense',                  () => prisma.expense.deleteMany()],
    ['payment',                  () => prisma.payment.deleteMany()],
    ['sale',                     () => prisma.sale.deleteMany()],
    ['salesOrder',               () => prisma.salesOrder.deleteMany()],
    ['purchase',                 () => prisma.purchase.deleteMany()],
    ['registerSession',          () => prisma.registerSession.deleteMany()],
    ['stockTransfer',            () => prisma.stockTransfer.deleteMany()],
    ['stockAdjustment',          () => prisma.stockAdjustment.deleteMany()],

    // Product catalogue
    ['product',                  () => prisma.product.deleteMany()],

    // Contacts
    ['customer',                 () => prisma.customer.deleteMany()],
    ['supplier',                 () => prisma.supplier.deleteMany()],

    // Reference / config data
    ['expenseCategory',          () => prisma.expenseCategory.deleteMany()],
    ['taxRate',                  () => prisma.taxRate.deleteMany()],
    ['customerGroup',            () => prisma.customerGroup.deleteMany()],
    ['productCategory',          () => prisma.productCategory.deleteMany()],
    ['productBrand',             () => prisma.productBrand.deleteMany()],
    ['productUnit',              () => prisma.productUnit.deleteMany()],
    ['productWarranty',          () => prisma.productWarranty.deleteMany()],
    ['salesRepresentative',      () => prisma.salesRepresentative.deleteMany()],
    ['sellingPriceGroup',        () => prisma.sellingPriceGroup.deleteMany()],
    ['discount',                 () => prisma.discount.deleteMany()],
    ['paymentAccount',           () => prisma.paymentAccount.deleteMany()],
    ['paymentAccountType',       () => prisma.paymentAccountType.deleteMany()],
    ['currency',                 () => prisma.currency.deleteMany()],
    ['appSetting',               () => prisma.appSetting.deleteMany()],

  ];

  for (const [label, fn] of steps) {
    try {
      const result = await fn();
      console.log(`  ✓ ${label.padEnd(28)} deleted ${result.count} rows`);
    } catch (err) {
      console.warn(`  ⚠ ${label.padEnd(28)} skipped (${err.message})`);
    }
  }

  // ── 2. Fetch surviving users for summary only ────────────────────────────
  console.log('\nBuilding clean snapshot from surviving users…');
  const users = await prisma.appUser.findMany();
  console.log(`  Found ${users.length} user(s): ${users.map(u => u.name).join(', ')}`);

  // ── 3. Summary ────────────────────────────────────────────────────────────
  const [userCount, locationCount] = await Promise.all([
    prisma.appUser.count(),
    prisma.location.count(),
  ]);

  console.log('\n──────────────────────────────────────────');
  console.log('Clean-up complete.');
  console.log(`  Users preserved:     ${userCount}`);
  console.log(`  Locations preserved: ${locationCount}`);
  console.log('──────────────────────────────────────────\n');
}

main()
  .catch(err => { console.error('Fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
