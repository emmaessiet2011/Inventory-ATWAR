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

    await act(async () => {
      await ctx().addUser(user);
    });
    await waitFor(() => expect(ctx().users.some((row) => row.id === user.id)).toBe(true));

    await act(async () => {
      await ctx().updateUser({ ...user, name: 'QA User Updated' });
    });
    await waitFor(() => expect(ctx().users.find((row) => row.id === user.id)?.name).toBe('QA User Updated'));

    await act(async () => {
      await ctx().deleteUser(user.id);
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

    await act(async () => {
      await ctx().addSale(sale);
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

    await act(async () => {
      await ctx().addPayment(payment);
    });
    await waitFor(() => expect(ctx().payments.some((row) => row.id === paymentId)).toBe(true));
    await waitFor(() => {
      const afterPaymentCustomer = ctx().customers.find((row) => String(row.id) === String(customer!.id));
      expect(Number(afterPaymentCustomer?.totalSellDue || 0)).toBeLessThan(baselineDue + 100);
    });

    await act(async () => {
      await ctx().updatePayment({ ...payment, amount: 70, note: 'QA payment updated' });
    });
    await waitFor(() => expect(ctx().payments.find((row) => row.id === paymentId)?.amount).toBe(70));

    await act(async () => {
      await ctx().deletePayment(paymentId);
    });
    await waitFor(() => expect(ctx().payments.some((row) => row.id === paymentId)).toBe(false));

    await act(async () => {
      await ctx().deleteSale(saleId);
    });
    await waitFor(() => expect(ctx().sales.some((row) => row.id === saleId)).toBe(false));
  });

  it('keeps invoice-specific payments pinned to the targeted invoice during rebuilds', async () => {
    const ctx = await bootContext();
    const customer = ctx().customers[0];
    expect(customer).toBeDefined();

    const locationName = ctx().locations[0]?.name || '';
    const invoiceA = 'INV-QA-STRICT-A';
    const invoiceB = 'INV-QA-STRICT-B';

    const saleA: Sale = {
      id: 'SALE-QA-STRICT-A',
      date: '2026-06-01T08:00:00.000Z',
      invoiceNo: invoiceA,
      customerId: customer!.id,
      customerName: customer!.businessName || customer!.name,
      location: locationName,
      paymentStatus: 'Due',
      shippingCharges: 0,
      items: [{ id: 'ITEM-A', name: 'QA A', qty: 1, unitPrice: 10, discount: 0, subtotal: 10, tax: 0, total: 10, unit: 'pcs' }],
      subTotal: 10,
      discountType: 'Fixed',
      discountAmount: 0,
      tax: '0',
      grandTotal: 10,
      totalAmount: 10,
      totalPaid: 0,
      sellDue: 10,
      status: 'Final',
      saleStatus: 'Final',
    };

    const saleB: Sale = {
      id: 'SALE-QA-STRICT-B',
      date: '2026-06-02T08:00:00.000Z',
      invoiceNo: invoiceB,
      customerId: customer!.id,
      customerName: customer!.businessName || customer!.name,
      location: locationName,
      paymentStatus: 'Due',
      shippingCharges: 0,
      items: [{ id: 'ITEM-B', name: 'QA B', qty: 1, unitPrice: 20, discount: 0, subtotal: 20, tax: 0, total: 20, unit: 'pcs' }],
      subTotal: 20,
      discountType: 'Fixed',
      discountAmount: 0,
      tax: '0',
      grandTotal: 20,
      totalAmount: 20,
      totalPaid: 0,
      sellDue: 20,
      status: 'Final',
      saleStatus: 'Final',
    };

    await act(async () => {
      await ctx().addSale(saleA);
      await ctx().addSale(saleB);
    });

    await waitFor(() => expect(ctx().sales.some((row) => row.id === saleA.id)).toBe(true));
    await waitFor(() => expect(ctx().sales.some((row) => row.id === saleB.id)).toBe(true));

    const invoiceSpecificPayment: Payment = {
      id: 'PAY-QA-STRICT-B',
      date: '2026-06-03T08:00:00.000Z',
      contactId: String(customer!.id),
      contactName: customer!.businessName || customer!.name,
      contactType: 'Customer',
      amount: 20,
      method: 'Cash',
      account: '',
      location: locationName,
      referenceNo: 'QA-PAY-STRICT-B',
      note: 'Invoice specific payment',
      type: 'received',
      linkedInvoices: [invoiceB],
      strictLinkedAllocation: true,
      addedBy: 'QA',
    };

    await act(async () => {
      await ctx().addPayment(invoiceSpecificPayment);
    });

    await waitFor(() => expect(ctx().payments.some((row) => row.id === invoiceSpecificPayment.id)).toBe(true));
    await waitFor(() => {
      const currentSaleA = ctx().sales.find((row) => row.id === saleA.id);
      const currentSaleB = ctx().sales.find((row) => row.id === saleB.id);
      expect(currentSaleA?.paymentStatus).toBe('Due');
      expect(Number(currentSaleA?.sellDue || 0)).toBeCloseTo(10, 3);
      expect(currentSaleB?.paymentStatus).toBe('Paid');
      expect(Number(currentSaleB?.sellDue || 0)).toBeCloseTo(0, 3);
    });
  });
});
