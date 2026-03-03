import React, { useState } from 'react';
import { FileText, Plus, Search, Edit, Trash2, Save, Layout, Image as ImageIcon, Type, ArrowUpDown, Info, X } from 'lucide-react';
import InvoiceLayoutForm from './InvoiceLayoutForm';

interface InvoiceScheme {
    id: number;
    name: string;
    prefix: string;
    numberingType: string;
    startFrom: number;
    invoiceCount: number;
    numberOfDigits: number;
    isDefault: boolean;
}

interface InvoiceLayout {
    id: number;
    name: string;
    isDefault: boolean;
    usedInLocations: string[];
}

const InvoiceSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'schemes' | 'layouts'>('schemes');
    
    const [schemes, setSchemes] = useState<InvoiceScheme[]>([
        { id: 1, name: 'Atwar', prefix: '2026-', numberingType: 'Sequential', startFrom: 1, invoiceCount: 1617, numberOfDigits: 4, isDefault: false },
        { id: 2, name: 'Knwz Ard Alkhlyj', prefix: 'K2026-', numberingType: 'Sequential', startFrom: 1225, invoiceCount: 1316, numberOfDigits: 4, isDefault: true },
    ]);

    const [layouts, setLayouts] = useState<InvoiceLayout[]>([
        { id: 1, name: 'Default', isDefault: false, usedInLocations: ['CR:1450968'] },
        { id: 2, name: 'Knwz Ard Alkhlyj', isDefault: true, usedInLocations: ['KNWZ ARD ALKHLYJ ALMTHDH CR:1282649'] },
    ]);

    const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);

    const handleSetDefaultScheme = (id: number) => {
        setSchemes(schemes.map(s => ({ ...s, isDefault: s.id === id })));
    };

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invoice Settings</h2>
                <span className="text-sm text-slate-500 mt-1">Manage your invoice settings</span>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button 
                        onClick={() => setActiveTab('schemes')}
                        className={`px-6 py-3 text-sm font-bold ${activeTab === 'schemes' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        Invoice Schemes
                    </button>
                    <button 
                        onClick={() => setActiveTab('layouts')}
                        className={`px-6 py-3 text-sm font-bold ${activeTab === 'layouts' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                    >
                        Invoice Layouts
                    </button>
                </div>

                {activeTab === 'schemes' && (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-base text-slate-700">All your invoice schemes</h3>
                            <button 
                                onClick={() => setIsSchemeModalOpen(true)}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition flex items-center gap-1"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>

                        <div className="p-4 flex justify-end">
                            <div className="relative w-64">
                                <input 
                                    type="text" 
                                    placeholder="Search ..." 
                                    className="w-full px-3 py-1.5 text-sm rounded border border-slate-300 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 border-r border-slate-200">Name <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3 border-r border-slate-200">Prefix <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3 border-r border-slate-200">Numbering Type <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3 border-r border-slate-200">Start from <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3 border-r border-slate-200">Invoice Count <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3 border-r border-slate-200">Number of digits <Info size={12} className="inline text-[#06b6d4] ml-1" /> <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                        <th className="px-4 py-3">Action <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {schemes.map((scheme) => (
                                        <tr key={scheme.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-slate-700">
                                                {scheme.name}
                                                {scheme.isDefault && <span className="ml-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Default</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-700">{scheme.prefix}</td>
                                            <td className="px-4 py-3 text-slate-700">{scheme.numberingType}</td>
                                            <td className="px-4 py-3 text-slate-700">{scheme.startFrom}</td>
                                            <td className="px-4 py-3 text-slate-700">{scheme.invoiceCount}</td>
                                            <td className="px-4 py-3 text-slate-700">{scheme.numberOfDigits}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                                                        <Edit size={12} /> Edit
                                                    </button>
                                                    <button className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed" disabled={scheme.isDefault}>
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                    {!scheme.isDefault ? (
                                                        <button 
                                                            onClick={() => handleSetDefaultScheme(scheme.id)}
                                                            className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50"
                                                        >
                                                            Set as default
                                                        </button>
                                                    ) : (
                                                        <button disabled className="px-2 py-1 text-xs text-slate-400 border border-slate-300 bg-slate-100 rounded cursor-not-allowed">
                                                            Default
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 text-sm text-slate-600">
                            Showing 1 to {schemes.length} of {schemes.length} entries
                        </div>
                    </>
                )}

                {activeTab === 'layouts' && (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-base text-slate-700">All your invoice layouts</h3>
                            <button 
                                onClick={() => setIsLayoutModalOpen(true)}
                                className="bg-[#4F46E5] text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition flex items-center gap-1"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>

                        <div className="p-8 flex flex-wrap gap-12 justify-center md:justify-start min-h-[400px]">
                            {layouts.map((layout) => (
                                <div key={layout.id} className="flex flex-col items-center text-center max-w-[200px]">
                                    <div className="mb-2 relative">
                                        <FileText size={48} className="text-blue-400" strokeWidth={1.5} />
                                        {layout.isDefault && (
                                            <span className="absolute -right-12 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <h4 
                                        onClick={() => setIsLayoutModalOpen(true)}
                                        className="text-sm font-bold text-blue-600 mb-1 cursor-pointer hover:underline"
                                    >
                                        {layout.name}
                                    </h4>
                                    <p className="text-xs font-bold text-slate-800 mb-1">Used in locations:</p>
                                    <p className="text-xs text-slate-600">
                                        {layout.usedInLocations.join(', ')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Add New Invoice Scheme Modal */}
            {isSchemeModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-slate-200">
                            <h3 className="text-xl text-[#333333]">Add new invoice scheme</h3>
                            <button onClick={() => setIsSchemeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="flex gap-4 mb-6">
                                <div className="bg-[#D1D5DB] text-[#374151] p-6 text-xl text-center flex-1">
                                    FORMAT:<br/>XXXX
                                </div>
                                <div className="bg-[#E5E7EB] text-[#374151] p-6 text-xl text-center flex-1">
                                    FORMAT:<br/>2026-XXXX
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <span className="font-bold text-slate-800">Preview:</span>
                                    <span className="text-slate-600">Not selected</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Name:*</label>
                                <input 
                                    type="text" 
                                    placeholder="Name" 
                                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Numbering Type:* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm text-slate-600">
                                    <option>Sequential</option>
                                </select>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                            <button 
                                onClick={() => setIsSchemeModalOpen(false)}
                                className="bg-[#5000ff] text-white px-6 py-2 rounded font-bold hover:bg-[#4000cc] transition"
                            >
                                Save
                            </button>
                            <button 
                                onClick={() => setIsSchemeModalOpen(false)}
                                className="bg-[#374151] text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Invoice Layout Modal */}
            {isLayoutModalOpen && (
                <InvoiceLayoutForm onClose={() => setIsLayoutModalOpen(false)} />
            )}
        </div>
    );
};

export default InvoiceSettings;
