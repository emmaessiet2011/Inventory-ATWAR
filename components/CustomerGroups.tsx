import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Printer, FileSpreadsheet, 
  Edit, Trash2, X, Users, Link as LinkIcon,
  MoreVertical, Filter, ChevronDown, CheckCircle2, Ban, Percent, Info,
  AlertTriangle
} from 'lucide-react';
import MultiSelect from './MultiSelect';

interface CustomerGroup {
  id: number;
  name: string;
  description: string;
  sellingPriceGroup: string; // The connection
  membersCount: number;
  status: 'Active' | 'Inactive';
  calculationPercentage?: number;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

const initialGroups: CustomerGroup[] = [
    { 
      id: 1, 
      name: 'Walk-in Customers', 
      description: 'General public with standard pricing', 
      sellingPriceGroup: 'Default Selling Price', 
      membersCount: 1450, 
      status: 'Active',
      calculationPercentage: 0
    },
    { 
      id: 2, 
      name: 'Gold Wholesalers', 
      description: 'High volume partners requiring bulk discounts', 
      sellingPriceGroup: 'Wholesale Tier A', 
      membersCount: 24, 
      status: 'Active',
      calculationPercentage: -10
    },
    { 
      id: 3, 
      name: 'Regional Distributors', 
      description: 'Partners covering specific geographic zones', 
      sellingPriceGroup: 'Distributor VIP', 
      membersCount: 5, 
      status: 'Active',
      calculationPercentage: -15
    },
    { 
      id: 4, 
      name: 'E-Commerce Users', 
      description: 'Registered users via mobile app', 
      sellingPriceGroup: 'Online Sales', 
      membersCount: 890, 
      status: 'Active',
      calculationPercentage: 0
    },
    { 
      id: 5, 
      name: 'Defaulters', 
      description: 'Customers with overdue payments', 
      sellingPriceGroup: 'Default Selling Price', 
      membersCount: 12, 
      status: 'Inactive',
      calculationPercentage: 0
    },
];

const CustomerGroups: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter States
  const [filters, setFilters] = useState({
      status: [] as string[],
      priceGroup: [] as string[]
  });
  
