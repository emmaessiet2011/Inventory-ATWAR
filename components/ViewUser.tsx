
import React, { useState } from 'react';
import { 
    ArrowLeft, User, Shield, Phone, Mail, 
    Calendar, TrendingUp, DollarSign, Activity,
    ShoppingCart, PieChart, Clock, LogIn,
    Briefcase, Award, CheckCircle2, Lock,
    Settings, Globe, MapPin, Eye, Filter,
    ShoppingBag, Edit, FileText, ChevronDown,
    Paperclip, List, Plus, FileSpreadsheet,
    Printer, Columns, FileDown
} from 'lucide-react';

import { useGlobalContext } from '../src/context/GlobalContext';

const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }: { id: string, label: string, icon: any, activeTab: string, setActiveTab: (id: string) => void }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`px-8 py-4 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === id 
            ? 'border-indigo-600 text-slate-900 bg-white' 
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`}
    >
        <Icon size={18} /> {label}
    </button>
);

const InfoField = ({ label, value }: { label: string, value: string }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-black text-slate-900">{label}:</span>
        <span className="text-sm text-slate-600 min-h-[1.25rem]">{value || ''}</span>
    </div>
);

interface ViewUserProps {
    userId: string;
    onNavigate: (page: string) => void;
}

const ViewUser: React.FC<ViewUserProps> = ({ userId, onNavigate }) => {
    const { users } = useGlobalContext();
    const [activeTab, setActiveTab] = useState('user_info');

    const user = users.find(u => u.id === userId);

    // Mock User Data based on the image
    const userData = {
        id: userId,
        name: user?.name || 'Unknown User',
        arabicRole: user?.role || 'Unknown Role',
        username: user?.username || 'unknown',
        email: user?.email || '',
        isActive: user?.status === 'Active',
        commissionPercent: user?.commissionPercent ? `${user.commissionPercent}%` : '0.00%',
        allowedContacts: 'All',
        dob: '',
        gender: '',
        maritalStatus: '',
        bloodGroup: '',
        mobile: '',
        altContact: '',
        familyContact: '',
        idProofName: '',
        idProofNumber: '',
        facebook: '',
        twitter: '',
        social1: '',
        social2: '',
        customField1: '',
        customField2: '',
        customField3: '',
        customField4: '',
        permanentAddress: '',
        currentAddress: '',
        bankDetails: {
            accountHolder: '',
            bankName: '',
            branch: '',
            accountNumber: '',
            bankIdentifier: '',
            taxPayerId: ''
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => onNavigate('users')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800">View User</h2>
                </div>
                <div className="relative w-72">
                    <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                        <option>{userData.name}</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left Sidebar: Profile Summary */}
                <div className="xl:col-span-3">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-8 flex flex-col items-center">
                        <div className="w-28 h-28 rounded-full bg-slate-100 border-4 border-slate-50 flex items-center justify-center text-4xl font-medium text-slate-400 mb-4">
                            AB
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-1">{userData.name}</h3>
                        <p className="text-slate-500 text-sm mb-6">{userData.arabicRole}</p>
                        
                        <div className="w-full space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center py-1">
                                <span className="text-sm font-bold text-slate-900">Username</span>
                                <span className="text-sm text-indigo-600 font-medium">{userData.username}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-sm font-bold text-slate-900">Email</span>
                                <span className="text-sm text-indigo-600 font-medium truncate max-w-[150px]">{userData.email}</span>
                            </div>
                            <div className="flex justify-between items-center py-1">
                                <span className="text-sm font-bold text-slate-900">Is active ?</span>
                                <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded uppercase">Active</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => onNavigate(`edit-user/${userId}`)}
                            className="w-full mt-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                        >
                            <Edit size={16} /> Edit
                        </button>
                    </div>
                </div>

                {/* Right Area: Detailed Info */}
                <div className="xl:col-span-9">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        {/* Tabs Navigation */}
                        <div className="flex border-b border-slate-100 bg-slate-50/30">
                            <TabButton id="user_info" label="User Information" icon={User} activeTab={activeTab} setActiveTab={setActiveTab} />
                            <TabButton id="docs" label="Documents & Note" icon={Paperclip} activeTab={activeTab} setActiveTab={setActiveTab} />
                            <TabButton id="activities" label="Activities" icon={Edit} activeTab={activeTab} setActiveTab={setActiveTab} />
                        </div>

                        {/* Tab Content */}
                        <div className="p-8">
                            {activeTab === 'user_info' && (
                                <div className="space-y-10">
                                    {/* Top Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Sales Commission Percentage (%):</span>
                                            <span className="text-sm text-slate-600">{userData.commissionPercent}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Allowed Contacts:</span>
                                            <span className="text-sm text-slate-600">{userData.allowedContacts}</span>
                                        </div>
                                    </div>

                                    {/* More Informations */}
                                    <div className="space-y-6">
                                        <h4 className="text-lg font-bold text-slate-700 border-b border-slate-100 pb-2">More Informations</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
                                            <InfoField label="Date of birth" value={userData.dob} />
                                            <InfoField label="Facebook Link" value={userData.facebook} />
                                            <InfoField label="Custom field 1" value={userData.customField1} />
                                            
                                            <InfoField label="Gender" value={userData.gender} />
                                            <InfoField label="Twitter Link" value={userData.twitter} />
                                            <InfoField label="Custom field 2" value={userData.customField2} />
                                            
                                            <InfoField label="Marital Status" value={userData.maritalStatus} />
                                            <InfoField label="Social Media 1" value={userData.social1} />
                                            <InfoField label="Custom field 3" value={userData.customField3} />
                                            
                                            <InfoField label="Blood Group" value={userData.bloodGroup} />
                                            <InfoField label="Social Media 2" value={userData.social2} />
                                            <InfoField label="Custom field 4" value={userData.customField4} />
                                            
                                            <InfoField label="Mobile Number" value={userData.mobile} />
                                            <div className="hidden lg:block"></div>
                                            <div className="hidden lg:block"></div>
                                            
                                            <InfoField label="Alternate contact number" value={userData.altContact} />
                                            <div className="hidden lg:block"></div>
                                            <div className="hidden lg:block"></div>
                                            
                                            <InfoField label="Family contact number" value={userData.familyContact} />
                                            <div className="hidden lg:block"></div>
                                            <div className="hidden lg:block"></div>
                                            
                                            <InfoField label="ID proof name" value={userData.idProofName} />
                                            <InfoField label="ID proof number" value={userData.idProofNumber} />
                                        </div>
                                    </div>

                                    {/* Addresses */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6 border-t border-slate-100">
                                        <InfoField label="Permanent Address" value={userData.permanentAddress} />
                                        <InfoField label="Current Address" value={userData.currentAddress} />
                                    </div>

                                    {/* Bank Details */}
                                    <div className="space-y-6 pt-6 border-t border-slate-100">
                                        <h4 className="text-lg font-bold text-slate-700 border-b border-slate-100 pb-2">Bank Details</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
                                            <InfoField label="Account Holder's Name" value={userData.bankDetails.accountHolder} />
                                            <InfoField label="Bank Name" value={userData.bankDetails.bankName} />
                                            <InfoField label="Branch" value={userData.bankDetails.branch} />
                                            
                                            <InfoField label="Account Number" value={userData.bankDetails.accountNumber} />
                                            <InfoField label="Bank Identifier Code" value={userData.bankDetails.bankIdentifier} />
                                            <InfoField label="Tax Payer ID" value={userData.bankDetails.taxPayerId} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'docs' && (
                                <div className="space-y-6">
                                    <div className="flex justify-end">
                                        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2">
                                            Add <Plus size={16} />
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-center bg-white">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <span>Show</span>
                                                <select className="border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                <span>entries</span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileText size={14} /> Export CSV
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileSpreadsheet size={14} /> Export Excel
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Printer size={14} /> Print
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Columns size={14} /> Column visibility
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileDown size={14} /> Export PDF
                                                </button>
                                            </div>

                                            <div className="relative w-full md:w-64">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Search ...</span>
                                                <input 
                                                    type="text" 
                                                    className="w-full pl-16 pr-4 py-1.5 rounded border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 border-r border-slate-100">Action</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Heading</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Added By</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Created At</th>
                                                        <th className="px-4 py-3">Updated At</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 bg-slate-50/30 italic">
                                                            No data available in table
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                                            <div className="text-sm text-slate-600 font-medium">
                                                Showing 0 to 0 of 0 entries
                                            </div>
                                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                                <button className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 border-r border-slate-200 transition disabled:opacity-50" disabled>Previous</button>
                                                <button className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 transition disabled:opacity-50" disabled>Next</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {activeTab === 'activities' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-center bg-white">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <span>Show</span>
                                                <select className="border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                <span>entries</span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileText size={14} /> Export CSV
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileSpreadsheet size={14} /> Export Excel
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Printer size={14} /> Print
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Columns size={14} /> Column visibility
                                                </button>
                                                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileDown size={14} /> Export PDF
                                                </button>
                                            </div>

                                            <div className="relative w-full md:w-64">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Search ...</span>
                                                <input 
                                                    type="text" 
                                                    className="w-full pl-16 pr-4 py-1.5 rounded border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 border-r border-slate-100">Date</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Action</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Module</th>
                                                        <th className="px-4 py-3 border-r border-slate-100">Description</th>
                                                        <th className="px-4 py-3">IP Address</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {[
                                                        { date: '2026-02-24 10:05:12', action: 'Login', module: 'Auth', desc: 'User logged into the system', ip: '192.168.1.45' },
                                                        { date: '2026-02-24 09:45:30', action: 'Update', module: 'User Management', desc: 'Updated profile information for Abtihal', ip: '192.168.1.45' },
                                                        { date: '2026-02-23 16:20:05', action: 'Create', module: 'Sales', desc: 'Created new invoice INV-2026-001', ip: '192.168.1.45' },
                                                        { date: '2026-02-23 14:10:55', action: 'View', module: 'Reports', desc: 'Viewed Profit & Loss report', ip: '192.168.1.45' },
                                                        { date: '2026-02-23 11:30:22', action: 'Logout', module: 'Auth', desc: 'User logged out', ip: '192.168.1.45' },
                                                    ].map((log, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 border-r border-slate-100 text-slate-500 font-medium">{log.date}</td>
                                                            <td className="px-4 py-3 border-r border-slate-100">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                    log.action === 'Login' ? 'bg-blue-100 text-blue-700' :
                                                                    log.action === 'Update' ? 'bg-amber-100 text-amber-700' :
                                                                    log.action === 'Create' ? 'bg-emerald-100 text-emerald-700' :
                                                                    log.action === 'Logout' ? 'bg-slate-100 text-slate-700' :
                                                                    'bg-indigo-100 text-indigo-700'
                                                                }`}>
                                                                    {log.action}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-700">{log.module}</td>
                                                            <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{log.desc}</td>
                                                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.ip}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                                            <div className="text-sm text-slate-600 font-medium">
                                                Showing 1 to 5 of 5 entries
                                            </div>
                                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                                <button className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 border-r border-slate-200 transition disabled:opacity-50" disabled>Previous</button>
                                                <button className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition">Next</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewUser;
