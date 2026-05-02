# Move All Products to One Location (Postgres)

This operation sets every product's location metadata to `CR:1450968` and moves inventory/stock-lot rows from `KNWZ ARD ALKHLYJ ALMTHDH` into that target location.

## Run from VPS (recommended)

Use your SSH session on the VPS:

```bash
cd /opt/ATWARBSS-main
```

## 1) Dry run (no writes)

```bash
npm run ops:move:products-location -- --dry-run
```

This validates source/target location matching and shows what will be updated.

## 2) Apply

```bash
npm run ops:move:products-location
```

## 3) Report

```bash
cat qa/reports/ops-move-products-location-summary.json
```

The report includes:
- total products updated to target location name
- products still referencing source name (should be `0`)
- product-inventory rows moved/merged
- stock-lot rows moved/merged

## Optional explicit terms

```bash
npm run ops:move:products-location -- --from "KNWZ ARD ALKHLYJ ALMTHDH" --target "CR:1450968"
```

