import React, { useState } from 'react';
import { 
  UserPlus, Save, X, Info, Shield, 
  DollarSign, Briefcase, MapPin, 
  CreditCard, User, Mail, Lock, 
  Calendar, Heart, Phone, Facebook, 
  Twitter, Share2, FileText, Home, 
  Building2, Landmark, Hash, Check,
  ChevronDown, Percent, Edit
} from 'lucide-react';
import { useNotifications } from '../src/context/NotificationContext';
import { useGlobalContext, AppUser } from '../src/context/GlobalContext';

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

const InputGroup = ({ label, name, type = "text", placeholder, required = false, icon: Icon, options }: any) => {
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
            className={`w-full ${Icon ? 'pl-11' : 'px-4'} pr-10 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer`}
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
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-800 resize-none"
          />
        ) : (
          <input 
            type={type}
            name={name}
            value={(formData as any)[name]}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            className={`w-full ${Icon ? 'pl-11' : 'px-4'} py-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800`}
          />
        )}
        {type === 'select' && <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />}
      </div>
    </div>
  );
};

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
          className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-indigo-600 checked:border-indigo-600 transition-all"
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
  const { users, addUser, updateUser, locations } = useGlobalContext();
  
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
    customField1: '',
    customField2: '',
    customField3: '',
    customField4: '',
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
      const userToEdit = users.find(u => u.id === userId);
      if (userToEdit) {
        setFormData(prev => ({
          ...prev,
          firstName: userToEdit.name.split(' ')[0] || '',
          lastName: userToEdit.name.split(' ').slice(1).join(' ') || '',
          email: userToEdit.email,
          username: userToEdit.username,
          role: userToEdit.role,
          commissionPercent: userToEdit.commissionPercent?.toString() || '',
          isActive: userToEdit.status === 'Active'
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newUser: AppUser = {
      id: isEdit && userId ? userId : `USR-${Date.now()}`,
      username: formData.username,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      role: formData.role,
      email: formData.email,
      status: formData.isActive ? 'Active' : 'Inactive',
      lastLogin: isEdit && userId ? users.find(u => u.id === userId)?.lastLogin || 'Never' : 'Never',
      commissionPercent: formData.commissionPercent ? parseFloat(formData.commissionPercent) : 0
    };

    if (isEdit) {
      updateUser(newUser);
    } else {
      addUser(newUser);
    }

    addNotification({
      title: isEdit ? 'User Updated' : 'User Created',
      message: `System user ${formData.firstName} has been successfully ${isEdit ? 'updated' : 'added'}.`,
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            {isEdit ? <Edit className="text-indigo-600" size={32} /> : <UserPlus className="text-indigo-600" size={32} />}
            {isEdit ? 'Edit User' : 'Add User'}
          </h2>
          <p className="text-slate-500 mt-1">Configure system access and personal details for system staff.</p>
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
              <InputGroup label="Username" name="username" placeholder="Emmanuel" icon={User} />
              <InputGroup label="Password" name="password" type="password" placeholder="********" required icon={Lock} />
              <InputGroup label="Confirm Password" name="confirmPassword" type="password" placeholder="********" required icon={Lock} />
              
              <InputGroup 
                label="Role" 
                name="role" 
                type="select" 
                icon={Briefcase}
                options={['Admin', 'Cashier', 'Manager', 'Sales Agent']} 
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
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-indigo-600 checked:border-indigo-600 transition-all"
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
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-200 bg-white checked:bg-indigo-600 checked:border-indigo-600 transition-all"
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
            <InputGroup label="Sales Commission Percentage (%)" name="commissionPercent" type="number" placeholder="Sales Commission Percentage (%)" icon={Percent} />
            <InputGroup label="Max sales discount percent" name="maxDiscountPercent" type="number" placeholder="Max sales discount percent" icon={Percent} />
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
            <InputGroup label="Custom Field 1" name="customField1" placeholder="Custom Field 1" icon={FileText} />
            
            <InputGroup label="Custom Field 2" name="customField2" placeholder="Custom Field 2" icon={FileText} />
            <InputGroup label="Custom Field 3" name="customField3" placeholder="Custom Field 3" icon={FileText} />
            <InputGroup label="Custom Field 4" name="customField4" placeholder="Custom Field 4" icon={FileText} />
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
            className="px-16 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-900/30 active:scale-95 flex items-center gap-3"
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
