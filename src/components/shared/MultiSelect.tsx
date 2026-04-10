import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selected, onChange, placeholder = 'All' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = Math.max(160, Math.round(rect.width));
    const maxLeft = Math.max(8, viewportWidth - width - 8);
    const left = Math.min(Math.max(8, Math.round(rect.left)), maxLeft);
    setMenuStyle({
      position: 'fixed',
      top: Math.round(rect.bottom + 8),
      left,
      width,
      zIndex: 10000,
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (menuRef.current ? !menuRef.current.contains(target) : true)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="group relative" ref={containerRef}>
      <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all select-none min-w-[160px]"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
          {selected.length === 0 
            ? placeholder 
            : selected.length === 1 
              ? selected[0] 
              : `${selected.length} selected`}
        </span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <div 
              onClick={clearSelection}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors z-10"
            >
              <X size={12} />
            </div>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((option) => (
            <div
              key={option}
              onClick={() => toggleOption(option)}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors group/item"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                selected.includes(option)
                ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200'
                : 'border-slate-300 bg-white group-hover/item:border-blue-400'
              }`}>
                {selected.includes(option) && <Check size={10} className="text-white" />}
              </div>
              <span className={`text-xs ${selected.includes(option) ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                {option}
              </span>
            </div>
          ))}
          {options.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-slate-400 italic">No options available</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default MultiSelect;
