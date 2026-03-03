import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit, Trash2, 
  FileText, FileSpreadsheet, Printer, 
  Columns, FileDown, X, MoreVertical,
  UserPlus, Percent, DollarSign, Users,
  Zap, ShieldAlert, BadgeCheck, Eye,
  Check, Mail, User, Phone, MapPin
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';
import { useGlobalContext, CommissionAgent } from '../src/context/GlobalContext';

interface DropdownPosition {
  top: number;
  left: number;
}

const SalesCommissionAgents: React.FC = () => {
  const { addNotification } = useNotifications();
  const { commissionAgents: globalAgents, addCommissionAgent, updateCommissionAgent, deleteCommissionAgent } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entriesToShow, setEntriesToShow] = useState(25);
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [agents, setAgents] = useState<CommissionAgent[]>(globalAgents);

  React.useEffect(() => {
    setAgents(globalAgents);
  }, [globalAgents]);

  const [formData, setFormData] = useState({
    prefix: '',
    firstName: '',
    lastName: '',
    email: '',
    contactNo: '',
    address: '',
    commissionPercentage: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.contactNo.includes(searchTerm)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddClick = () => {
    setFormData({
      prefix: '',
      firstName: '',
      lastName: '',
      email: '',
      contactNo: '',
      address: '',
      commissionPercentage: ''
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEditAgent = (agent: CommissionAgent) => {
    const nameParts = agent.name.split(' ');
    setFormData({
      prefix: '', // Assuming prefix isn't stored in the simple model for now, or extract if possible
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: agent.email,
      contactNo: agent.contactNo,
      address: agent.address,
      commissionPercentage: agent.commissionPercentage.toString()
    });
    setEditingId(agent.id);
    setIsModalOpen(true);
    setActiveActionId(null);
  };

  const handleSaveAgent = (e: React.FormEvent) => {
    e.preventDefault();
    
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    
    if (editingId) {
      updateCommissionAgent({
        id: editingId,
        name: fullName,
        email: formData.email,
        contactNo: formData.contactNo,
        address: formData.address,
        commissionPercentage: parseFloat(formData.commissionPercentage) || 0
      });
      
      addNotification({
        title: 'Agent Updated',
        message: 'Sales commission agent details have been updated.',
        type: 'success'
      });
    } else {
      const newAgent: CommissionAgent = {
        id: Date.now(),
        name: fullName,
        email: formData.email,
        contactNo: formData.contactNo,
        address: formData.address,
        commissionPercentage: parseFloat(formData.commissionPercentage) || 0
      };
      
      addCommissionAgent(newAgent);
      
      addNotification({
        title: 'Agent Added',
        message: 'Sales commission agent has been successfully added.',
        type: 'success'
      });
    }
    
    setIsModalOpen(false);
  };

  const handleDeleteAgent = (id: number) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      deleteCommissionAgent(id);
      addNotification({
        title: 'Agent Deleted',
        message: 'Sales commission agent has been removed.',
        type: 'info'
      });
    }
    setActiveActionId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <UserPlus className="text-blue-600" size={32} />
              Sales Commission Agents
          </h2>
          <p className="text-slate-500 mt-1">Manage agents and their sales commission rates.</p>
        </div>
        <button 
          onClick={handleAddClick}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Agent
        </button>
      </div>

      {/* Analytics Dashboard Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
              { label: 'Total Agents', value: agents.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Agents', value: agents.length, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Avg Commission', value: '4.25%', icon: Percent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Total Paid', value: '1,240 OMR', icon: DollarSign, color: 'text-slate-900', bg: 'bg-slate-100' },
          ].map((stat, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                      <stat.icon size={20} />
                  </div>
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-lg font-black text-slate-900">{stat.value}</p>
                  </div>
              </div>
          ))}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col xl:flex-row justify-between gap-6 items-center">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, email or contact..." 
              className="w-full pl-11 pr-4 py-3 rounded-xl border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm">
              <FileText size={14} className="text-blue-500" /> CSV
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm">
              <FileSpreadsheet size={14} className="text-emerald-500" /> Excel
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm">
              <Printer size={14} className="text-slate-500" /> Print
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm">
              <FileDown size={14} className="text-rose-500" /> PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 whitespace-nowrap">
                <th className="px-6 py-4 w-20">Action</th>
                <th className="px-6 py-4">Agent Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-center">Commission %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 relative">
                      <button 
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({ top: rect.bottom + 8, left: rect.left });
                          setActiveActionId(activeActionId === agent.id ? null : agent.id);
                        }}
                        className={`p-2 rounded-lg transition-all ${activeActionId === agent.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeActionId === agent.id && createPortal(
                        <div 
                          ref={dropdownRef}
                          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-200 origin-top-left"
                          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Eye size={14} className="text-blue-500" /> View Details</button>
                          <button onClick={() => handleEditAgent(agent)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Edit size={14} className="text-amber-500" /> Edit Agent</button>
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button onClick={() => handleDeleteAgent(agent.id)} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3"><Trash2 size={14} /> Delete Agent</button>
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {agent.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900">{agent.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail size={12} className="text-slate-300" />
                        {agent.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone size={12} className="text-slate-300" />
                        {agent.contactNo}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin size={12} className="text-slate-300" />
                        <span className="truncate max-w-[200px]">{agent.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black border border-blue-100">
                        <Percent size={10} /> {agent.commissionPercentage}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Showing {filteredAgents.length} Entries</span>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>Prev</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20">1</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <UserPlus size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Add Sales Commission Agent</h3>
                        <p className="text-slate-500 text-sm">Create a new agent profile and set commission rates.</p>
                    </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                    <X size={24} />
                </button>
            </div>
            
            <form onSubmit={handleSaveAgent} className="flex flex-col overflow-hidden">
              <div className="p-10 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* Basic Information */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <User size={14} className="text-blue-500" /> Identity Information
                    </h4>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Prefix</label>
                        <input 
                          type="text" 
                          name="prefix"
                          value={formData.prefix}
                          onChange={handleInputChange}
                          placeholder="Mr / M"
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800" 
                        />
                      </div>
                      <div className="col-span-2 group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">First Name *</label>
                        <input 
                          type="text" 
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          placeholder="First Name"
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800" 
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Last Name</label>
                      <input 
                        type="text" 
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Last Name"
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800" 
                      />
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email" 
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="agent@example.com"
                          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact & Commission */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Phone size={14} className="text-blue-500" /> Contact Details
                    </h4>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Contact Number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="tel" 
                          name="contactNo"
                          value={formData.contactNo}
                          onChange={handleInputChange}
                          placeholder="+968 0000 0000"
                          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800" 
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Address</label>
                      <textarea 
                        rows={3}
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Full Address"
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 resize-none"
                      ></textarea>
                    </div>

                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 pt-4">
                      <Percent size={14} className="text-emerald-500" /> Commission Settings
                    </h4>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Sales Commission Percentage (%)</label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max="100"
                          name="commissionPercentage"
                          value={formData.commissionPercentage}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 transition-all text-sm font-bold text-slate-800" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center gap-2"
                >
                  <Check size={18} /> {editingId ? 'Update Agent' : 'Save Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesCommissionAgents;
