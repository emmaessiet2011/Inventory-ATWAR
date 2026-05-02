# Selling Price List Import (Excel -> Postgres)

This flow imports sheet prices into `SellingPriceGroup.meta.applicableProducts` in Postgres.

## 1) Extract Excel sheets to JSON (Windows machine)

Run in repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ops\extract-selling-price-lists.ps1 `
  -InputDir "C:\Users\atwar\Downloads\NEW PRICE LIST" `
  -OutputPath "tmp/price-lists/selling-price-lists.json"
```

## 2) Dry run import (safe validation)

Run from VPS repo folder (`/opt/ATWARBSS-main`):

```bash
npm run ops:import:price-lists -- --input tmp/price-lists/selling-price-lists.json --dry-run
```

Review report:

`qa/reports/ops-price-list-import-summary.json`

## 3) Apply import to Postgres

Run from VPS repo folder (`/opt/ATWARBSS-main`):

```bash
npm run ops:import:price-lists -- --input tmp/price-lists/selling-price-lists.json
```

If you want to use the already-prepared dataset from this repo, use:

```bash
npm run ops:import:price-lists -- --input data/price-lists/selling-price-lists-2026-05-02.json
```

## 4) Current built-in group links

- Sheet `highest group supermarket` links to customer group containing `supermarket`.
- Sheet `Pet Shop & Veterinary Clinic` links to customer group containing `pet food`.

If your customer-group names differ, edit `sheetOverrides` in:

`scripts/ops/import-selling-price-lists.mjs`
