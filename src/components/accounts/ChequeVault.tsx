import React, { useState, useMemo } from 'react';
import { Plus, Search, Calendar, Landmark, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useGlobalContext } from '../../context/GlobalContext';

const ChequeVault = () => {
  const { chequeReminders, addChequeReminder, updateChequeReminder, generateId } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'CLEARED' | 'BOUNCED'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    contactName: '',
    chequeNo: '',
    bankName: '',
    chequeDate: new Date().toISOString().split('T')[0],
    amount: 0,
    notes: '',
  });

  const filteredCheques = useMemo(() => {
    return chequeReminders.filter((cheque) => {
      const matchesSearch = 
        cheque.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cheque.chequeNo && cheque.chequeNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (cheque.bankName && cheque.bankName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'ALL' || cheque.status === statusFilter;
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(a.chequeDate).getTime() - new Date(b.chequeDate).getTime());
  }, [chequeReminders, searchTerm, statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addChequeReminder({
      id: generateId('CHQ-'),
      contactName: formData.contactName,
      chequeNo: formData.chequeNo,
      bankName: formData.bankName,
      chequeDate: new Date(formData.chequeDate).toISOString(),
      amount: formData.amount,
      status: 'PENDING',
      notes: formData.notes,
    });
    
    if (result.ok) {
      setIsModalOpen(false);
      setFormData({
        contactName: '',
        chequeNo: '',
        bankName: '',
        chequeDate: new Date().toISOString().split('T')[0],
        amount: 0,
        notes: '',
      });
    } else {
      console.error(`Failed to save cheque: ${result.error || 'Unknown error'}`);
    }
  };

  const updateStatus = async (cheque: any, status: 'CLEARED' | 'BOUNCED') => {
    if (confirm(`Are you sure you want to mark this cheque as ${status}?`)) {
      await updateChequeReminder({ ...cheque, status });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Pending</span>;
      case 'CLEARED':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cleared</span>;
      case 'BOUNCED':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Bounced</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheque Vault</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track post-dated cheques</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Cheque
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by contact, cheque no, or bank..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['ALL', 'PENDING', 'CLEARED', 'BOUNCED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === status
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Cheque Details</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCheques.map((cheque) => (
                <tr key={cheque.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cheque.contactName}</div>
                    {cheque.notes && <div className="text-sm text-gray-500">{cheque.notes}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cheque.bankName || 'Unknown Bank'}</div>
                        <div className="text-sm text-gray-500">#{cheque.chequeNo || 'No Number'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(cheque.chequeDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {cheque.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(cheque.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {cheque.status === 'PENDING' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => updateStatus(cheque, 'CLEARED')}
                          className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition-colors"
                          title="Mark as Cleared"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => updateStatus(cheque, 'BOUNCED')}
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="Mark as Bounced"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCheques.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium text-gray-900">No cheques found</p>
                    <p>Try adjusting your search or filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Add Cheque Reminder</h2>
              <p className="text-sm text-gray-500 mt-1">Record a post-dated cheque</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                  <input
                    type="text"
                    value={formData.chequeNo}
                    onChange={(e) => setFormData({ ...formData, chequeNo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.chequeDate}
                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-indigo-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700"
                >
                  Save Cheque
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChequeVault;
