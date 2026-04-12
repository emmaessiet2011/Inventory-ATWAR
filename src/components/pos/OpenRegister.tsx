import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  bootstrapRegisterFromDB,
  getActiveRegisterSession,
  RegisterSessionRecord,
  startRegisterSession,
} from '@/utils/registerLedger';

interface OpenRegisterProps {
  onNavigate: (page: string) => void;
}

const OpenRegister: React.FC<OpenRegisterProps> = ({ onNavigate }) => {
  const { locations, currentUser, formatCurrency } = useGlobalContext();
  const { addNotification } = useNotifications();
  const [cashInHand, setCashInHand] = useState('');
  const [location, setLocation] = useState('');
  const [existingSession, setExistingSession] = useState<RegisterSessionRecord | null>(null);
  const activeLocations = useMemo(
    () => locations.filter(loc => loc.isActive !== false),
    [locations]
  );

  useEffect(() => {
    if (!location && (activeLocations.length > 0 || locations.length > 0)) {
      setLocation(activeLocations[0]?.id || locations[0]?.id || '');
    }
  }, [location, activeLocations, locations]);

  useEffect(() => {
    let cancelled = false;
    const refreshActiveSession = async () => {
      await bootstrapRegisterFromDB().catch(() => {});
      if (cancelled) return;
      setExistingSession(getActiveRegisterSession());
    };
    void refreshActiveSession();
    const onFocus = () => { void refreshActiveSession(); };
    const onRegisterUpdated = () => { void refreshActiveSession(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:register-updated', onRegisterUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:register-updated', onRegisterUpdated);
    };
  }, []);

  const handleOpen = () => {
    if (existingSession?.status === 'Open') {
      addNotification({
        title: 'Register already open',
        message: `Register is already open at ${existingSession.locationName}. Redirecting to POS.`,
        type: 'info',
      });
      onNavigate('pos');
      return;
    }

    const cash = Number(cashInHand || 0);
    const locationObj = activeLocations.find(loc => loc.id === location) || activeLocations[0] || locations[0];

    if (!locationObj) {
      addNotification({
        title: 'No business location',
        message: 'Please create a business location first.',
        type: 'error',
      });
      return;
    }

    if (!Number.isFinite(cash) || cash < 0) {
      addNotification({
        title: 'Invalid opening cash',
        message: 'Cash in hand must be a valid non-negative amount.',
        type: 'error',
      });
      return;
    }

    const registerSession: RegisterSessionRecord = {
      id: `REG-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openedBy: currentUser?.name || 'Admin',
      locationId: locationObj.id,
      locationName: locationObj.name,
      cashInHand: cash,
      status: 'Open',
    };

    startRegisterSession(registerSession);
    onNavigate('pos');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900">Open Cash Register</h2>
      
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 min-h-[400px]">
        <div className="max-w-6xl mx-auto space-y-6">
            {existingSession && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Existing register session: {existingSession.locationName} | Opened by {existingSession.openedBy} | Opening cash {formatCurrency(existingSession.cashInHand)}
                <div className="mt-2">
                  <button
                    onClick={() => onNavigate('pos')}
                    className="text-xs font-bold text-emerald-700 underline"
                  >
                    Continue to POS
                  </button>
                </div>
              </div>
            )}
            
            <div className="group">
                <label className="block text-sm font-bold text-slate-900 mb-2">Cash in hand:*</label>
                <input 
                    type="number" 
                    step="0.001"
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
                        {activeLocations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div className="pt-4 flex justify-end">
                <button 
                    onClick={handleOpen}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded shadow-md transition-colors text-sm"
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
