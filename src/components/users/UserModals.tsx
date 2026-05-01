
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lock, ShieldAlert, AlertTriangle, Eye, EyeOff } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ConfirmationModalProps extends ModalProps {
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void | boolean | Promise<void | boolean>;
    icon?: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, title, message, confirmLabel, confirmVariant = 'primary', icon 
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    if (!isOpen) return null;

    const variantClasses = {
        danger: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200',
        warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200',
        primary: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
    };

    const iconBgClasses = {
        danger: 'bg-rose-50 text-rose-600',
        warning: 'bg-amber-50 text-amber-600',
        primary: 'bg-indigo-50 text-indigo-600'
    };

    const handleConfirm = async () => {
        if (isConfirming) return;
        setIsConfirming(true);
        try {
            const shouldClose = await onConfirm();
            if (shouldClose !== false) onClose();
        } finally {
            setIsConfirming(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8 text-center">
                    <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6 ${iconBgClasses[confirmVariant]}`}>
                        {icon || <AlertTriangle size={32} />}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isConfirming}
                        className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className={`flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[confirmVariant]}`}
                    >
                        {isConfirming ? 'Working...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

interface ChangePasswordModalProps extends ModalProps {
    userName: string;
    onSave: (password: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, onSave, userName }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setPassword('');
            setConfirmPassword('');
            setShowPassword(false);
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        onSave(password);
        onClose();
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Lock size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Change Password</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">For {userName}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                                    placeholder="••••••••"
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                                <ShieldAlert size={14} />
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit"
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20 active:scale-[0.98] mt-4"
                        >
                            Update Password
                        </button>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
};
