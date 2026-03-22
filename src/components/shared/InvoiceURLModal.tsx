import React, { useState } from 'react';
import { X, Copy, Check, Link as LinkIcon, ExternalLink } from 'lucide-react';

interface InvoiceURLModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo?: string;
  saleId?: string;
}

const InvoiceURLModal: React.FC<InvoiceURLModalProps> = ({ isOpen, onClose, invoiceNo, saleId }) => {
  const [copied, setCopied] = useState(false);
  
  // Generate a real link pointing to the current app with query parameters
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const normalizedSaleId = String(saleId || '').trim();
  const hasValidSaleId = normalizedSaleId.length > 0;
  const url = hasValidSaleId
    ? `${origin}?page=public-view-invoice&id=${encodeURIComponent(normalizedSaleId)}`
    : '';

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon size={18} className="text-indigo-500" /> Share Invoice
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6">
            <p className="text-sm text-slate-600 mb-4">
                Share this link with your customer to allow them to view or download the invoice 
                {invoiceNo && <span className="font-bold text-slate-800"> {invoiceNo}</span>}.
            </p>

            <div className={`flex items-center gap-2 p-2 rounded-xl border ${hasValidSaleId ? 'bg-slate-50 border-slate-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="flex-1 px-2 overflow-hidden">
                    <p className={`text-xs truncate font-mono ${hasValidSaleId ? 'text-slate-500 select-all' : 'text-rose-600'}`}>
                      {hasValidSaleId ? url : 'Invoice link unavailable: sale record is missing.'}
                    </p>
                </div>
                <button 
                    onClick={handleCopy}
                    disabled={!hasValidSaleId}
                    className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${
                        !hasValidSaleId
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        :
                        copied 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm'
                    }`}
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                 <button 
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                    Close
                </button>
                <a 
                    href={hasValidSaleId ? url : '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-disabled={!hasValidSaleId}
                    onClick={(event) => {
                      if (!hasValidSaleId) event.preventDefault();
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg ${
                      hasValidSaleId
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-slate-200/20'
                    }`}
                >
                    Open Link <ExternalLink size={14} />
                </a>
            </div>
        </div>
        
      </div>
    </div>
  );
};

export default InvoiceURLModal;
