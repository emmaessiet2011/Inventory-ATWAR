import React, { useState, useRef } from 'react';
import { 
  Download, Upload, FileSpreadsheet, 
  AlertCircle, CheckCircle2, ChevronRight, 
  FileText, Info, X, Loader2, Save, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

const ImportContacts: React.FC = () => {
  const { customers, suppliers, addCustomer, addSupplier } = useGlobalContext();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'success'>('idle');
  
  // Data State
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = [
    { num: 1, name: 'contact_type', required: true, instruction: '1 = Customer, 2 = Supplier, 3 = Both' },
    { num: 2, name: 'prefix', required: false, instruction: 'Mr, Mrs, Miss, Dr, etc.' },
    { num: 3, name: 'first_name', required: true, instruction: '' },
    { num: 4, name: 'middle_name', required: false, instruction: '' },
    { num: 5, name: 'last_name', required: false, instruction: '' },
    { num: 6, name: 'business_name', required: 'conditional', instruction: 'Required if contact type is supplier or both' },
    { num: 7, name: 'contact_id', required: false, instruction: 'Leave blank to auto generate Contact ID' },
    { num: 8, name: 'tax_number', required: false, instruction: '' },
    { num: 9, name: 'opening_balance', required: false, instruction: '' },
    { num: 10, name: 'pay_term', required: 'conditional', instruction: 'Required if contact type is supplier or both' },
    { num: 11, name: 'pay_term_period', required: 'conditional', instruction: 'Options: <strong>days</strong> or <strong>months</strong>' },
    { num: 12, name: 'credit_limit', required: false, instruction: '' },
    { num: 13, name: 'email', required: false, instruction: '' },
    { num: 14, name: 'mobile', required: true, instruction: '' },
    { num: 15, name: 'alternate_number', required: false, instruction: '' },
    { num: 16, name: 'landline', required: false, instruction: '' },
    { num: 17, name: 'city', required: false, instruction: '' },
    { num: 18, name: 'state', required: false, instruction: '' },
    { num: 19, name: 'country', required: false, instruction: '' },
    { num: 20, name: 'address_line_1', required: false, instruction: '' },
    { num: 21, name: 'address_line_2', required: false, instruction: '' },
    { num: 22, name: 'zip_code', required: false, instruction: '' },
    { num: 23, name: 'dob', required: false, instruction: 'Format Y-m-d (2026-02-10)' },
    { num: 24, name: 'custom_field_1', required: false, instruction: '' },
    { num: 25, name: 'custom_field_2', required: false, instruction: '' },
    { num: 26, name: 'custom_field_3', required: false, instruction: '' },
    { num: 27, name: 'custom_field_4', required: false, instruction: '' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
          alert('Please upload a valid CSV file.');
          return;
      }
      setSelectedFile(file);
      setImportStatus('idle');
      setValidationErrors([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const downloadTemplate = () => {
    const csvHeaders = columns.map(c => c.name).join(',');
    // Add a dummy row for user guidance
    const dummyRow = columns.map(c => {
        if (c.name === 'contact_type') return '1';
        if (c.name === 'first_name') return 'John';
        if (c.name === 'mobile') return '99999999';
        return '';
    }).join(',');
    
    const csvContent = `${csvHeaders}\n${dummyRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        // Simple CSV parser: splits by comma, trimming whitespace
        // Note: Does not handle commas inside quotes for this demo but works for simple CSVs
        const parsedData = lines
            .map(line => line.split(',').map(cell => cell.trim()))
            .filter(row => row.some(cell => cell !== '')); // Remove empty rows
        
        if (parsedData.length > 0) {
            const fileHeaders = parsedData[0].map(h => h.toLowerCase().replace(/['"]+/g, '').trim());
            const dataRows = parsedData.slice(1);
            
            setHeaders(fileHeaders);
            setPreviewData(dataRows);
            validateData(fileHeaders, dataRows);
            setImportStatus('preview');
        } else {
            setValidationErrors(['File appears to be empty.']);
        }
        setIsProcessing(false);
    };
    reader.onerror = () => {
        setValidationErrors(['Error reading file.']);
        setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  };

  const validateData = (fileHeaders: string[], rows: string[][]) => {
      const errors: string[] = [];
      const requiredColumns = columns.filter(c => c.required === true).map(c => c.name);

      // 1. Check if required columns exist in file
      requiredColumns.forEach(reqCol => {
          if (!fileHeaders.includes(reqCol)) {
              errors.push(`Missing required column: ${reqCol}`);
          }
      });

      // 2. Check for empty values in required fields (limit to first 20 errors)
      if (errors.length === 0) {
        rows.forEach((row, rowIndex) => {
            if (errors.length >= 20) return; // Cap error limit
            
            requiredColumns.forEach(reqCol => {
                const colIndex = fileHeaders.indexOf(reqCol);
                // colIndex might be valid, but row might not have that index if short
                if (colIndex !== -1 && (!row[colIndex] || row[colIndex] === '')) {
                     errors.push(`Row ${rowIndex + 2}: Missing required value for '${reqCol}'`);
                }
            });
        });
      }

      setValidationErrors(errors);
  };

  const finalImport = () => {
      setIsProcessing(true);
      
      try {
          // Helper to get value by column name
          const getVal = (row: string[], colName: string) => {
              const idx = headers.indexOf(colName);
              return idx !== -1 ? row[idx] : '';
          };

          const newCustomers: any[] = [];
          const newSuppliers: any[] = [];

          previewData.forEach((row) => {
              const type = getVal(row, 'contact_type');
              const firstName = getVal(row, 'first_name');
              const lastName = getVal(row, 'last_name');
              const fullName = `${firstName} ${lastName}`.trim();
              const businessName = getVal(row, 'business_name') || fullName;
              const mobile = getVal(row, 'mobile');
              const email = getVal(row, 'email');
              const taxNumber = getVal(row, 'tax_number');
              const creditLimit = parseFloat(getVal(row, 'credit_limit')) || 0;
              const openingBalance = parseFloat(getVal(row, 'opening_balance')) || 0;
              const payTerm = getVal(row, 'pay_term');
              const payTermPeriod = getVal(row, 'pay_term_period');
              const addressLine1 = getVal(row, 'address_line_1');
              const city = getVal(row, 'city');
              
              const address = [addressLine1, city].filter(Boolean).join(', ');
              const fullPayTerm = payTerm ? `${payTerm} ${payTermPeriod || 'Days'}` : 'No Limit';
              const contactId = getVal(row, 'contact_id');

              // Create Customer Object
              if (type === '1' || type === '3') {
                  newCustomers.push({
                      type: 'Customer',
                      id: contactId || `CUST-${Math.floor(10000 + Math.random() * 90000)}`,
                      businessName: businessName,
                      name: fullName,
                      email: email,
                      mobile: mobile,
                      phone: '',
                      taxNumber: taxNumber,
                      creditLimit: creditLimit,
                      payTerm: fullPayTerm,
                      openingBalance: openingBalance,
                      advanceBalance: 0,
                      totalSellDue: 0,
                      totalSellReturnDue: 0,
                      addedOn: new Date().toLocaleDateString('en-GB'),
                      customerGroup: 'Retail',
                      address: address,
                      city: city,
                      status: 'Active',
                      assignedTo: '',
                      customValues: {}
                  });
              }

              // Create Supplier Object
              if (type === '2' || type === '3') {
                  newSuppliers.push({
                      type: 'Supplier',
                      id: contactId || `SUP-${Math.floor(10000 + Math.random() * 90000)}`,
                      businessName: businessName,
                      name: fullName,
                      email: email,
                      mobile: mobile,
                      phone: '',
                      taxNumber: taxNumber,
                      payTerm: fullPayTerm,
                      openingBalance: openingBalance,
                      advanceBalance: 0,
                      totalPurchaseDue: 0,
                      totalReturnDue: 0,
                      addedOn: new Date().toLocaleDateString('en-GB'),
                      address: address,
                      city: city,
                      status: 'Active',
                      purchaseStatus: 'Ordered',
                      assignedTo: '',
                      customValues: {}
                  });
              }
          });

          // Save through GlobalContext (single source of truth + correct localStorage keys)
          const existingCustomerIds = new Set(customers.map(c => c.id));
          const existingSupplierIds = new Set(suppliers.map(s => s.id));
          newCustomers.forEach(c => {
            if (!existingCustomerIds.has(c.id)) {
              addCustomer(c);
              existingCustomerIds.add(c.id);
            }
          });
          newSuppliers.forEach(s => {
            if (!existingSupplierIds.has(s.id)) {
              addSupplier(s);
              existingSupplierIds.add(s.id);
            }
          });

          setTimeout(() => {
              setIsProcessing(false);
              setImportStatus('success');
          }, 1000);

      } catch (error) {
          console.error("Import failed", error);
          setValidationErrors(['An unexpected error occurred during import processing.']);
          setIsProcessing(false);
      }
  };

  const resetImport = () => {
      setSelectedFile(null);
      setPreviewData([]);
      setHeaders([]);
      setValidationErrors([]);
      setImportStatus('idle');
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Contacts</h2>
          <p className="text-slate-500 mt-2 text-lg">
            Bulk upload customers and suppliers using CSV.
          </p>
        </div>
        
        {/* Visual Steps */}
        <div className="hidden lg:flex items-center gap-2 bg-white p-2 rounded-full border border-slate-200 shadow-sm text-sm font-medium">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'idle' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
                <Upload size={14} /> 1. Upload
            </span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'preview' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
                <FileSpreadsheet size={14} /> 2. Preview
            </span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
                <CheckCircle2 size={14} /> 3. Finish
            </span>
        </div>
      </div>
      
      {/* 2. Success State */}
      {importStatus === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-emerald-900 mb-2">Import Successful!</h3>
              <p className="text-emerald-700 mb-6">Your contacts have been successfully imported into the system.</p>
              <button 
                onClick={resetImport}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all"
              >
                  Import More
              </button>
          </div>
      )}

      {/* 3. Main Action Card */}
      {importStatus !== 'success' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Upload Zone */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500"></div>
                
                <div className="p-8">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                Upload File
                                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">.csv only</span>
                            </h3>
                        </div>
                        {selectedFile && importStatus === 'idle' && (
                            <button 
                                onClick={resetImport} 
                                className="text-xs text-red-500 hover:underline font-medium flex items-center gap-1"
                            >
                                <X size={12} /> Clear File
                            </button>
                        )}
                    </div>

                    {/* Drag Drop Area */}
                    {importStatus === 'idle' && (
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all duration-300 ${
                                isDragging 
                                ? 'border-red-500 bg-red-50/30 scale-[0.99]' 
                                : 'border-slate-300 hover:border-red-400 hover:bg-slate-50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={handleFileChange}
                                accept=".csv"
                            />
                            
                            {selectedFile ? (
                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <FileSpreadsheet size={32} />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-900">{selectedFile.name}</h4>
                                    <p className="text-slate-500 text-sm mt-1">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            ) : (
                                <div>
                                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                        <Upload size={32} />
                                    </div>
                                    <h4 className="text-lg font-bold text-slate-700">Drag & drop CSV here</h4>
                                    <p className="text-slate-400 text-sm mt-1">or click to browse your computer</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Table & Validation */}
                    {importStatus === 'preview' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            
                            {/* Validation Status */}
                            {validationErrors.length > 0 ? (
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-rose-800 font-bold mb-2">
                                        <AlertCircle size={18} /> Found {validationErrors.length} issues
                                    </div>
                                    <ul className="text-xs text-rose-700 space-y-1 list-disc list-inside max-h-32 overflow-y-auto custom-scrollbar">
                                        {validationErrors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-2 text-emerald-800 font-bold">
                                    <CheckCircle2 size={20} /> File looks good! Ready to import {previewData.length} contacts.
                                </div>
                            )}

                            {/* Data Preview */}
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-2">Data Preview (First 5 rows)</h4>
                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-xs text-left whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                            <tr>
                                                {headers.map((h, i) => (
                                                    <th key={i} className="px-4 py-2">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {previewData.slice(0, 5).map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} className="px-4 py-2 text-slate-600">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-8 flex justify-between items-center border-t border-slate-100 pt-6">
                        {importStatus === 'preview' && (
                             <button 
                                onClick={resetImport}
                                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-2 text-sm"
                            >
                                <RefreshCw size={14} /> Upload Different File
                            </button>
                        )}
                        <div className="flex justify-end gap-3 ml-auto">
                            {importStatus === 'idle' && (
                                <button 
                                    disabled={!selectedFile || isProcessing}
                                    onClick={parseCSV}
                                    className={`px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                                        selectedFile 
                                        ? 'bg-slate-900 text-white hover:bg-slate-800' 
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                                    Read & Validate
                                </button>
                            )}
                            
                            {importStatus === 'preview' && (
                                <button 
                                    disabled={validationErrors.length > 0 || isProcessing}
                                    onClick={finalImport}
                                    className={`px-8 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                                        validationErrors.length > 0 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-red-500/30'
                                    }`}
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    Complete Import
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Right: Template & Help */}
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                
                <div className="relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                        <FileSpreadsheet size={20} className="text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Start with a Template</h3>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        Download the official CSV template to ensure your data is formatted correctly before importing.
                    </p>
                    <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-50 transition flex items-center justify-center gap-2"
                    >
                        <Download size={16} /> Download Template
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-3">
                    <AlertTriangle size={18} /> Important Note
                </h4>
                <ul className="text-sm text-amber-800 space-y-2 list-disc list-inside">
                    <li>Headers must match the template exactly.</li>
                    <li>Required fields cannot be empty.</li>
                    <li>Verify the <strong>Contact Type</strong> ID (1, 2, or 3).</li>
                    <li>Dates must be <strong>YYYY-MM-DD</strong>.</li>
                </ul>
            </div>
        </div>
      </div>
      )}

      {/* 4. Data Mapping Guide Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full max-h-[800px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Column Mapping Guide</h3>
                <p className="text-sm text-slate-500">Ensure your CSV file columns match this specific order.</p>
            </div>
            <div className="text-xs font-medium px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 shadow-sm">
                27 Columns Total
            </div>
        </div>

        <div className="overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-20 bg-white">#</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-64 bg-white">Column Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 bg-white">Requirement</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-white">Instructions / Valid Values</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {columns.map((col) => (
                        <tr key={col.num} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="px-6 py-4 text-slate-400 font-mono text-xs group-hover:text-slate-600">
                                {String(col.num).padStart(2, '0')}
                            </td>
                            <td className="px-6 py-4">
                                <span className="font-bold text-slate-700 text-sm group-hover:text-red-600 transition-colors">
                                    {col.name}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                {col.required === true && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                        Required
                                    </span>
                                )}
                                {col.required === false && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                        Optional
                                    </span>
                                )}
                                {col.required === 'conditional' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                        Conditional
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                                {col.instruction ? (
                                    <div className="flex items-start gap-2">
                                        <Info size={14} className="mt-0.5 text-slate-400 flex-shrink-0" />
                                        <span dangerouslySetInnerHTML={{ __html: col.instruction }} />
                                    </div>
                                ) : (
                                    <span className="text-slate-300 text-xs italic">No specific instructions</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ImportContacts;
