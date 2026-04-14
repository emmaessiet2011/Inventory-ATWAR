import React, { useMemo, useState } from 'react';
import { X, Printer, Trash2 } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { printDocument } from '@/utils/printUtils';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface ViewSellReturnPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellReturnId?: string | null;
}

const ViewSellReturnPaymentsModal: React.FC<ViewSellReturnPaymentsModalProps> = ({
  isOpen,
  onClose,
  sellReturnId,
}) => {
  const { sellReturns, payments, settings, formatCurrency, deletePayment: globalDeletePayment } = useGlobalContext();
  const [pendingDeletePayment, setPendingDeletePayment] = useState<{ id: string; ref: string } | null>(null);

  const sellReturn = useMemo(
    () => (sellReturnId ? sellReturns.find(record => record.id === sellReturnId) : undefined),
    [sellReturnId, sellReturns]
  );

  const linkedPayments = useMemo(() => {
    if (!sellReturn?.referenceNo) return [];
    const reference = String(sellReturn.referenceNo || '').trim();
    return payments.filter(payment => {
      if (payment.contactType !== 'Customer' || payment.type !== 'sent') return false;
      const linked = (payment.linkedInvoices || []).some(item => String(item || '').trim() === reference);
      const refHit = String(payment.referenceNo || '').trim() === reference;
      const noteHit = String(payment.note || '').includes(reference);
      return linked || refHit || noteHit;
    });
  }, [payments, sellReturn?.referenceNo]);

  const paidTotal = linkedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const formatDateTimeDisplay = (value?: string) => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const handlePrint = () => {
    printDocument({
      title: `Return Payments - ${sellReturn?.referenceNo || '--'}`,
      subtitle: `Customer: ${sellReturn?.customerName || '--'}`,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings.businessAddress || settings.address || '',
      printedBy: 'System',
      columns: [
        { label: 'Date', width: '110px' },
        { label: 'Reference No', width: '120px' },
        { label: 'Amount', width: '95px', align: 'right' },
        { label: 'Method', width: '85px' },
        { label: 'Account', width: '95px' },
        { label: 'Note' },
      ],
      rows: linkedPayments.map(payment => [
        formatDateTimeDisplay(payment.date),
        payment.referenceNo || '--',
        formatCurrency(Number(payment.amount || 0)),
        payment.method || '--',
        payment.account || payment.paymentAccount || '--',
        payment.note || '--',
      ]),
      stats: [
        { label: 'Return Total', value: formatCurrency(Number(sellReturn?.total || 0)), color: 'blue' },
        { label: 'Refunded Total', value: formatCurrency(paidTotal), color: 'green' },
        { label: 'Remaining', value: formatCurrency(Number(sellReturn?.paymentDue || 0)), color: 'rose' },
      ],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/55 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-slate-200 mt-10 mb-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl text-slate-700">
            Return Payments ( Credit Note No.: {sellReturn?.referenceNo || '--'} )
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <p><span className="font-bold">Customer:</span> {sellReturn?.customerName || '--'}</p>
            <p><span className="font-bold">Return Total:</span> {formatCurrency(Number(sellReturn?.total || 0))}</p>
            <p><span className="font-bold">Remaining:</span> {formatCurrency(Number(sellReturn?.paymentDue || 0))}</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reference No</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Note</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedPayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No refund payments linked to this credit note.</td>
                  </tr>
                )}
                {linkedPayments.map(payment => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">{formatDateTimeDisplay(payment.date)}</td>
                    <td className="px-4 py-3">{payment.referenceNo || '--'}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(Number(payment.amount || 0))}</td>
                    <td className="px-4 py-3">{payment.method || '--'}</td>
                    <td className="px-4 py-3">{payment.note || '--'}</td>
                    <td className="px-4 py-3">{payment.account || payment.paymentAccount || '--'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setPendingDeletePayment({ id: payment.id, ref: payment.referenceNo || payment.id })}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-right text-sm font-bold">Refunded Total: {formatCurrency(paidTotal)}</div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-2"
          >
            <Printer size={14} /> Print
          </button>
          <button onClick={onClose} className="px-5 py-2 bg-slate-700 text-white rounded text-sm font-bold hover:bg-slate-800">
            Close
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!pendingDeletePayment}
        title="Delete Payment"
        message={`Are you sure you want to delete payment ${pendingDeletePayment?.ref || '--'}? This action cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeletePayment(null)}
        onConfirm={() => {
          if (pendingDeletePayment) globalDeletePayment(pendingDeletePayment.id);
          setPendingDeletePayment(null);
        }}
      />
    </div>
  );
};

export default ViewSellReturnPaymentsModal;
