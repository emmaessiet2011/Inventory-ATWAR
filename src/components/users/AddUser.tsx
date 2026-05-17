import React, { useMemo, useState } from 'react';
import { 
  UserPlus, Save, X, Info, Shield, 
  DollarSign, Briefcase, MapPin, 
  CreditCard, User, Mail, Lock, 
  Calendar, Heart, Phone, Facebook, 
  Twitter, Share2, FileText, Home, 
  Building2, Landmark, Hash, Check,
  ChevronDown, Percent, Edit
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalContext, AppUser } from '@/context/GlobalContext';

const FormContext = React.createContext<any>(null);

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
      <Icon size={20} />
    </div>
    <div>
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{title}</h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const InputGroup = ({ label, name, type = "text", placeholder, required = false, icon: Icon, options, min, max, step }: any) => {
  const { formData, handleChange } = React.useContext(FormContext);
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative group">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />}
        {type === 'select' ? (
          <select 
            name={name}
            value={(formData as any)[name]}
            onChange={handleChange}
            className={`w-full ${Icon ? 'pl-11' : 'px-4'} pr-10 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer`}
          >
            <option value="">Please Select</option>
            {options.map((opt: any) => (
              <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea 
            name={name}
            value={(formData as any)[name]}
            onChange={handleChange}
            placeholder={placeholder}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-800 resize-none"
          />
        ) : (
          <input 
            type={type}
            name={name}
            value={(formData as any)[name]}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            min={min}
            max={max}
            step={step}
            className={`w-full ${Icon ? 'pl-11' : 'px-4'} py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800`}
          />
        )}
        {type === 'select' && <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />}
      </div>
    </div>
  );
};

const FALLBACK_ROLE_NAMES = ['Admin', 'CEO', 'Manager', 'Sale Agent', 'Sales Man', 'Order', 'Field Payment', 'Cashier'];
const CRITICAL_ADMIN_EMAIL = 'admin@atwar.com';
const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeRoleName = (value: unknown) => String(value || '').trim().toLowerCase();

const CheckboxGroup = ({ label, name, checked, info }: any) => {
  const { handleChange } = React.useContext(FormContext);
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative flex items-center">
        <input 
          type="checkbox" 
          name={name}
          checked={checked}
          onChange={handleChange}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-blue-600 checked:border-indigo-600 transition-all"
        />
        <Check className="absolute left-1 top-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={4} />
      </div>
      <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
        {label}
        {info && <Info size={12} className="text-slate-400" />}
      </span>
    </label>
  );
};

interface AddUserProps {
  onNavigate?: (page: string) => void;
  isEdit?: boolean;
  userId?: string;
}

const AddUser: React.FC<AddUserProps> = ({ onNavigate, isEdit, userId }) => {
  const { addNotification } = useNotifications();
  const { users, addUser, updateUser, locations, roles, currentUser } = useGlobalContext();
  const availableRoleNames = useMemo(() => {
    const roleNames = roles.map((role: any) => String(role?.name || '').trim()).filter(Boolean);
    const uniqueRoleNames = Array.from(new Set(roleNames));
    return uniqueRoleNames.length > 0 ? uniqueRoleNames : FALLBACK_ROLE_NAMES;
  }, [roles]);
  const adminRoleNameSet = useMemo(() => {
    const names = new Set<string>(['admin']);
    roles.forEach((role: any) => {
      const roleName = String(role?.name || '').trim();
      if (!roleName) return;
      if (role?.isSystem || normalizeRoleName(roleName) === 'admin') {
        names.add(normalizeRoleName(roleName));
      }
    });
    return names;
  }, [roles]);
  const isAdminRole = (roleName: unknown): boolean => adminRoleNameSet.has(normalizeRoleName(roleName));
  
  // --- Form State ---
  const [formData, setFormData] = useState({
    // ... (rest of initial state)
    prefix: '',
    firstName: '',
    lastName: '',
    email: '',
    isActive: true,
    enableServiceStaffPin: false,
    allowLogin: true,
    username: '',
    password: '',
    confirmPassword: '',
    role: 'Admin',
    accessLocations: ['All Locations'],
    commissionPercent: '',
    maxDiscountPercent: '',
    allowSelectedContacts: false,
    dob: '',
    gender: '',
    maritalStatus: '',
    bloodGroup: '',
    mobile: '',
    altContact: '',
    familyContact: '',
    facebook: '',
    twitter: '',
    social1: '',
    social2: '',
    guardianName: '',
    idProofName: '',
    idProofNumber: '',
    permanentAddress: '',
    currentAddress: '',
    accountHolder: '',
    accountNumber: '',
    bankName: '',
    bankIdentifierCode: '',
    branch: '',
    taxPayerId: ''
  });

  React.useEffect(() => {
    if (isEdit && userId) {
      const u = users.find(u => u.id === userId);
      if (u) {
        setFormData(prev => ({
          ...prev,
          prefix: u.prefix || '',
          firstName: u.name.split(' ')[0] || '',
          lastName: u.name.split(' ').slice(1).join(' ') || '',
          email: u.email,
          username: u.username,
          role: u.role,
          isActive: u.status === 'Active',
          allowLogin: u.allowLogin !== false,
          enableServiceStaffPin: u.enableServiceStaffPin || false,
          commissionPercent: u.commissionPercent?.toString() || '',
          maxDiscountPercent: u.maxDiscountPercent?.toString() || '',
          allowSelectedContacts: u.allowSelectedContacts || false,
          accessLocations: u.accessLocations || ['All Locations'],
          mobile: u.mobile || '',
          altContact: u.altContact || '',
          familyContact: u.familyContact || '',
          dob: u.dob || '',
          gender: u.gender || '',
          maritalStatus: u.maritalStatus || '',
          bloodGroup: u.bloodGroup || '',
          facebook: u.facebook || '',
          twitter: u.twitter || '',
          social1: u.social1 || '',
          social2: u.social2 || '',
          guardianName: u.guardianName || '',
          idProofName: u.idProofName || '',
          idProofNumber: u.idProofNumber || '',
          permanentAddress: u.permanentAddress || '',
          currentAddress: u.currentAddress || '',
          accountHolder: u.accountHolder || '',
          accountNumber: u.accountNumber || '',
          bankName: u.bankName || '',
          bankIdentifierCode: u.bankIdentifierCode || '',
          branch: u.branch || '',
          taxPayerId: u.taxPayerId || '',
        }));
      }
    }
  }, [isEdit, userId, users]);

  const handleLocationChange = (locId: string, checked: boolean) => {
    setFormData(prev => {
      let newLocations = [...(prev.accessLocations || [])];
      
      if (locId === 'All Locations') {
        if (checked) {
          newLocations = ['All Locations'];
        } else {
          newLocations = [];
        }
      } else {
        // Remove 'All Locations' if a specific location is checked/unchecked
        newLocations = newLocations.filter(id => id !== 'All Locations');
        
        if (checked) {
          if (!newLocations.includes(locId)) newLocations.push(locId);
        } else {
          newLocations = newLocations.filter(id => id !== locId);
        }
        
        // If all specific locations are checked, maybe switch to 'All Locations'? 
        // For simplicity, just let them be individual.
      }
      
      return { ...prev, accessLocations: newLocations };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitted = new FormData(e.currentTarget as HTMLFormElement);
    const getSubmittedValue = (key: string, fallback: unknown): string => {
      const raw = submitted.get(key);
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      return String(fallback || '').trim();
    };

    const normalizedFirstName = getSubmittedValue('firstName', formData.firstName);
    const normalizedLastName = getSubmittedValue('lastName', formData.lastName);
    const normalizedUsername = getSubmittedValue('username', formData.username);
    const normalizedEmail = getSubmittedValue('email', formData.email);
    const normalizedRole = getSubmittedValue('role', formData.role);
    const enteredPassword = getSubmittedValue('password', formData.password);
    const confirmPassword = getSubmittedValue('confirmPassword', formData.confirmPassword);
    const commissionPercent = Number(formData.commissionPercent || 0);
    const maxDiscountPercent = formData.maxDiscountPercent === ''
      ? undefined
      : Number(formData.maxDiscountPercent);
    const existingUser = isEdit && userId ? users.find(u => u.id === userId) : undefined;

    if (!normalizedFirstName || !normalizedUsername || !normalizedEmail || !normalizedRole) {
      addNotification({
        title: 'Validation Error',
        message: 'First name, username, email, and role are required.',
        type: 'error',
      });
      return;
    }
    const isKnownRole = availableRoleNames.some(
      roleName => normalizeText(roleName) === normalizeText(normalizedRole),
    );
    if (!isKnownRole) {
      addNotification({
        title: 'Validation Error',
        message: 'Selected role is not valid. Please choose a role from the configured list.',
        type: 'error',
      });
      return;
    }
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      addNotification({
        title: 'Validation Error',
        message: 'Sales Commission Percentage must be between 0 and 100.',
        type: 'error',
      });
      return;
    }
    if (
      maxDiscountPercent !== undefined &&
      (!Number.isFinite(maxDiscountPercent) || maxDiscountPercent < 0 || maxDiscountPercent > 100)
    ) {
      addNotification({
        title: 'Validation Error',
        message: 'Max sales discount percent must be between 0 and 100.',
        type: 'error',
      });
      return;
    }

    const duplicateUsername = users.some(
      u => u.username.toLowerCase() === normalizedUsername.toLowerCase() && (!isEdit || u.id !== userId)
    );
    if (duplicateUsername) {
      addNotification({
        title: 'Validation Error',
        message: 'Username already exists. Please choose another username.',
        type: 'error',
      });
      return;
    }

    const duplicateEmail = users.some(
      u => u.email.toLowerCase() === normalizedEmail.toLowerCase() && (!isEdit || u.id !== userId)
    );
    if (duplicateEmail) {
      addNotification({
        title: 'Validation Error',
        message: 'Email already exists. Please use another email address.',
        type: 'error',
      });
      return;
    }

    if (!isEdit && !enteredPassword) {
      addNotification({
        title: 'Validation Error',
        message: 'Password is required when creating a new user.',
        type: 'error',
      });
      return;
    }

    if (enteredPassword || !isEdit) {
      if (enteredPassword.length < 6) {
        addNotification({
          title: 'Validation Error',
          message: 'Password must be at least 6 characters.',
          type: 'error',
        });
        return;
      }
      if (enteredPassword !== confirmPassword) {
        addNotification({
          title: 'Validation Error',
          message: 'Password and confirm password do not match.',
          type: 'error',
        });
        return;
      }
    }
    
    const hasNewPassword = enteredPassword.length > 0;

    const newUser: AppUser = {
      id: isEdit && userId ? userId : `USR-${Date.now()}`,
      username: normalizedUsername,
      name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
      role: normalizedRole,
      email: normalizedEmail,
      password: hasNewPassword ? enteredPassword : undefined,
      passwordHash: hasNewPassword ? undefined : existingUser?.passwordHash,
      passwordSalt: hasNewPassword ? undefined : existingUser?.passwordSalt,
      passwordUpdatedAt: hasNewPassword
        ? new Date().toISOString()
        : existingUser?.passwordUpdatedAt,
      status: formData.isActive ? 'Active' : 'Inactive',
      lastLogin: isEdit && userId ? existingUser?.lastLogin || 'Never' : 'Never',
      commissionPercent: Number(commissionPercent.toFixed(2)),
      maxDiscountPercent: maxDiscountPercent === undefined ? undefined : Number(maxDiscountPercent.toFixed(2)),
      allowSelectedContacts: formData.allowSelectedContacts,
      accessLocations: Array.isArray(formData.accessLocations) ? formData.accessLocations : [],
      allowLogin: formData.allowLogin,
      enableServiceStaffPin: formData.enableServiceStaffPin,
      prefix: formData.prefix || undefined,
      mobile: formData.mobile || undefined,
      altContact: formData.altContact || undefined,
      familyContact: formData.familyContact || undefined,
      dob: formData.dob || undefined,
      gender: formData.gender || undefined,
      maritalStatus: formData.maritalStatus || undefined,
      bloodGroup: formData.bloodGroup || undefined,
      facebook: formData.facebook || undefined,
      twitter: formData.twitter || undefined,
      social1: formData.social1 || undefined,
      social2: formData.social2 || undefined,
      guardianName: formData.guardianName || undefined,
      idProofName: formData.idProofName || undefined,
      idProofNumber: formData.idProofNumber || undefined,
      permanentAddress: formData.permanentAddress || undefined,
      currentAddress: formData.currentAddress || undefined,
      accountHolder: formData.accountHolder || undefined,
      accountNumber: formData.accountNumber || undefined,
      bankName: formData.bankName || undefined,
      bankIdentifierCode: formData.bankIdentifierCode || undefined,
      branch: formData.branch || undefined,
      taxPayerId: formData.taxPayerId || undefined,
    };

    const projectedUsers = (isEdit && userId)
      ? users.map(u => u.id === userId ? newUser : u)
      : [...users, newUser];
    if (normalizedEmail === CRITICAL_ADMIN_EMAIL && (newUser.status !== 'Active' || newUser.allowLogin === false)) {
      addNotification({
        title: 'Validation Error',
        message: `${CRITICAL_ADMIN_EMAIL} must remain Active with login access.`,
        type: 'error',
      });
      return;
    }
    const activeAdminLoginUsers = projectedUsers.filter(
      u => isAdminRole(u.role) && u.status === 'Active' && u.allowLogin !== false
    );
    if (activeAdminLoginUsers.length === 0) {
      addNotification({
        title: 'Validation Error',
        message: 'At least one active Admin with login access must remain in the system.',
        type: 'error',
      });
      return;
    }

    if (isEdit && userId && currentUser?.id === userId) {
      if (newUser.status !== 'Active') {
        addNotification({
          title: 'Validation Error',
          message: 'You cannot deactivate your own account while logged in.',
          type: 'error',
        });
        return;
      }
      if (newUser.allowLogin === false) {
        addNotification({
          title: 'Validation Error',
          message: 'You cannot disable your own login while logged in.',
          type: 'error',
        });
        return;
      }
    }

    const result = isEdit
      ? await updateUser(newUser)
      : await addUser(newUser);
    if (!result.ok) {
      addNotification({
        title: isEdit ? 'Update Failed' : 'Create Failed',
        message: result.error || `Unable to ${isEdit ? 'update' : 'create'} system user.`,
        type: 'error',
      });
      return;
    }

    addNotification({
      title: isEdit ? 'User Updated' : 'User Created',
      message: `System user ${normalizedFirstName} has been successfully ${isEdit ? 'updated' : 'added'}.`,
      type: 'success'
    });
    if (onNavigate) onNavigate('users');
  };

  return (
    <FormContext.Provider value={{ formData, handleChange }}>
      <div className="space-y-8 animate-fade-in pb-32 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
              {isEdit ? <Edit size={24} className="text-white" /> : <UserPlus size={24} className="text-white" />}
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">{isEdit ? 'Edit User' : 'Add User'}</h2>
              <p className="text-slate-500 text-sm mt-0.5">Configure system access and personal details</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => onNavigate?.('users')}
          className="p-2.5 bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-200 shadow-sm"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <InputGroup label="Prefix" name="prefix" placeholder="Mr / Mrs / Miss" />
            <InputGroup label="First Name" name="firstName" placeholder="First Name" required />
            <InputGroup label="Last Name" name="lastName" placeholder="Last Name" />
            <div className="lg:col-span-1">
              <InputGroup label="Email" name="email" type="email" placeholder="Email" required icon={Mail} />
            </div>
            <div className="flex items-center gap-8 pt-6">
              <CheckboxGroup label="Is active?" name="isActive" checked={formData.isActive} info />
              <CheckboxGroup label="Enable service staff pin" name="enableServiceStaffPin" checked={formData.enableServiceStaffPin} info />
            </div>
          </div>
        </div>

        {/* Roles and Permissions */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
          <SectionHeader icon={Shield} title="Roles and Permissions" />
          
          <div className="space-y-8">
            <CheckboxGroup label="Allow login" name="allowLogin" checked={formData.allowLogin} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <InputGroup label="Username" name="username" placeholder="Emmanuel" required icon={User} />
              <InputGroup label="Password" name="password" type="password" placeholder="********" required={!isEdit} icon={Lock} />
              <InputGroup label="Confirm Password" name="confirmPassword" type="password" placeholder="********" required={!isEdit} icon={Lock} />
              
              <InputGroup
                label="Role"
                name="role"
                type="select"
                icon={Briefcase}
                options={availableRoleNames.map((roleName) => ({ value: roleName, label: roleName }))}
              />
              
              <div className="lg:col-span-2 space-y-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Access locations</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        checked={formData.accessLocations?.includes('All Locations')}
                        onChange={(e) => handleLocationChange('All Locations', e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-blue-600 checked:border-indigo-600 transition-all"
                      />
                      <Check className="absolute left-1 top-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={4} />
                    </div>
                    <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      All Locations
                      <Info size={12} className="text-slate-400" />
                    </span>
                  </label>
                  
                  {locations.map(loc => (
                    <label key={loc.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={formData.accessLocations?.includes('All Locations') || formData.accessLocations?.includes(loc.id)}
                          onChange={(e) => handleLocationChange(loc.id, e.target.checked)}
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-blue-600 checked:border-indigo-600 transition-all"
                        />
                        <Check className="absolute left-1 top-1 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={4} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                        {loc.name} ({loc.id})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
          <SectionHeader icon={DollarSign} title="Sales" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <InputGroup
              label="Sales Commission Percentage (%)"
              name="commissionPercent"
              type="number"
              placeholder="Sales Commission Percentage (%)"
              icon={Percent}
              min={0}
              max={100}
              step="0.01"
            />
            <InputGroup
              label="Max sales discount percent"
              name="maxDiscountPercent"
              type="number"
              placeholder="Max sales discount percent"
              icon={Percent}
              min={0}
              max={100}
              step="0.01"
            />
            <div className="lg:col-span-2">
              <CheckboxGroup label="Allow Selected Contacts" name="allowSelectedContacts" checked={formData.allowSelectedContacts} info />
            </div>
          </div>
        </div>

        {/* More Informations */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
          <SectionHeader icon={Info} title="More Informations" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <InputGroup label="Date of birth" name="dob" type="date" icon={Calendar} />
            <InputGroup label="Gender" name="gender" type="select" options={['Male', 'Female', 'Other']} />
            <InputGroup label="Marital Status" name="maritalStatus" type="select" options={['Single', 'Married', 'Divorced', 'Widowed']} />
            <InputGroup label="Blood Group" name="bloodGroup" type="select" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} icon={Heart} />
            
            <InputGroup label="Mobile Number" name="mobile" type="tel" placeholder="Mobile Number" icon={Phone} />
            <InputGroup label="Alternate contact number" name="altContact" type="tel" placeholder="Alternate contact number" icon={Phone} />
            <InputGroup label="Family contact number" name="familyContact" type="tel" placeholder="Family contact number" icon={Phone} />
            <InputGroup label="Facebook Link" name="facebook" type="url" placeholder="Facebook Link" icon={Facebook} />
            
            <InputGroup label="Twitter Link" name="twitter" type="url" placeholder="Twitter Link" icon={Twitter} />
            <InputGroup label="Social Media 1" name="social1" type="url" placeholder="Social Media 1" icon={Share2} />
            <InputGroup label="Social Media 2" name="social2" type="url" placeholder="Social Media 2" icon={Share2} />
            <InputGroup label="Guardian Name" name="guardianName" placeholder="Guardian Name" icon={User} />
            
            <InputGroup label="ID proof name" name="idProofName" placeholder="ID proof name" icon={FileText} />
            <InputGroup label="ID proof number" name="idProofNumber" placeholder="ID proof number" icon={Hash} />
            
            <div className="md:col-span-2">
              <InputGroup label="Permanent Address" name="permanentAddress" type="textarea" placeholder="Permanent Address" icon={Home} />
            </div>
            <div className="md:col-span-2">
              <InputGroup label="Current Address" name="currentAddress" type="textarea" placeholder="Current Address" icon={MapPin} />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-10 relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-500"></div>
          <SectionHeader icon={CreditCard} title="Bank Details" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <InputGroup label="Account Holder's Name" name="accountHolder" placeholder="Account Holder's Name" icon={User} />
            <InputGroup label="Account Number" name="accountNumber" placeholder="Account Number" icon={Hash} />
            <InputGroup label="Bank Name" name="bankName" placeholder="Bank Name" icon={Building2} />
            <InputGroup label="Bank Identifier Code" name="bankIdentifierCode" placeholder="Bank Identifier Code" icon={Landmark} info />
            
            <InputGroup label="Branch" name="branch" placeholder="Branch" icon={MapPin} />
            <InputGroup label="Tax Payer ID" name="taxPayerId" placeholder="Tax Payer ID" icon={Hash} info />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-8">
          <button 
            type="submit"
            className="px-16 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transition-all shadow-2xl shadow-indigo-900/30 active:scale-95 flex items-center gap-3"
          >
            <Save size={20} /> {isEdit ? 'Update User' : 'Save'}
          </button>
        </div>
      </form>
    </div>
    </FormContext.Provider>
  );
};

export default AddUser;
