import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, Plus, Search, Edit, Trash2, 
  Lock, Key, Info,
  Users, UserCog, ShieldAlert, X, Save, 
  Square, CheckSquare, Layers, 
  ShoppingCart, Package, Tags, CreditCard, 
  BarChart3, Settings as SettingsIcon,
  FileText, FileCheck, Monitor, FileEdit, Truck,
  Calculator, Bookmark, Percent, Ruler, LayoutGrid,
  Home, Landmark, DollarSign, LifeBuoy
} from 'lucide-react';
import { useGlobalContext, Role } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmationModal } from './UserModals';

interface PermissionGroup {
    module: string;
    icon: any;
    permissions: string[];
}

const PERMISSION_MODULES: PermissionGroup[] = [
    { module: 'Others', icon: Layers, permissions: ['View export to buttons (csv/excel/print/pdf) on tables'] },
    { module: 'User', icon: Users, permissions: ['View user', 'Add user', 'Edit user', 'Delete user'] },
    { module: 'Roles', icon: ShieldCheck, permissions: ['View role', 'Add Role', 'Edit Role', 'Delete role'] },
    { module: 'Supplier', icon: Users, permissions: ['View all supplier', 'View own supplier', 'Add supplier', 'Edit supplier', 'Delete supplier'] },
    { module: 'Customer', icon: Users, permissions: ['View all customer', 'View own customer', 'View customers with no sell from one month only', 'View customers with no sell from three months only', 'View customers with no sell from six months only', 'View customers with no sell from one year only', 'View customers irrespective of their sell', 'Add customer', 'Edit customer', 'Delete customer'] },
    { module: 'Product', icon: Package, permissions: ['View product', 'Add product', 'Edit product', 'Delete product', 'Add Opening Stock', 'View Purchase Price'] },
    { module: 'Purchase & Stock Adjustment', icon: ShoppingCart, permissions: ['View all Purchase & Stock Adjustment', 'View own Purchase & Stock Adjustment', 'Add purchase & Stock Adjustment', 'Edit purchase & Stock Adjustment', 'Delete purchase & Stock Adjustment', 'Add purchase payment', 'Edit purchase payment', 'Delete purchase payment', 'Update Status'] },
    { module: 'Stock Transfer', icon: Truck, permissions: ['View all stock transfers', 'View own stock transfers', 'Add stock transfer', 'Edit stock transfer', 'Delete stock transfer'] },
    { module: 'Stock Adjustment', icon: Calculator, permissions: ['View all stock adjustments', 'View own stock adjustments', 'Add stock adjustment', 'Edit stock adjustment', 'Delete stock adjustment', 'Approve stock adjustment'] },
    { module: 'Purchase Requisition', icon: FileText, permissions: ['View all purchase requisition', 'View own purchase requisition', 'Create purchase requisition', 'Delete purchase requisition'] },
    { module: 'Purchase Order', icon: FileCheck, permissions: ['View all purchase order', 'View own purchase order', 'Create purchase order', 'Edit purchase order', 'Delete purchase order'] },
    { module: 'POS', icon: Monitor, permissions: ['View POS sell', 'Add POS sell', 'Edit POS sell', 'Delete POS sell', 'Edit product price from POS screen', 'Edit product discount from POS screen', 'Add/Edit Payment', 'Print Invoice', 'Disable Multiple Pay', 'Disable Draft', 'Disable Express Checkout', 'Disable Discount', 'Disable Suspend Sale', 'Disable credit sale button', 'Disable Quotation', 'Disable Card'] },
    { module: 'Sell', icon: Tags, permissions: ['View all sell', 'View own sell only', 'View paid sells only', 'View due sells only', 'View partially paid sells only', 'View overdue sells only', 'Add Sell', 'Update Sell', 'Delete Sell', 'Commission agent can view their own sell', 'Add sell payment', 'Edit sell payment', 'Delete sell payment', 'View customer payment ledger', 'Edit product price from sales screen', 'Edit product discount from Sale screen', 'Add/Edit/Delete Discount', 'Import Sales', 'Access all sell return', 'Access own sell return', 'Add edit invoice number'] },
    { module: 'Draft', icon: FileEdit, permissions: ['View all drafts', 'View own drafts', 'Edit draft', 'Delete draft'] },
    { module: 'Quotation', icon: FileText, permissions: ['View all quotations', 'View own quotations', 'Edit quotation', 'Delete quotation'] },
    { module: 'Shipments', icon: Truck, permissions: ['Access all shipments', 'Access own shipments', 'Access pending shipments only', 'Commission agent can access their own shipments'] },
    { module: 'Cash Register', icon: Calculator, permissions: ['View cash register', 'Close cash register'] },
    { module: 'Order', icon: Truck, permissions: ['View order', 'Add order', 'Edit order', 'Delete order', 'Approve order'] },
    { module: 'Field Payment', icon: Landmark, permissions: ['View field payment', 'Add field payment', 'Edit field payment', 'Delete field payment', 'Approval field payment'] },
    { module: 'Brand', icon: Bookmark, permissions: ['View brand', 'Add brand', 'Edit brand', 'Delete brand'] },
    { module: 'Tax rate', icon: Percent, permissions: ['View tax rate', 'Add tax rate', 'Edit tax rate', 'Delete tax rate'] },
    { module: 'Unit', icon: Ruler, permissions: ['View unit', 'Add unit', 'Edit unit', 'Delete unit'] },
    { module: 'Category', icon: LayoutGrid, permissions: ['View category', 'Add category', 'Edit category', 'Delete category'] },
    { module: 'Report', icon: BarChart3, permissions: ['View purchase & sell report', 'View Tax report', 'View Supplier & Customer report', 'View customer groups report', 'View expense report', 'View profit/loss report', 'View stock report, stock adjustment report & stock expiry report', 'View trending product report', 'View register report', 'View sales representative report', 'View product stock value'] },
    { module: 'Settings', icon: SettingsIcon, permissions: ['Access business settings', 'Access barcode settings', 'Access invoice settings', 'Access printers'] },
    { module: 'Support', icon: LifeBuoy, permissions: ['Access help center'] },
    { module: 'Expense', icon: CreditCard, permissions: ['Access all expenses', 'View own expense only', 'Add Expense', 'Edit Expense', 'Delete Expense'] },
    { module: 'Home', icon: Home, permissions: ['View Home data'] },
    { module: 'Account', icon: Landmark, permissions: ['Access Accounts', 'Edit account transaction', 'Delete account transaction'] },
    { module: 'Access selling price groups', icon: DollarSign, permissions: ['Default Selling Price', 'Engine Oil Customers', 'Super Markets', 'Vet Clinic', 'Pets Shops'] },
];

