import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Printer, FileSpreadsheet,
  Edit, Trash2, X, Users, Link as LinkIcon,
  MoreVertical, Filter, ChevronDown, CheckCircle2, Ban, Percent, Info, UsersRound
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';


import { printActiveReportTable } from '../src/utils/printUtils';
import { useNotifications } from '../src/context/NotificationContext';
import { buildPaginationItems } from '../src/utils/pagination';

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

const CustomerGroups: React.FC = () => {
  const {
    customerGroups: contextGroups,
    addCustomerGroup: ctxAdd,
    updateCustomerGroup: ctxUpdate,
    deleteCustomerGroup: ctxDelete,
    customers: allCustomers,
    sellingPriceGroups: contextSellingPriceGroups,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

  type GroupStatus = 'Active' | 'Inactive';
  type ConfirmationType = 'delete' | 'deactivate' | 'activate' | null;
  interface GroupFormState {
    id: string | null;
    name: string;
    description: string;
    sellingPriceGroupId: string;
    calculationPercentage: number;
    discountPercent: number;
    status: GroupStatus;
  }

  const findLinkedSellingPriceGroup = (group: any) => {
    if (group.sellingPriceGroupId) {
      const byId = contextSellingPriceGroups.find(pg => pg.id === group.sellingPriceGroupId);
      if (byId) return byId;
    }
    if (group.sellingPriceGroup) {
      const byName = contextSellingPriceGroups.find(
        pg => normalizeText(pg.name) === normalizeText(group.sellingPriceGroup)
      );
      if (byName) return byName;
      const byAlias = contextSellingPriceGroups.find(pg => {
        const candidate = normalizeText(pg.name);
        const source = normalizeText(group.sellingPriceGroup);
        return candidate.includes(source) || source.includes(candidate);
      });
      if (byAlias) return byAlias;
    }
    return null;
  };

  const defaultFormData: GroupFormState = {
    id: null,
    name: '',
    description: '',
    sellingPriceGroupId: '',
    calculationPercentage: 0,
    discountPercent: 0,
    status: 'Active',
  };

  const activeSellingPriceGroups = useMemo(
    () => contextSellingPriceGroups.filter(pg => pg.status === 'Active'),
    [contextSellingPriceGroups]
  );

  const groups = useMemo(() => contextGroups.map(g => {
    const linkedPriceGroup = findLinkedSellingPriceGroup(g);
    const parsedCalculation = Number(g.calculationPercentage);
    const parsedDiscount = Number(g.discountPercent);
    return {
      ...g,
      membersCount: allCustomers.filter(c =>
        c.customerGroupId
          ? c.customerGroupId === g.id
          : normalizeText(c.customerGroup) === normalizeText(g.name)
      ).length,
      status: (g.status || 'Active') as GroupStatus,
      sellingPriceGroup: linkedPriceGroup?.name || g.sellingPriceGroup || '',
      sellingPriceGroupId: linkedPriceGroup?.id || g.sellingPriceGroupId || '',
      calculationPercentage: Number.isFinite(parsedCalculation)
        ? parsedCalculation
        : (Number.isFinite(parsedDiscount) ? parsedDiscount : 0),
      discountPercent: Number.isFinite(parsedDiscount) ? parsedDiscount : 0,
    };
  }), [contextGroups, allCustomers, contextSellingPriceGroups]);

  const sellingPriceGroupFilterOptions = useMemo(() => Array.from(new Set([
    ...contextSellingPriceGroups.map(pg => pg.name),
    ...groups.map(g => g.sellingPriceGroup || '').filter(Boolean),
  ])), [contextSellingPriceGroups, groups]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter States
  const [filters, setFilters] = useState({
      status: [] as string[],
      priceGroup: [] as string[]
  });

  // Actions State
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Confirmation Modal State
  const [confirmationModal, setConfirmationModal] = useState<{
      isOpen: boolean;
      type: ConfirmationType;
      groupId: string | null;
      groupName: string;
      memberCount: number;
      reassignToGroupId: string;
  }>({
      isOpen: false,
      type: null,
      groupId: null,
      groupName: '',
      memberCount: 0,
      reassignToGroupId: '',
  });

  // Form State
  const [formData, setFormData] = useState<GroupFormState>(defaultFormData);
  const selectableSellingPriceGroups = useMemo(() => {
    if (!formData.sellingPriceGroupId) return activeSellingPriceGroups;
    const alreadyPresent = activeSellingPriceGroups.some(pg => pg.id === formData.sellingPriceGroupId);
    if (alreadyPresent) return activeSellingPriceGroups;
    const linkedInactive = contextSellingPriceGroups.find(pg => pg.id === formData.sellingPriceGroupId);
    return linkedInactive ? [...activeSellingPriceGroups, linkedInactive] : activeSellingPriceGroups;
  }, [activeSellingPriceGroups, contextSellingPriceGroups, formData.sellingPriceGroupId]);

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 160;
      const dropdownWidth = 192;
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropUp = spaceBelow < dropdownHeight;
      const preferredLeft = rect.left - 100;
      const maxLeft = Math.max(8, window.innerWidth - dropdownWidth - 8);
      const clampedLeft = Math.max(8, Math.min(preferredLeft, maxLeft));

      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 4,
        bottom: isDropUp ? window.innerHeight - rect.top + 4 : undefined,
        left: clampedLeft,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.status, filters.priceGroup, pageSize]);

  const handleToggleStatus = (id: string) => {
      const group = contextGroups.find(g => g.id === id);
      if (!group) return;

      const action = (group.status || 'Active') === 'Active' ? 'deactivate' : 'activate';
      setConfirmationModal({
          isOpen: true,
          type: action,
          groupId: id,
          groupName: group.name,
          memberCount: 0,
          reassignToGroupId: '',
      });
      setActiveActionId(null);
  };

  const handleDelete = (id: string) => {
      const group = groups.find(g => g.id === id);
      if (!group) return;

      const fallbackReassign = groups.find(g => g.id !== id && g.status === 'Active');

      setConfirmationModal({
          isOpen: true,
          type: 'delete',
          groupId: id,
          groupName: group.name,
          memberCount: group.membersCount || 0,
          reassignToGroupId: fallbackReassign?.id || '',
      });
      setActiveActionId(null);
  };

  const executeConfirmation = () => {
      if (!confirmationModal.groupId || !confirmationModal.type) return;

      if (confirmationModal.type === 'delete') {
          ctxDelete(
            confirmationModal.groupId,
            confirmationModal.reassignToGroupId || undefined
          );
          addNotification({
            title: 'Group Deleted',
            message: confirmationModal.memberCount > 0 && confirmationModal.reassignToGroupId
              ? `"${confirmationModal.groupName}" deleted and members reassigned.`
              : `"${confirmationModal.groupName}" deleted successfully.`,
            type: 'success',
          });
      } else {
          const newStatus = confirmationModal.type === 'activate' ? 'Active' : 'Inactive';
          const group = contextGroups.find(g => g.id === confirmationModal.groupId);
          if (group) {
            ctxUpdate({ ...group, status: newStatus });
            addNotification({
              title: `Group ${newStatus}`,
              message: `"${group.name}" is now ${newStatus}.`,
              type: 'success',
            });
          }
      }
      setConfirmationModal({ isOpen: false, type: null, groupId: null, groupName: '', memberCount: 0, reassignToGroupId: '' });
  };

  const handleEdit = (group: typeof groups[0]) => {
      setFormData({
          id: group.id,
          name: group.name,
          description: group.description || '',
          sellingPriceGroupId: group.sellingPriceGroupId || '',
          calculationPercentage: Number(group.calculationPercentage || 0),
          discountPercent: Number(group.discountPercent || 0),
          status: group.status || 'Active',
      });
      setIsAddModalOpen(true);
      setActiveActionId(null);
  };

  const handleSave = () => {
      const trimmedName = formData.name.trim();
      const trimmedDescription = formData.description.trim();
      if (!trimmedName) {
          addNotification({ title: 'Validation Error', message: 'Group Name is required.', type: 'error' });
          return;
      }

      const duplicate = contextGroups.some(g =>
        g.id !== formData.id &&
        normalizeText(g.name) === normalizeText(trimmedName)
      );
      if (duplicate) {
          addNotification({ title: 'Duplicate Group', message: `Customer group "${trimmedName}" already exists.`, type: 'error' });
          return;
      }

      const parsedCalculation = Number(formData.calculationPercentage);
      const parsedDiscount = Number(formData.discountPercent);
      const calculationPercentage = Number.isFinite(parsedCalculation) ? parsedCalculation : 0;
      const discountPercent = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;
      if (discountPercent < 0 || discountPercent > 100) {
          addNotification({ title: 'Validation Error', message: 'Group discount must be between 0 and 100.', type: 'error' });
          return;
      }
      if (calculationPercentage < -100) {
          addNotification({ title: 'Validation Error', message: 'Price calculation percentage cannot be less than -100.', type: 'error' });
          return;
      }

      if (formData.sellingPriceGroupId && !contextSellingPriceGroups.some(pg => pg.id === formData.sellingPriceGroupId)) {
          addNotification({ title: 'Invalid Price Group', message: 'The selected selling price group no longer exists. Please re-select or clear the field.', type: 'error' });
          return;
      }

      if (formData.id) {
          // Update existing
          const existing = contextGroups.find(g => g.id === formData.id);
          const selectedPriceGroup = contextSellingPriceGroups.find(pg => pg.id === formData.sellingPriceGroupId);
          if (!existing) return;
          ctxUpdate({
              ...existing,
              id: formData.id,
              name: trimmedName,
              description: trimmedDescription,
              discountPercent,
              sellingPriceGroupId: selectedPriceGroup?.id || '',
              sellingPriceGroup: selectedPriceGroup?.name || '',
              calculationPercentage,
              status: formData.status || existing.status || 'Active',
          });
          addNotification({ title: 'Group Updated', message: `"${trimmedName}" updated successfully.`, type: 'success' });
      } else {
          // Add new
          const selectedPriceGroup = contextSellingPriceGroups.find(pg => pg.id === formData.sellingPriceGroupId);
          ctxAdd({
              id: generateId('GRP-'),
              name: trimmedName,
              description: trimmedDescription,
              discountPercent,
              sellingPriceGroupId: selectedPriceGroup?.id || '',
              sellingPriceGroup: selectedPriceGroup?.name || '',
              calculationPercentage,
              status: formData.status || 'Active',
          });
          addNotification({ title: 'Group Created', message: `"${trimmedName}" created successfully.`, type: 'success' });
      }
      handleCloseModal();
  };

  const handleCloseModal = () => {
      setIsAddModalOpen(false);
      setFormData(defaultFormData);
  };

  const filteredGroups = groups.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filters.status.length === 0 || filters.status.includes(g.status);
      const matchesPriceGroup = filters.priceGroup.length === 0 || filters.priceGroup.includes(g.sellingPriceGroup);
      return matchesSearch && matchesStatus && matchesPriceGroup;
  });

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageItems = buildPaginationItems(safePage, totalPages);
  const paginatedGroups = filteredGroups.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const exportToCSV = () => {
    const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Group Name', 'Selling Price Group', 'Calculation %', 'Members', 'Status'].join(',');
    const rows = filteredGroups.map(g => [
      csvEscape(g.name),
      csvEscape(g.sellingPriceGroup),
      Number(g.calculationPercentage ?? 0).toFixed(3),
      g.membersCount,
      g.status,
    ].join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_groups.csv';
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ title: 'Export Complete', message: `${filteredGroups.length} group record(s) exported.`, type: 'success' });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <UsersRound size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customer Groups</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Segment customers and assign selling price groups</p>
          </div>
        </div>
        <button
            onClick={() => {
                setFormData(defaultFormData);
                setIsAddModalOpen(true);
            }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
        >
            <Plus size={18} /> Create Group
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
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
                    <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
                      <FileSpreadsheet size={14} /> Export
                    </button>
                    <button onClick={() => printActiveReportTable()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm">
                      <Printer size={14} /> Print
                    </button>
                </div>

                <div className="relative w-full xl:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search groups..."
                        className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
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
                            options={sellingPriceGroupFilterOptions}
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
                    {paginatedGroups.length > 0 ? (
                        paginatedGroups.map((group) => (
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
                                        {group.sellingPriceGroup || '--'}
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
            <div>Showing {Math.min((safePage - 1) * pageSize + 1, filteredGroups.length)}-{Math.min(safePage * pageSize, filteredGroups.length)} of {filteredGroups.length} entries</div>
            <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                >Previous</button>
                {pageItems.map((item, index) => item === '...'
                  ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
                  : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`px-4 py-2 rounded-lg shadow-sm ${item === safePage ? 'bg-blue-600 text-white shadow-blue-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                    >
                      {item}
                    </button>
                  ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                >Next</button>
            </div>
        </div>
      </div>

       {/* Add/Edit Modal */}
       {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
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
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Group Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                placeholder="e.g. Silver Members"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Price Calculation Percentage (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                    placeholder="0"
                                    value={formData.calculationPercentage}
                                    onChange={(e) => setFormData({ ...formData, calculationPercentage: parseFloat(e.target.value) || 0 })}
                                />
                                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 flex items-start gap-1">
                                <Info size={12} className="flex-shrink-0 mt-0.5" />
                                <span>Used to calculate selling price = Selling Price Group Price + (Selling Price Group Price * % / 100)</span>
                            </p>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Group Discount (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                                    placeholder="0"
                                    value={formData.discountPercent}
                                    onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                                />
                                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                            <select
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm appearance-none cursor-pointer"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as GroupStatus })}
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price Group</label>
                            <div className="relative">
                                <select
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm appearance-none cursor-pointer"
                                    value={formData.sellingPriceGroupId}
                                    onChange={(e) => setFormData({ ...formData, sellingPriceGroupId: e.target.value })}
                                >
                                    <option value="">None</option>
                                    {selectableSellingPriceGroups.map(pg => (
                                        <option key={pg.id} value={pg.id}>{pg.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                            <textarea
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm resize-none"
                                placeholder="Optional notes about this customer group"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                     </div>
                </div>

                <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
                    <button onClick={handleCloseModal} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2">
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
                    {confirmationModal.type === 'delete' && confirmationModal.memberCount > 0 && (
                        <div className="w-full mb-4 text-left rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="text-xs font-semibold text-amber-800 mb-2">
                                {confirmationModal.memberCount} customer(s) are currently linked to this group.
                            </p>
                            <label className="block text-[11px] font-bold text-amber-900 mb-1">
                                Reassign members to
                            </label>
                            <select
                                className="w-full px-3 py-2 rounded-md border border-amber-200 bg-white text-xs font-medium text-slate-700"
                                value={confirmationModal.reassignToGroupId}
                                onChange={(e) => setConfirmationModal(prev => ({ ...prev, reassignToGroupId: e.target.value }))}
                            >
                                <option value="">No reassignment (set Ungrouped)</option>
                                {groups
                                  .filter(g => g.id !== confirmationModal.groupId && g.status === 'Active')
                                  .map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                  ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => setConfirmationModal({ isOpen: false, type: null, groupId: null, groupName: '', memberCount: 0, reassignToGroupId: '' })}
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
                onClick={() => activeActionId && handleDelete(activeActionId)}
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


