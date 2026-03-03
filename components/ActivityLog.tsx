import React, { useState } from 'react';
import { 
  History, Search, Filter, Download, Printer, 
  User, Clock, FileText, ChevronDown, Calendar
} from 'lucide-react';

interface Activity {
  id: number;
  user: string;
  action: string;
  module: string;
  description: string;
  date: string;
  ipAddress: string;
}

const ActivityLog: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activities] = useState<Activity[]>([
    {
      id: 1,
      user: 'Admin User',
      action: 'Created',
      module: 'Products',
      description: 'Added new product: iPhone 15 Pro',
      date: '2026-02-23 14:20:15',
      ipAddress: '192.168.1.10'
    },
    {
      id: 2,
      user: 'Sales Manager',
      action: 'Updated',
      module: 'Sales',
      description: 'Updated status of Invoice #INV-2026-001 to Paid',
      date: '2026-02-23 13:45:22',
      ipAddress: '192.168.1.15'
    },
    {
      id: 3,
      user: 'Inventory Clerk',
      action: 'Adjusted',
      module: 'Stock',
      description: 'Stock adjustment for "Samsung S24" (+10 units)',
      date: '2026-02-23 11:30:05',
      ipAddress: '192.168.1.22'
    },
    {
      id: 4,
      user: 'Admin User',
      action: 'Deleted',
      module: 'Expenses',
      description: 'Deleted expense record #EXP-452',
      date: '2026-02-23 10:15:40',
      ipAddress: '192.168.1.10'
    },
    {
      id: 5,
      user: 'Sales Rep',
      action: 'Login',
      module: 'Auth',
      description: 'User logged into the system',
      date: '2026-02-23 09:00:12',
      ipAddress: '192.168.1.45'
    }
  ]);

  const filteredActivities = activities.filter(a => 
    a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <History className="text-slate-600" size={32} />
            Activity Log
          </h2>
          <p className="text-slate-500 mt-1">Track all system activities and user actions.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
            <Printer size={16} /> Print
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-700"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search activity..." 
                  className="w-full pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-500 focus:outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm flex items-center gap-2 px-3">
                  <Calendar size={16} />
                  <span className="text-xs font-bold">Today</span>
                  <ChevronDown size={14} />
                </button>
                <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-sm">
                  <Filter size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Module</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                      <Clock size={12} />
                      {activity.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                        <User size={14} />
                      </div>
                      <span className="font-bold text-slate-900">{activity.user}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activity.action === 'Created' ? 'bg-emerald-100 text-emerald-700' :
                      activity.action === 'Updated' ? 'bg-blue-100 text-blue-700' :
                      activity.action === 'Deleted' ? 'bg-rose-100 text-rose-700' :
                      activity.action === 'Login' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {activity.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <FileText size={14} className="text-slate-400" />
                      {activity.module}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={activity.description}>
                    {activity.description}
                  </td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                    {activity.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center">
          <p className="text-xs text-slate-500 font-medium">Showing {filteredActivities.length} activities</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed">Previous</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 hover:bg-slate-50 transition shadow-sm">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