  // Actions State
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      type: 'delete' | 'deactivate' | 'activate' | null;
      groupId: number | null;
      groupName: string;
  }>({
      isOpen: false,
      type: null,
      groupId: null,
      groupName: ''
  });

  // Form State
  const [formData, setFormData] = useState<{
      id: number | null;
      name: string;
      sellingPriceGroup: string;
      calculationPercentage: number;
  }>({
      id: null,
      name: '',
      sellingPriceGroup: '',
      calculationPercentage: 0
  });

  // Mock Data
  const [groups, setGroups] = useState<CustomerGroup[]>(() => {
      const saved = localStorage.getItem('app_customer_groups');
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) {
              console.error("Failed to parse groups", e);
          }
      }
      return initialGroups;
  });

  // Save to LocalStorage whenever groups change
  useEffect(() => {
      localStorage.setItem('app_customer_groups', JSON.stringify(groups));
  }, [groups]);

  const sellingPriceGroups = [
      'Default Selling Price',
      'Wholesale Tier A',
      'Distributor VIP',
      'Online Sales'
  ];

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 160; 
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 4,
        bottom: isDropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left - 100, 
        transformOrigin: isDropUp ? 'origin-bottom-right' : 'origin-top-right'
      });
      setActiveActionId(id);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
            return;
        }
        setActiveActionId(null);
    };

    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => setActiveActionId(null);

    if (activeActionId) {
        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }
    return () => {
        window.removeEventListener('mousedown', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId]);

  const handleToggleStatus = (id: number) => {
      const group = groups.find(g => g.id === id);
      if (!group) return;

      const action = group.status === 'Active' ? 'deactivate' : 'activate';
      setConfirmationModal({
          isOpen: true,
          type: action,
          groupId: id,
          groupName: group.name
      });
      setActiveActionId(null);
  };

  const handleDelete = (id: number) => {
      const group = groups.find(g => g.id === id);
      if (!group) return;
      
      setConfirmationModal({
          isOpen: true,
          type: 'delete',
          groupId: id,
          groupName: group.name
      });
      setActiveActionId(null);
  };

  const executeConfirmation = () => {
      if (!confirmationModal.groupId || !confirmationModal.type) return;

      if (confirmationModal.type === 'delete') {
          setGroups(groups.filter(g => g.id !== confirmationModal.groupId));
      } else {
          const newStatus = confirmationModal.type === 'activate' ? 'Active' : 'Inactive';
          setGroups(groups.map(g => g.id === confirmationModal.groupId ? { ...g, status: newStatus } : g));
      }
      setConfirmationModal({ isOpen: false, type: null, groupId: null, groupName: '' });
  };

  const handleEdit = (group: CustomerGroup) => {
      setFormData({
          id: group.id,
          name: group.name,
          sellingPriceGroup: group.sellingPriceGroup,
          calculationPercentage: group.calculationPercentage || 0
      });
      setIsAddModalOpen(true);
      setActiveActionId(null);
  };

  const handleSave = () => {
      if (!formData.name) {
          alert("Group Name is required");
          return;
      }

      if (formData.id) {
          // Update existing
          setGroups(groups.map(g => g.id === formData.id ? {
              ...g,
              name: formData.name,
              sellingPriceGroup: formData.sellingPriceGroup || 'Default Selling Price',
              calculationPercentage: formData.calculationPercentage
          } : g));
      } else {
          // Add new
          const newGroup: CustomerGroup = {
              id: Date.now(),
              name: formData.name,
              description: 'Custom Group',
              sellingPriceGroup: formData.sellingPriceGroup || 'Default Selling Price',
              membersCount: 0,
              status: 'Active',
              calculationPercentage: formData.calculationPercentage
          };
          setGroups([...groups, newGroup]);
      }
      handleCloseModal();
  };

  const handleCloseModal = () => {
      setIsAddModalOpen(false);
      setFormData({ id: null, name: '', sellingPriceGroup: '', calculationPercentage: 0 });
  };

  const filteredGroups = groups.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filters.status.length === 0 || filters.status.includes(g.status);
      const matchesPriceGroup = filters.priceGroup.length === 0 || filters.priceGroup.includes(g.sellingPriceGroup);
      return matchesSearch && matchesStatus && matchesPriceGroup;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-10">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customer Groups</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Segment your customers and assign specific <span className="font-semibold text-slate-700">Selling Price Groups</span> to them.
          </p>
        </div>
        <button 
            onClick={() => {
                setFormData({ id: null, name: '', sellingPriceGroup: '', calculationPercentage: 0 });
                setIsAddModalOpen(true);
            }}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
            <Plus size={18} /> Create Group
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                    <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-slate-500 focus:outline-none cursor-pointer">
                        <option>25</option>
                        <option>50</option>
                        <option>100</option>
                    </select>
                </div>

                <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                     <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm border ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                     >
                        <Filter size={14} /> Filter
                    </button>
                    <div className="h-8 w-px bg-slate-200 mx-2 hidden xl:block"></div>
                    {[
                        { icon: FileSpreadsheet, label: 'Export' },
                        { icon: Printer, label: 'Print' },
                    ].map((action, i) => (
                         <button key={i} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
                            <action.icon size={14} /> {action.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full xl:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search groups..." 
                        className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-500 focus:outline-none text-sm placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-2 fade-in">
                    <div className="group">
                        <MultiSelect 
                            label="Status"
                            options={['Active', 'Inactive']}
                            selected={filters.status}
                            onChange={(val) => setFilters({...filters, status: val})}
                        />
                    </div>
                    <div className="group">
                         <MultiSelect 
                            label="Selling Price Group"
                            options={sellingPriceGroups}
                            selected={filters.priceGroup}
                            onChange={(val) => setFilters({...filters, priceGroup: val})}
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 w-1/4">Group Name</th>
                        <th className="px-6 py-4">Linked Price Group</th>
                        <th className="px-6 py-4 text-center">Calculation %</th>
                        <th className="px-6 py-4 text-center">Members</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center w-20">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map((group) => (
                        <tr key={group.id} className={`hover:bg-slate-50/80 transition-colors group ${group.status === 'Inactive' ? 'opacity-60 bg-slate-50' : ''}`}>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-base">{group.name}</span>
                                    <span className="text-xs text-slate-500 mt-0.5">{group.description}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <LinkIcon size={14} className="text-slate-400" />
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {group.sellingPriceGroup}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                {group.calculationPercentage !== 0 && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                        group.calculationPercentage! > 0 
                                        ? 'bg-amber-50 text-amber-700' 
                                        : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                        {group.calculationPercentage! > 0 ? '+' : ''}{group.calculationPercentage}%
                                    </span>
                                )}
                                {group.calculationPercentage === 0 && <span className="text-slate-400">-</span>}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                                    <Users size={12} /> {group.membersCount}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                    group.status === 'Active' 
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                    {group.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button 
                                    onClick={(e) => toggleActions(e, group.id)}
                                    className={`p-2 rounded-lg transition-all duration-200 ${activeActionId === group.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                >
                                    <MoreVertical size={16} />
                                </button>
                            </td>
                        </tr>
                    ))
                    ) : (
                         <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                                No customer groups found matching your criteria.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>Showing {filteredGroups.length} entries</div>
            <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                <button className="px-4 py-2 bg-slate-900 text-white rounded-lg shadow-md shadow-slate-900/10">1</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
            </div>
        </div>
      </div>

       {/* Add/Edit Modal */}
       {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
                 <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <Users className="text-slate-900" size={24} />
                            {formData.id ? 'Edit Customer Group' : 'Add Customer Group'}
                        </h3>
                    </div>
                    <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
                     <div className="space-y-6">
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Group Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                placeholder="e.g. Silver Members"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Price Calculation Percentage (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                    placeholder="0"
                                    value={formData.calculationPercentage}
                                    onChange={(e) => setFormData({ ...formData, calculationPercentage: parseFloat(e.target.value) })}
                                />
                                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 flex items-start gap-1">
                                <Info size={12} className="flex-shrink-0 mt-0.5" />
                                <span>Used to calculate selling price = Selling Price Group Price + (Selling Price Group Price * % / 100)</span>
                            </p>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">Selling Price Group</label>
                            <div className="relative">
                                <select 
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm appearance-none cursor-pointer"
                                    value={formData.sellingPriceGroup}
                                    onChange={(e) => setFormData({ ...formData, sellingPriceGroup: e.target.value })}
                                >
                                    <option value="">None</option>
                                    {sellingPriceGroups.map(pg => (
                                        <option key={pg} value={pg}>{pg}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                     </div>
                </div>

                <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
                    <button onClick={handleCloseModal} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} /> {formData.id ? 'Update Group' : 'Save Group'}
                    </button>
                </div>
            </div>
        </div>
       )}

       {/* Confirmation Modal */}
       {confirmationModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 p-6">
                <div className="flex flex-col items-center text-center">
                    <div className={`p-4 rounded-full mb-4 ${
                        confirmationModal.type === 'delete' ? 'bg-red-50 text-red-500' : 
                        confirmationModal.type === 'deactivate' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                    }`}>
                        {confirmationModal.type === 'delete' && <Trash2 size={32} />}
                        {confirmationModal.type === 'deactivate' && <Ban size={32} />}
                        {confirmationModal.type === 'activate' && <CheckCircle2 size={32} />}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 capitalize">
                        {confirmationModal.type} Group
                    </h3>
                    <p className="text-slate-500 text-sm mb-6">
                        Are you sure you want to {confirmationModal.type} <span className="font-bold text-slate-800">"{confirmationModal.groupName}"</span>?
                        {confirmationModal.type === 'delete' && " This action cannot be undone."}
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setConfirmationModal({ isOpen: false, type: null, groupId: null, groupName: '' })}
                            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeConfirmation}
                            className={`flex-1 px-4 py-2.5 rounded-lg text-white font-bold shadow-lg transition-colors ${
                                 confirmationModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 
                                 confirmationModal.type === 'deactivate' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 
                                 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
       )}

       {/* Action Menu Portal */}
       {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ 
                top: dropdownPosition.top, 
                left: dropdownPosition.left, 
                bottom: dropdownPosition.bottom
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Actions</span>
            </div>
            
            <button 
                onClick={() => {
                    const group = groups.find(g => g.id === activeActionId);
                    if (group) handleEdit(group);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            <button 
                onClick={() => handleDelete(activeActionId!)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} className="text-rose-500" /> Delete
            </button>
            
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            {(() => {
                const group = groups.find(g => g.id === activeActionId);
                if (!group) return null;
                const isActive = group.status === 'Active';
                
                return (
                    <button 
                        onClick={() => handleToggleStatus(group.id)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-3 transition-colors ${isActive ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'}`}
                    >
                        {isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                )
            })()}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomerGroups;