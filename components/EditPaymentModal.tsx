import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarIcon, Banknote, DollarSign, ChevronDown } from 'lucide-react';

interface EditPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    payment: any;
    customer: any;
    onSave: (updatedPayment: any) => void;
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ isOpen, onClose, payment, customer, onSave }) => {
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [paymentDate, setPaymentDate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentAccount, setPaymentAccount] = useState('None');
    const [paymentNote, setPaymentNote] = useState('');

    useEffect(() => {
        if (payment) {
            setPaymentMethod(payment.method || 'Cash');
            // Assuming payment.paidOn is in a format that can be parsed, or we just use it as string for now
            // For a real app, you'd format this to YYYY-MM-DDTHH:mm
            setPaymentDate(payment.paidOn || ''); 
            setPaymentAmount(payment.amount?.toString() || '');
            setPaymentNote(payment.note || '');
        }
    }, [payment]);

    if (!isOpen || !payment || !customer) return null;

    const handleSave = () => {
        onSave({
            ...payment,
            method: paymentMethod,
            paidOn: paymentDate,
            amount: parseFloat(paymentAmount),
            note: paymentNote
        });
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <h3 className="text-xl font-bold text-slate-800">Edit payment</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-slate-50 p-4 rounded border border-slate-200">
                            <p className="text-sm font-bold text-slate-800 mb-1">Customer: <span className="font-normal text-slate-600">{customer.businessName}</span></p>
                            <p className="text-sm font-bold text-slate-800">Business:</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded border border-slate-200">
                            <p className="text-sm font-bold text-slate-800 mb-1">Reference No: <span className="font-normal text-slate-600">{payment.refNo}</span></p>
                            <p className="text-sm font-bold text-slate-800 mb-1">Location: <span className="font-normal text-slate-600">KNWZ ARD ALKHLYJ ALMTHDH CR:1282649</span></p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded border border-slate-200">
                            <p className="text-sm font-bold text-slate-800 mb-1">Total amount: <span className="font-normal text-slate-600">{payment.amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span></p>
                            <p className="text-sm font-bold text-slate-800 mb-1">Payment Note: <span className="font-normal text-slate-600">{payment.note || 'Credit'}</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Payment Method:*</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Banknote size={16} />
                                </div>
                                <select 
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    <option>Cash</option>
                                    <option>Card</option>
                                    <option>Cheque</option>
                                    <option>Bank Transfer</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Paid on:*</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <CalendarIcon size={16} />
                                </div>
                                <input 
                                    type="text" 
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Amount:*</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <DollarSign size={16} />
                                </div>
                                <input 
                                    type="number" 
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Attach Document:</label>
                            <div className="flex items-center">
                                <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-l text-sm hover:bg-slate-200 transition-colors whitespace-nowrap">
                                    Choose File
                                    <input type="file" className="hidden" />
                                </label>
                                <span className="px-3 py-2 border border-l-0 border-slate-300 rounded-r w-full text-sm text-slate-500 bg-white">No file chosen</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Previously uploaded file will be replaced<br/>Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>
                        </div>

                        <div className="group">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Payment Account:</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <Banknote size={16} />
                                </div>
                                <select 
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                                    value={paymentAccount}
                                    onChange={(e) => setPaymentAccount(e.target.value)}
                                >
                                    <option value="None">None</option>
                                    <option value="Cash Account">Cash Account</option>
                                    <option value="Bank Account">Bank Account</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                            </div>
                        </div>
                    </div>

                    <div className="group mb-6">
                        <label className="block text-sm font-bold text-slate-800 mb-1">Payment Note:</label>
                        <textarea 
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-24 resize-none"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 bg-[#4f46e5] text-white rounded font-bold text-sm hover:bg-[#4338ca] transition-colors"
                    >
                        Update
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

export default EditPaymentModal;
