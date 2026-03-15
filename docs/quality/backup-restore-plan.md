# Backup & Restore Plan

## Scope
- Covers all browser-stored ERP records (business settings, products, contacts, sales, payments, users, reports metadata).
- Backup format is a signed JSON snapshot exported from **Settings > System > Backup & Restore**.

## Backup Procedure
1. Open `Settings`.
2. Go to `System`.
3. Click `Export Backup`.
4. Confirm `Last Backup` timestamp/record count updates in the same panel.
5. Store the downloaded JSON in a secure location (at least one off-device copy).

## Restore Procedure
1. Open `Settings`.
2. Go to `System`.
3. Click `Validate Backup File` and select a previously exported JSON file.
4. Confirm validation success message (checksum + record count).
5. Click `Restore Backup` and select the same file.
6. Wait for restore completion and automatic app reload.
7. Validate critical records: users, customers, products, sales, payments.

## Validation Rules
- Backup payload includes checksum validation; tampered/corrupted files are rejected.
- Only ATWAR storage namespaces are restored.
- Restore result includes restored record count.
- Backup panel tracks `Last Backup`, `Last Validation`, and `Last Restore` audit timestamps.

## Operational Policy
- Take at least one backup daily before close of business.
- Take a backup before bulk imports, mass price updates, and role/permission changes.
- Keep rolling backups for at least 30 days.

## Recovery Drill
- Frequency: weekly.
- Drill steps:
  1. Export backup from active environment.
  2. Clear browser storage in a test profile.
  3. Restore from backup file.
  4. Verify totals on dashboard and sample transactions.
