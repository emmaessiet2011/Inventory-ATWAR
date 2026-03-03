import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';

interface Printer {
    id: number;
    name: string;
    connectionType: string;
    capabilityProfile: string;
    charactersPerLine: number;
    ipAddress: string;
    port: string;
    path: string;
}

const Printers: React.FC = () => {
    const [view, setView] = useState<'list' | 'add'>('list');
    const [printersList, setPrintersList] = useState<Printer[]>([]);

    const handleSave = () => {
        setView('list');
    };

    if (view === 'add') {
        return (
            <div className="space-y-4 animate-fade-in pb-10">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Add Printer</h2>
                </div>

                <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Printer Name:*</label>
                            <input type="text" placeholder="Short Descriptive Name to recognize printer" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Connection Type:*</label>
                            <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>Network</option>
                                <option>Windows</option>
                                <option>Linux</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1">
                                Capability Profile:*
                                <span className="text-blue-500 text-xs bg-blue-50 rounded-full w-4 h-4 flex items-center justify-center cursor-help">i</span>
                            </label>
                            <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>Default</option>
                                <option>Simple</option>
                                <option>Star</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Characters per line:*</label>
                            <input type="number" defaultValue={42} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">IP Address:*</label>
                            <input type="text" placeholder="IP address for connecting to the printer" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Port:*</label>
                            <input type="text" defaultValue="9100" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            <p className="text-xs text-slate-500 mt-1">Most printer works on port 9100</p>
                        </div>

                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={handleSave}
                                className="bg-[#1d4ed8] text-white px-8 py-2 rounded font-bold hover:bg-blue-800 transition"
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
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Printers</h2>
                <span className="text-sm text-slate-500 mt-1">Manage your Printers</span>
            </div>

            <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-base text-slate-700">All configured Printers</h3>
                    <button 
                        onClick={() => setView('add')}
                        className="bg-[#4F46E5] text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition flex items-center gap-1"
                    >
                        <Plus size={16} /> Add Printer
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
                                <th className="px-4 py-3 border-r border-slate-200">Printer Name <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Connection Type <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Capability Profile <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Characters per line <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">IP Address <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Port <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3 border-r border-slate-200">Path <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                                <th className="px-4 py-3">Action <span className="text-slate-300 ml-1 float-right">⇅</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {printersList.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-3 text-center text-slate-500">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                printersList.map((printer) => (
                                    <tr key={printer.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-700">{printer.name}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.connectionType}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.capabilityProfile}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.charactersPerLine}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.ipAddress}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.port}</td>
                                        <td className="px-4 py-3 text-slate-700">{printer.path}</td>
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

export default Printers;
