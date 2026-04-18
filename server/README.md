# ATWAR BSS Backend (PostgreSQL)

This backend now supports:
- Core snapshot sync (backward compatible with current frontend flow)
- Relational CRUD APIs for module tables
- Dropdown/master collections sync
- Bootstrap defaults endpoint

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment

Copy `server/.env.example` to `server/.env` and verify values:

```env
DATABASE_URL="postgresql://postgres:admin@localhost:5432/atwar_bss?schema=public"
PORT=4000
FRONTEND_ORIGIN="http://localhost:5173"
```

## 3) Create Prisma client and DB table

```bash
npm run db:generate
npm run db:push
```

## 4) Start backend

```bash
npm run server:dev
```

## API summary

Health:
- `GET /api/health`

Legacy snapshot sync:
- `/api/sync/core`, `/api/sync/collection/:key`, and `/api/options/bulk` are disabled with `410 Gone`.
- Business data must use typed PostgreSQL resources through `/api/data/*`, `/api/sync/record/*`, or dedicated sync endpoints.

Relational CRUD:
- `GET /api/data/resources` (discover available resources)
- `GET /api/data/status` (high-level row counts)
- `GET /api/data/:resource?page=1&pageSize=25&q=...&where={...}`
- `GET /api/data/:resource/:id`
- `POST /api/data/:resource`
- `POST /api/data/:resource/bulk-upsert`
- `PUT /api/data/:resource/:id`
- `DELETE /api/data/:resource/:id`

Role permissions:
- `GET /api/data/roles/:roleId/permissions`
- `PUT /api/data/roles/:roleId/permissions`

Bootstrap:
- `POST /api/bootstrap/defaults`

Notes:

- On first frontend load with `VITE_ENABLE_DB_SYNC=true`, typed dropdown/master tables are loaded from PostgreSQL and seeded only through relational resources.
- Snapshot and option-collection blob storage is no longer a supported business-data path.

## Ops hardening commands

Use these before go-live and after major backend/deployment changes.

```bash
# 1) Render + Neon health with latency thresholds and optional alert webhook
npm run ops:health:alerts

# 2) PostgreSQL reconciliation summary (writes qa/reports/ops-reconciliation-summary.json)
npm run ops:reconcile

# 3) Multi-user concurrency smoke (2-3 sessions against same customer/order/payment)
npm run ops:smoke:concurrency

# 4) One-command go-live checklist (runs all of the above in sequence)
npm run ops:go-live:checklist
```

### Optional environment variables

`ops:health:alerts`
- `HEALTH_API_BASE_URL` default: `http://localhost:4000`
- `HEALTH_CHECK_TIMEOUT_MS` default: `7000`
- `HEALTH_SAMPLE_COUNT` default: `3`
- `HEALTH_WARN_LATENCY_MS` default: `1200`
- `HEALTH_FAIL_LATENCY_MS` default: `3500`
- `HEALTH_FAIL_ON_DEGRADED` default: `false` (set `true` for strict CI gating)
- `HEALTH_ENABLE_NEON_DIRECT_CHECK` default: `true`
- `HEALTH_ALERT_WEBHOOK_URL` optional webhook for degraded/down alerts

`ops:smoke:concurrency`
- `SMOKE_API_BASE_URL` default falls back to `HEALTH_API_BASE_URL`
- `SMOKE_SESSION_COUNT` default: `3` (min 2, max 3)
- `SMOKE_TIMEOUT_MS` default: `15000`
- `SMOKE_REQUIRED` default: `false` (set `true` in CI to fail if credentials are missing)
- `SMOKE_SKIP_CLEANUP` default: `false`
- Shared credentials: `SMOKE_EMAIL`, `SMOKE_PASSWORD`
- Per-session credentials: `SMOKE_USER_1_EMAIL/PASSWORD`, `SMOKE_USER_2_EMAIL/PASSWORD`, `SMOKE_USER_3_EMAIL/PASSWORD`

### Multi-user smoke test plan (what is tested)

`npm run ops:smoke:concurrency` validates a real shared-data race path:
1. Login 2-3 sessions.
2. Create one shared customer.
3. Create one shared order on that customer.
4. Run concurrent updates from all sessions against that same customer.
5. Run concurrent updates from all sessions against that same order.
6. Run concurrent payment inserts against that same customer.
7. Verify records from API (`/api/data/*`) and confirm expected final-state constraints.
8. Cleanup the temporary customer/order/payment records (unless `SMOKE_SKIP_CLEANUP=true`).
