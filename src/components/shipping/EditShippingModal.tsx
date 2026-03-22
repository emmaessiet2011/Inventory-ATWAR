import React, { useState, useEffect, useRef } from 'react';
import { X, Paperclip } from 'lucide-react';
import {
  Sale as GlobalSale,
  ShippingActivity,
  ShippingDocumentMeta,
  ShippingStatus,
  SHIPPING_STATUS_OPTIONS,
  useGlobalContext,
} from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface EditShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: GlobalSale | null;
  onSave?: (updatedSale: GlobalSale) => void;
}

const EditShippingModal: React.FC<EditShippingModalProps> = ({ isOpen, onClose, sale, onSave }) => {
  const { users, currentUser, settings } = useGlobalContext();

  const [shippingDetails, setShippingDetails] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>('Ordered');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [shippingNote, setShippingNote] = useState('');
  const [shippingDocName, setShippingDocName] = useState('');
  const [shippingDocument, setShippingDocument] = useState<ShippingDocumentMeta | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDateTimeDisplay = (value?: string): string => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const buildDocumentMeta = (file: File): ShippingDocumentMeta => ({
    name: file.name,
    type: file.type || undefined,
    size: Number.isFinite(file.size) ? file.size : undefined,
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : undefined,
  });

  // Pre-fill from existing sale data whenever modal opens
  useEffect(() => {
    if (!isOpen || !sale) return;
    setShippingDetails(sale.shippingDetails || '');
    setShippingAddress(sale.shippingAddress || sale.billingAddress || '');
    setShippingStatus(sale.shippingStatus || 'Ordered');
    setDeliveredTo(sale.deliveredTo || '');
    setDeliveryPerson(sale.deliveryPerson || '');
    setShippingNote(sale.shippingNote || '');
    const existingDoc = sale.shippingDocument || (sale.shippingDocName ? { name: sale.shippingDocName } : null);
    setShippingDocument(existingDoc);
    setShippingDocName(existingDoc?.name || '');
  }, [isOpen, sale]);

  if (!isOpen) return null;

  // Build an activities log from the sale's shipping history array (if tracked) or show current status
  const activities: ShippingActivity[] = Array.isArray(sale?.shippingActivities) ? sale.shippingActivities : [];
  // Always show the current status if no history exists
  const displayActivities = activities.length > 0 ? activities : (sale?.shippingStatus ? [{
    date: sale.date || '--',
    action: `Status: ${sale.shippingStatus}`,
    by: sale.deliveryPerson || '--',
    note: sale.shippingNote || '--',
  }] : []);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-200 relative mt-10 mb-10 overflow-hidden animate-in slide-in-from-top-4 duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Paperclip size={20} className="text-slate-600" />
            Edit Shipping — <span className="text-blue-600">{sale?.invoiceNo}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">

            {/* Row 1: Details & Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Shipping Details:*
                    </label>
                    <div className="relative">
                        <textarea
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none placeholder:text-slate-400"
                            placeholder="Shipping Details"
                            value={shippingDetails}
                            onChange={(e) => setShippingDetails(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Shipping Address:
                    </label>
                    <div className="relative">
                        <textarea
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none placeholder:text-slate-400"
                            placeholder="Shipping Address"
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                        ></textarea>
                    </div>
                </div>
            </div>

            {/* Row 2: Status, Delivered To, Delivery Person */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Shipping Status:
                    </label>
                    <div className="relative">
                        <select
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                            value={shippingStatus}
                            onChange={(e) => setShippingStatus(e.target.value as ShippingStatus)}
                        >
                            {SHIPPING_STATUS_OPTIONS.map(statusOption => (
                              <option key={statusOption} value={statusOption}>{statusOption}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5L6 6.5L11 1.5"/></svg>
                        </div>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Delivered To:
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="Delivered To"
                        value={deliveredTo}
                        onChange={(e) => setDeliveredTo(e.target.value)}
                    />
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Delivery Person:
                    </label>
                    <div className="relative">
                        <select
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                            value={deliveryPerson}
                            onChange={(e) => setDeliveryPerson(e.target.value)}
                        >
                            <option value="">Please Select</option>
                            {users.filter(u => u.status === 'Active').map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5L6 6.5L11 1.5"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Shipping Note */}
            <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Shipping note:
                </label>
                <div className="relative">
                    <textarea
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none placeholder:text-slate-400"
                        placeholder="Shipping note"
                        value={shippingNote}
                        onChange={(e) => setShippingNote(e.target.value)}
                    ></textarea>
                </div>
            </div>

            {/* Row 4: Shipping Documents */}
            <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Shipping Documents:
                </label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setShippingDocName(file.name);
                          setShippingDocument(buildDocumentMeta(file));
                        }
                    }}
                />
                <div
                    className="border border-dashed border-slate-300 rounded h-28 flex flex-col items-center justify-center text-slate-500 text-sm bg-white cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setShippingDocName(file.name);
                          setShippingDocument(buildDocumentMeta(file));
                        }
                    }}
                >
                    {shippingDocName ? (
                        <><Paperclip size={16} className="text-blue-500 mb-1" /><span className="text-blue-600 font-medium text-xs">{shippingDocName}</span></>
                    ) : (
                        <><p>Drop files here or click to upload</p><p className="text-xs text-slate-400 mt-1">.pdf, .jpg, .png, .doc accepted</p></>
                    )}
                </div>
                {!shippingDocName && <p className="text-center text-xs text-slate-500 mt-2">No attachment found</p>}
            </div>

            {/* Row 5: Activities Table */}
            <div className="mt-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">Activities:</h4>
                <div className="border-t border-slate-200">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="py-2 font-bold text-slate-700">Date</th>
                                <th className="py-2 font-bold text-slate-700">Action</th>
                                <th className="py-2 font-bold text-slate-700">By</th>
                                <th className="py-2 font-bold text-slate-700">Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayActivities.length > 0 ? displayActivities.map((act, i) => (
                                <tr key={i} className="border-b border-slate-100">
                                    <td className="py-2 text-slate-600 text-xs">{formatDateTimeDisplay(act.date)}</td>
                                    <td className="py-2 text-slate-700 text-xs font-medium">{act.action}</td>
                                    <td className="py-2 text-slate-600 text-xs">{act.by}</td>
                                    <td className="py-2 text-slate-600 text-xs">{act.note}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-500 text-xs">No records found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
            <button
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
            >
                Cancel
            </button>
             <button
                onClick={() => {
                  if (onSave && sale) {
                    // Append to shippingActivities log so history is preserved
                    const newActivity: ShippingActivity = {
                      date: new Date().toISOString(),
                      action: `Status changed to: ${shippingStatus}`,
                      by: currentUser?.name || deliveryPerson || '--',
                      note: shippingNote || '--',
                    };
                    const existingActivities: ShippingActivity[] = Array.isArray(sale.shippingActivities) ? sale.shippingActivities : [];
                    const updatedActivities = shippingStatus !== sale.shippingStatus
                      ? [...existingActivities, newActivity]
                      : existingActivities;

                    onSave({
                      ...sale,
                      shippingStatus,
                      shippingAddress,
                      shippingDetails,
                      deliveredTo,
                      deliveryPerson,
                      shippingNote,
                      shippingDocName: shippingDocName || sale.shippingDocName || '',
                      shippingDocument: shippingDocument || sale.shippingDocument || undefined,
                      shippingActivities: updatedActivities,
                    });
                  }
                  onClose();
                }}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95"
             >
                Update Shipping
            </button>
        </div>

      </div>
    </div>
  );
};

export default EditShippingModal;
