import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, User, Users, Mail, ShieldCheck, 
  ChevronDown, Edit, Trash2, MoreVertical, 
  Filter, CheckCircle2, Ban, X, Key,
  UserPlus, ShieldAlert, BadgeCheck, Zap,
  Eye, Percent
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { ConfirmationModal, ChangePasswordModal } from './UserModals';
import { useNotifications } from '../src/context/NotificationContext';
import { useGlobalContext, AppUser } from '../src/context/GlobalContext';
import { Trash2 as TrashIcon } from 'lucide-react';

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

interface UserManagementProps {
    onNavigate: (page: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const { users: globalUsers, updateUser, deleteUser } = useGlobalContext();
  const [users, setUsers] = useState<AppUser[]>(globalUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-left' });
  const [availableRoles, setAvailableRoles] = useState<string[]>(['Admin', 'CEO', 'Manager', 'Sale Agent', 'Sales Man', 'Order', 'Field Payment', 'Cashier']);
  
  // Modal States
  const [modalState, setModalState] = useState<{
    type: 'password' | 'delete' | 'status' | null;
    user: AppUser | null;
  }>({ type: null, user: null });
  
  const [filters, setFilters] = useState({
      role: [] as string[],
      status: [] as string[]
  });

  useEffect(() => {
    setUsers(globalUsers);
  }, [globalUsers]);

  useEffect(() => {
    const savedRoles = localStorage.getItem('app_roles');
    if (savedRoles) {
      try {
        const parsed = JSON.parse(savedRoles);
        setAvailableRoles(parsed.map((r: any) => r.name));
      } catch (e) {
        console.error("Failed to load roles", e);
      }
    }
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'CEO': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Manager': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Sale Agent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Sales Man': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Order': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Field Payment': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Cashier': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Admin': return 'bg-slate-900 text-white border-slate-900';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const handleToggleStatus = (user: AppUser) => {
    const updatedUser = { ...user, status: user.status === 'Active' ? 'Inactive' : 'Active' } as AppUser;
    updateUser(updatedUser);
    addNotification({
        title: user.status === 'Active' ? 'User Deactivated' : 'User Activated',
        message: `The user ${user.name} has been successfully ${user.status === 'Active' ? 'deactivated' : 'activated'}.`,
        type: 'success'
    });
    setModalState({ type: null, user: null });
  };

  const handleDelete = (user: AppUser) => {
    deleteUser(user.id);
    addNotification({
        title: 'User Deleted',
        message: `The user ${user.name} has been permanently removed from the system.`,
        type: 'success'
    });
    setModalState({ type: null, user: null });
  };

  const handleChangePassword = (user: AppUser, newPassword: string) => {
    // In a real app, you'd call an API here
    addNotification({
        title: 'Password Changed',
        message: `The password for ${user.name} has been successfully updated.`,
        type: 'success'
    });
    setModalState({ type: null, user: null });
  };

  const handleEdit = (user: AppUser) => {
      onNavigate(`edit-user/${user.id}`);
      setActiveActionId(null);
  };

  const handleView = (id: string) => {
      onNavigate(`view-user/${id}`);
      setActiveActionId(null);
  };

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.role.length === 0 || filters.role.includes(u.role)) &&
    (filters.status.length === 0 || filters.status.includes(u.status))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-blue-600" size={32} />
              User Management
          </h2>
          <p className="text-slate-500 mt-1">Manage system access, roles, and user profiles.</p>
        </div>
        <button 
          onClick={() => onNavigate('add-user')}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {/* Analytics Dashboard Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
              { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Sessions', value: users.filter(u => u.status === 'Active').length, icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Managers', value: users.filter(u => u.role === 'Manager').length, icon: ShieldAlert, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'System Admins', value: users.filter(u => u.role === 'Admin').length, icon: BadgeCheck, color: 'text-slate-900', bg: 'bg-slate-100' },
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
                      placeholder="Search by name, email or ID..." 
                      className="w-full pl-11 pr-4 py-3 rounded-xl border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
               </div>

               <div className="flex gap-4 w-full md:w-auto">
                    <MultiSelect 
                        label="Role"
                        options={availableRoles}
                        selected={filters.role}
                        onChange={(val) => setFilters({...filters, role: val})}
                    />
                    <MultiSelect 
                        label="Status"
                        options={['Active', 'Inactive']}
                        selected={filters.status}
                        onChange={(val) => setFilters({...filters, status: val})}
                    />
               </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 whitespace-nowrap">
                          <th className="px-6 py-4 w-20">Action</th>
                          <th className="px-6 py-4">Full Name</th>
                          <th className="px-6 py-4">Username</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4 text-center">Commission</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Last Login</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredUsers.length > 0 ? (
                          filteredUsers.map(user => (
                              <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                  <td className="px-6 py-4 relative">
                                      <button 
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setDropdownPosition({ top: rect.bottom + 8, left: rect.left, transformOrigin: 'origin-top-left' });
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
                                              <button onClick={() => handleView(user.id)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Eye size={14} className="text-blue-500" /> View Profile</button>
                                              <button onClick={() => handleEdit(user)} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"><Edit size={14} className="text-amber-500" /> Edit User</button>
                                              <button 
                                                onClick={() => {
                                                    setModalState({ type: 'password', user });
                                                    setActiveActionId(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                              >
                                                <Key size={14} className="text-blue-500" /> Change Password
                                              </button>
                                              <button 
                                                onClick={() => {
                                                    setModalState({ type: 'status', user });
                                                    setActiveActionId(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                                              >
                                                  {user.status === 'Active' ? <Ban size={14} className="text-rose-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                                  {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                                              </button>
                                              <div className="h-px bg-slate-100 my-1"></div>
                                              <button 
                                                onClick={() => {
                                                    setModalState({ type: 'delete', user });
                                                    setActiveActionId(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3"
                                              >
                                                <Trash2 size={14} /> Delete Account
                                              </button>
                                          </div>,
                                          document.body
                                      )}
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                                              {user.name.charAt(0)}
                                          </div>
                                          <span className="font-bold text-slate-900">{user.name}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{user.username}</td>
                                  <td className="px-6 py-4">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleColor(user.role)}`}>
                                          {user.role}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-2 text-slate-600">
                                          <Mail size={12} className="text-slate-300" />
                                          {user.email}
                                      </div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      {user.commissionPercent ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black border border-blue-100">
                                              <Percent size={10} /> {user.commissionPercent}%
                                          </span>
                                      ) : <span className="text-slate-300">-</span>}
                                  </td>
                                  <td className="px-6 py-4">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                          user.status === 'Active' 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                          : 'bg-slate-100 text-slate-500 border-slate-200'
                                      }`}>
                                          <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                          {user.status}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                      {user.lastLogin}
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">No users matching your search.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>

          {/* Footer / Pagination */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/30">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Showing {filteredUsers.length} Users</span>
              <div className="flex gap-2">
                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>Prev</button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20">1</button>
                  <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
              </div>
          </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal 
        isOpen={modalState.type === 'password'}
        onClose={() => setModalState({ type: null, user: null })}
        userName={modalState.user?.name || ''}
        onSave={(pwd) => modalState.user && handleChangePassword(modalState.user, pwd)}
      />

      <ConfirmationModal 
        isOpen={modalState.type === 'delete'}
        onClose={() => setModalState({ type: null, user: null })}
        onConfirm={() => modalState.user && handleDelete(modalState.user)}
        title="Delete Account"
        message={`Are you sure you want to delete ${modalState.user?.name}'s account? This action is permanent and cannot be undone.`}
        confirmLabel="Delete Permanently"
        confirmVariant="danger"
        icon={<TrashIcon size={32} />}
      />

      <ConfirmationModal 
        isOpen={modalState.type === 'status'}
        onClose={() => setModalState({ type: null, user: null })}
        onConfirm={() => modalState.user && handleToggleStatus(modalState.user)}
        title={modalState.user?.status === 'Active' ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${modalState.user?.status === 'Active' ? 'deactivate' : 'activate'} ${modalState.user?.name}'s account?`}
        confirmLabel={modalState.user?.status === 'Active' ? 'Deactivate' : 'Activate'}
        confirmVariant={modalState.user?.status === 'Active' ? 'warning' : 'primary'}
        icon={modalState.user?.status === 'Active' ? <Ban size={32} /> : <CheckCircle2 size={32} />}
      />
    </div>
  );
};

export default UserManagement;