
import React, { useEffect, useMemo, useState } from 'react';
import { 
    ArrowLeft, User,
    Edit, FileText, ChevronDown,
    Paperclip, Plus, FileSpreadsheet,
    Printer, Columns, FileDown, UserCheck
} from 'lucide-react';

import { ContactDocument, useGlobalContext } from '@/context/GlobalContext';
import { printDocument } from '@/utils/printUtils';

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

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const downloadBlob = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const ViewUser: React.FC<ViewUserProps> = ({ userId, onNavigate }) => {
    const { users, updateUser, currentUser, activityLogs } = useGlobalContext();
    const [activeTab, setActiveTab] = useState('user_info');
    const [selectedUserId, setSelectedUserId] = useState(userId);
    const [newDocHeading, setNewDocHeading] = useState('');
    const [docSearch, setDocSearch] = useState('');
    const [docEntries, setDocEntries] = useState(25);
    const [docPage, setDocPage] = useState(1);
    const [showDocMetaColumns, setShowDocMetaColumns] = useState(true);
    const [activitySearch, setActivitySearch] = useState('');
    const [activityEntries, setActivityEntries] = useState(25);
    const [activityPage, setActivityPage] = useState(1);
    const [showActivityMetaColumns, setShowActivityMetaColumns] = useState(true);

    const user = users.find(u => u.id === selectedUserId) || users.find(u => u.id === userId);

    useEffect(() => {
        setSelectedUserId(userId);
    }, [userId]);

    useEffect(() => {
        setDocPage(1);
        setActivityPage(1);
        setDocSearch('');
        setActivitySearch('');
        setNewDocHeading('');
    }, [selectedUserId]);

    const documentsData = useMemo(() => {
        const docs = Array.isArray(user?.documents) ? user.documents : [];
        return docs
            .map((doc) => ({
                id: String(doc.id || '').trim(),
                heading: String(doc.heading || '').trim(),
                addedBy: String(doc.addedBy || '').trim(),
                createdAt: String(doc.createdAt || '').trim(),
                updatedAt: String(doc.updatedAt || '').trim(),
            }))
            .filter((doc) => doc.id && doc.heading)
            .sort((left, right) => Date.parse(right.updatedAt || right.createdAt || '') - Date.parse(left.updatedAt || left.createdAt || ''));
    }, [user?.documents]);

    const filteredDocuments = useMemo(() => {
        const query = normalizeText(docSearch);
        if (!query) return documentsData;
        return documentsData.filter((doc) =>
            normalizeText(`${doc.heading} ${doc.addedBy} ${doc.createdAt} ${doc.updatedAt}`).includes(query),
        );
    }, [documentsData, docSearch]);

    const docTotalPages = Math.max(1, Math.ceil(filteredDocuments.length / Math.max(1, docEntries)));
    const docStartIndex = (docPage - 1) * Math.max(1, docEntries);
    const docRows = filteredDocuments.slice(docStartIndex, docStartIndex + Math.max(1, docEntries));

    useEffect(() => {
        if (docPage > docTotalPages) setDocPage(docTotalPages);
    }, [docPage, docTotalPages]);

    const userActivityLogs = useMemo(() => {
        if (!user) return [];
        const expectedName = normalizeText(user.name);
        const expectedUsername = normalizeText(user.username);
        return activityLogs
            .filter((log) => {
                const logUser = normalizeText(log.user);
                if (!logUser) return false;
                return (
                    logUser === expectedName ||
                    logUser === expectedUsername ||
                    (expectedName && logUser.includes(expectedName)) ||
                    (expectedUsername && logUser.includes(expectedUsername))
                );
            })
            .sort((left, right) => Date.parse(right.date || '') - Date.parse(left.date || ''));
    }, [activityLogs, user]);

    const filteredActivityLogs = useMemo(() => {
        const query = normalizeText(activitySearch);
        if (!query) return userActivityLogs;
        return userActivityLogs.filter((log) =>
            normalizeText(`${log.date} ${log.action} ${log.module} ${log.description} ${log.ipAddress || ''}`).includes(query),
        );
    }, [userActivityLogs, activitySearch]);

    const activityTotalPages = Math.max(1, Math.ceil(filteredActivityLogs.length / Math.max(1, activityEntries)));
    const activityStartIndex = (activityPage - 1) * Math.max(1, activityEntries);
    const activityRows = filteredActivityLogs.slice(activityStartIndex, activityStartIndex + Math.max(1, activityEntries));

    useEffect(() => {
        if (activityPage > activityTotalPages) setActivityPage(activityTotalPages);
    }, [activityPage, activityTotalPages]);

    const persistDocuments = (nextDocuments: ContactDocument[]) => {
        if (!user) return;
        updateUser({ ...user, documents: nextDocuments });
    };

    const handleAddDocument = () => {
        const heading = newDocHeading.trim();
        if (!heading || !user) return;
        const now = new Date().toISOString();
        const nextDocuments: ContactDocument[] = [
            ...documentsData,
            {
                id: `UDOC-${Date.now()}`,
                heading,
                addedBy: currentUser?.name || currentUser?.username || 'System',
                createdAt: now,
                updatedAt: now,
            },
        ];
        persistDocuments(nextDocuments);
        setNewDocHeading('');
    };

    const handleDeleteDocument = (documentId: string) => {
        if (!window.confirm('Delete this document?')) return;
        const nextDocuments = documentsData.filter((doc) => doc.id !== documentId);
        persistDocuments(nextDocuments);
    };

    const exportDocumentsCsv = () => {
        const header = ['Heading', 'Added By', 'Created At', 'Updated At'];
        const rows = filteredDocuments.map((doc) => [doc.heading, doc.addedBy, doc.createdAt, doc.updatedAt].map(escapeCsv).join(','));
        downloadBlob(`user-${selectedUserId}-documents.csv`, [header.map(escapeCsv).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
    };

    const exportDocumentsExcel = () => {
        const header = ['Heading', 'Added By', 'Created At', 'Updated At'];
        const rows = filteredDocuments.map((doc) => [doc.heading, doc.addedBy, doc.createdAt, doc.updatedAt].join('\t'));
        downloadBlob(`user-${selectedUserId}-documents.xls`, [header.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
    };

    const exportActivitiesCsv = () => {
        const header = ['Date', 'Action', 'Module', 'Description', 'IP Address'];
        const rows = filteredActivityLogs.map((log) => [
            log.date,
            log.action,
            log.module,
            log.description,
            log.ipAddress || '--',
        ].map(escapeCsv).join(','));
        downloadBlob(`user-${selectedUserId}-activities.csv`, [header.map(escapeCsv).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
    };

    const exportActivitiesExcel = () => {
        const header = ['Date', 'Action', 'Module', 'Description', 'IP Address'];
        const rows = filteredActivityLogs.map((log) => [
            log.date,
            log.action,
            log.module,
            log.description,
            log.ipAddress || '--',
        ].join('\t'));
        downloadBlob(`user-${selectedUserId}-activities.xls`, [header.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
    };

    const printDocuments = () => {
        printDocument({
            title: `User Documents - ${user?.name || selectedUserId}`,
            subtitle: `Rows: ${filteredDocuments.length}`,
            businessName: 'ATWAR BSS',
            businessAddress: '',
            printedBy: currentUser?.name || currentUser?.username || 'System',
            columns: [
                { label: 'Heading' },
                { label: 'Added By', width: '110px' },
                { label: 'Created At', width: '120px' },
                { label: 'Updated At', width: '120px' },
            ],
            rows: filteredDocuments.map((doc) => [
                doc.heading || '--',
                doc.addedBy || '--',
                doc.createdAt || '--',
                doc.updatedAt || '--',
            ]),
            stats: [
                { label: 'Total Documents', value: String(filteredDocuments.length), color: 'blue' },
            ],
        });
    };

    const printActivities = () => {
        printDocument({
            title: `User Activities - ${user?.name || selectedUserId}`,
            subtitle: `Rows: ${filteredActivityLogs.length}`,
            businessName: 'ATWAR BSS',
            businessAddress: '',
            printedBy: currentUser?.name || currentUser?.username || 'System',
            columns: [
                { label: 'Date', width: '120px' },
                { label: 'Action', width: '95px' },
                { label: 'Module', width: '95px' },
                { label: 'Description' },
                { label: 'IP Address', width: '95px' },
            ],
            rows: filteredActivityLogs.map((log) => [
                log.date || '--',
                log.action || '--',
                log.module || '--',
                log.description || '--',
                log.ipAddress || '--',
            ]),
            stats: [
                { label: 'Total Activities', value: String(filteredActivityLogs.length), color: 'green' },
            ],
        });
    };

    const exportDocumentsPdf = async () => {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const left = 40;
        let y = 44;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`User Documents - ${user?.name || selectedUserId}`, left, y);
        y += 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
        y += 18;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Heading | Added By | Created At | Updated At', left, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        filteredDocuments.forEach((docRow, index) => {
            const line = `${index + 1}. ${docRow.heading} | ${docRow.addedBy || '--'} | ${docRow.createdAt || '--'} | ${docRow.updatedAt || '--'}`;
            const wrapped = doc.splitTextToSize(line, 515);
            if (y + (wrapped.length * 12) > 800) {
                doc.addPage();
                y = 44;
            }
            doc.text(wrapped, left, y);
            y += (wrapped.length * 12) + 2;
        });
        doc.save(`user-${selectedUserId}-documents.pdf`);
    };

    const exportActivitiesPdf = async () => {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const left = 40;
        let y = 44;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(`User Activities - ${user?.name || selectedUserId}`, left, y);
        y += 18;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
        y += 18;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Date | Action | Module | Description | IP Address', left, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
        filteredActivityLogs.forEach((log, index) => {
            const line = `${index + 1}. ${log.date} | ${log.action} | ${log.module} | ${log.description} | ${log.ipAddress || '--'}`;
            const wrapped = doc.splitTextToSize(line, 515);
            if (y + (wrapped.length * 12) > 800) {
                doc.addPage();
                y = 44;
            }
            doc.text(wrapped, left, y);
            y += (wrapped.length * 12) + 2;
        });
        doc.save(`user-${selectedUserId}-activities.pdf`);
    };

    const userData = {
        id: user?.id || userId,
        name: user?.name || 'Unknown User',
        roleLabel: user?.role || 'Unknown Role',
        username: user?.username || 'unknown',
        email: user?.email || '',
        isActive: user?.status === 'Active',
        commissionPercent: user?.commissionPercent != null ? `${user.commissionPercent}%` : '—',
        maxDiscountPercent: user?.maxDiscountPercent ? `${user.maxDiscountPercent}%` : '',
        allowedContacts: user?.allowSelectedContacts ? 'Selected' : 'All',
        allowLogin: user?.allowLogin !== false ? 'Yes' : 'No',
        serviceStaffPin: user?.enableServiceStaffPin ? 'Enabled' : 'Disabled',
        accessLocations: (user?.accessLocations && user.accessLocations.length > 0) ? user.accessLocations.join(', ') : 'All Locations',
        dob: user?.dob || '',
        gender: user?.gender || '',
        maritalStatus: user?.maritalStatus || '',
        bloodGroup: user?.bloodGroup || '',
        mobile: user?.mobile || '',
        altContact: user?.altContact || '',
        familyContact: user?.familyContact || '',
        idProofName: user?.idProofName || '',
        idProofNumber: user?.idProofNumber || '',
        facebook: user?.facebook || '',
        twitter: user?.twitter || '',
        social1: user?.social1 || '',
        social2: user?.social2 || '',
        guardianName: user?.guardianName || '',
        permanentAddress: user?.permanentAddress || '',
        currentAddress: user?.currentAddress || '',
        bankDetails: {
            accountHolder: user?.accountHolder || '',
            bankName: user?.bankName || '',
            branch: user?.branch || '',
            accountNumber: user?.accountNumber || '',
            bankIdentifier: user?.bankIdentifierCode || '',
            taxPayerId: user?.taxPayerId || ''
        }
    };

    const avatarInitials = userData.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U';

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => onNavigate('users')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 rounded-2xl shadow-md">
                        <UserCheck size={20} className="text-white" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">View User</h2>
                    </div>
                </div>
                <div className="relative w-72">
                    <select
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                    >
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* Left Sidebar: Profile Summary */}
                <div className="xl:col-span-3">
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative p-8 flex flex-col items-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
                        <div className="w-28 h-28 rounded-full bg-indigo-100 border-4 border-indigo-50 flex items-center justify-center text-4xl font-bold text-indigo-500 mb-4">
                            {avatarInitials}
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-1">{userData.name}</h3>
                        <p className="text-slate-500 text-sm mb-6">{userData.roleLabel}</p>
                        
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
                                <span className={`px-2 py-0.5 text-white text-[10px] font-bold rounded uppercase ${userData.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                    {userData.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => onNavigate(`edit-user/${userData.id}`)}
                            className="w-full mt-8 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                        >
                            <Edit size={16} /> Edit
                        </button>
                    </div>
                </div>

                {/* Right Area: Detailed Info */}
                <div className="xl:col-span-9">
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative flex flex-col">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
                        {/* Tabs Navigation */}
                        <div className="flex border-b border-slate-100 bg-slate-50/30">
                            <TabButton id="user_info" label="User Information" icon={User} activeTab={activeTab} setActiveTab={setActiveTab} />
                            <TabButton id="docs" label="Documents & Notes" icon={Paperclip} activeTab={activeTab} setActiveTab={setActiveTab} />
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
                                            <span className="text-sm text-slate-600">{userData.commissionPercent || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Max Discount (%):</span>
                                            <span className="text-sm text-slate-600">{userData.maxDiscountPercent || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Allowed Contacts:</span>
                                            <span className="text-sm text-slate-600">{userData.allowedContacts}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Allow Login:</span>
                                            <span className="text-sm text-slate-600">{userData.allowLogin}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-slate-900">Service Staff PIN:</span>
                                            <span className="text-sm text-slate-600">{userData.serviceStaffPin}</span>
                                        </div>
                                        <div className="flex items-center gap-2 md:col-span-2">
                                            <span className="text-sm font-black text-slate-900">Access Locations:</span>
                                            <span className="text-sm text-slate-600">{userData.accessLocations}</span>
                                        </div>
                                    </div>

                                    {/* More Informations */}
                                    <div className="space-y-6">
                                        <h4 className="text-lg font-bold text-slate-700 border-b border-slate-100 pb-2">More Informations</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-12">
                                            <InfoField label="Date of birth" value={userData.dob} />
                                            <InfoField label="Facebook Link" value={userData.facebook} />
                                            
                                            <InfoField label="Gender" value={userData.gender} />
                                            <InfoField label="Twitter Link" value={userData.twitter} />
                                            
                                            <InfoField label="Marital Status" value={userData.maritalStatus} />
                                            <InfoField label="Social Media 1" value={userData.social1} />
                                            
                                            <InfoField label="Blood Group" value={userData.bloodGroup} />
                                            <InfoField label="Social Media 2" value={userData.social2} />
                                            
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
                                    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-end">
                                        <input
                                            type="text"
                                            value={newDocHeading}
                                            onChange={(e) => setNewDocHeading(e.target.value)}
                                            placeholder="Document heading"
                                            className="w-full md:w-80 px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                                        />
                                        <button onClick={handleAddDocument} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2 justify-center">
                                            Add Document <Plus size={16} />
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-center bg-white">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <span>Show</span>
                                                <select value={docEntries} onChange={(e) => setDocEntries(Number(e.target.value) || 25)} className="border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                <span>entries</span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <button onClick={exportDocumentsCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileText size={14} /> Export CSV
                                                </button>
                                                <button onClick={exportDocumentsExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileSpreadsheet size={14} /> Export Excel
                                                </button>
                                                <button onClick={printDocuments} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Printer size={14} /> Print
                                                </button>
                                                <button onClick={() => setShowDocMetaColumns((value) => !value)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Columns size={14} /> {showDocMetaColumns ? 'Hide timestamps' : 'Show timestamps'}
                                                </button>
                                                <button onClick={exportDocumentsPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileDown size={14} /> Export PDF
                                                </button>
                                            </div>

                                            <div className="relative w-full md:w-64">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Search ...</span>
                                                <input 
                                                    type="text"
                                                    value={docSearch}
                                                    onChange={(e) => setDocSearch(e.target.value)}
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
                                                        {showDocMetaColumns && <th className="px-4 py-3 border-r border-slate-100">Created At</th>}
                                                        {showDocMetaColumns && <th className="px-4 py-3">Updated At</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {docRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={showDocMetaColumns ? 5 : 3} className="px-4 py-8 text-center text-slate-500 bg-slate-50/30 italic">
                                                                No data available in table
                                                            </td>
                                                        </tr>
                                                    ) : docRows.map((doc) => (
                                                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 border-r border-slate-100">
                                                                <button onClick={() => handleDeleteDocument(doc.id)} className="px-2 py-1 rounded bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100">
                                                                    Delete
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-700">{doc.heading}</td>
                                                            <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{doc.addedBy || '--'}</td>
                                                            {showDocMetaColumns && <td className="px-4 py-3 border-r border-slate-100 text-slate-500 text-xs">{doc.createdAt || '--'}</td>}
                                                            {showDocMetaColumns && <td className="px-4 py-3 text-slate-500 text-xs">{doc.updatedAt || '--'}</td>}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                                            <div className="text-sm text-slate-600 font-medium">
                                                Showing {filteredDocuments.length === 0 ? 0 : docStartIndex + 1} to {Math.min(docStartIndex + docEntries, filteredDocuments.length)} of {filteredDocuments.length} entries
                                            </div>
                                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                                <button onClick={() => setDocPage((page) => Math.max(1, page - 1))} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 border-r border-slate-200 transition disabled:opacity-50" disabled={docPage <= 1}>Previous</button>
                                                <button onClick={() => setDocPage((page) => Math.min(docTotalPages, page + 1))} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50" disabled={docPage >= docTotalPages}>Next</button>
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
                                                <select value={activityEntries} onChange={(e) => setActivityEntries(Number(e.target.value) || 25)} className="border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                <span>entries</span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <button onClick={exportActivitiesCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileText size={14} /> Export CSV
                                                </button>
                                                <button onClick={exportActivitiesExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileSpreadsheet size={14} /> Export Excel
                                                </button>
                                                <button onClick={printActivities} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Printer size={14} /> Print
                                                </button>
                                                <button onClick={() => setShowActivityMetaColumns((value) => !value)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <Columns size={14} /> {showActivityMetaColumns ? 'Hide extra cols' : 'Show extra cols'}
                                                </button>
                                                <button onClick={exportActivitiesPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition">
                                                    <FileDown size={14} /> Export PDF
                                                </button>
                                            </div>

                                            <div className="relative w-full md:w-64">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Search ...</span>
                                                <input 
                                                    type="text"
                                                    value={activitySearch}
                                                    onChange={(e) => setActivitySearch(e.target.value)}
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
                                                        {showActivityMetaColumns && <th className="px-4 py-3 border-r border-slate-100">Module</th>}
                                                        <th className="px-4 py-3 border-r border-slate-100">Description</th>
                                                        {showActivityMetaColumns && <th className="px-4 py-3">IP Address</th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {activityRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={showActivityMetaColumns ? 5 : 3} className="px-4 py-8 text-center text-slate-500 bg-slate-50/30 italic">
                                                                No activity found for this user.
                                                            </td>
                                                        </tr>
                                                    ) : activityRows.map((log) => (
                                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="px-4 py-3 border-r border-slate-100 text-slate-500 font-medium">{log.date}</td>
                                                            <td className="px-4 py-3 border-r border-slate-100">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                    normalizeText(log.action).includes('login') ? 'bg-blue-100 text-blue-700' :
                                                                    normalizeText(log.action).includes('update') ? 'bg-amber-100 text-amber-700' :
                                                                    normalizeText(log.action).includes('create') || normalizeText(log.action).includes('add') ? 'bg-emerald-100 text-emerald-700' :
                                                                    normalizeText(log.action).includes('delete') ? 'bg-rose-100 text-rose-700' :
                                                                    'bg-indigo-100 text-indigo-700'
                                                                }`}>
                                                                    {log.action}
                                                                </span>
                                                            </td>
                                                            {showActivityMetaColumns && <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-700">{log.module}</td>}
                                                            <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{log.description}</td>
                                                            {showActivityMetaColumns && <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.ipAddress || '--'}</td>}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                                            <div className="text-sm text-slate-600 font-medium">
                                                Showing {filteredActivityLogs.length === 0 ? 0 : activityStartIndex + 1} to {Math.min(activityStartIndex + activityEntries, filteredActivityLogs.length)} of {filteredActivityLogs.length} entries
                                            </div>
                                            <div className="flex items-center border border-slate-200 rounded overflow-hidden">
                                                <button onClick={() => setActivityPage((page) => Math.max(1, page - 1))} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-50 border-r border-slate-200 transition disabled:opacity-50" disabled={activityPage <= 1}>Previous</button>
                                                <button onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition disabled:opacity-50" disabled={activityPage >= activityTotalPages}>Next</button>
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
