import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Printer } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { printDocument } from '../src/utils/printUtils';

interface ViewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  customer: any;
}

const ViewPaymentModal: React.FC<ViewPaymentModalProps> = ({ isOpen, onClose, payment, customer }) => {
  const { settings, formatCurrency } = useGlobalContext();
  if (!isOpen || !payment) return null;

  const referenceNo = payment.referenceNo || payment.refNo || '--';
  const paidOn = payment.date || payment.paidOn || '--';
  const attachmentName = payment.attachmentName || payment.document || '';
  const amount = Number(payment.amount || 0);

  const customerBusinessName = customer?.businessName || payment.contactName || '--';
  const customerContactName = customer?.name || '--';
  const customerMobile = customer?.mobile || '--';
  const businessAddress = settings.businessAddress || settings.address;
  const taxNumber = settings.tax1Number || settings.taxNumber;

  const handlePrint = () => {
    printDocument({
      title: `Payment Receipt ${referenceNo}`,
      subtitle: `Customer: ${customerBusinessName}`,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress,
      printedBy: 'System',
      columns: [
        { label: 'Field' },
        { label: 'Value' },
      ],
      rows: [
        ['Reference No', referenceNo],
        ['Paid On', String(paidOn || '--')],
        ['Customer', customerBusinessName],
        ['Contact Name', customerContactName],
        ['Mobile', customerMobile],
        ['Payment Method', String(payment.method || '--')],
        ['Payment Account', String(payment.account || payment.paymentAccount || '--')],
        ['Amount', formatCurrency(amount)],
        ['Payment Note', String(payment.note || '--')],
        ['Attachment', attachmentName || '--'],
      ],
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h3 className="text-xl font-bold text-slate-800">
            View Payment ( Reference No: {referenceNo} )
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-slate-600 mb-1">Customer:</p>
              <p className="font-bold text-slate-800">{customerBusinessName}</p>
              <p className="text-sm text-slate-600">{customerContactName}</p>
              <p className="text-sm text-slate-600">Mobile: {customerMobile}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Business:</p>
              <p className="font-bold text-slate-800">{settings.businessName || 'ATWAR AL MUSTAQBAL'}</p>
              {businessAddress && <p className="text-sm text-slate-600">{businessAddress}</p>}
              {settings.businessCity && <p className="text-sm text-slate-600">{settings.businessCity}, Oman</p>}
              {taxNumber && <p className="text-sm text-slate-600">VATIN: {taxNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-sm"><span className="font-bold text-slate-800">Amount :</span> {formatCurrency(amount)}</p>
              <p className="text-sm"><span className="font-bold text-slate-800">Payment Method :</span> {payment.method || '--'}</p>
              <p className="text-sm"><span className="font-bold text-slate-800">Payment Note :</span> {payment.note || '-'}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm"><span className="font-bold text-slate-800">Reference No:</span> {referenceNo}</p>
              <p className="text-sm"><span className="font-bold text-slate-800">Paid on:</span> {paidOn}</p>
              {attachmentName ? (
                <button
                  onClick={() => {
                    if (!payment.attachmentData) return;
                    const a = document.createElement('a');
                    a.href = payment.attachmentData;
                    a.download = attachmentName;
                    a.click();
                  }}
                  className="mt-4 flex items-center gap-2 px-4 py-2 border border-emerald-500 text-emerald-600 rounded-full text-sm font-bold hover:bg-emerald-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={!payment.attachmentData}
                >
                  <Download size={16} />
                  {attachmentName}
                </button>
              ) : (
                <p className="mt-4 text-sm text-slate-400 italic">No document attached</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 text-white rounded font-bold text-sm hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ViewPaymentModal;
