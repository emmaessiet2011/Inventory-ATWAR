# Regression Process

## Rule
Any production bug fix must include a regression test in the same change.

## Workflow
1. Create/append issue in `qa/known-issues.json`.
2. Reproduce with a failing test (unit/integration/e2e).
3. Implement fix.
4. Verify test passes.
5. Mark issue as `closed` and reference test file.

## Test Placement
- Context/state integrity: `tests/context/*.test.tsx`
- Route/action audits: `scripts/qa/*.mjs`
- End-to-end behavior: `e2e/*.spec.ts`

## Minimum Metadata
- Issue ID
- Severity (`P1`/`P2`/`P3`)
- Module + route
- Root cause
- Regression test path
