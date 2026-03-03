import React from 'react';
import { X, Printer } from 'lucide-react';

interface PackingSlipProps {
    onClose: () => void;
    invoiceNo?: string;
    date?: string;
}

const PackingSlip: React.FC<PackingSlipProps> = ({ onClose, invoiceNo = 'K2026-2505', date = '14/02/2026 07:33 AM' }) => {
  
  const handlePrint = () => {
      window.print();
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
                               {/* Logo Placeholder */}
                               <div className="w-full h-full flex items-center justify-center">
                                    <svg viewBox="0 0 100 100" className="w-full h-full">
                                        <path d="M50 20 L80 80 L50 65 L20 80 Z" fill="#dc2626" opacity="0.9" />
                                        <path d="M50 20 L70 50 L30 50 Z" fill="#991b1b" />
                                    </svg>
                               </div>
                               <div className="absolute -bottom-2 left-0 w-full text-center text-[8px] text-red-600 font-bold uppercase tracking-tighter">Gulf Land Treasures United</div>
                            </div>
                            
                            <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900 mb-1">KNWZ ARD ALKHLYJ <br/> ALMTHDH CR:1282649</h1>
                            <p className="text-xs text-slate-600 mb-1">Muscat, Oman</p>
                            <p className="text-xs font-bold text-slate-800">VATIN: OM1100435179</p>
                        </div>
                        
                        <div className="w-1/2 text-right">
                             <h2 className="text-3xl text-slate-600 font-light mb-6">Packing Slip</h2>
                             <div className="grid grid-cols-2 gap-x-4 text-sm">
                                 <div className="text-slate-600 text-right font-medium">Invoice No.</div>
                                 <div className="text-slate-900 text-right font-bold">{invoiceNo}</div>
                                 
                                 <div className="text-slate-600 text-right font-medium">Date</div>
                                 <div className="text-slate-900 text-right font-bold">{date}</div>
                             </div>
                        </div>
                    </div>

                    {/* Addresses */}
                    <div className="flex justify-between items-start mb-12 gap-8">
                        <div className="w-1/2">
                            <h3 className="text-xs font-bold text-slate-900 mb-2">Customer</h3>
                            <div className="text-xs text-slate-700 space-y-1">
                                <p>Direct Customer</p>
                                <p>Direct Customer</p>
                                <p className="font-bold">Mobile: 0</p>
                            </div>
                        </div>
                        <div className="w-1/2">
                            <h3 className="text-xs font-bold text-slate-900 mb-2">Shipping Address:</h3>
                             <div className="text-xs text-slate-700 min-h-[3rem]">
                                {/* Empty in screenshot */}
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
                                <tr>
                                    <td className="py-4 text-slate-500">1</td>
                                    <td className="py-4 text-slate-800">X Pets Puppy (Lamb) Pate 400g</td>
                                    <td className="py-4 text-right text-slate-800">36.000 Pc(s)</td>
                                </tr>
                                <tr>
                                    <td className="py-4 text-slate-500">2</td>
                                    <td className="py-4 text-slate-800">X Pets Dog (Veal) Chunks 400g</td>
                                    <td className="py-4 text-right text-slate-800">36.000 Pc(s)</td>
                                </tr>
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
                             <span>2/14/26, 5:36 PM</span>
                             <span>All sales - Atwar Al Mustaqbal</span>
                        </div>
                         <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                             <span>https://wingitalpos.com/atwaralmustaqbal/public/sells</span>
                             <span>1/1</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};

export default PackingSlip;