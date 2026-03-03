import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1 animate-in fade-in zoom-in-95 duration-100">
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
        </div>
      )}
    </div>
  );
};

export default MultiSelect;