const Roles: React.FC<{ onNavigate: (page: string) => void }> = () => {
    const { roles: globalRoles, addRole, updateRole, deleteRole, users, currentUser } = useGlobalContext();
    const { addNotification } = useNotifications();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [pendingDeleteRole, setPendingDeleteRole] = useState<Role | null>(null);

    const permissionKey = (moduleName: string, permission: string) => `${moduleName}::${permission}`;

    const createEmptyPermissionMap = () => {
        const map: Record<string, string[]> = {};
        PERMISSION_MODULES.forEach(m => { map[m.module] = []; });
        return map;
    };

    const hydratePermissionMap = (role?: Role | null) => {
        const initialPerms = createEmptyPermissionMap();
        if (!role || !Array.isArray(role.permissions) || role.permissions.length === 0) return initialPerms;

        PERMISSION_MODULES.forEach(module => {
            initialPerms[module.module] = module.permissions.filter(perm =>
                role.permissions?.includes(permissionKey(module.module, perm)) || role.permissions?.includes(perm)
            );
        });
        return initialPerms;
    };

    const flattenSelectedPermissions = (permissionsMap: Record<string, string[]>) => (
        Object.entries(permissionsMap).flatMap(([moduleName, perms]) =>
            (perms || []).map(perm => permissionKey(moduleName, perm))
        )
    );

    const roleUserCountMap = useMemo(() => {
        const counts: Record<string, number> = {};
        users.forEach(u => {
            const role = String(u.role || '').trim();
            if (!role) return;
            counts[role] = (counts[role] || 0) + 1;
        });
        return counts;
    }, [users]);

    const currentRoleRecord = useMemo(
        () => globalRoles.find(r => r.name === currentUser?.role),
        [globalRoles, currentUser?.role]
    );
    const roleHasExplicitPermissions = !!(currentRoleRecord?.permissions && currentRoleRecord.permissions.length > 0);
    const canManageRolePermission = (permission: string) => {
        if (!currentUser) return false;
        if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
        if (!roleHasExplicitPermissions) return true; // backward compatibility for existing roles without explicit permission arrays
        const perms = currentRoleRecord?.permissions || [];
        return perms.includes(permission) || perms.includes(permissionKey('Roles', permission));
    };
    const canViewRoles = canManageRolePermission('View role');
    const canAddRole = canManageRolePermission('Add Role');
    const canEditRole = canManageRolePermission('Edit Role');
    const canDeleteRole = canManageRolePermission('Delete role');

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filteredRoles = globalRoles.filter(r =>
        !normalizedSearch ||
        r.name.toLowerCase().includes(normalizedSearch) ||
        r.description.toLowerCase().includes(normalizedSearch) ||
        String(r.id).toLowerCase().includes(normalizedSearch)
    );

    const handleOpenModal = (role: Role | null = null) => {
        if (role && !canEditRole) {
            addNotification({
                title: 'Access Denied',
                message: 'You do not have permission to edit roles.',
                type: 'error',
            });
            return;
        }
        if (!role && !canAddRole) {
            addNotification({
                title: 'Access Denied',
                message: 'You do not have permission to add roles.',
                type: 'error',
            });
            return;
        }
        setEditingRole(role);
        setRoleName(role?.name || '');
        setRoleDescription(role?.description || '');
        setSelectedPermissions(hydratePermissionMap(role));
        setIsModalOpen(true);
    };

    const togglePermission = (module: string, perm: string) => {
        setSelectedPermissions(prev => {
            const current = prev[module] || [];
            const updated = current.includes(perm) 
                ? current.filter(p => p !== perm) 
                : [...current, perm];
            return { ...prev, [module]: updated };
        });
    };

    const toggleModuleAll = (module: string, perms: string[]) => {
        setSelectedPermissions(prev => {
            const current = prev[module] || [];
            const isAllSelected = current.length === perms.length;
            return { ...prev, [module]: isAllSelected ? [] : [...perms] };
        });
    };

    const handleSaveRole = () => {
        if ((editingRole && !canEditRole) || (!editingRole && !canAddRole)) {
            addNotification({
                title: 'Access Denied',
                message: 'You do not have permission to save role changes.',
                type: 'error',
            });
            return;
        }

        const normalizedRoleName = roleName.trim();
        const normalizedDescription = roleDescription.trim();
        if (!normalizedRoleName) {
            addNotification({
                title: 'Validation Error',
                message: 'Role name is required.',
                type: 'error',
            });
            return;
        }

        const duplicateRole = globalRoles.find(r =>
            r.name.trim().toLowerCase() === normalizedRoleName.toLowerCase() &&
            (!editingRole || r.id !== editingRole.id)
        );
        if (duplicateRole) {
            addNotification({
                title: 'Validation Error',
                message: 'Role name already exists. Please use a unique role name.',
                type: 'error',
            });
            return;
        }

        if (editingRole?.isSystem && normalizedRoleName.toLowerCase() !== editingRole.name.trim().toLowerCase()) {
            addNotification({
                title: 'Action Blocked',
                message: 'System role names cannot be renamed.',
                type: 'error',
            });
            return;
        }

        const assignedToEditingRole = editingRole ? (roleUserCountMap[editingRole.name] || 0) : 0;
        if (
            editingRole &&
            assignedToEditingRole > 0 &&
            normalizedRoleName.toLowerCase() !== editingRole.name.trim().toLowerCase()
        ) {
            addNotification({
                title: 'Action Blocked',
                message: `Cannot rename role "${editingRole.name}" while ${assignedToEditingRole} user(s) are assigned. Reassign users first.`,
                type: 'error',
            });
            return;
        }

        const selectedPermissionKeys = flattenSelectedPermissions(selectedPermissions);
        const totalPermissions = selectedPermissionKeys.length;
        if (totalPermissions === 0) {
            addNotification({
                title: 'Validation Error',
                message: 'Select at least one permission before saving the role.',
                type: 'error',
            });
            return;
        }

        const computedUserCount = roleUserCountMap[normalizedRoleName] || 0;

        if (editingRole) {
            updateRole({
                ...editingRole,
                name: normalizedRoleName,
                description: normalizedDescription,
                userCount: computedUserCount,
                permissionsCount: totalPermissions,
                permissions: selectedPermissionKeys,
            });
            addNotification({
                title: 'Role Updated',
                message: `Role "${normalizedRoleName}" was updated successfully.`,
                type: 'success',
            });
        } else {
            const newRole: Role = {
                id: Date.now(),
                name: normalizedRoleName,
                description: normalizedDescription,
                userCount: computedUserCount,
                permissionsCount: totalPermissions,
                isSystem: false,
                permissions: selectedPermissionKeys,
            };
            addRole(newRole);
            addNotification({
                title: 'Role Created',
                message: `Role "${normalizedRoleName}" was created successfully.`,
                type: 'success',
            });
        }
        
        setIsModalOpen(false);
    };

    const handleDeleteRole = (role: Role) => {
        if (!canDeleteRole) {
            addNotification({
                title: 'Access Denied',
                message: 'You do not have permission to delete roles.',
                type: 'error',
            });
            return;
        }

        if (role.isSystem) {
            addNotification({
                title: 'Action Blocked',
                message: `System role "${role.name}" cannot be deleted.`,
                type: 'error',
            });
            return;
        }

        const assignedUsers = roleUserCountMap[role.name] || 0;
        if (assignedUsers > 0) {
            addNotification({
                title: 'Action Blocked',
                message: `Cannot delete "${role.name}" because ${assignedUsers} user(s) are assigned to it.`,
                type: 'error',
            });
            return;
        }

        setPendingDeleteRole(role);
    };

    const handleConfirmDeleteRole = () => {
        if (!pendingDeleteRole) return;
        deleteRole(pendingDeleteRole.id);
        addNotification({
            title: 'Role Deleted',
            message: `Role "${pendingDeleteRole.name}" was deleted successfully.`,
            type: 'success',
        });
        setPendingDeleteRole(null);
    };

    if (!canViewRoles) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
                <p>You do not have permission to view roles.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
             {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
                        <UserCog size={24} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Roles & Permissions</h2>
                        <p className="text-slate-500 mt-0.5 text-sm">Define access levels and functional permissions for user groups.</p>
                    </div>
                </div>
                {canAddRole && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
                    >
                        <Plus size={18} /> Create New Role
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left: Role Selection Cards */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="relative group mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input 
                            type="text" 
                            placeholder="Find role by name, description, or ID..." 
                            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRoles.map(role => (
                            <div 
                                key={role.id} 
                                onClick={() => { if (canEditRole) handleOpenModal(role); }}
                                className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition-all group relative ${canEditRole ? 'hover:border-indigo-300 hover:shadow-md cursor-pointer' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${role.isSystem ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canEditRole && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenModal(role); }}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={16}/>
                                            </button>
                                        )}
                                        {!role.isSystem && canDeleteRole && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <h4 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                    {role.name}
                                    {role.isSystem && <Lock size={14} className="text-slate-300" />}
                                </h4>
                                <p className="text-slate-500 text-xs mt-2 leading-relaxed h-10 line-clamp-2">{role.description}</p>
                                <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                        <Users size={14} /> {roleUserCountMap[role.name] || 0} Users
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                                        <Key size={14} /> {Array.isArray(role.permissions) ? role.permissions.length : role.permissionsCount} Permissions
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Security Information & Tips */}
                <div className="space-y-6">
                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                            <ShieldAlert size={24} className="text-indigo-400" />
                            Security Protocol
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Roles define the hard boundaries of what users can see and do. Always follow the principle of **least privilege**.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div>
                                <p className="text-xs text-slate-300">System roles (Admin) cannot be deleted to prevent accidental lockouts.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2"></div>
                                <p className="text-xs text-slate-300">New permissions are added automatically when core modules are updated.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                        <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Info size={18} className="text-blue-500" /> Need Help?
                        </h4>
                        <div className="space-y-4">
                             <div className="group cursor-pointer">
                                 <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">How to edit permissions?</p>
                                 <p className="text-xs text-slate-500 mt-1">Learn how to fine-tune specific module access.</p>
                             </div>
                             <div className="group cursor-pointer">
                                 <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">Multiple roles per user?</p>
                                 <p className="text-xs text-slate-500 mt-1">Can a user have more than one role assigned?</p>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Role Management Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[95vh]">
                        
                        {/* Modal Header */}
                        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {editingRole ? `Manage Role: ${editingRole.name}` : 'Configure New Role'}
                                    </h3>
                                    <p className="text-slate-500 text-sm">Define access privileges for this role group.</p>
                                </div>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-white p-2 rounded-full transition-all shadow-sm">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-10 overflow-y-auto custom-scrollbar bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                <div className="group">
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Role Name *</label>
                                    <input 
                                        type="text" 
                                        value={roleName}
                                        onChange={(e) => setRoleName(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800" 
                                        placeholder="e.g. Regional Manager"
                                        disabled={!!editingRole?.isSystem}
                                    />
                                    {!!editingRole?.isSystem && (
                                        <p className="text-[10px] text-slate-400 mt-2 ml-1">System role name is locked.</p>
                                    )}
                                </div>
                                <div className="group">
                                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-wider ml-1">Role Description</label>
                                    <input 
                                        type="text" 
                                        value={roleDescription}
                                        onChange={(e) => setRoleDescription(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700" 
                                        placeholder="Briefly describe responsibilities..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                        <Key size={18} className="text-indigo-500" /> Functional Permissions Matrix
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-400">SELECT ACCESS LEVELS PER MODULE</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {PERMISSION_MODULES.map((module) => (
                                        <div key={module.module} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 transition-all hover:shadow-md hover:border-indigo-200 group/module">
                                            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm border border-slate-100 group-hover/module:bg-indigo-600 group-hover/module:text-white transition-all">
                                                        <module.icon size={16} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-800">{module.module}</span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => toggleModuleAll(module.module, module.permissions)}
                                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm transition-all"
                                                >
                                                    {selectedPermissions[module.module]?.length === module.permissions.length ? 'DESELECT ALL' : 'SELECT ALL'}
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {module.permissions.map((perm) => {
                                                    const isSelected = selectedPermissions[module.module]?.includes(perm);
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={perm}
                                                            onClick={() => togglePermission(module.module, perm)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                                                isSelected 
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-105' 
                                                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                            }`}
                                                        >
                                                            {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                                            {perm}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-10 py-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-8 py-3.5 border border-slate-200 rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-white hover:border-slate-300 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveRole}
                                disabled={(editingRole && !canEditRole) || (!editingRole && !canAddRole)}
                                className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                            >
                                <Save size={18} /> {editingRole ? 'Update Role' : 'Create Role'}
                            </button>
                        </div>

                    </div>
                </div>
            )}
            <ConfirmationModal
                isOpen={!!pendingDeleteRole}
                onClose={() => setPendingDeleteRole(null)}
                onConfirm={handleConfirmDeleteRole}
                title="Delete Role"
                message={`Are you sure you want to delete role "${pendingDeleteRole?.name}"? This action cannot be undone.`}
                confirmLabel="Delete Role"
                confirmVariant="danger"
                icon={<Trash2 size={32} />}
            />
        </div>
    );
};

export default Roles;
