import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Key, Check, Info, Lock, ChevronDown, UserPlus, Eye, EyeOff, Percent, DollarSign } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
}

const DEFAULT_FORM_DATA = {
  name: '',
  username: '',
  email: '',
  role: 'Cashier',
  password: '',
  confirmPassword: '',
  allowLogin: true,
  language: 'English',
  commissionPercent: 0,
  maxDiscountPercent: 0,
  baseSalary: 0
};

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { roles, users } = useGlobalContext();
  const { addNotification } = useNotifications();
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const availableRoles = (() => {
    const roleNames = roles.map((r: any) => String(r?.name || '').trim()).filter(Boolean);
    const uniqueRoleNames = Array.from(new Set(roleNames));
    return uniqueRoleNames.length > 0
      ? uniqueRoleNames
      : ['Admin', 'CEO', 'Manager', 'Sale Agent', 'Sales Man', 'Order', 'Field Payment', 'Cashier'];
  })();

  useEffect(() => {
      if (initialData) {
          setFormData({
              ...DEFAULT_FORM_DATA,
              ...initialData,
              password: '', // Never pre-fill password
              confirmPassword: ''
          });
      } else {
          setFormData(DEFAULT_FORM_DATA);
      }
      setShowPassword(false);
      setShowConfirmPassword(false);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const name = formData.name.trim();
    const username = formData.username.trim();
    const email = formData.email.trim();
    const password = formData.password.trim();
    const confirmPassword = formData.confirmPassword;
    const isEdit = !!initialData;

    if (!name || !username || !email || !formData.role) {
      addNotification({
        title: 'Missing required fields',
        message: 'Please fill in name, username, email, and role.',
        type: 'error',
      });
      return;
    }

    const duplicateUsername = users.some(
      u => u.username.toLowerCase() === username.toLowerCase() && (!isEdit || u.id !== initialData?.id)
    );
    if (duplicateUsername) {
      addNotification({
        title: 'Duplicate username',
        message: 'Username already exists. Please choose another username.',
        type: 'error',
      });
      return;
    }

    const duplicateEmail = users.some(
      u => u.email.toLowerCase() === email.toLowerCase() && (!isEdit || u.id !== initialData?.id)
    );
    if (duplicateEmail) {
      addNotification({
        title: 'Duplicate email',
        message: 'Email already exists. Please use another email address.',
        type: 'error',
      });
      return;
    }

    if (!isEdit && !password) {
      addNotification({
        title: 'Password required',
        message: 'Password is required for new users.',
        type: 'error',
      });
      return;
    }

    if (password || !isEdit) {
      if (password.length < 6) {
        addNotification({
          title: 'Weak password',
          message: 'Password must be at least 6 characters.',
          type: 'error',
        });
        return;
      }
      if (password !== confirmPassword) {
        addNotification({
          title: 'Password mismatch',
          message: 'Password and confirm password do not match.',
          type: 'error',
        });
        return;
      }
    }

    onSave({
      ...formData,
      name,
      username,
      email,
      password,
      commissionPercent: Number.isFinite(Number(formData.commissionPercent)) ? Number(formData.commissionPercent) : 0,
      maxDiscountPercent: Number.isFinite(Number(formData.maxDiscountPercent)) ? Number(formData.maxDiscountPercent) : undefined,
      baseSalary: Number.isFinite(Number(formData.baseSalary)) ? Number(formData.baseSalary) : 0
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
        
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <UserPlus size={28} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {initialData ? 'Edit User Profile' : 'Create System Account'}
                    </h3>
                    <p className="text-slate-500 text-sm">Assign roles and credentials for ATWAR BSS.</p>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                <X size={24} />
            </button>
        </div>

        {/* Form Body */}
        <div className="p-10 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                
                {/* Profile Information */}
                <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <User size={14} className="text-blue-500" /> Identity Information
                    </h4>
                    
                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Full Name *</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800" 
                                placeholder="e.g. Hussain Balushi"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Username *</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-mono text-slate-700" 
                                placeholder="unique_login_id"
                                value={formData.username}
                                onChange={(e) => handleChange('username', e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">Username will be used for system login.</p>
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Email Address *</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="email" 
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" 
                                placeholder="user@atwar.com"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">System Role</label>
                        <div className="relative">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select 
                                className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-black text-slate-800 appearance-none cursor-pointer"
                                value={formData.role}
                                onChange={(e) => handleChange('role', e.target.value)}
                            >
                                {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                        </div>
                    </div>
                </div>

                {/* Security & Finance */}
                <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <DollarSign size={14} className="text-emerald-500" /> Sales & Commission
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Commission (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="number" 
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 transition-all text-sm font-bold text-slate-800" 
                                    placeholder="0"
                                    value={formData.commissionPercent}
                                    onChange={(e) => handleChange('commissionPercent', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Max Discount (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 transition-all text-sm font-bold text-slate-800"
                                    placeholder="0"
                                    value={formData.maxDiscountPercent}
                                    onChange={(e) => handleChange('maxDiscountPercent', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Base Salary (OMR)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="number" 
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 transition-all text-sm font-bold text-slate-800" 
                                    placeholder="0.000"
                                    value={formData.baseSalary}
                                    onChange={(e) => handleChange('baseSalary', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 pt-4">
                        <Lock size={14} className="text-rose-500" /> Security Credentials
                    </h4>

                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Password</label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-mono text-slate-800" 
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Confirm Password</label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-mono text-slate-800"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                            <h5 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Info size={14} className="text-blue-500" /> Access Controls
                            </h5>
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div 
                                        className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${formData.allowLogin ? 'bg-blue-600' : 'bg-slate-300'}`} 
                                        onClick={() => handleChange('allowLogin', !formData.allowLogin)}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${formData.allowLogin ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700 transition-colors">Grant System Login</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
            <button 
                onClick={onClose}
                className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all shadow-sm"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center gap-2"
            >
                <Check size={18} /> {initialData ? 'Update Account' : 'Confirm & Create'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default AddUserModal;
