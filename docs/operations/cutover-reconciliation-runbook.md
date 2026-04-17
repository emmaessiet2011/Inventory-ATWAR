# Cutover & Reconciliation Runbook

This runbook is for moving from pre-go-live state to production operation with PostgreSQL as source of truth.

## 1. Pre-Cutover

1. Freeze data entry in old process/system at agreed cutover timestamp.
2. Import latest master data (customers, suppliers, products, groups, settings).
3. Verify all imports against row counts from source files.
4. Run:

```bash
npm run ops:reconcile
```

5. Archive generated report:
   - `qa/reports/ops-reconciliation-summary.json`

## 2. Reconciliation Checklist

Validate and sign off:

- Customer totals:
  - `openingBalance`
  - `advanceBalance`
  - `totalSellDue`
  - `totalSellReturnDue`
- Supplier totals:
  - `openingBalance`
  - `advanceBalance`
  - `totalPurchaseDue`
  - `totalReturnDue`
- Product totals:
  - aggregate stock quantity
- Transaction totals:
  - sales `grandTotal`, `totalPaid`, `totalDue`
  - purchases `grandTotal`, `totalDue`
  - payments amount totals
  - returns totals

Hard gate:

- `customersWithoutGroup` must be `0`.

## 3. API/DB Readiness Check

Run:

```bash
npm run ops:health
```

Expected:

- `/healthz` => `status: up`
- `/api/health` => `status: up`, `db: connected`

## 4. Post-Cutover Validation

1. Login with admin and one non-admin role account.
2. Execute one smoke transaction per critical flow:
   - order lifecycle
   - sale + payment
   - field payment approval
   - stock adjustment
3. Confirm totals changed as expected in reports.

## 5. Evidence Pack

Store the following per cutover event:

- Commit hash and deployed URL
- `ops-reconciliation-summary.json`
- UAT pass/fail records
- Health check output
- Rollback version identifier
