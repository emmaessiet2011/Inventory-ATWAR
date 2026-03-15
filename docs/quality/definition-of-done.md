# Definition Of Done (Module/Page/Modal)

This checklist is mandatory for every module, page, and modal before release.

## 1) Scope And Behavior
- Feature objective is documented in one sentence.
- Acceptance criteria are explicit and testable.
- All roles/permissions are defined for the feature.

## 2) Data Integrity
- All create/update/delete actions are wired to `GlobalContext` (no local mock persistence).
- State persists correctly in `localStorage` and reload is consistent.
- Related ledgers/reports are updated after each transaction.

## 3) UI/UX
- No clipped dropdowns, hidden search results, or overlapping modals.
- Layout works on desktop and mobile (no unintended horizontal page scroll).
- Empty/loading/error states are clear and actionable.

## 4) Actions And Navigation
- Every button action is connected to a real handler.
- No `alert()`/`console.log()` in production actions.
- Every `onNavigate(...)` target is a valid route in `App.tsx`.

## 5) Table Quality
- Search, filter, sort, and pagination are functional.
- Large datasets remain usable (page size + page navigation).
- Export/Print actions use real data and produce expected output.

## 6) Quality Gates
- `npm run typecheck:strict` passes.
- `npm run audit:quality` passes.
- Unit/integration and smoke E2E pass.

## 7) Release Readiness
- No open P1/P2 in `qa/known-issues.json`.
- Route row is checked in `docs/quality/screen-audit-checklist.md`.
- Regression test added for every fixed production bug.
