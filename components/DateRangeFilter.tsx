import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface DateRangeFilterProps {
  onRangeSelect?: (range: DateRange) => void;
  className?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onRangeSelect, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('This Year');
  const [dateRange, setDateRange] = useState<string>('01/01/2026 - 31/12/2026');
  const [showCustomRange, setShowCustomRange] = useState(false);
  
  // Custom range temporary state
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to format date as DD/MM/YYYY
  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Helper to format date as YYYY-MM-DD for input[type="date"]
  const formatInputDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const applyRange = (label: string, start: Date, end: Date) => {
    const formattedRange = `${formatDate(start)} - ${formatDate(end)}`;
    setDateRange(formattedRange);
    setSelectedLabel(label);
    if (onRangeSelect) {
        onRangeSelect({ startDate: start, endDate: end, label });
    }
    setIsOpen(false);
    setShowCustomRange(false);
  };

  const handlePresetClick = (preset: string) => {
    const today = new Date(); // Assuming today is within 2026 for demo consistency based on previous screens, but sticking to real Date is safer. 
    // For demo purposes, let's use real dates.
    
    let start = new Date();
    let end = new Date();

    switch (preset) {
        case 'Today':
            start = new Date();
            end = new Date();
            break;
        case 'Yesterday':
            start = new Date();
            start.setDate(today.getDate() - 1);
            end = new Date(start);
            break;
        case 'Last 7 Days':
            start = new Date();
            start.setDate(today.getDate() - 6);
            end = new Date();
            break;
        case 'Last 30 Days':
            start = new Date();
            start.setDate(today.getDate() - 29);
            end = new Date();
            break;
        case 'This Month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'Last Month':
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'This month last year':
            start = new Date(today.getFullYear() - 1, today.getMonth(), 1);
            end = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0);
            break;
        case 'This Year':
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            break;
        case 'Last Year':
            start = new Date(today.getFullYear() - 1, 0, 1);
            end = new Date(today.getFullYear() - 1, 11, 31);
            break;
        case 'Current financial year':
            // Assuming Jan-Dec for demo, or could be Apr-Mar
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            break;
        case 'Last financial year':
            start = new Date(today.getFullYear() - 1, 0, 1);
            end = new Date(today.getFullYear() - 1, 11, 31);
            break;
        case 'Custom Range':
            setShowCustomRange(true);
            return; // Don't close yet
    }

    applyRange(preset, start, end);
  };

  const handleCustomApply = () => {
      if (customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          applyRange('Custom Range', start, end);
      }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomRange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <label className="block text-xs font-bold text-slate-700 mb-1">Date Range:</label>
      <div 
        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-slate-300 rounded cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-bold text-blue-800 whitespace-nowrap overflow-hidden text-ellipsis mr-2">
            {dateRange}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
            {!showCustomRange ? (
                <div className="py-1">
                    {[
                        'Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 
                        'This Month', 'Last Month', 'This month last year', 
                        'This Year', 'Last Year', 'Current financial year', 
                        'Last financial year', 'Custom Range'
                    ].map((preset) => (
                        <div 
                            key={preset}
                            className={`px-4 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50 hover:text-blue-600 transition-colors ${selectedLabel === preset ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
                            onClick={() => handlePresetClick(preset)}
                        >
                            {preset}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 bg-slate-50">
                    <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">Select Range</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">From</label>
                            <input 
                                type="date" 
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">To</label>
                            <input 
                                type="date" 
                                className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:border-blue-500"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-between pt-2">
                            <button 
                                onClick={() => setShowCustomRange(false)}
                                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                                Back
                            </button>
                            <button 
                                onClick={handleCustomApply}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 shadow-sm"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;