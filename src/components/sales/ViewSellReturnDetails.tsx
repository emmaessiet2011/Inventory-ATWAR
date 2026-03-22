import React, { useEffect, useMemo } from 'react';
import { X, Printer } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { printDocument } from '@/utils/printUtils';

interface ViewSellReturnDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  sellReturnId?: string | null;
  autoPrint?: boolean;
  onAfterPrint?: () => void;
}

const ViewSellReturnDetails: React.FC<ViewSellReturnDetailsProps> = ({
  isOpen,
  onClose,
  sellReturnId,
  autoPrint = false,
  onAfterPrint,
}) => {
  const { sellReturns, sales, payments, settings, formatCurrency } = useGlobalContext();

  const sellReturn = useMemo(
    () => (sellReturnId ? sellReturns.find(record => record.id === sellReturnId) : undefined),
    [sellReturns, sellReturnId]
  );

  const parentSale = useMemo(
    () => (sellReturn?.parentSaleId ? sales.find(sale => sale.id === sellReturn.parentSaleId) : undefined),
    [sales, sellReturn?.parentSaleId]
  );

  const linkedRefundPayments = useMemo(() => {
    if (!sellReturn?.referenceNo) return [];
    const ref = String(sellReturn.referenceNo || '').trim();
    return payments.filter(payment => {
      if (payment.contactType !== 'Customer' || payment.type !== 'sent') return false;
      const linked = (payment.linkedInvoices || []).some(item => String(item || '').trim() === ref);
      const refHit = String(payment.referenceNo || '').trim() === ref;
      const noteHit = String(payment.note || '').includes(ref);
      return linked || refHit || noteHit;
    });
  }, [payments, sellReturn?.referenceNo]);

  const refundedTotal = linkedRefundPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const settlementLabel = (() => {
    const mode = String(sellReturn?.settlementMode || '').trim();
    if (mode === 'refund_now') return 'Refund now';
    if (mode === 'apply_to_invoice_due') return 'Applied to invoice due';
    if (mode === 'customer_credit') return 'Customer credit';
    return 'Refund later';
  })();

  const formatDateTimeDisplay = (value?: string) => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const handlePrint = () => {
    if (!sellReturn) return;
    printDocument({
      title: `Sell Return - ${sellReturn.referenceNo || '--'}`,
      subtitle: `Customer: ${sellReturn.customerName || '--'} | Parent Sale: ${sellReturn.parentInvoiceNo || '--'}`,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings.businessAddress || settings.address || '',
      printedBy: sellReturn.addedBy || 'System',
      columns: [
        { label: 'Product' },
        { label: 'Qty', width: '80px', align: 'right' },
        { label: 'Unit Price', width: '95px', align: 'right' },
        { label: 'Line Total', width: '95px', align: 'right' },
      ],
      rows: (sellReturn.items || []).map(item => [
        item.productName || '--',
        Number(item.qty || 0).toFixed(3),
        formatCurrency(Number(item.unitPrice || 0)),
        formatCurrency(Number(item.lineTotal || 0)),
      ]),
      stats: [
        { label: 'Return Total', value: formatCurrency(Number(sellReturn.total || 0)), color: 'blue' },
        { label: 'Applied to Invoice', value: formatCurrency(Number(sellReturn.appliedToSaleDue || 0)), color: 'green' },
        { label: 'Refunded', value: formatCurrency(refundedTotal), color: 'amber' },
        { label: 'Remaining', value: formatCurrency(Number(sellReturn.paymentDue || 0)), color: 'rose' },
      ],
    });
  };

  useEffect(() => {
    if (!isOpen || !autoPrint || !sellReturn) return;
    const timer = window.setTimeout(() => {
      handlePrint();
      onAfterPrint?.();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isOpen, autoPrint, onAfterPrint, sellReturn]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/55 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl border border-slate-200 mt-8 mb-8">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
          <h3 className="text-xl text-slate-800 font-semibold">Sell Return Details</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-2"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5">
              <X size={18} />
            </button>
          </div>
        </div>

        {!sellReturn ? (
          <div className="px-6 py-12 text-center text-slate-500">Sell return record was not found.</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-1">
                <p><span className="font-bold">Credit Note No:</span> {sellReturn.referenceNo}</p>
                <p><span className="font-bold">Date:</span> {formatDateTimeDisplay(sellReturn.date)}</p>
                <p><span className="font-bold">Parent Sale:</span> {sellReturn.parentInvoiceNo || '--'}</p>
              </div>
              <div className="space-y-1">
                <p><span className="font-bold">Customer:</span> {sellReturn.customerName}</p>
                <p><span className="font-bold">Location:</span> {sellReturn.location || '--'}</p>
                <p><span className="font-bold">Added By:</span> {sellReturn.addedBy || '--'}</p>
              </div>
              <div className="space-y-1">
                <p>
                  <span className="font-bold">Payment Status:</span>{' '}
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      sellReturn.paymentStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : sellReturn.paymentStatus === 'Partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {sellReturn.paymentStatus}
                  </span>
                </p>
                <p><span className="font-bold">Settlement:</span> {settlementLabel}</p>
                <p><span className="font-bold">Return Total:</span> {formatCurrency(sellReturn.total)}</p>
                <p><span className="font-bold">Applied to Invoice:</span> {formatCurrency(Number(sellReturn.appliedToSaleDue || 0))}</p>
                <p><span className="font-bold">Credited to Advance:</span> {formatCurrency(Number(sellReturn.creditedToAdvance || 0))}</p>
                <p><span className="font-bold">Refunded:</span> {formatCurrency(refundedTotal)}</p>
                <p><span className="font-bold">Remaining:</span> {formatCurrency(sellReturn.paymentDue)}</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Sold Qty</th>
                    <th className="px-3 py-2 text-right">Returned Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sellReturn.items || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-400">No return line items.</td>
                    </tr>
                  )}
                  {(sellReturn.items || []).map((item, index) => (
                    <tr key={`${item.productId}-${index}`}>
                      <td className="px-3 py-2">{item.productName}</td>
                      <td className="px-3 py-2 text-right">{Number(item.soldQty || 0).toFixed(3)} {item.unit || ''}</td>
                      <td className="px-3 py-2 text-right">{Number(item.qty || 0).toFixed(3)} {item.unit || ''}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(Number(item.unitPrice || 0))}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(Number(item.lineTotal || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-sm text-sm border border-slate-200 rounded p-4 bg-slate-50 space-y-1.5">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(sellReturn.subTotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>(-) {formatCurrency(sellReturn.discountAmount)}</span></div>
              <div className="flex justify-between"><span>Order Tax</span><span>(+) {formatCurrency(sellReturn.taxAmount)}</span></div>
              <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-bold text-base">
                <span>Return Total</span>
                <span>{formatCurrency(sellReturn.total)}</span>
              </div>
              <div className="flex justify-between"><span>Refunded</span><span>{formatCurrency(refundedTotal)}</span></div>
              <div className="flex justify-between"><span>Remaining</span><span>{formatCurrency(sellReturn.paymentDue)}</span></div>
            </div>

            {sellReturn.note && (
              <div className="text-sm">
                <p className="font-bold text-slate-800 mb-1">Return Note</p>
                <p className="text-slate-600 whitespace-pre-wrap">{sellReturn.note}</p>
              </div>
            )}

            {parentSale?.sellNote && (
              <div className="text-sm">
                <p className="font-bold text-slate-800 mb-1">Parent Sale Note</p>
                <p className="text-slate-600 whitespace-pre-wrap">{parentSale.sellNote}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewSellReturnDetails;
