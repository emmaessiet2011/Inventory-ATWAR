import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  DollarSign,
  Edit,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Percent,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmationModal } from './UserModals';
import { CommissionAgent, Sale as GlobalSale, useGlobalContext } from '@/context/GlobalContext';
import { printActiveReportTable } from '@/utils/printUtils';

interface AgentFormData {
  prefix: string;
  firstName: string;
  lastName: string;
  email: string;
  contactNo: string;
  address: string;
  commissionPercentage: string;
  isActive: boolean;
}

const DEFAULT_FORM_DATA: AgentFormData = {
  prefix: '',
  firstName: '',
  lastName: '',
  email: '',
  contactNo: '',
  address: '',
  commissionPercentage: '',
  isActive: true,
};

const clean = (value: string): string => String(value || '').trim();

const normalizeAgent = (agent: CommissionAgent): CommissionAgent => {
  const name = clean(agent.name);
  const prefix = clean(agent.prefix || '');
  const firstName = clean(agent.firstName || name.split(' ')[0] || '');
  const lastName = clean(agent.lastName || name.split(' ').slice(1).join(' ') || '');
  return {
    ...agent,
    prefix,
    firstName,
    lastName,
    name: clean(name || [prefix, firstName, lastName].filter(Boolean).join(' ')),
    commissionPercentage: Number.isFinite(Number(agent.commissionPercentage)) ? Number(agent.commissionPercentage) : 0,
    isActive: agent.isActive !== false,
  };
};

const isFinalSale = (sale: GlobalSale): boolean => (sale.status || sale.saleStatus) === 'Final';

const isLinkedToAgent = (sale: GlobalSale, agent: CommissionAgent): boolean => {
  const idMatch = String((sale as any).commissionAgentId || '') === String(agent.id);
  const nameMatch = clean(String((sale as any).commissionAgentName || '')).toLowerCase() === clean(agent.name).toLowerCase();
  return idMatch || nameMatch;
};

const escapeCsv = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;

