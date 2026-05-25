import React, { useMemo, useState } from 'react';
import { X, Printer, Trash2 } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmationModal } from '@/components/users/UserModals';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { printDocument } from '@/utils/printUtils';
import { isLocationAccessible } from '@/utils/productVisibility';

interface ViewPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo?: string;
}

const ViewPaymentsModal: React.FC<ViewPaymentsModalProps> = ({ isOpen, onClose, invoiceNo }) => {
  const { payments, sales, settings, formatCurrency, deletePayment: globalDeletePayment, currentUser, locations } = useGlobalContext();
  const { addNotification } = useNotifications();
  const [pendingDeletePaymentId, setPendingDeletePaymentId] = useState<string | null>(null);

  const formatDateTimeDisplay = (value?: string) => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const sale = useMemo(
    () => {
      if (!invoiceNo) return undefined;
      const match = sales.find(s => s.invoiceNo === invoiceNo);
      if (!match) return undefined;
      return isLocationAccessible(match.location || '', currentUser, locations) ? match : undefined;
    },
    [sales, invoiceNo, currentUser, locations]
  );

  const invoicePayments = useMemo(() => {
    if (!invoiceNo || !sale) return [];
    return payments.filter(p =>
      (p.linkedInvoices || []).includes(invoiceNo) ||
      p.referenceNo === invoiceNo ||
      (p.note || '').includes(invoiceNo)
    );
  }, [payments, invoiceNo, sale]);

  const handlePrint = () => {
    const grandTotal = Number(sale?.grandTotal || sale?.totalAmount || 0);
    const totalPaid = Number(sale?.totalPaid ?? invoicePayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const due = sale
      ? Math.max(0, Number(sale.sellDue ?? Math.max(0, grandTotal - totalPaid)))
      : Math.max(0, grandTotal - totalPaid);
    printDocument({
      title: `Invoice Payments - ${invoiceNo || '--'}`,
      subtitle: `Customer: ${sale?.customerName || '--'}`,
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
      rows: invoicePayments.map(payment => [
        formatDateTimeDisplay(payment.date),
        payment.referenceNo || '--',
        formatCurrency(Number(payment.amount || 0)),
        payment.method || '--',
        payment.account || payment.paymentAccount || '--',
        payment.note || '--',
      ]),
      stats: [
        { label: 'Invoice Total', value: formatCurrency(grandTotal), color: 'blue' },
        { label: 'Paid', value: formatCurrency(totalPaid), color: 'green' },
        { label: 'Due', value: formatCurrency(due), color: 'rose' },
      ],
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-slate-200 relative mt-10 mb-10 animate-in slide-in-from-top-4 duration-300">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white rounded-t-lg">
          <h3 className="text-xl text-slate-700">View Payments ( Invoice No.: {invoiceNo || '--'} )</h3>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-sm">
            <div>
              <p className="text-slate-600 mb-1">Customer:</p>
              <p className="font-bold text-slate-800">{sale?.customerName || '--'}</p>
              <p className="text-slate-600 mt-1">Mobile: {sale?.contactNumber || '--'}</p>
            </div>
            <div>
              <p className="text-slate-600 mb-1">Invoice Info:</p>
              <p className="text-slate-800"><span className="font-bold">Date:</span> {sale?.date || '--'}</p>
              <p className="text-slate-800"><span className="font-bold">Status:</span> {sale?.paymentStatus || '--'}</p>
            </div>
            <div>
              {(() => {
                const grandTotal = sale?.grandTotal || sale?.totalAmount || 0;
                // Use FIFO-authoritative values from the sale record; fall back to summing visible payments
                const totalPaid = sale?.totalPaid ?? invoicePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                const due = sale ? Math.max(0, sale.sellDue ?? Math.max(0, grandTotal - totalPaid)) : Math.max(0, grandTotal - totalPaid);
                return (
                  <>
                    <p className="text-slate-800 mb-1"><span className="font-bold">Invoice Total:</span> {formatCurrency(grandTotal)}</p>
                    <p className="text-slate-800 mb-1"><span className="font-bold">Paid:</span> {formatCurrency(totalPaid)}</p>
                    <p className="text-slate-800"><span className="font-bold">Due:</span> {formatCurrency(due)}</p>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="border border-slate-100 rounded-sm mb-6 bg-slate-50/30 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 font-bold text-slate-800 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Payment Note</th>
                  <th className="px-4 py-3">Payment Account</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoicePayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-4 text-slate-700">{formatDateTimeDisplay(p.date)}</td>
                    <td className="px-4 py-4 text-slate-700">{p.referenceNo}</td>
                    <td className="px-4 py-4 text-slate-700 text-right font-bold">{formatCurrency(p.amount || 0)}</td>
                    <td className="px-4 py-4 text-slate-700">{p.method}</td>
                    <td className="px-4 py-4 text-slate-700">{p.note || '-'}</td>
                    <td className="px-4 py-4 text-slate-700">{p.account || p.paymentAccount || '-'}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => setPendingDeletePaymentId(p.id)}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {invoicePayments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No payments linked to this invoice.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-white rounded-b-lg">
          <button onClick={handlePrint} className="px-6 py-2 bg-blue-600 text-white rounded shadow-md text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <Printer size={16} /> Print
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-700 text-white rounded shadow-md text-sm font-bold hover:bg-slate-800 transition-colors">
            Close
          </button>
        </div>
      </div>
      <ConfirmationModal
        isOpen={!!pendingDeletePaymentId}
        onClose={() => setPendingDeletePaymentId(null)}
        onConfirm={async () => {
          if (!pendingDeletePaymentId) return;
          const target = invoicePayments.find(payment => payment.id === pendingDeletePaymentId);
          const result = await globalDeletePayment(pendingDeletePaymentId);
          if (!result.ok) {
            addNotification({
              title: 'Payment Delete Failed',
              message: result.error || `${target?.referenceNo || 'Payment'} could not be deleted from Postgres.`,
              type: 'error',
            });
            return false;
          }
          setPendingDeletePaymentId(null);
          addNotification({
            title: 'Payment Deleted',
            message: `${target?.referenceNo || 'Payment'} deleted successfully.`,
            type: 'success',
          });
        }}
        title="Delete Payment"
        message={`Delete payment ${invoicePayments.find(p => p.id === pendingDeletePaymentId)?.referenceNo || '--'}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default ViewPaymentsModal;
