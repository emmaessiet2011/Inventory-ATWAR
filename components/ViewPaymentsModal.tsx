import React, { useMemo } from 'react';
import { X, Printer, Trash2 } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ViewPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo?: string;
}

const ViewPaymentsModal: React.FC<ViewPaymentsModalProps> = ({ isOpen, onClose, invoiceNo }) => {
  const { payments, sales, formatCurrency, deletePayment: globalDeletePayment } = useGlobalContext();

  const sale = useMemo(
    () => (invoiceNo ? sales.find(s => s.invoiceNo === invoiceNo) : undefined),
    [sales, invoiceNo]
  );

  const invoicePayments = useMemo(() => {
    if (!invoiceNo) return [];
    return payments.filter(p =>
      (p.linkedInvoices || []).includes(invoiceNo) ||
      p.referenceNo === invoiceNo ||
      (p.note || '').includes(invoiceNo)
    );
  }, [payments, invoiceNo]);

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
              <p className="text-slate-800 mb-1"><span className="font-bold">Invoice Total:</span> {formatCurrency(sale?.grandTotal || sale?.totalAmount || 0)}</p>
              <p className="text-slate-800 mb-1"><span className="font-bold">Paid:</span> {formatCurrency(sale?.totalPaid || 0)}</p>
              <p className="text-slate-800"><span className="font-bold">Due:</span> {formatCurrency(sale?.sellDue || 0)}</p>
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
                    <td className="px-4 py-4 text-slate-700">{p.date}</td>
                    <td className="px-4 py-4 text-slate-700">{p.referenceNo}</td>
                    <td className="px-4 py-4 text-slate-700 text-right font-bold">{formatCurrency(p.amount || 0)}</td>
                    <td className="px-4 py-4 text-slate-700">{p.method}</td>
                    <td className="px-4 py-4 text-slate-700">{p.note || '-'}</td>
                    <td className="px-4 py-4 text-slate-700">{p.account || '-'}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => {
                          if (confirm(`Delete payment ${p.referenceNo}?`)) globalDeletePayment(p.id);
                        }}
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
          <button className="px-6 py-2 bg-[#6200ea] text-white rounded shadow-md text-sm font-bold flex items-center gap-2 hover:bg-[#5000ca] transition-colors">
            <Printer size={16} /> Print
          </button>
          <button onClick={onClose} className="px-6 py-2 bg-slate-700 text-white rounded shadow-md text-sm font-bold hover:bg-slate-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPaymentsModal;
