# Quality System (1-10)

This folder and `scripts/qa` implement the product-quality framework:

1. Definition of done per module/page/modal:
- `docs/quality/definition-of-done.md`

2. Full screen audit checklist:
- `docs/quality/screen-audit-checklist.md` (generated from routes)
- Generate with `npm run qa:checklist`
- Module progress dashboard from checklist:
  - `docs/quality/module-progress-dashboard.md`
  - `qa/reports/module-progress-dashboard.json`
  - Generate with `npm run qa:dashboard` (or `npm run qa:status`)
  - `qa:status` does not regenerate checklist, so manual checks are preserved.
- Strict launch gap queue:
  - `docs/quality/gap-execution-queue.md`
  - `qa/reports/gap-execution-queue.json`
  - Generate with `npm run qa:gaps` (or `npm run qa:status`)

3. Static gates:
- `npm run typecheck:strict`
- `npm run lint`

4. Route/action audits:
- `npm run audit:routes`

5. GlobalContext integration tests:
- `npm run test:context`

6. Critical-flow E2E:
- `npm run test:e2e:smoke`

7. Large-data performance/pagination:
- `npm run test:large-data`

8. UI fit-and-finish checks:
- `e2e/ui-fit.spec.ts`

9. Release gate and freeze checklist:
- `npm run release:check`
- `docs/quality/release-checklist.md`

10. Regression cycle:
- `docs/quality/regression-process.md`
- `qa/regression-template.md`
- `qa/known-issues.json`
