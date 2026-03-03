import React, { useState } from 'react';
import { 
  Download, Upload, FileSpreadsheet, 
  AlertCircle, CheckCircle2, ChevronRight, 
  FileText, Info
} from 'lucide-react';

interface ImportSalesProps {
    onNavigate?: (page: string) => void;
}

const ImportSales: React.FC<ImportSalesProps> = ({ onNavigate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const columns = [
    { name: 'Invoice No.', instruction: '' },
    { name: 'Customer name', instruction: '' },
    { name: 'Customer Phone number', instruction: 'Either customer email id or phone number required' },
    { name: 'Customer Email', instruction: 'Either customer email id or phone number required' },
    { name: 'Sale Date', instruction: "Sale date time format should be 'Y-m-d H:i:s' (2020-07-15 17:45:32)" },
    { name: 'Product Name', instruction: 'Either product name (for single and combo only) or product sku required' },
    { name: 'Product SKU', instruction: 'Either product name (for single and combo only) or product sku required' },
    { name: 'Quantity', instruction: 'Required' },
    { name: 'Product Unit', instruction: '' },
    { name: 'Unit Price', instruction: '' },
    { name: 'Item Tax', instruction: '' },
    { name: 'Item Discount', instruction: '' },
    { name: 'Item Description', instruction: '' },
    { name: 'Order Total', instruction: '' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Sales</h2>
      </div>

      {/* 1. File Upload Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
             <div className="w-full md:w-1/2">
                 <label className="block text-sm font-bold text-slate-900 mb-2">File To Import:</label>
                 <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                        <span className="px-4 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-200 transition-colors">
                            Choose File
                        </span>
                        <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
                    </label>
                    <span className="text-sm text-slate-500">
                        {selectedFile ? selectedFile.name : 'No file chosen'}
                    </span>
                 </div>
             </div>
             
             <div>
                 <button className="px-6 py-2 bg-[#6200ea] text-white rounded-md text-sm font-bold shadow-md hover:bg-[#5000ca] transition-all">
                      Upload and review
                  </button>
             </div>
        </div>
        
        <div>
            <button className="px-4 py-2 bg-emerald-500 text-white rounded-md text-sm font-bold shadow-md hover:bg-emerald-600 transition-all flex items-center gap-2">
                <Download size={16} /> Download template file
            </button>
        </div>

      </div>

      {/* 2. Instructions Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Instructions</h3>
          
          <div className="space-y-2 mb-8 text-sm text-slate-600">
              <div className="flex gap-2">
                  <span className="font-bold text-slate-900">1.</span>
                  <span>Upload sales data in excel format</span>
              </div>
              <div className="flex gap-2">
                  <span className="font-bold text-slate-900">2.</span>
                  <span>Choose business location and column by which sell lines will be grouped</span>
              </div>
              <div className="flex gap-2">
                  <span className="font-bold text-slate-900">3.</span>
                  <span>Choose respective sales fields for each column</span>
              </div>
          </div>

          <div className="overflow-x-auto border rounded-md border-slate-200">
             <table className="w-full text-left text-sm">
                 <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                     <tr>
                         <th className="px-6 py-3 w-1/3">Importable fields</th>
                         <th className="px-6 py-3">Instructions</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                     {columns.map((col, idx) => (
                         <tr key={idx} className="hover:bg-slate-50 transition-colors">
                             <td className="px-6 py-3 font-medium text-slate-700">{col.name}</td>
                             <td className="px-6 py-3 text-slate-500">{col.instruction}</td>
                         </tr>
                     ))}
                 </tbody>
             </table>
          </div>
      </div>

      {/* 3. Imports History Section */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Imports</h3>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                 <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                     <tr>
                         <th className="px-4 py-3">Import batch</th>
                         <th className="px-4 py-3">Import time</th>
                         <th className="px-4 py-3">Created By</th>
                         <th className="px-4 py-3">Invoices</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                     <tr>
                         <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No previous imports found</td>
                     </tr>
                 </tbody>
             </table>
          </div>
      </div>

    </div>
  );
};

export default ImportSales;