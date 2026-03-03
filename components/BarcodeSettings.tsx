import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, ArrowUpDown } from 'lucide-react';

interface BarcodeSetting {
    id: number;
    name: string;
    description: string;
}

const BarcodeSettings: React.FC = () => {
    const [view, setView] = useState<'list' | 'add'>('list');
    const [settingsList, setSettingsList] = useState<BarcodeSetting[]>([]);

    const handleSave = () => {
        setView('list');
    };

    if (view === 'add') {
        return (
            <div className="space-y-4 animate-fade-in pb-10">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add barcode sticker setting</h2>
                </div>

                <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Sticker Sheet setting Name:*</label>
                            <input type="text" placeholder="Sticker Sheet setting Name" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Sticker Sheet setting Description</label>
                            <textarea placeholder="Sticker Sheet setting Description" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm h-24"></textarea>
                        </div>
                        
                        <div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                Continous feed or rolls
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Additional top margin (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⬆</span>
                                    <input type="number" defaultValue={0} className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Additional left margin (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⬅</span>
                                    <input type="number" defaultValue={0} className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Width of sticker (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↔</span>
                                    <input type="text" placeholder="Width of sticker" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Height of sticker (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↕</span>
                                    <input type="text" placeholder="Height of sticker" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Paper width (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↔</span>
                                    <input type="text" placeholder="Paper width" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Paper height (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↕</span>
                                    <input type="text" placeholder="Paper height" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Stickers in one row:*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⋯</span>
                                    <input type="text" placeholder="Stickers in one row" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                            <div className="hidden md:block"></div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Distance between two rows (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↕</span>
                                    <input type="number" defaultValue={0} className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Distance between two columns (In Inches):*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">↔</span>
                                    <input type="number" defaultValue={0} className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">No. of Stickers per sheet:*</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">⊞</span>
                                    <input type="text" placeholder="No. of Stickers per sheet" className="w-full pl-8 pr-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                Set as default
                            </label>
                        </div>

                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={handleSave}
                                className="bg-[#5000ff] text-white px-8 py-2 rounded font-bold hover:bg-[#4000cc] transition"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Barcodes</h2>
                <span className="text-sm text-slate-500 mt-1">Manage your barcode settings</span>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-base text-slate-700">All your barcode settings</h3>
                    <button 
                        onClick={() => setView('add')}
                        className="bg-[#4F46E5] text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition flex items-center gap-1"
                    >
                        <Plus size={16} /> Add new setting
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
                                <th className="px-4 py-3 border-r border-slate-200">Sticker Sheet setting Name <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Sticker Sheet setting Description <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {settingsList.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-center text-slate-500">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                settingsList.map((setting) => (
                                    <tr key={setting.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-700">{setting.name}</td>
                                        <td className="px-4 py-3 text-slate-700">{setting.description}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                                                    <Edit size={12} /> Edit
                                                </button>
                                                <button className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                                                    <Trash2 size={12} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="p-4 border-t border-slate-100 text-sm text-slate-600">
                    Showing 0 to 0 of 0 entries
                </div>
            </div>
        </div>
    );
};

export default BarcodeSettings;