const SalesCommissionAgents: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    commissionAgents,
    addCommissionAgent,
    updateCommissionAgent,
    deleteCommissionAgent,
    sales,
    formatCurrency,
    settings,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [entriesToShow, setEntriesToShow] = useState<number>(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(DEFAULT_FORM_DATA);
  const [pendingDeleteAgent, setPendingDeleteAgent] = useState<CommissionAgent | null>(null);
  const [viewAgentId, setViewAgentId] = useState<number | null>(null);

  const agents = useMemo(
    () => commissionAgents.map(normalizeAgent).sort((a, b) => a.name.localeCompare(b.name)),
    [commissionAgents]
  );

  useEffect(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    if (Number.isFinite(parsed) && parsed > 0) setEntriesToShow(parsed);
  }, [settings.defaultTableEntries]);

  const filteredAgents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a =>
      String(a.id).toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.contactNo.toLowerCase().includes(q)
    );
  }, [agents, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / entriesToShow));
  useEffect(() => { setCurrentPage(1); }, [searchTerm, entriesToShow]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * entriesToShow;
    return filteredAgents.slice(start, start + entriesToShow);
  }, [filteredAgents, currentPage, entriesToShow]);

  const stats = useMemo(() => {
    const activeAgents = agents.filter(a => a.isActive !== false).length;
    const avgCommission = agents.length > 0
      ? agents.reduce((sum, agent) => sum + Number(agent.commissionPercentage || 0), 0) / agents.length
      : 0;
    const totalCommission = sales.reduce((sum, sale) => {
      if (!isFinalSale(sale)) return sum;
      const hasAgent = clean(String((sale as any).commissionAgentId || '')) !== '' ||
        clean(String((sale as any).commissionAgentName || '')) !== '';
      if (!hasAgent) return sum;
      return sum + Number((sale as any).commissionAmount || 0);
    }, 0);
    return { activeAgents, avgCommission, totalCommission };
  }, [agents, sales]);

  const selectedViewAgent = useMemo(
    () => (viewAgentId === null ? null : agents.find(a => a.id === viewAgentId) || null),
    [viewAgentId, agents]
  );

  const selectedViewAgentSales = useMemo(() => {
    if (!selectedViewAgent) return [];
    return sales.filter(sale => isFinalSale(sale) && isLinkedToAgent(sale, selectedViewAgent));
  }, [sales, selectedViewAgent]);

  const selectedViewAgentCommissionTotal = useMemo(
    () => selectedViewAgentSales.reduce((sum, sale) => sum + Number((sale as any).commissionAmount || 0), 0),
    [selectedViewAgentSales]
  );

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (agent: CommissionAgent) => {
    const normalized = normalizeAgent(agent);
    setFormData({
      prefix: normalized.prefix || '',
      firstName: normalized.firstName || '',
      lastName: normalized.lastName || '',
      email: normalized.email || '',
      contactNo: normalized.contactNo || '',
      address: normalized.address || '',
      commissionPercentage: Number(normalized.commissionPercentage || 0).toString(),
      isActive: normalized.isActive !== false,
    });
    setEditingId(normalized.id);
    setIsModalOpen(true);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = event.target as HTMLInputElement;
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: target.type === 'checkbox' ? target.checked : value }));
  };

  const handleSaveAgent = (event: React.FormEvent) => {
    event.preventDefault();

    const prefix = clean(formData.prefix);
    const firstName = clean(formData.firstName);
    const lastName = clean(formData.lastName);
    const email = clean(formData.email);
    const contactNo = clean(formData.contactNo);
    const address = clean(formData.address);
    const commissionPercentage = Number(formData.commissionPercentage);

    if (!firstName) {
      addNotification({ title: 'Validation Error', message: 'First name is required.', type: 'error' });
      return;
    }
    if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      addNotification({ title: 'Validation Error', message: 'Commission must be between 0 and 100.', type: 'error' });
      return;
    }
    if (email && agents.some(a => a.email.toLowerCase() === email.toLowerCase() && a.id !== editingId)) {
      addNotification({ title: 'Validation Error', message: 'Email already exists for another agent.', type: 'error' });
      return;
    }
    if (contactNo && agents.some(a => a.contactNo === contactNo && a.id !== editingId)) {
      addNotification({ title: 'Validation Error', message: 'Contact number already exists for another agent.', type: 'error' });
      return;
    }

    const existing = editingId !== null ? agents.find(a => a.id === editingId) : undefined;
    const now = new Date().toISOString();
    const payload: CommissionAgent = {
      id: editingId ?? Date.now(),
      prefix,
      firstName,
      lastName,
      name: clean([prefix, firstName, lastName].filter(Boolean).join(' ')),
      email,
      contactNo,
      address,
      commissionPercentage: Number(commissionPercentage.toFixed(2)),
      isActive: formData.isActive,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (editingId !== null) {
      updateCommissionAgent(payload);
      addNotification({ title: 'Agent Updated', message: 'Sales commission agent updated.', type: 'success' });
    } else {
      addCommissionAgent(payload);
      addNotification({ title: 'Agent Added', message: 'Sales commission agent added.', type: 'success' });
    }

    setIsModalOpen(false);
    resetForm();
  };

  const toggleAgentStatus = (agent: CommissionAgent) => {
    const normalized = normalizeAgent(agent);
    updateCommissionAgent({ ...normalized, isActive: !(normalized.isActive !== false) });
    addNotification({
      title: normalized.isActive !== false ? 'Agent Deactivated' : 'Agent Activated',
      message: `${normalized.name} is now ${normalized.isActive !== false ? 'inactive' : 'active'}.`,
      type: 'info',
    });
  };

  const confirmDelete = () => {
    if (!pendingDeleteAgent) return;
    deleteCommissionAgent(pendingDeleteAgent.id);
    addNotification({ title: 'Agent Deleted', message: 'Sales commission agent deleted.', type: 'info' });
    setPendingDeleteAgent(null);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportCsv = () => {
    const header = ['ID', 'Name', 'Email', 'Contact Number', 'Address', 'Commission %', 'Status'];
    const rows = filteredAgents.map(a => [
      String(a.id),
      escapeCsv(a.name),
      escapeCsv(a.email),
      escapeCsv(a.contactNo),
      escapeCsv(a.address),
      Number(a.commissionPercentage || 0).toFixed(2),
      a.isActive !== false ? 'Active' : 'Inactive',
    ].join(','));
    downloadFile([header.join(','), ...rows].join('\n'), 'sales-commission-agents.csv', 'text/csv');
  };

  const exportExcel = () => {
    const header = ['ID', 'Name', 'Email', 'Contact Number', 'Address', 'Commission %', 'Status'];
    const rows = filteredAgents.map(a => [
      String(a.id),
      a.name,
      a.email || '',
      a.contactNo || '',
      a.address || '',
      Number(a.commissionPercentage || 0).toFixed(2),
      a.isActive !== false ? 'Active' : 'Inactive',
    ].join('\t'));
    downloadFile([header.join('\t'), ...rows].join('\n'), 'sales-commission-agents.xls', 'application/vnd.ms-excel');
  };

  const printData = () => printActiveReportTable();

  const exportPdf = () => {
    printActiveReportTable();
    addNotification({ title: 'Export PDF', message: 'Use browser print dialog to save as PDF.', type: 'info' });
  };

  const start = filteredAgents.length === 0 ? 0 : (currentPage - 1) * entriesToShow + 1;
  const end = Math.min(currentPage * entriesToShow, filteredAgents.length);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UserPlus className="text-blue-600" size={32} />
            Sales Commission Agents
          </h2>
          <p className="text-slate-500 mt-1">Manage agents and commission setup used by sales.</p>
        </div>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2">
          <Plus size={18} /> Add Agent
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Agents', value: agents.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Agents', value: stats.activeAgents, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Avg Commission', value: `${stats.avgCommission.toFixed(2)}%`, icon: Percent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Total Commission', value: formatCurrency(stats.totalCommission), icon: DollarSign, color: 'text-slate-900', bg: 'bg-slate-100' },
        ].map((card, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}><card.icon size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
              <p className="text-lg font-black text-slate-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col lg:flex-row justify-between gap-4 items-center">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by ID, name, email or contact number..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={entriesToShow} onChange={(e) => setEntriesToShow(Number(e.target.value))} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white">
              {[10, 25, 50, 100].map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <button onClick={exportCsv} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white flex items-center gap-1"><FileText size={12} /> CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white flex items-center gap-1"><FileSpreadsheet size={12} /> Excel</button>
            <button onClick={printData} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white flex items-center gap-1"><Printer size={12} /> Print</button>
            <button onClick={exportPdf} className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white flex items-center gap-1"><FileDown size={12} /> PDF</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3">Agent Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-center">Commission %</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAgents.length > 0 ? paginatedAgents.map(agent => (
                <tr key={agent.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewAgentId(agent.id)} className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"><Eye size={12} /></button>
                      <button onClick={() => openEditModal(agent)} className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50"><Edit size={12} /></button>
                      <button onClick={() => toggleAgentStatus(agent)} className="px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50">{agent.isActive !== false ? <Ban size={12} /> : <Check size={12} />}</button>
                      <button onClick={() => setPendingDeleteAgent(agent)} className="px-2 py-1 text-xs rounded border border-rose-200 text-rose-600 bg-white hover:bg-rose-50"><Trash2 size={12} /></button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">{agent.name}</td>
                  <td className="px-4 py-3 text-slate-600">{agent.email || '--'}</td>
                  <td className="px-4 py-3 text-slate-600">{agent.contactNo || '--'}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{Number(agent.commissionPercentage || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold border ${
                      agent.isActive !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {agent.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No data available in table</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30 text-xs font-bold text-slate-500">
          <span>Showing {start} to {end} of {filteredAgents.length} entries</span>
          <div className="flex gap-2">
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50">Prev</button>
            <span className="px-4 py-2 bg-blue-600 text-white rounded-xl" aria-current="page">{currentPage}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="px-4 py-2 bg-white border border-slate-200 rounded-xl disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editingId ? 'Edit Sales Commission Agent' : 'Add Sales Commission Agent'}</h3>
                <p className="text-slate-500 text-sm">{editingId ? 'Update agent details and commission rules.' : 'Create a new agent profile.'}</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAgent} className="p-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input name="prefix" value={formData.prefix} onChange={handleInputChange} placeholder="Prefix" className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" />
                <input name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="First Name *" required className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 md:col-span-2" />
              </div>
              <input name="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="Last Name" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" />
              <input name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="Email Address" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" />
              <input name="contactNo" value={formData.contactNo} onChange={handleInputChange} placeholder="Contact Number" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" />
              <textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Address" rows={3} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 resize-none" />
              <input name="commissionPercentage" type="number" min="0" max="100" step="0.01" value={formData.commissionPercentage} onChange={handleInputChange} placeholder="Sales Commission Percentage (%)" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200" />
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                <input name="isActive" type="checkbox" checked={formData.isActive} onChange={handleInputChange} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Active Agent
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-6 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">Cancel</button>
                <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold">{editingId ? 'Update Agent' : 'Save Agent'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedViewAgent && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Agent Details</h3>
              <button onClick={() => setViewAgentId(null)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div><span className="font-bold text-slate-700">Name:</span> {selectedViewAgent.name}</div>
              <div><span className="font-bold text-slate-700">Email:</span> {selectedViewAgent.email || '--'}</div>
              <div><span className="font-bold text-slate-700">Contact:</span> {selectedViewAgent.contactNo || '--'}</div>
              <div><span className="font-bold text-slate-700">Address:</span> {selectedViewAgent.address || '--'}</div>
              <div><span className="font-bold text-slate-700">Commission Rate:</span> {Number(selectedViewAgent.commissionPercentage || 0).toFixed(2)}%</div>
              <div><span className="font-bold text-slate-700">Final Sales Linked:</span> {selectedViewAgentSales.length}</div>
              <div><span className="font-bold text-slate-700">Commission Total:</span> {formatCurrency(selectedViewAgentCommissionTotal)}</div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDeleteAgent}
        onClose={() => setPendingDeleteAgent(null)}
        onConfirm={confirmDelete}
        title="Delete Commission Agent"
        message={`Delete ${pendingDeleteAgent?.name || 'this agent'}? This action cannot be undone.`}
        confirmLabel="Delete Agent"
        confirmVariant="danger"
      />
    </div>
  );
};

export default SalesCommissionAgents;

