import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit, Trash2, 
  User, Mail, Phone, MapPin, 
  Shield, Lock, Eye, EyeOff, 
  CheckCircle2, X, MoreVertical,
  Briefcase, Building2, Users as UsersIcon,
  Filter, FileSpreadsheet, Printer
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';

interface UserData {
  id: number;
  prefix: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  locations: string[];
}

const initialUsers: UserData[] = [
  {
    id: 1,
    prefix: 'Mr',
    firstName: 'Admin',
    lastName: 'User',
    username: 'admin',
    email: 'admin@example.com',
    role: 'Admin',
    status: 'Active',
    locations: ['Main Branch', 'Downtown Store']
  },
  {
    id: 2,
    prefix: 'Ms',
    firstName: 'Sarah',
    lastName: 'Sales',
    username: 'sarah.sales',
    email: 'sarah@example.com',
    role: 'Sales Man',
    status: 'Active',
    locations: ['Main Branch']
  }
];

const Users: React.FC = () => {
  const { addNotification } = useNotifications();
  const [users, setUsers] = useState<UserData[]>(() => {
    const saved = localStorage.getItem('app_users');
    return saved ? JSON.parse(saved) : initialUsers;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    id: null as number | null,
    prefix: '',
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: '',
    locations: [] as string[],
    status: 'Active' as 'Active' | 'Inactive'
  });

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      addNotification({
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
        type: 'error'
      });
      return;
    }

    if (formData.id) {
      setUsers(users.map(u => u.id === formData.id ? {
        ...u,
        prefix: formData.prefix,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: formData.username,
        role: formData.role,
        locations: formData.locations,
        status: formData.status
      } : u));
      addNotification({ title: 'User Updated', message: 'User details updated successfully.', type: 'success' });
    } else {
      const newUser: UserData = {
        id: Date.now(),
        prefix: formData.prefix,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        locations: formData.locations
      };
      setUsers([...users, newUser]);
      addNotification({ title: 'User Added', message: 'New user created successfully.', type: 'success' });
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleDeleteUser = (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== id));
      addNotification({ title: 'User Deleted', message: 'User removed successfully.', type: 'info' });
    }
    setActiveActionId(null);
  };

  const handleEditUser = (user: UserData) => {
    setFormData({
      id: user.id,
      prefix: user.prefix,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      password: '',
      confirmPassword: '',
      role: user.role,
      locations: user.locations,
      status: user.status
    });
    setIsModalOpen(true);
    setActiveActionId(null);
  };

  const resetForm = () => {
    setFormData({
      id: null,
      prefix: '',
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: '',
      locations: [],
      status: 'Active'
    });
  };

  const filteredUsers = users.filter(user => 
    user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UsersIcon className="text-indigo-600" size={32} />
            User Management
          </h2>
          <p className="text-slate-500 mt-1">Manage system users, roles, and access permissions.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add New User
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between gap-4 items-center">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full pl-11 pr-4 py-3 rounded-xl border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <Filter size={14} /> Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <FileSpreadsheet size={14} className="text-emerald-600" /> Export
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-20">Action</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Locations</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 relative">
                      <button 
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setDropdownPosition({ top: rect.bottom + 8, left: rect.left });
                          setActiveActionId(activeActionId === user.id ? null : user.id);
                        }}
                        className={`p-2 rounded-lg transition-all ${activeActionId === user.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeActionId === user.id && createPortal(
                        <div 
                          ref={dropdownRef}
                          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-200 origin-top-left"
                          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                          >
                            <Edit size={14} className="text-amber-500" /> Edit
                          </button>
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm border border-indigo-100">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{user.prefix} {user.firstName} {user.lastName}</p>
                          <p className="text-xs text-slate-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                        <Shield size={12} /> {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.locations.map((loc, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-500 font-medium">
                            {loc}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        user.status === 'Active' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/30">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <User size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formData.id ? 'Edit User' : 'Add New User'}
                  </h3>
                  <p className="text-slate-500 text-sm">Fill in the details to create a new system user.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="flex flex-col overflow-hidden">
              <div className="p-10 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* Personal Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <User size={14} className="text-indigo-500" /> Personal Information
                    </h4>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-1 group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Prefix</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="Mr"
                          value={formData.prefix}
                          onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                        />
                      </div>
                      <div className="col-span-3 group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">First Name *</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                          placeholder="John"
                          value={formData.firstName}
                          onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Last Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                        placeholder="Doe"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Email Address *</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email" 
                          required
                          className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-800"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <Lock size={14} className="text-indigo-500" /> Account Security
                    </h4>

                    <div className="group">
                      <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Username *</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                        placeholder="johndoe"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-800"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Confirm Password</label>
                        <input 
                          type="password" 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-800"
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Role *</label>
                        <select 
                          required
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                          value={formData.role}
                          onChange={(e) => setFormData({...formData, role: e.target.value})}
                        >
                          <option value="">Select Role</option>
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Sales Man">Sales Man</option>
                          <option value="Cashier">Cashier</option>
                        </select>
                      </div>
                      <div className="group">
                        <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Status</label>
                        <select 
                          className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
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
                  className="px-12 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20 active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 size={18} /> {formData.id ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
