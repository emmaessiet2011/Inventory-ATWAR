# Release Checklist

## Pre-Freeze
- [x] Scope locked and release owner assigned.
- [x] `docs/quality/screen-audit-checklist.md` updated for all in-scope routes.
- [x] `qa/known-issues.json` reviewed and current.

## Freeze Gate
- [x] `npm run release:check` passes.
- [x] No open P1/P2 issues.
- [x] Smoke test sign-off from product + engineering.

## Post-Freeze Rules
- [x] Only blocker fixes allowed.
- [x] Every blocker fix must include a regression test.
- [x] Re-run `npm run release:check` after each freeze fix.

## Release Evidence
- [x] Attach quality reports from `qa/reports/`.
- [x] Attach E2E output and screenshots where relevant.
- [x] Tag release commit with checklist completion.
