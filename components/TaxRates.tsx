import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, X, ChevronDown, 
  ArrowUpDown, Info
} from 'lucide-react';

interface TaxRate {
  id: number;
  name: string;
  rate: number;
}

interface TaxGroup {
  id: number;
  name: string;
  rate: number;
  subTaxes: TaxRate[];
}

const TaxRates: React.FC = () => {
  const [rateSearch, setRateSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  
  // Initial Data
  const [rates, setRates] = useState<TaxRate[]>([
    { id: 1, name: 'VAT', rate: 5.000 }
  ]);
  
  const [groups, setGroups] = useState<TaxGroup[]>([]);

  // Modal States
  const [isAddRateOpen, setIsAddRateOpen] = useState(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);

  // Form States
  const [newRateName, setNewRateName] = useState('');
  const [newRateValue, setNewRateValue] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [selectedSubTaxes, setSelectedSubTaxes] = useState<number[]>([]);

  // Handlers
  const handleAddRate = () => {
    if (newRateName && newRateValue) {
      setRates([...rates, { 
        id: Date.now(), 
        name: newRateName, 
        rate: parseFloat(newRateValue) 
      }]);
      setNewRateName('');
      setNewRateValue('');
      setIsAddRateOpen(false);
    }
  };

  const handleAddGroup = () => {
    if (newGroupName && selectedSubTaxes.length > 0) {
      const selectedRates = rates.filter(r => selectedSubTaxes.includes(r.id));
      const totalRate = selectedRates.reduce((sum, r) => sum + r.rate, 0);
      
      setGroups([...groups, {
        id: Date.now(),
        name: newGroupName,
        rate: totalRate,
        subTaxes: selectedRates
      }]);
      
      setNewGroupName('');
      setSelectedSubTaxes([]);
      setIsAddGroupOpen(false);
    }
  };

  const handleDeleteRate = (id: number) => {
      if(confirm('Are you sure you want to delete this tax rate?')) {
          setRates(rates.filter(r => r.id !== id));
      }
  };

  const handleDeleteGroup = (id: number) => {
      if(confirm('Are you sure you want to delete this tax group?')) {
          setGroups(groups.filter(g => g.id !== id));
      }
  };

  const toggleSubTaxSelection = (id: number) => {
      if (selectedSubTaxes.includes(id)) {
          setSelectedSubTaxes(selectedSubTaxes.filter(tid => tid !== id));
      } else {
          setSelectedSubTaxes([...selectedSubTaxes, id]);
      }
  };

  const filteredRates = rates.filter(r => r.name.toLowerCase().includes(rateSearch.toLowerCase()));
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tax Rates</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage your tax rates
          </p>
        </div>
      </div>

      {/* SECTION 1: Single Tax Rates */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
        
        {/* Section Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">All your tax rates</h3>
        </div>

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-white">
           <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
              <div className="flex items-center gap-3 w-full xl:w-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                  <div className="relative">
                      <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none">
                          <option>25</option>
                          <option>50</option>
                          <option>100</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
              </div>

              <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                 {[
                    { icon: FileText, label: 'Export CSV' },
                    { icon: FileSpreadsheet, label: 'Export Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Columns, label: 'Column visibility' },
                    { icon: Download, label: 'Export PDF' },
                 ].map((action, i) => (
                      <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                          <action.icon size={14} /> {action.label}
                      </button>
                 ))}
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
                          value={rateSearch}
                          onChange={(e) => setRateSearch(e.target.value)}
                      />
                  </div>
                  <button 
                    onClick={() => setIsAddRateOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
                    >
                    <Plus size={16} /> Add
                  </button>
              </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/2">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Name <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 w-1/4">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Tax Rate % <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRates.length > 0 ? (
                  filteredRates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                      </td>
                      <td className="px-6 py-4">
                           <span className="font-medium text-slate-600">{r.rate.toFixed(3)}</span>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">
                                  <Edit size={12} /> Edit
                              </button>
                              <button onClick={() => handleDeleteRate(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>Showing {filteredRates.length > 0 ? 1 : 0} to {filteredRates.length} of {filteredRates.length} entries</div>
            <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                 <button className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-900/10">1</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
            </div>
        </div>
      </div>

      {/* SECTION 2: Tax Groups */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500"></div>
        
        {/* Section Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Tax groups ( Combination of multiple taxes )</h3>
            <Info size={14} className="text-blue-500 cursor-help" />
        </div>

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-white">
           <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
              <div className="flex items-center gap-3 w-full xl:w-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                  <div className="relative">
                      <select className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer appearance-none">
                          <option>25</option>
                          <option>50</option>
                          <option>100</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
              </div>

              <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                 {[
                    { icon: FileText, label: 'Export CSV' },
                    { icon: FileSpreadsheet, label: 'Export Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Columns, label: 'Column visibility' },
                    { icon: Download, label: 'Export PDF' },
                 ].map((action, i) => (
                      <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                          <action.icon size={14} /> {action.label}
                      </button>
                 ))}
              </div>

              <div className="flex items-center gap-2 w-full xl:w-auto">
                  <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                          type="text" 
                          placeholder="Search..." 
                          className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                      />
                  </div>
                  <button 
                    onClick={() => setIsAddGroupOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
                    >
                    <Plus size={16} /> Add
                  </button>
              </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/3">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Name <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 w-1/6">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Tax Rate % <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 w-1/3">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Sub taxes <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGroups.length > 0 ? (
                  filteredGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                          <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                      </td>
                      <td className="px-6 py-4">
                           <span className="font-medium text-slate-600">{g.rate.toFixed(3)}</span>
                      </td>
                      <td className="px-6 py-4">
                           <div className="flex flex-wrap gap-1">
                               {g.subTaxes.map(sub => (
                                   <span key={sub.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">
                                       {sub.name}
                                   </span>
                               ))}
                           </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">
                                  <Edit size={12} /> Edit
                              </button>
                              <button onClick={() => handleDeleteGroup(g.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                                  <Trash2 size={14} />
                              </button>
                          </div>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
            <div>Showing {filteredGroups.length > 0 ? 1 : 0} to {filteredGroups.length} of {filteredGroups.length} entries</div>
            <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
            </div>
        </div>
      </div>

      {/* Add Rate Modal */}
      {isAddRateOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
               <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Add Tax Rate</h3>
                    <button onClick={() => setIsAddRateOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                     <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                            placeholder="e.g. VAT"
                            value={newRateName}
                            onChange={(e) => setNewRateName(e.target.value)}
                        />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tax Rate % <span className="text-red-500">*</span></label>
                        <input 
                            type="number" 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                            placeholder="5.000"
                            value={newRateValue}
                            onChange={(e) => setNewRateValue(e.target.value)}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button onClick={() => setIsAddRateOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Close
                    </button>
                    <button onClick={handleAddRate} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm">
                        Save
                    </button>
                </div>
           </div>
        </div>
      )}

      {/* Add Group Modal */}
      {isAddGroupOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
               <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Add Tax Group</h3>
                    <button onClick={() => setIsAddGroupOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                     <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                            placeholder="e.g. VAT + Service"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                        />
                    </div>
                    
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Sub Taxes</label>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 custom-scrollbar">
                            {rates.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-2">No individual rates available.</p>
                            ) : (
                                rates.map(rate => (
                                    <label key={rate.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                            checked={selectedSubTaxes.includes(rate.id)}
                                            onChange={() => toggleSubTaxSelection(rate.id)}
                                        />
                                        <span className="text-sm font-medium text-slate-700">{rate.name} ({rate.rate}%)</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button onClick={() => setIsAddGroupOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Close
                    </button>
                    <button onClick={handleAddGroup} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm">
                        Save
                    </button>
                </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default TaxRates;
