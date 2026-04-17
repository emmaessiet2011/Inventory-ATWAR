# Business UAT Scenarios

Run these with real user roles and realistic sample data.  
Each scenario must produce clear pass/fail evidence.

## Core Scenarios

| Module | Scenario | Expected Result |
|---|---|---|
| User Management | Create user, assign role, login/logout | User can access only permitted pages/actions |
| Contacts | Add customer/supplier with minimum required fields | Record persists in Postgres and appears after refresh |
| Products | Add/edit product with stock and pricing details | Product appears in listing, stock values consistent |
| Purchases | Create purchase with items and payment state | Purchase totals, due, and stock movement reconcile |
| Sell | Create finalized sale and partial payment | Invoice due/status updates correctly across reports |
| Sell Return | Return items against finalized invoice | Return updates invoice due and return ledger correctly |
| Orders | Create order, approve, generate invoice | Order lifecycle status is enforced by role permissions |
| Payments | Customer payment against multiple invoices | Allocation reduces due correctly and logs payment records |
| Field Payments | Submit then approve field payment | No due change before approval; due adjusts after approval |
| Stock | Transfer/adjust stock with reasons | Ledger, lots/history, and product quantities align |
| Expenses | Add expense with payment status | Expense totals and due appear in expense reports |
| Reports | Compare report totals vs transaction lists | Report totals reconcile with source transactions |
| Settings | Update critical settings (tax, location, invoice schema) | Changes persist and are applied in related workflows |

## Mandatory Cross-Cutting Checks

- Same data visible across different users after save (multi-user verification).
- Data remains correct after page refresh and after re-login.
- Unauthorized actions are blocked with clear error feedback.
- Critical actions with confirmation modal cannot be triggered accidentally.
- Activity log captures create/update/delete for sensitive modules.

## Sign-Off Template

For each scenario:

- Tester:
- Date:
- User role used:
- Input reference (invoice/order/customer IDs):
- Expected:
- Actual:
- Result: Pass / Fail
- Defect ID (if failed):
