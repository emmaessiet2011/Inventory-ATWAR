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

Core snapshot sync:
- `GET /api/sync/core`
- `PUT /api/sync/core`
- `GET /api/sync/core/status`
- `POST /api/sync/core/materialize` (imports snapshot into relational tables)

Dropdown/master collections:
- `GET /api/options/bulk?keys=roles,locations,taxRates,productCategories,productBrands,productUnits,customerGroups,sellingPriceGroups,invoiceSchemes,invoiceLayouts,barcodeSettings,expenseCategories`
- `PUT /api/options/bulk`

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

- On first frontend load with `VITE_ENABLE_DB_SYNC=true`, if dropdown collections are empty in DB, the app seeds them automatically from current app state.
- Existing frontend can continue using snapshot sync while you progressively move screens to relational CRUD endpoints.
- Frontend `pushCoreSnapshot()` now triggers `/api/sync/core/materialize` automatically, so relational tables stay updated without waiting for a full frontend refactor.
