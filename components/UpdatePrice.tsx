import React, { useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Info } from 'lucide-react';

const UpdatePrice: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle file upload logic here
    console.log("Uploading file:", file);
    alert("File uploaded (mock)");
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 md:p-10 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter mb-2">Update <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Price</span></h2>
            <p className="text-slate-400 text-base md:text-lg font-light max-w-xl">
                Bulk update product prices via CSV export/import.
            </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            
            {/* Export Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                        <Download size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Export Prices</h3>
                        <p className="text-sm text-slate-500">Download current price list</p>
                    </div>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Download the current product price list in Excel/CSV format. 
                        Use this file to make bulk changes to product costs, margins, and selling prices.
                    </p>
                    <button className="w-full py-4 bg-white border-2 border-blue-100 text-blue-600 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm">
                        <FileSpreadsheet size={20} />
                        Export Product Prices
                    </button>
                </div>
            </div>

            {/* Import Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                        <Upload size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Import Changes</h3>
                        <p className="text-sm text-slate-500">Upload modified price list</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select File</label>
                        <input 
                            type="file" 
                            accept=".csv, .xlsx"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2.5 file:px-4
                                file:rounded-xl file:border-0
                                file:text-sm file:font-bold
                                file:bg-purple-50 file:text-purple-700
                                hover:file:bg-purple-100
                                transition-all cursor-pointer"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={!file}
                        className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Upload size={20} />
                        Update Prices
                    </button>
                </form>
            </div>
        </div>

        {/* Instructions */}
        <div className="mt-12 p-6 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-start gap-4">
                <Info className="text-amber-600 shrink-0 mt-1" size={24} />
                <div className="space-y-3">
                    <h4 className="font-bold text-amber-900">Instructions & Guidelines</h4>
                    <ul className="space-y-2 text-sm text-amber-800 font-medium">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                            Export product prices by clicking on the "Export Product Prices" button above.
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                            Make changes in product price including tax & selling price groups.
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                            <span className="font-bold">Do not change</span> any product name, SKU, or headers to ensure data integrity.
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
                            After making changes, save the file and upload it using the form on the right.
                        </li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrice;