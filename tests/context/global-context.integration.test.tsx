import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppUser, GlobalProvider, Payment, Sale, useGlobalContext } from '../../src/context/GlobalContext';

type Ctx = ReturnType<typeof useGlobalContext>;

const ContextProbe: React.FC<{ onChange: (ctx: Ctx) => void }> = ({ onChange }) => {
  const ctx = useGlobalContext();
  useEffect(() => {
    onChange(ctx);
  }, [ctx, onChange]);
  return null;
};

const bootContext = async () => {
  let latest: Ctx | null = null;
  render(
    <GlobalProvider>
      <ContextProbe onChange={(ctx) => { latest = ctx; }} />
    </GlobalProvider>
  );
  await waitFor(() => expect(latest).not.toBeNull());
  return () => latest as Ctx;
};

describe('GlobalContext integration', () => {
  it('does not seed sales or payments when localStorage is empty', async () => {
    const ctx = await bootContext();
    expect(ctx().sales.length).toBe(0);
    expect(ctx().payments.length).toBe(0);
  });

  it('supports add/update/delete user lifecycle through global actions', async () => {
    const ctx = await bootContext();
    const baseCount = ctx().users.length;

    const user: AppUser = {
      id: 'USR-QA-001',
      username: 'qa_user',
      name: 'QA User',
      role: 'Manager',
      email: 'qa.user@atwar.test',
      password: 'qa123',
      status: 'Active',
      lastLogin: '',
      allowLogin: true,
    };

    act(() => {
      ctx().addUser(user);
    });
    await waitFor(() => expect(ctx().users.some((row) => row.id === user.id)).toBe(true));

    act(() => {
      ctx().updateUser({ ...user, name: 'QA User Updated' });
    });
    await waitFor(() => expect(ctx().users.find((row) => row.id === user.id)?.name).toBe('QA User Updated'));

    act(() => {
      ctx().deleteUser(user.id);
    });
    await waitFor(() => expect(ctx().users.some((row) => row.id === user.id)).toBe(false));
    expect(ctx().users.length).toBe(baseCount);
  });

  it('keeps sale/payment/customer ledger values consistent across CRUD operations', async () => {
    const ctx = await bootContext();
    const customer = ctx().customers[0];
    expect(customer).toBeDefined();

    const locationName = ctx().locations[0]?.name || '';
    const baselineDue = Number(customer?.totalSellDue || 0);

    const saleId = 'SALE-QA-001';
    const invoiceNo = 'INV-QA-001';
    const paymentId = 'PAY-QA-001';

    const sale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      invoiceNo,
      customerId: customer!.id,
      customerName: customer!.businessName || customer!.name,
      location: locationName,
      paymentStatus: 'Due',
      shippingCharges: 0,
      items: [
        {
          id: 'ITEM-QA-1',
          name: 'QA Product',
          qty: 1,
          unitPrice: 100,
          discount: 0,
          subtotal: 100,
          tax: 0,
          total: 100,
          unit: 'pcs',
        },
      ],
      subTotal: 100,
      discountType: 'Fixed',
      discountAmount: 0,
      tax: '0',
      grandTotal: 100,
      totalAmount: 100,
      totalPaid: 0,
      sellDue: 100,
      status: 'Final',
      saleStatus: 'Final',
    };

    act(() => {
      ctx().addSale(sale);
    });
    await waitFor(() => expect(ctx().sales.some((row) => row.id === saleId)).toBe(true));
    await waitFor(() => {
      const afterSaleCustomer = ctx().customers.find((row) => String(row.id) === String(customer!.id));
      expect(Number(afterSaleCustomer?.totalSellDue || 0)).toBeGreaterThanOrEqual(baselineDue + 99.9);
    });

    const payment: Payment = {
      id: paymentId,
      date: new Date().toISOString(),
      contactId: String(customer!.id),
      contactName: customer!.businessName || customer!.name,
      contactType: 'Customer',
      amount: 40,
      method: 'Cash',
      account: '',
      location: locationName,
      referenceNo: 'QA-PAY-001',
      note: 'QA payment',
      type: 'received',
      linkedInvoices: [invoiceNo],
      addedBy: 'QA',
    };

    act(() => {
      ctx().addPayment(payment);
    });
    await waitFor(() => expect(ctx().payments.some((row) => row.id === paymentId)).toBe(true));
    await waitFor(() => {
      const afterPaymentCustomer = ctx().customers.find((row) => String(row.id) === String(customer!.id));
      expect(Number(afterPaymentCustomer?.totalSellDue || 0)).toBeLessThan(baselineDue + 100);
    });

    act(() => {
      ctx().updatePayment({ ...payment, amount: 70, note: 'QA payment updated' });
    });
    await waitFor(() => expect(ctx().payments.find((row) => row.id === paymentId)?.amount).toBe(70));

    act(() => {
      ctx().deletePayment(paymentId);
    });
    await waitFor(() => expect(ctx().payments.some((row) => row.id === paymentId)).toBe(false));

    act(() => {
      ctx().deleteSale(saleId);
    });
    await waitFor(() => expect(ctx().sales.some((row) => row.id === saleId)).toBe(false));
  });
});
