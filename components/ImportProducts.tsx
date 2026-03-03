import React, { useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronRight, FileText, Info } from 'lucide-react';

const ImportProducts: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const columns = [
    { num: 1, name: 'Product Name', required: true, instruction: 'Name of the product' },
    { num: 2, name: 'Brand', required: false, instruction: 'Name of the brand' },
    { num: 3, name: 'Unit', required: true, instruction: 'Name of the unit' },
    { num: 4, name: 'Category', required: false, instruction: 'Name of the Category' },
    { num: 5, name: 'Sub category', required: false, instruction: 'Name of the Sub-Category' },
    { num: 6, name: 'SKU', required: false, instruction: 'Product SKU. If blank an SKU will be automatically generated' },
    { num: 7, name: 'Barcode Type', required: false, instruction: 'Barcode Type for the product.\nCurrently supported: C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14' },
    { num: 8, name: 'Manage Stock?', required: false, instruction: 'Enable or disable stock management\n1 = Yes\n0 = No' },
    { num: 9, name: 'Alert quantity', required: false, instruction: 'Alert quantity' },
    { num: 10, name: 'Expires in', required: false, instruction: 'Product expiry period (Only in numbers)' },
    { num: 11, name: 'Expiry Period Unit', required: false, instruction: 'Unit for the expiry period\nAvailable Options: days, months' },
    { num: 12, name: 'Applicable Tax', required: false, instruction: 'Name of the Tax Rate' },
    { num: 13, name: 'Selling Price Tax Type', required: true, instruction: 'Selling Price Tax Type\nAvailable Options: inclusive, exclusive' },
    { num: 14, name: 'Product Type', required: true, instruction: 'Product Type\nAvailable Options: single, variable' },
    { num: 15, name: 'Variation Name', required: 'conditional', instruction: 'Name of the variation (Ex: Size, Color etc )' },
    { num: 16, name: 'Variation Values', required: 'conditional', instruction: 'Values for the variation separated by |' },
    { num: 17, name: 'Variation SKUs', required: false, instruction: 'SKUs of each variation separated by | if product type is variable' },
    { num: 18, name: 'Purchase Price (Including Tax)', required: false, instruction: 'Purchase Price (Including Tax) (Only in numbers)' },
    { num: 19, name: 'Purchase Price (Excluding Tax)', required: false, instruction: 'Purchase Price (Excluding Tax) (Only in numbers)' },
    { num: 20, name: 'Profit Margin %', required: false, instruction: 'Profit Margin (Only in numbers)' },
    { num: 21, name: 'Selling Price', required: false, instruction: 'Selling Price (Only in numbers)' },
    { num: 22, name: 'Opening Stock', required: false, instruction: 'Opening Stock (Only in numbers)' },
    { num: 23, name: 'Opening Stock Location', required: false, instruction: 'Name of the business location' },
    { num: 24, name: 'Expiry Date', required: false, instruction: 'Stock Expiry Date\nFormat: mm-dd-yyyy' },
    { num: 25, name: 'Enable Product description, IMEI or Serial Number', required: false, instruction: '1 = Yes\n0 = No' },
    { num: 26, name: 'Weight', required: false, instruction: 'Optional' },
    { num: 27, name: 'Rack', required: false, instruction: 'Rack details separated by | for different business locations serially' },
    { num: 28, name: 'Row', required: false, instruction: 'Row details separated by | for different business locations serially' },
    { num: 29, name: 'Position', required: false, instruction: 'Position details separated by | for different business locations serially' },
    { num: 30, name: 'Image', required: false, instruction: 'Image name with extension.\n(Image name must be uploaded to the server public/uploads/img)' },
    { num: 31, name: 'Product Description', required: false, instruction: '' },
    { num: 32, name: 'Custom Field1', required: false, instruction: '' },
    { num: 33, name: 'Custom Field2', required: false, instruction: '' },
    { num: 34, name: 'Custom Field3', required: false, instruction: '' },
    { num: 35, name: 'Custom Field4', required: false, instruction: '' },
    { num: 36, name: 'Not for selling', required: false, instruction: '1 = Yes\n0 = No' },
    { num: 37, name: 'Product locations', required: false, instruction: 'Comma separated string of business location names where product will be available' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Products</h2>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>
        
        {/* File Upload Section */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-start border-b border-slate-100 pb-8">
             <div className="w-full md:w-1/2 space-y-3">
                 <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">File To Import:</label>
                 <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                        <span className="px-6 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-2">
                            <Upload size={16} /> Choose File
                        </span>
                        <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
                    </label>
                    <span className="text-sm text-slate-500 italic">
                        {selectedFile ? selectedFile.name : 'No file chosen'}
                    </span>
                 </div>
                 {selectedFile && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold mt-2">
                        <CheckCircle2 size={14} /> Ready to upload
                    </div>
                 )}
             </div>
             
             <div className="w-full md:w-1/2 flex justify-end items-center h-full gap-4 mt-auto pt-6">
                 <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95">
                      Submit Import
                  </button>
             </div>
        </div>
        
        <div className="mb-10">
            <button className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95">
                <Download size={16} /> Download template file
            </button>
        </div>

        {/* Instructions Table */}
        <div className="border rounded-xl overflow-hidden border-slate-200">
             <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-200">
                 <h3 className="text-lg font-bold text-slate-800">Instructions</h3>
                 <p className="text-sm text-slate-500 mt-1">Follow the instructions carefully before importing the file. The columns of the file should be in the following order.</p>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                     <thead className="bg-white text-xs uppercase text-slate-500 font-extrabold border-b border-slate-200">
                         <tr>
                             <th className="px-6 py-4 w-32">Col #</th>
                             <th className="px-6 py-4 w-64">Column Name</th>
                             <th className="px-6 py-4">Instruction</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-sm">
                         {columns.map((col) => (
                             <tr key={col.num} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4 text-slate-400 font-mono font-medium">{col.num}</td>
                                 <td className="px-6 py-4 font-bold text-slate-700">
                                     {col.name} 
                                     {col.required === true && <span className="text-[10px] text-red-500 font-bold ml-1 italic">(Required)</span>}
                                     {col.required === false && <span className="text-[10px] text-slate-400 font-normal ml-1 italic">(Optional)</span>}
                                 </td>
                                 <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed text-xs font-medium">
                                     {col.instruction}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>

      </div>
    </div>
  );
};

export default ImportProducts;