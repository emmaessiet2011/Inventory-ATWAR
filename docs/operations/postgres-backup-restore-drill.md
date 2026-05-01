# Postgres Backup & Restore Drill

This drill validates that production data can be recovered when needed.

## Frequency

- Minimum: weekly
- Mandatory before major release, schema changes, or bulk imports

## Backup Source

- Primary: VPS PostgreSQL backup/snapshot
- Optional supplemental: SQL export (`pg_dump`) for point-in-time evidence

## Drill Steps

1. Record drill start timestamp and current production commit hash.
2. Create a fresh VPS PostgreSQL backup/snapshot.
3. Restore backup into isolated target (staging or temporary branch DB).
4. Point a test backend instance to restored DB.
5. Run health checks:
   - `/healthz`
   - `/api/health`
6. Run reconciliation:

```bash
npm run ops:reconcile
```

7. Execute smoke validations on restored environment:
   - login
   - list customers/products/sales
   - create and rollback one low-risk transaction if allowed
8. Record result:
   - restore duration
   - any mismatches
   - pass/fail

## Acceptance Criteria

- API starts successfully on restored DB.
- Core modules load without DB errors.
- Reconciliation totals are consistent with pre-backup baseline.
- No missing critical reference data (users, roles, settings, tax/location schemas).

## Required Drill Evidence

- Backup/snapshot identifier
- Restore target identifier
- `ops-reconciliation-summary.json` from restored environment
- Health check output
- Tester name and sign-off timestamp
