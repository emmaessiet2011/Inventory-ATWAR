import React from 'react';
import { X, Printer } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { printShippingDocument } from '@/utils/printUtils';

interface SaleItem {
  name: string;
  qty: number;
  unit?: string;
}

interface PackingSlipProps {
    onClose: () => void;
    invoiceNo?: string;
    date?: string;
    sale?: {
        invoiceNo?: string;
        date?: string;
        customerName?: string;
        contactNumber?: string;
        billingAddress?: string;
        shippingAddress?: string;
        items?: SaleItem[];
        location?: string;
    };
    customer?: {
        businessName?: string;
        address?: string;
        mobile?: string;
    };
}

const PackingSlip: React.FC<PackingSlipProps> = ({ onClose, invoiceNo, date, sale, customer }) => {
  const { settings, locations } = useGlobalContext();

  const displayInvoiceNo = sale?.invoiceNo || invoiceNo || '--';
  const displayDate = sale?.date || date || '--';
  const displayCustomer = sale?.customerName || customer?.businessName || 'Direct Customer';
  const displayMobile = sale?.contactNumber || customer?.mobile || '--';
  const displayAddress = sale?.shippingAddress || sale?.billingAddress || customer?.address || '';
  const displayItems: SaleItem[] = sale?.items || [];
  const locationObj = locations.find(loc => loc.name === sale?.location);
  const businessName = settings.businessName || 'Business';
  const businessSubLine = [locationObj?.city, locationObj?.country].filter(Boolean).join(', ') || sale?.location || '--';

  const formatDateTimeDisplay = (value?: string) => {
    if (!value) return '--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    const hours24 = parsed.getHours();
    const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const dateOnly = settings.dateFormat === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
    return settings.timeFormat === '24'
      ? `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`
      : `${dateOnly} ${hours12}:${minutes} ${meridiem}`;
  };

  const handlePrint = () => {
    printShippingDocument({
      documentType: 'Packing Slip',
      invoiceNo: displayInvoiceNo,
      date: formatDateTimeDisplay(displayDate),
      customerName: displayCustomer,
      mobile: displayMobile,
      shippingAddress: displayAddress,
      items: displayItems.map(item => ({ name: item.name, qty: item.qty, unit: item.unit })),
      businessName,
      businessAddress: businessSubLine,
      printedBy: settings.businessName || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:h-auto print:block">
        <div className="bg-white w-full max-w-[210mm] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:h-auto print:max-w-none print:rounded-none print:overflow-visible">

            {/* Modal Header - Hidden in Print */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0 print:hidden">
                 <h2 className="text-lg font-bold text-slate-700">Packing Slip Preview</h2>
                 <div className="flex gap-3">
                     <button
                        onClick={handlePrint}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                     >
                         <Printer size={16} /> Print
                     </button>
                     <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                         <X size={20} />
                     </button>
                 </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-slate-100 custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
                <div className="max-w-[210mm] mx-auto bg-white shadow-sm p-12 min-h-[297mm] flex flex-col print:shadow-none print:p-0">

                    {/* Header Section */}
                    <div className="flex justify-between items-start mb-12">
                        <div className="w-1/2">
                             <div className="w-24 h-24 mb-4 relative">
                               <div className="w-full h-full flex items-center justify-center rounded bg-slate-900 text-white text-3xl font-black">
                                    {(businessName || 'B').trim().charAt(0).toUpperCase()}
                               </div>
                               <div className="absolute -bottom-2 left-0 w-full text-center text-[8px] text-slate-600 font-bold uppercase tracking-tighter">{businessName}</div>
                            </div>

                            <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900 mb-1">{businessName}</h1>
                            <p className="text-xs text-slate-600 mb-1">{businessSubLine}</p>
                        </div>

                        <div className="w-1/2 text-right">
                             <h2 className="text-3xl text-slate-600 font-light mb-6">Packing Slip</h2>
                             <div className="grid grid-cols-2 gap-x-4 text-sm">
                                 <div className="text-slate-600 text-right font-medium">Invoice No.</div>
                                 <div className="text-slate-900 text-right font-bold">{displayInvoiceNo}</div>

                                 <div className="text-slate-600 text-right font-medium">Date</div>
                                 <div className="text-slate-900 text-right font-bold">{formatDateTimeDisplay(displayDate)}</div>
                             </div>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="flex justify-between items-start mb-12 gap-8">
                        <div className="w-1/2">
                            <h3 className="text-xs font-bold text-slate-900 mb-2">Customer</h3>
                            <div className="text-xs text-slate-700 space-y-1">
                                <p className="font-semibold">{displayCustomer}</p>
                                <p className="font-bold">Mobile: {displayMobile}</p>
                            </div>
                        </div>
                        <div className="w-1/2">
                            <h3 className="text-xs font-bold text-slate-900 mb-2">Shipping Address:</h3>
                             <div className="text-xs text-slate-700 min-h-[3rem]">
                                <p>{displayAddress || '--'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mb-12">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-2 text-left w-12 font-medium text-slate-400">#</th>
                                    <th className="py-2 text-left font-medium text-slate-400">Product</th>
                                    <th className="py-2 text-right font-medium text-slate-400">Quantity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {displayItems.length > 0 ? displayItems.map((item, i) => (
                                    <tr key={i}>
                                        <td className="py-4 text-slate-500">{i + 1}</td>
                                        <td className="py-4 text-slate-800">{item.name}</td>
                                        <td className="py-4 text-right text-slate-800">{Number(item.qty).toFixed(3)} {item.unit || 'Pc(s)'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-slate-400 text-xs">No items</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        <div className="border-t border-slate-200 mt-2"></div>
                    </div>

                    {/* Footer / Signatures */}
                    <div className="mt-auto">
                        <div className="mb-12">
                            <p className="text-xs font-bold text-slate-800 mb-6">Authorized Signatory</p>

                            <p className="text-xs font-bold text-slate-800 underline italic mb-4">Received By</p>
                            <div className="flex gap-2 text-xs font-bold text-slate-800 mb-4">
                                <span>Name:</span>
                                <span className="border-b border-slate-300 w-48 inline-block"></span>
                            </div>
                             <div className="flex gap-2 text-xs font-bold text-slate-800">
                                <span>Signature:</span>
                                <span className="border-b border-slate-300 w-48 inline-block"></span>
                            </div>
                        </div>

                        <p className="text-xs italic font-bold text-slate-900 mb-8">
                            "Received in good condition; payment as agreed."
                        </p>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-[10px] text-slate-500">
                             <span>{formatDateTimeDisplay(new Date().toISOString())}</span>
                             <span>All sales - {businessName}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};

export default PackingSlip;
