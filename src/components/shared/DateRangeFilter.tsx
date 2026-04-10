import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface DateRangeFilterProps {
  onRangeSelect?: (range: DateRange) => void;
  className?: string;
  initialRange?: DateRange;
  allowAllTime?: boolean;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  onRangeSelect,
  className = '',
  initialRange,
  allowAllTime = false,
}) => {
  const { settings } = useGlobalContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(() => String(initialRange?.label || 'This Year'));
  const getFiscalStartMonthIndex = () => {
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];
    const idx = monthNames.indexOf(String(settings.fyStartMonth || '').trim().toLowerCase());
    return idx >= 0 ? idx : 0;
  };
  const getFinancialYearRange = (referenceDate: Date, yearOffset = 0) => {
    const fiscalStartMonth = getFiscalStartMonthIndex();
    const year = referenceDate.getFullYear();
    const startYear = referenceDate.getMonth() >= fiscalStartMonth ? year : year - 1;
    const targetStartYear = startYear + yearOffset;
    const start = new Date(targetStartYear, fiscalStartMonth, 1);
    const end = new Date(targetStartYear + 1, fiscalStartMonth, 0);
    return { start, end };
  };
  // Helper to format date according to app settings
  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return settings.dateFormat === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
  };
  const [dateRange, setDateRange] = useState<string>(() => {
    if (initialRange) {
      if (initialRange.startDate && initialRange.endDate) {
        return `${formatDate(initialRange.startDate)} - ${formatDate(initialRange.endDate)}`;
      }
      return initialRange.label || 'All Time';
    }
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return `${formatDate(start)} - ${formatDate(end)}`;
  });
  const [showCustomRange, setShowCustomRange] = useState(false);
  
  // Custom range temporary state
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = Math.max(224, Math.round(rect.width));
    const maxLeft = Math.max(8, viewportWidth - width - 8);
    const left = Math.min(Math.max(8, Math.round(rect.left)), maxLeft);
    setMenuStyle({
      position: 'fixed',
      top: Math.round(rect.bottom + 6),
      left,
      width,
      zIndex: 10000,
    });
  };

  const applyRange = (label: string, start: Date | null, end: Date | null) => {
    const formattedRange = start && end
      ? `${formatDate(start)} - ${formatDate(end)}`
      : label || 'All Time';
    setDateRange(formattedRange);
    setSelectedLabel(label);
    if (onRangeSelect) {
        onRangeSelect({ startDate: start, endDate: end, label });
    }
    setIsOpen(false);
    setShowCustomRange(false);
  };

  const handlePresetClick = (preset: string) => {
    const today = new Date();
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
            ({ start, end } = getFinancialYearRange(today, 0));
            break;
        case 'Last financial year':
            ({ start, end } = getFinancialYearRange(today, -1));
            break;
        case 'All Time':
            applyRange('All Time', null, null);
            return;
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
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (menuRef.current ? !menuRef.current.contains(target) : true)
      ) {
        setIsOpen(false);
        setShowCustomRange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  }, [isOpen, showCustomRange]);

  useEffect(() => {
    const today = new Date();
    if (selectedLabel === 'All Time') {
      setDateRange('All Time');
      return;
    }
    if (selectedLabel === 'This Year') {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      setDateRange(`${formatDate(start)} - ${formatDate(end)}`);
      return;
    }
    if (selectedLabel === 'Current financial year') {
      const { start, end } = getFinancialYearRange(today, 0);
      setDateRange(`${formatDate(start)} - ${formatDate(end)}`);
      return;
    }
    if (selectedLabel === 'Last financial year') {
      const { start, end } = getFinancialYearRange(today, -1);
      setDateRange(`${formatDate(start)} - ${formatDate(end)}`);
    }
  }, [settings.dateFormat, settings.fyStartMonth, selectedLabel]);

  return (
    <div className={`relative group ${className}`} ref={containerRef}>
      <label className="block text-xs font-bold text-slate-700 mb-1">Date Range:</label>
      <div
        ref={triggerRef}
        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-slate-300 rounded cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-bold text-blue-800 whitespace-nowrap overflow-hidden text-ellipsis mr-2">
            {dateRange}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="bg-white border border-slate-200 rounded shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
        >
            {!showCustomRange ? (
                <div className="py-1">
                    {[
                        ...(allowAllTime ? ['All Time'] : []),
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
        </div>,
        document.body,
      )}
    </div>
  );
};

export default DateRangeFilter;
