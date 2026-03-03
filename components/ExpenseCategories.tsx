import React, { useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, Edit, Trash2, X, Tag
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';

const ExpenseCategories: React.FC = () => {
  const { expenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory, generateId } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', code: '', description: '' });

  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: '', code: '', description: '' });
    setIsAddModalOpen(true);
  };

  const openEdit = (id: string) => {
    const cat = expenseCategories.find(c => c.id === id);
    if (!cat) return;
    setEditingId(id);
    setFormData({ name: cat.name, code: cat.code || '', description: cat.description || '' });
    setIsAddModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      addNotification({ title: 'Validation Error', message: 'Category name is required.', type: 'error' });
      return;
    }

    if (editingId) {
      updateExpenseCategory({ id: editingId, name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim() });
      addNotification({ title: 'Category Updated', message: `"${formData.name}" has been updated.`, type: 'success' });
    } else {
      addExpenseCategory({ id: generateId('ECAT'), name: formData.name.trim(), code: formData.code.trim(), description: formData.description.trim() });
      addNotification({ title: 'Category Added', message: `"${formData.name}" has been added.`, type: 'success' });
    }

    setFormData({ name: '', code: '', description: '' });
    setEditingId(null);
    setIsAddModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const cat = expenseCategories.find(c => c.id === id);
    deleteExpenseCategory(id);
    setConfirmDeleteId(null);
    addNotification({ title: 'Category Deleted', message: `"${cat?.name}" has been deleted.`, type: 'success' });
  };

  const filteredCategories = expenseCategories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Expense Categories</h2>
          <p className="text-slate-500 text-sm mt-1">Manage categories used when recording expenses.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-1"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">

        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-base font-medium text-slate-700 flex items-center gap-2">
              <Tag size={16} className="text-blue-500" />
              All Expense Categories ({filteredCategories.length})
            </h3>
        </div>

        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2">
               <span className="text-sm text-slate-600">Show</span>
               <select className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none">
                   <option>25</option>
                   <option>50</option>
                   <option>100</option>
               </select>
               <span className="text-sm text-slate-600">entries</span>
           </div>

           <div className="flex gap-1 flex-wrap">
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12}/> Export CSV</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={12}/> Export Excel</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm" onClick={() => window.print()}><Printer size={12}/> Print</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={12}/> Columns</button>
           </div>

           <div className="flex items-center gap-2">
               <Search size={14} className="text-slate-400" />
               <input
                   type="text"
                   placeholder="Search categories..."
                   className="px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-1/2">Category Name</th>
                <th className="px-4 py-3 w-1/4">Category Code</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.length > 0 ? (
                  filteredCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.code || '--'}</td>
                      <td className="px-4 py-3">
                          <div className="flex gap-2">
                              <button
                                onClick={() => openEdit(c.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-500 text-blue-600 rounded text-xs font-bold hover:bg-blue-50 transition-colors"
                              >
                                  <Edit size={12} /> Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(c.id)}
                                className="flex items-center gap-1 px-2 py-1 bg-white border border-red-500 text-red-600 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                              >
                                  <Trash2 size={12} /> Delete
                              </button>
                          </div>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-slate-400 italic">
                          {searchTerm ? 'No categories match your search.' : 'No expense categories yet. Click "Add Category" to create one.'}
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500">
            <div>Showing 1 to {filteredCategories.length} of {expenseCategories.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                 <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col">
               <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingId ? 'Edit Expense Category' : 'Add Expense Category'}
                    </h3>
                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Category Name: <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            placeholder="e.g. Petrol, Salary, Utilities"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            autoFocus
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Category Code:</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                            placeholder="e.g. PTR, SAL"
                            value={formData.code}
                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
                    <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-bold hover:bg-white text-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm">
                        {editingId ? 'Update' : 'Save'}
                    </button>
                </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Delete Category?</h3>
            <p className="text-slate-500 text-sm mb-6">
              Are you sure you want to delete "<strong>{expenseCategories.find(c => c.id === confirmDeleteId)?.name}</strong>"?
              Existing expenses using this category will not be affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseCategories;
