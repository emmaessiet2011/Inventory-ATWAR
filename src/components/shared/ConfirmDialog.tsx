import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  onCancel: () => void;
  onConfirm: () => void | boolean | Promise<void | boolean>;
}

const toneStyles: Record<NonNullable<ConfirmDialogProps['tone']>, { iconBg: string; iconText: string; confirmBtn: string }> = {
  danger: {
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    confirmBtn: 'bg-rose-600 hover:bg-rose-700',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700',
  },
  primary: {
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700',
  },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onCancel,
  onConfirm,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  if (!isOpen) return null;
  const style = toneStyles[tone];
  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const shouldClose = await onConfirm();
      if (shouldClose !== false) onCancel();
    } finally {
      setIsConfirming(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
        <div className="flex flex-col items-center text-center">
          <div className={`p-4 rounded-full mb-4 ${style.iconBg} ${style.iconText}`}>
            <AlertTriangle size={30} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${style.confirmBtn}`}
            >
              {isConfirming ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
