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
