import React from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Printer } from 'lucide-react';

interface ViewPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payment: any;
    customer: any;
}

const ViewPaymentModal: React.FC<ViewPaymentModalProps> = ({ isOpen, onClose, payment, customer }) => {
    if (!isOpen || !payment || !customer) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">
                        View Payment ( Reference No: {payment.refNo} )
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-sm text-slate-600 mb-1">Customer:</p>
                            <p className="font-bold text-slate-800">{customer.businessName}</p>
                            <p className="text-sm text-slate-600">{customer.name}</p>
                            <p className="text-sm text-slate-600">Mobile: {customer.mobile}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-600 mb-1">Business:</p>
                            <p className="font-bold text-slate-800">Atwar Al Mustaqbal</p>
                            <p className="text-sm text-slate-600">KNWZ ARD ALKHLYJ ALMTHDH CR:1282649</p>
                            <p className="text-sm text-slate-600">KNWZ</p>
                            <p className="text-sm text-slate-600">Muscat,Muscat,Oman</p>
                            <p className="text-sm text-slate-600">VATIN: OM1100399470</p>
                            <p className="text-sm text-slate-600">VATIN: OM1100435179</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <p className="text-sm"><span className="font-bold text-slate-800">Amount :</span> {payment.amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال</p>
                            <p className="text-sm"><span className="font-bold text-slate-800">Payment Method :</span> {payment.method}</p>
                            <p className="text-sm"><span className="font-bold text-slate-800">Payment Note :</span> {payment.note || '-'}</p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm"><span className="font-bold text-slate-800">Reference No:</span> {payment.refNo}</p>
                            <p className="text-sm"><span className="font-bold text-slate-800">Paid on:</span> {payment.paidOn}</p>
                            <button className="mt-4 flex items-center gap-2 px-4 py-2 border border-[#00d1b2] text-[#00d1b2] rounded-full text-sm font-bold hover:bg-[#00d1b2]/10 transition-colors">
                                <Download size={16} />
                                Download Document
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                    <button 
                        className="px-6 py-2 bg-[#4f46e5] text-white rounded font-bold text-sm hover:bg-[#4338ca] transition-colors flex items-center gap-2"
                    >
                        <Printer size={16} />
                        Print
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-[#334155] text-white rounded font-bold text-sm hover:bg-[#1e293b] transition-colors"
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
