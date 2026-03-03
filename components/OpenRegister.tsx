import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface OpenRegisterProps {
  onNavigate: (page: string) => void;
}

const OpenRegister: React.FC<OpenRegisterProps> = ({ onNavigate }) => {
  const [cashInHand, setCashInHand] = useState('');
  const [location, setLocation] = useState('');

  const handleOpen = () => {
    // Navigate to actual POS on success
    onNavigate('pos');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900">Open Cash Register</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 min-h-[400px]">
        <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="group">
                <label className="block text-sm font-bold text-slate-900 mb-2">Cash in hand:*</label>
                <input 
                    type="number" 
                    placeholder="Enter amount" 
                    className="w-full px-4 py-3 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm placeholder:text-slate-400"
                    value={cashInHand}
                    onChange={(e) => setCashInHand(e.target.value)}
                />
            </div>

            <div className="group">
                <label className="block text-sm font-bold text-slate-900 mb-2">Business Location:</label>
                <div className="relative">
                    <select 
                        className="w-full px-4 py-3 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm text-slate-600 appearance-none bg-white cursor-pointer"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    >
                        <option value="">Select location</option>
                        <option value="Main Store">Main Store</option>
                        <option value="Warehouse">Warehouse</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <button 
                    onClick={handleOpen}
                    className="bg-[#6200ea] hover:bg-[#5000ca] text-white font-bold py-3 px-6 rounded shadow-md transition-colors text-sm"
                >
                    Open Register
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};

export default OpenRegister;