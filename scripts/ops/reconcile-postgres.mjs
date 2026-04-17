import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const nowIso = new Date().toISOString();
const reportDir = path.resolve(process.cwd(), 'qa', 'reports');
const reportPath = path.join(reportDir, 'ops-reconciliation-summary.json');

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round3 = (value) => Number(toNumber(value).toFixed(3));

async function main() {
  const [
    customersAgg,
    suppliersAgg,
    productsAgg,
    salesAgg,
    purchasesAgg,
    sellReturnsAgg,
    purchaseReturnsAgg,
    paymentsAgg,
    fieldPaymentsAgg,
    expensesAgg,
    ordersAgg,
    customersWithoutGroup,
    inactiveUsers,
    salesByPaymentStatus,
    purchasesByPaymentStatus,
    ordersByStatus,
  ] = await Promise.all([
    prisma.customer.aggregate({
      _count: { _all: true },
      _sum: {
        openingBalance: true,
        advanceBalance: true,
        totalSellDue: true,
        totalSellReturnDue: true,
      },
    }),
    prisma.supplier.aggregate({
      _count: { _all: true },
      _sum: {
        openingBalance: true,
        advanceBalance: true,
        totalPurchaseDue: true,
        totalReturnDue: true,
      },
    }),
    prisma.product.aggregate({
      _count: { _all: true },
      _sum: {
        stock: true,
      },
    }),
    prisma.sale.aggregate({
      _count: { _all: true },
      _sum: {
        grandTotal: true,
        totalPaid: true,
        sellDue: true,
      },
    }),
    prisma.purchase.aggregate({
      _count: { _all: true },
      _sum: {
        grandTotal: true,
        paymentDue: true,
      },
    }),
    prisma.sellReturn.aggregate({
      _count: { _all: true },
      _sum: {
        grandTotal: true,
        totalRefunded: true,
      },
    }),
    prisma.purchaseReturn.aggregate({
      _count: { _all: true },
      _sum: {
        grandTotal: true,
        totalRefunded: true,
      },
    }),
    prisma.payment.aggregate({
      _count: { _all: true },
      _sum: {
        amount: true,
      },
    }),
    prisma.fieldPayment.aggregate({
      _count: { _all: true },
      _sum: {
        amount: true,
      },
    }),
    prisma.expense.aggregate({
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        paymentDue: true,
      },
    }),
    prisma.salesOrder.aggregate({
      _count: { _all: true },
      _sum: {
        total: true,
      },
    }),
    prisma.customer.count({ where: { customerGroupId: null } }),
    prisma.appUser.count({
      where: {
        OR: [{ status: 'INACTIVE' }, { allowLogin: false }],
      },
    }),
    prisma.sale.groupBy({
      by: ['paymentStatus'],
      _count: { _all: true },
      _sum: { grandTotal: true, sellDue: true },
      orderBy: { paymentStatus: 'asc' },
    }),
    prisma.purchase.groupBy({
      by: ['paymentStatus'],
      _count: { _all: true },
      _sum: { grandTotal: true, paymentDue: true },
      orderBy: { paymentStatus: 'asc' },
    }),
    prisma.salesOrder.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { total: true },
      orderBy: { status: 'asc' },
    }),
  ]);

  const report = {
    generatedAt: nowIso,
    sourceOfTruth: 'PostgreSQL via Prisma',
    core: {
      customers: {
        count: customersAgg._count._all,
        openingBalance: round3(customersAgg._sum.openingBalance),
        advanceBalance: round3(customersAgg._sum.advanceBalance),
        totalSellDue: round3(customersAgg._sum.totalSellDue),
        totalSellReturnDue: round3(customersAgg._sum.totalSellReturnDue),
        customersWithoutGroup,
      },
      suppliers: {
        count: suppliersAgg._count._all,
        openingBalance: round3(suppliersAgg._sum.openingBalance),
        advanceBalance: round3(suppliersAgg._sum.advanceBalance),
        totalPurchaseDue: round3(suppliersAgg._sum.totalPurchaseDue),
        totalReturnDue: round3(suppliersAgg._sum.totalReturnDue),
      },
      products: {
        count: productsAgg._count._all,
        aggregateStockQty: round3(productsAgg._sum.stock),
      },
      sales: {
        count: salesAgg._count._all,
        grandTotal: round3(salesAgg._sum.grandTotal),
        totalPaid: round3(salesAgg._sum.totalPaid),
        totalDue: round3(salesAgg._sum.sellDue),
      },
      purchases: {
        count: purchasesAgg._count._all,
        grandTotal: round3(purchasesAgg._sum.grandTotal),
        totalDue: round3(purchasesAgg._sum.paymentDue),
      },
      orders: {
        count: ordersAgg._count._all,
        total: round3(ordersAgg._sum.total),
      },
      payments: {
        count: paymentsAgg._count._all,
        amountTotal: round3(paymentsAgg._sum.amount),
      },
      fieldPayments: {
        count: fieldPaymentsAgg._count._all,
        amountTotal: round3(fieldPaymentsAgg._sum.amount),
      },
      expenses: {
        count: expensesAgg._count._all,
        totalAmount: round3(expensesAgg._sum.totalAmount),
        totalDue: round3(expensesAgg._sum.paymentDue),
      },
      sellReturns: {
        count: sellReturnsAgg._count._all,
        grandTotal: round3(sellReturnsAgg._sum.grandTotal),
        totalRefunded: round3(sellReturnsAgg._sum.totalRefunded),
        estimatedOutstanding: round3(
          toNumber(sellReturnsAgg._sum.grandTotal) - toNumber(sellReturnsAgg._sum.totalRefunded),
        ),
      },
      purchaseReturns: {
        count: purchaseReturnsAgg._count._all,
        grandTotal: round3(purchaseReturnsAgg._sum.grandTotal),
        totalRefunded: round3(purchaseReturnsAgg._sum.totalRefunded),
        estimatedOutstanding: round3(
          toNumber(purchaseReturnsAgg._sum.grandTotal) - toNumber(purchaseReturnsAgg._sum.totalRefunded),
        ),
      },
      users: {
        inactiveOrLoginDisabled: inactiveUsers,
      },
    },
    breakdowns: {
      salesByPaymentStatus: salesByPaymentStatus.map((row) => ({
        paymentStatus: row.paymentStatus,
        count: row._count._all,
        grandTotal: round3(row._sum.grandTotal),
        due: round3(row._sum.sellDue),
      })),
      purchasesByPaymentStatus: purchasesByPaymentStatus.map((row) => ({
        paymentStatus: row.paymentStatus,
        count: row._count._all,
        grandTotal: round3(row._sum.grandTotal),
        due: round3(row._sum.paymentDue),
      })),
      ordersByStatus: ordersByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        total: round3(row._sum.total),
      })),
    },
  };

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('[ops:reconcile] PostgreSQL reconciliation summary generated');
  console.log(`[ops:reconcile] Report: ${reportPath}`);
  console.log(
    JSON.stringify(
      {
        generatedAt: report.generatedAt,
        customers: report.core.customers.count,
        products: report.core.products.count,
        sales: report.core.sales.count,
        purchases: report.core.purchases.count,
        payments: report.core.payments.count,
        customersWithoutGroup: report.core.customers.customersWithoutGroup,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('[ops:reconcile] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
