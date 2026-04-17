# Operations Playbook

This folder is the technical go-live and run-operations pack for ATWAR BSS in Postgres mode.

## Files

- `postgres-go-live-checklist.md`: engineering-owned launch checklist.
- `business-uat-scenarios.md`: end-to-end UAT scenarios and expected results.
- `cutover-reconciliation-runbook.md`: cutover and reconciliation process.
- `postgres-backup-restore-drill.md`: backup and restore validation drill.

## Commands

- `npm run ops:reconcile`  
  Generate DB reconciliation report from PostgreSQL into:
  - `qa/reports/ops-reconciliation-summary.json`
- `npm run ops:health`  
  Check `/healthz` and `/api/health` for API + DB connectivity.
- `npm run ops:go-live`  
  Run strict typecheck + route/placeholders audits + DB reconciliation.
