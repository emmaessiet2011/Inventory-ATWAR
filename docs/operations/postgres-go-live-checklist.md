# Postgres Go-Live Checklist

Use this checklist for technical release readiness.  
Business sign-off is managed separately by operations/process owners.

## 1. Environment Readiness

- [ ] `DATABASE_URL` points to production Neon project.
- [ ] `JWT_SECRET` is set and non-default.
- [ ] `VITE_API_BASE_URL` points to production backend.
- [ ] Render service health endpoint returns `status: up` and `db: connected`.
- [ ] Namecheap build artifact is from latest approved commit.

## 2. Data Integrity Gate

- [ ] Run `npm run ops:reconcile`.
- [ ] Confirm `customersWithoutGroup = 0` in `qa/reports/ops-reconciliation-summary.json`.
- [ ] Confirm customer/supplier due totals are within approved reconciliation tolerance.
- [ ] Confirm sales/purchases/payment counts are non-zero and expected for current stage.
- [ ] Confirm no unexpected inactive/disabled user accounts.

## 3. Functional Gate (Engineering)

- [ ] `npm run typecheck:strict` passes.
- [ ] `npm run audit:quality` passes.
- [ ] Critical auth flow tested (`/api/auth/login` with active account).
- [ ] Order → approval → invoice generation flow tested.
- [ ] Sell payment and field payment approval flow tested.
- [ ] Sell return flow updates due and report totals correctly.

## 4. Operational Safety

- [ ] Backup executed before cutover window.
- [ ] Restore drill completed on test/staging target.
- [ ] Activity log captures create/update/delete events in critical modules.
- [ ] Monitoring alert channel and owner are confirmed.

## 5. Launch Control

- [ ] Release tag created.
- [ ] Rollback path documented (previous Render deploy + prior dist package).
- [ ] Hypercare owner assigned for first 72 hours post go-live.
