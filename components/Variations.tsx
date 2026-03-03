import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, X, ChevronDown, 
  ArrowUpDown, Settings, Layers
} from 'lucide-react';

interface Variation {
  id: number;
  name: string;
  values: string[];
}

const Variations: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Mock Data
  const [variations, setVariations] = useState<Variation[]>([
    { id: 1, name: 'Color', values: ['Red', 'Blue', 'Green', 'Black', 'White'] },
    { id: 2, name: 'Size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
    { id: 3, name: 'Storage', values: ['64GB', '128GB', '256GB', '512GB'] },
    { id: 4, name: 'Material', values: ['Cotton', 'Polyester', 'Leather'] }
  ]);

  const [newVariationName, setNewVariationName] = useState('');
  const [newVariationValues, setNewVariationValues] = useState<string[]>(['']);

  const handleAddValue = () => {
    setNewVariationValues([...newVariationValues, '']);
  };

  const handleValueChange = (index: number, val: string) => {
    const updated = [...newVariationValues];
    updated[index] = val;
    setNewVariationValues(updated);
  };

  const handleRemoveValue = (index: number) => {
    const updated = newVariationValues.filter((_, i) => i !== index);
    setNewVariationValues(updated);
  };

  const handleSave = () => {
    if (!newVariationName) return;
    const values = newVariationValues.filter(v => v.trim() !== '');
    if (values.length === 0) return;

    const newVar: Variation = {
      id: Date.now(),
      name: newVariationName,
      values: values
    };
    
    setVariations([...variations, newVar]);
    setNewVariationName('');
    setNewVariationValues(['']);
    setIsAddModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if(confirm('Are you sure you want to delete this variation?')) {
        setVariations(variations.filter(v => v.id !== id));
    }
  }

  const filteredVariations = variations.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.values.some(val => val.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Variations</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Manage product variations like Size, Color, etc.
          </p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Variation
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-rose-500"></div>
        
        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
           <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
              {/* Show Entries */}
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

              {/* Export Buttons */}
              <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
                 {[
                    { icon: FileText, label: 'CSV' },
                    { icon: FileSpreadsheet, label: 'Excel' },
                    { icon: Printer, label: 'Print' },
                    { icon: Columns, label: 'Column visibility' },
                    { icon: Download, label: 'PDF' },
                 ].map((action, i) => (
                      <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                          <action.icon size={14} /> {action.label}
                      </button>
                 ))}
              </div>

              {/* Search */}
              <div className="relative w-full xl:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/4">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Variations <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4">
                    <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700">
                        Values <ArrowUpDown size={14} />
                    </div>
                </th>
                <th className="px-6 py-4 text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVariations.length > 0 ? (
                  filteredVariations.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 align-top">
                          <span className="font-bold text-slate-900 text-base">{v.name}</span>
                      </td>
                      <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                              {v.values.map((val, idx) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                                      {val}
                                  </span>
                              ))}
                          </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                  <Edit size={16} />
                              </button>
                              <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                  <Trash2 size={16} />
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
            <div>Showing {filteredVariations.length > 0 ? 1 : 0} to {filteredVariations.length} of {filteredVariations.length} entries</div>
            <div className="flex gap-2">
                 <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
                <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
            </div>
        </div>

      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
               {/* Modal Header */}
               <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Add Variation
                        </h3>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="space-y-6">
                         <div className="group">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Variation Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm" 
                                placeholder="e.g. Size"
                                value={newVariationName}
                                onChange={(e) => setNewVariationName(e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Values</label>
                                <button onClick={handleAddValue} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                                    <Plus size={12} /> Add Value
                                </button>
                            </div>
                            <div className="space-y-3">
                                {newVariationValues.map((val, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium shadow-sm" 
                                            placeholder={`Value ${idx + 1}`}
                                            value={val}
                                            onChange={(e) => handleValueChange(idx, e.target.value)}
                                        />
                                        {newVariationValues.length > 1 && (
                                            <button onClick={() => handleRemoveValue(idx)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm">
                        Save
                    </button>
                </div>

           </div>
        </div>
      )}
    </div>
  );
};

export default Variations;