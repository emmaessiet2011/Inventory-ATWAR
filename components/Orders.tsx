import React from 'react';
import { Eye, CheckCircle, Truck, Clock, Filter } from 'lucide-react';

const Orders: React.FC = () => {
  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900">Orders Management</h2>
        <div className="flex gap-2">
            <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2">
                <Clock size={16} /> Pending
            </button>
            <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2">
                <CheckCircle size={16} /> Approved
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                    <th className="px-6 py-4">Order Ref</th>
                    <th className="px-6 py-4">Sales Representative</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Grand Total</th>
                    <th className="px-6 py-4">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4].map(i => (
                    <tr key={i} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-mono font-medium text-slate-700">ORD-{202300 + i}</td>
                        <td className="px-6 py-4">Alex Johnson</td>
                        <td className="px-6 py-4">BuildIt Construction</td>
                        <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                i === 1 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {i === 1 ? 'Needs Approval' : 'Processing'}
                            </span>
                        </td>
                        <td className="px-6 py-4 font-bold">$1,240.00</td>
                        <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="View Details">
                                    <Eye size={18} />
                                </button>
                                {i === 1 && (
                                    <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition">
                                        Approve
                                    </button>
                                )}
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default Orders;