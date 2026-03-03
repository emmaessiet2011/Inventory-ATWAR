import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';

interface EditShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
}

const EditShippingModal: React.FC<EditShippingModalProps> = ({ isOpen, onClose, sale }) => {
  const [shippingDetails, setShippingDetails] = useState(sale?.shippingDetails || '');
  const [shippingAddress, setShippingAddress] = useState('Muscat, Oman');
  const [shippingStatus, setShippingStatus] = useState(sale?.shippingStatus || 'Ordered');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [shippingNote, setShippingNote] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl border border-slate-200 relative mt-10 mb-10 animate-in slide-in-from-top-4 duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl font-normal text-slate-800">
            Edit Shipping - <span className="font-semibold text-slate-600">{sale?.invoiceNo}</span>
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            {/* Row 1: Details & Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                        Shipping Details:*
                    </label>
                    <div className="relative">
                        <textarea 
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none text-slate-600 placeholder:text-slate-400"
                            placeholder="Shipping Details"
                            value={shippingDetails}
                            onChange={(e) => setShippingDetails(e.target.value)}
                        ></textarea>
                        <div className="absolute bottom-2 right-2 text-slate-400">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M8 8H2V2h6v6z" fillOpacity="0.2"/>
                                <path d="M9 9H1V1h8v8zM0 10h10V0H0v10z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                        Shipping Address:
                    </label>
                    <div className="relative">
                        <textarea 
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none text-slate-600 placeholder:text-slate-400"
                            placeholder="Shipping Address"
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                        ></textarea>
                         <div className="absolute bottom-2 right-2 text-slate-400">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                                <path d="M8 8H2V2h6v6z" fillOpacity="0.2"/>
                                <path d="M9 9H1V1h8v8zM0 10h10V0H0v10z"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 2: Status, Delivered To, Delivery Person */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                        Shipping Status:
                    </label>
                    <div className="relative">
                        <select 
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-sm text-slate-600 appearance-none bg-white"
                            value={shippingStatus}
                            onChange={(e) => setShippingStatus(e.target.value)}
                        >
                            <option value="Ordered">Ordered</option>
                            <option value="Packed">Packed</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5L6 6.5L11 1.5"/></svg>
                        </div>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                        Delivered To:
                    </label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-sm text-slate-600 placeholder:text-slate-400"
                        placeholder="Delivered To"
                        value={deliveredTo}
                        onChange={(e) => setDeliveredTo(e.target.value)}
                    />
                </div>

                <div className="group">
                    <label className="block text-sm font-bold text-slate-800 mb-2">
                        Delivery Person:
                    </label>
                     <div className="relative">
                        <select 
                            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 text-sm text-slate-600 appearance-none bg-white"
                            value={deliveryPerson}
                            onChange={(e) => setDeliveryPerson(e.target.value)}
                        >
                            <option value="">Please Select</option>
                            <option value="Driver 1">Driver 1</option>
                            <option value="Driver 2">Driver 2</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5L6 6.5L11 1.5"/></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Row 3: Shipping Note */}
            <div className="group">
                <label className="block text-sm font-bold text-slate-800 mb-2">
                    Shipping note:
                </label>
                 <div className="relative">
                    <textarea 
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm resize-none text-slate-600 placeholder:text-slate-400"
                        placeholder="Shipping note"
                        value={shippingNote}
                        onChange={(e) => setShippingNote(e.target.value)}
                    ></textarea>
                    <div className="absolute bottom-2 right-2 text-slate-400">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M8 8H2V2h6v6z" fillOpacity="0.2"/>
                            <path d="M9 9H1V1h8v8zM0 10h10V0H0v10z"/>
                        </svg>
                    </div>
                </div>
            </div>

             {/* Row 4: Shipping Documents */}
            <div className="group">
                <label className="block text-sm font-bold text-slate-800 mb-2">
                    Shipping Documents:
                </label>
                <div className="border border-slate-300 rounded h-32 flex flex-col items-center justify-center text-slate-500 text-sm bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                     <p>Drop files here to upload</p>
                </div>
                 <p className="text-center text-xs text-slate-500 mt-2">No attachment found</p>
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
                             <tr>
                                 <td colSpan={4} className="py-4 text-center text-slate-500 text-xs">No records found</td>
                             </tr>
                         </tbody>
                     </table>
                 </div>
            </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-white rounded-b-lg">
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-[#6200ea] text-white font-bold text-sm rounded hover:bg-[#5000ca] transition-colors"
             >
                Update
            </button>
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-slate-700 text-white font-bold text-sm rounded hover:bg-slate-800 transition-colors"
            >
                Cancel
            </button>
        </div>

      </div>
    </div>
  );
};

export default EditShippingModal;