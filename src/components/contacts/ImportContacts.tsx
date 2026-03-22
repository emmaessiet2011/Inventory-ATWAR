import React, { useMemo, useRef, useState } from 'react';
import {
  Download, Upload, FileSpreadsheet,
  AlertCircle, CheckCircle2, Loader2, Save, RefreshCw
} from 'lucide-react';
import { useGlobalContext, Customer, Supplier } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';

type ImportStatus = 'idle' | 'preview' | 'success';
type RowStatus = 'ready' | 'error' | 'imported' | 'skipped';
type RequirementType = true | false | 'conditional';

interface ColumnDefinition {
  num: number;
  name: string;
  required: RequirementType;
  instruction: string;
}

interface RowReport {
  rowNumber: number;
  contactType: string;
  name: string;
  contactId: string;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  message?: string;
}

interface ImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  importedCustomers: number;
  importedSuppliers: number;
  skippedInvalidRows: number;
  skippedDuplicateEntries: number;
}

const columns: ColumnDefinition[] = [
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
  { num: 11, name: 'pay_term_period', required: 'conditional', instruction: 'Options: days or months' },
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
  { num: 23, name: 'dob', required: false, instruction: 'Format YYYY-MM-DD' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const normalizeText = (value?: string): string => String(value || '').trim().toLowerCase();

const normalizePayTermPeriod = (value?: string): 'Days' | 'Months' | '' => {
  const normalized = normalizeText(value);
  if (normalized === 'day' || normalized === 'days') return 'Days';
  if (normalized === 'month' || normalized === 'months') return 'Months';
  return '';
};

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCSVText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      cell = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
  }

  return rows;
};

const ImportContacts: React.FC = () => {
  const { addNotification } = useNotifications();
  const { customers, suppliers, addCustomer, addSupplier, customerGroups, generateId } = useGlobalContext();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [rowReports, setRowReports] = useState<RowReport[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validationStats = useMemo(() => {
    const ready = rowReports.filter(row => row.status === 'ready').length;
    const errors = rowReports.filter(row => row.status === 'error').length;
    return { total: rowReports.length, ready, errors };
  }, [rowReports]);

  const resetImport = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setHeaders([]);
    setValidationErrors([]);
    setRowReports([]);
    setImportSummary(null);
    setImportStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      addNotification({ title: 'Invalid File', message: 'Please upload a valid CSV file.', type: 'error' });
      return;
    }
    setSelectedFile(file);
    setImportStatus('idle');
    setValidationErrors([]);
    setHeaders([]);
    setPreviewData([]);
    setRowReports([]);
    setImportSummary(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const downloadTemplate = () => {
    const csvHeaders = columns.map(c => c.name).join(',');
    const dummyRow = columns.map(c => {
      if (c.name === 'contact_type') return '1';
      if (c.name === 'first_name') return 'John';
      if (c.name === 'business_name') return 'Acme Trading';
      if (c.name === 'mobile') return '99999999';
      if (c.name === 'pay_term') return '30';
      if (c.name === 'pay_term_period') return 'days';
      return '';
    }).join(',');
    const blob = new Blob([`${csvHeaders}\n${dummyRow}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const validateData = (fileHeaders: string[], rows: string[][]): { globalErrors: string[]; reports: RowReport[] } => {
    const globalErrors: string[] = [];
    const reports: RowReport[] = [];
    const requiredColumns = columns.filter(c => c.required === true).map(c => c.name);
    requiredColumns.forEach(requiredColumn => {
      if (!fileHeaders.includes(requiredColumn)) globalErrors.push(`Missing required column: ${requiredColumn}`);
    });
    if (rows.length === 0) globalErrors.push('No data rows found in the CSV file.');

    const headerIndex = new Map<string, number>();
    fileHeaders.forEach((header, index) => headerIndex.set(header, index));
    const getVal = (row: string[], colName: string): string => {
      const index = headerIndex.get(colName);
      return index !== undefined ? String(row[index] || '').trim() : '';
    };

    const existingCustomerIds = new Set(customers.map(c => c.id));
    const existingSupplierIds = new Set(suppliers.map(s => s.id));
    const seenCustomerIdsInFile = new Set<string>();
    const seenSupplierIdsInFile = new Set<string>();

    rows.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const contactType = getVal(row, 'contact_type');
      const firstName = getVal(row, 'first_name');
      const middleName = getVal(row, 'middle_name');
      const lastName = getVal(row, 'last_name');
      const businessName = getVal(row, 'business_name');
      const mobile = getVal(row, 'mobile');
      const email = getVal(row, 'email');
      const contactId = getVal(row, 'contact_id');
      const payTerm = getVal(row, 'pay_term');
      const payTermPeriod = getVal(row, 'pay_term_period');
      const openingBalanceRaw = getVal(row, 'opening_balance');
      const creditLimitRaw = getVal(row, 'credit_limit');
      const dob = getVal(row, 'dob');
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!['1', '2', '3'].includes(contactType)) errors.push('contact_type must be 1, 2, or 3.');
      if (!firstName) errors.push('first_name is required.');
      if (!mobile) errors.push('mobile is required.');
      if (email && !EMAIL_REGEX.test(email)) errors.push('email is invalid.');
      if (dob && !ISO_DATE_REGEX.test(dob)) errors.push('dob must be YYYY-MM-DD.');
      if (openingBalanceRaw && parseOptionalNumber(openingBalanceRaw) === null) errors.push('opening_balance must be numeric.');
      if (creditLimitRaw && parseOptionalNumber(creditLimitRaw) === null) errors.push('credit_limit must be numeric.');
      const normalizedPeriod = normalizePayTermPeriod(payTermPeriod);
      if (payTermPeriod && !normalizedPeriod) errors.push("pay_term_period must be 'days' or 'months'.");
      const parsedPayTerm = parseOptionalNumber(payTerm);
      if (payTerm && parsedPayTerm === null) errors.push('pay_term must be numeric.');
      if (parsedPayTerm !== null && parsedPayTerm < 0) errors.push('pay_term cannot be negative.');

      if (contactType === '2' || contactType === '3') {
        if (!businessName) errors.push('business_name is required for supplier/both type.');
        if (!payTerm) errors.push('pay_term is required for supplier/both type.');
        if (!payTermPeriod) errors.push('pay_term_period is required for supplier/both type.');
      }

      if (!contactId) warnings.push('contact_id is blank; ID will be auto-generated.');

      if (contactId) {
        if (contactType === '1' || contactType === '3') {
          if (existingCustomerIds.has(contactId)) errors.push(`Customer ID "${contactId}" already exists.`);
          else if (seenCustomerIdsInFile.has(contactId)) errors.push(`Customer ID "${contactId}" is duplicated in this file.`);
          else seenCustomerIdsInFile.add(contactId);
        }
        if (contactType === '2' || contactType === '3') {
          if (existingSupplierIds.has(contactId)) errors.push(`Supplier ID "${contactId}" already exists.`);
          else if (seenSupplierIdsInFile.has(contactId)) errors.push(`Supplier ID "${contactId}" is duplicated in this file.`);
          else seenSupplierIdsInFile.add(contactId);
        }
      }

      reports.push({
        rowNumber,
        contactType,
        name: fullName || businessName || '--',
        contactId: contactId || '--',
        status: errors.length > 0 ? 'error' : 'ready',
        errors,
        warnings,
      });
    });

    return { globalErrors, reports };
  };

  const parseCSV = () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || '');
        const parsedData = parseCSVText(text);
        if (parsedData.length === 0) {
          setHeaders([]);
          setPreviewData([]);
          setRowReports([]);
          setValidationErrors(['File appears to be empty.']);
          setImportStatus('preview');
          return;
        }

        const rawHeaders = parsedData[0].map((header, index) =>
          index === 0 ? header.replace(/^\uFEFF/, '') : header
        );
        const normalizedHeaders = rawHeaders.map(header =>
          header.toLowerCase().replace(/['"]+/g, '').trim()
        );
        const dataRows = parsedData.slice(1);
        const { globalErrors, reports } = validateData(normalizedHeaders, dataRows);

        setHeaders(normalizedHeaders);
        setPreviewData(dataRows);
        setValidationErrors(globalErrors);
        setRowReports(reports);
        setImportSummary(null);
        setImportStatus('preview');
      } catch {
        setValidationErrors(['Unable to parse the CSV file.']);
        setHeaders([]);
        setPreviewData([]);
        setRowReports([]);
        setImportStatus('preview');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setValidationErrors(['Error reading file.']);
      setHeaders([]);
      setPreviewData([]);
      setRowReports([]);
      setImportStatus('preview');
      setIsProcessing(false);
    };

    reader.readAsText(selectedFile);
  };

  const finalImport = () => {
    if (rowReports.length === 0) return;
    setIsProcessing(true);

    try {
      const headerIndex = new Map<string, number>();
      headers.forEach((header, index) => headerIndex.set(header, index));
      const getVal = (row: string[], colName: string): string => {
        const index = headerIndex.get(colName);
        return index !== undefined ? String(row[index] || '').trim() : '';
      };

      const defaultCustomerGroup = customerGroups.find(group => (group.status || 'Active') === 'Active') || customerGroups[0];
      const todayIso = new Date().toISOString().slice(0, 10);
      const existingCustomerIds = new Set(customers.map(customer => customer.id));
      const existingSupplierIds = new Set(suppliers.map(supplier => supplier.id));

      const updatedReports = rowReports.map(report => ({ ...report }));
      let importedCustomers = 0;
      let importedSuppliers = 0;
      let skippedInvalidRows = 0;
      let skippedDuplicateEntries = 0;

      previewData.forEach((row, rowIndex) => {
        const report = updatedReports[rowIndex];
        if (!report) return;

        if (report.status !== 'ready') {
          report.status = 'skipped';
          report.message = 'Skipped due to validation errors.';
          skippedInvalidRows += 1;
          return;
        }

        const contactType = getVal(row, 'contact_type');
        const prefix = getVal(row, 'prefix');
        const firstName = getVal(row, 'first_name');
        const middleName = getVal(row, 'middle_name');
        const lastName = getVal(row, 'last_name');
        const businessNameRaw = getVal(row, 'business_name');
        const contactIdRaw = getVal(row, 'contact_id');
        const taxNumber = getVal(row, 'tax_number');
        const openingBalance = parseOptionalNumber(getVal(row, 'opening_balance')) || 0;
        const payTermValueRaw = getVal(row, 'pay_term');
        const payTermPeriodRaw = getVal(row, 'pay_term_period');
        const creditLimit = parseOptionalNumber(getVal(row, 'credit_limit')) || 0;
        const email = getVal(row, 'email');
        const mobile = getVal(row, 'mobile');
        const alternateNumber = getVal(row, 'alternate_number');
        const landline = getVal(row, 'landline');
        const city = getVal(row, 'city');
        const state = getVal(row, 'state');
        const country = getVal(row, 'country');
        const addressLine1 = getVal(row, 'address_line_1');
        const addressLine2 = getVal(row, 'address_line_2');
        const zipCode = getVal(row, 'zip_code');

        const fullName = [prefix, firstName, middleName, lastName].filter(Boolean).join(' ').trim();
        const address = [addressLine1, addressLine2, city, state, country, zipCode].filter(Boolean).join(', ');
        const period = normalizePayTermPeriod(payTermPeriodRaw) || 'Days';
        const parsedPayTerm = parseOptionalNumber(payTermValueRaw);
        const payTerm = parsedPayTerm !== null ? `${parsedPayTerm} ${period}` : 'No Limit';
        const phone = alternateNumber || landline || '';

        let importedEntriesForRow = 0;
        const rowMessages: string[] = [];

        if (contactType === '1' || contactType === '3') {
          const customerId = contactIdRaw || generateId('CUST-');
          if (existingCustomerIds.has(customerId)) {
            skippedDuplicateEntries += 1;
            rowMessages.push(`Customer skipped (duplicate ID: ${customerId})`);
          } else {
            const customerPayload: Customer = {
              type: 'Customer',
              id: customerId,
              businessName: businessNameRaw || fullName || customerId,
              name: fullName || businessNameRaw || customerId,
              email,
              mobile,
              phone,
              taxNumber,
              creditLimit,
              payTerm,
              openingBalance,
              advanceBalance: 0,
              totalSellDue: 0,
              totalSellReturnDue: 0,
              addedOn: todayIso,
              customerGroupId: defaultCustomerGroup?.id || '',
              customerGroup: defaultCustomerGroup?.name || '',
              address,
              city,
              state,
              country,
              zipCode,
              status: 'Active',
              assignedTo: '',
              lastSellDate: todayIso,
              customValues: {},
              contactCategory: businessNameRaw ? 'Business' : 'Individual',
            };
            addCustomer(customerPayload);
            existingCustomerIds.add(customerId);
            importedCustomers += 1;
            importedEntriesForRow += 1;
            rowMessages.push(`Customer imported (${customerId})`);
          }
        }

        if (contactType === '2' || contactType === '3') {
          const supplierId = contactIdRaw || generateId('SUP-');
          if (existingSupplierIds.has(supplierId)) {
            skippedDuplicateEntries += 1;
            rowMessages.push(`Supplier skipped (duplicate ID: ${supplierId})`);
          } else {
            const supplierPayload: Supplier = {
              type: 'Supplier',
              id: supplierId,
              businessName: businessNameRaw || fullName || supplierId,
              name: fullName || businessNameRaw || supplierId,
              email,
              mobile,
              phone,
              taxNumber,
              payTerm,
              openingBalance,
              advanceBalance: 0,
              totalPurchaseDue: 0,
              totalReturnDue: 0,
              addedOn: todayIso,
              address,
              city,
              state,
              country,
              zipCode,
              status: 'Active',
              purchaseStatus: 'Ordered',
              assignedTo: '',
              customValues: {},
              contactCategory: 'Supplier',
            };
            addSupplier(supplierPayload);
            existingSupplierIds.add(supplierId);
            importedSuppliers += 1;
            importedEntriesForRow += 1;
            rowMessages.push(`Supplier imported (${supplierId})`);
          }
        }

        if (importedEntriesForRow > 0) {
          report.status = 'imported';
          report.message = rowMessages.join(' | ');
        } else {
          report.status = 'skipped';
          report.message = rowMessages.length > 0 ? rowMessages.join(' | ') : 'Skipped.';
          if (rowMessages.length === 0) skippedInvalidRows += 1;
        }
      });

      const validRows = rowReports.filter(row => row.status === 'ready').length;
      const errorRows = rowReports.filter(row => row.errors.length > 0).length;
      setRowReports(updatedReports);
      setImportSummary({
        totalRows: previewData.length,
        validRows,
        errorRows,
        importedCustomers,
        importedSuppliers,
        skippedInvalidRows,
        skippedDuplicateEntries,
      });
      setImportStatus('success');
      addNotification({
        title: 'Import Completed',
        message: `Imported ${importedCustomers} customer(s) and ${importedSuppliers} supplier(s).`,
        type: 'success',
      });
    } catch {
      setValidationErrors(['An unexpected error occurred during import processing.']);
      addNotification({ title: 'Import Failed', message: 'An unexpected error occurred during import.', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Contacts</h2>
          <p className="text-slate-500 mt-2 text-lg">Bulk upload customers and suppliers using CSV.</p>
        </div>
        <div className="hidden lg:flex items-center gap-2 bg-white p-2 rounded-full border border-slate-200 shadow-sm text-sm font-medium">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'idle' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
            <Upload size={14} /> 1. Upload
          </span>
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'preview' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
            <FileSpreadsheet size={14} /> 2. Preview
          </span>
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${importStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-600'}`}>
            <CheckCircle2 size={14} /> 3. Finish
          </span>
        </div>
      </div>

      {importStatus === 'success' && importSummary && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-emerald-900">Import Completed</h3>
            <p className="text-emerald-700 mt-2">
              Customers Imported: <strong>{importSummary.importedCustomers}</strong> | Suppliers Imported: <strong>{importSummary.importedSuppliers}</strong>
            </p>
            <p className="text-emerald-700 text-sm mt-1">
              Total Rows: {importSummary.totalRows}, Valid Rows: {importSummary.validRows}, Error Rows: {importSummary.errorRows},
              Skipped Invalid: {importSummary.skippedInvalidRows}, Skipped Duplicates: {importSummary.skippedDuplicateEntries}
            </p>
            <button
              onClick={resetImport}
              className="mt-4 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
            >
              Import More
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Row Import Results</div>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowReports.map((report) => (
                    <tr key={`success-${report.rowNumber}`}>
                      <td className="px-3 py-2 font-mono">{report.rowNumber}</td>
                      <td className="px-3 py-2">{report.contactType || '--'}</td>
                      <td className="px-3 py-2">{report.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          report.status === 'imported' ? 'bg-emerald-100 text-emerald-700' :
                          report.status === 'error' ? 'bg-rose-100 text-rose-700' :
                          report.status === 'skipped' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{report.message || report.errors[0] || report.warnings[0] || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {importStatus !== 'success' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Upload CSV</h3>
                <button onClick={downloadTemplate} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center gap-2">
                  <Download size={14} /> Template
                </button>
              </div>

              {importStatus === 'idle' && (
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-red-500 bg-red-50/30' : 'border-slate-300 hover:border-red-400'}`}
                  onDragOver={handleDragOver}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-50">
                    {selectedFile ? selectedFile.name : 'Choose CSV File'}
                  </button>
                </div>
              )}

              {importStatus === 'preview' && (
                <div className="space-y-4">
                  {(validationErrors.length > 0 || validationStats.errors > 0) ? (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-800">
                      <div className="font-bold flex items-center gap-2"><AlertCircle size={16} /> Issues found</div>
                      <ul className="list-disc list-inside text-xs mt-2 space-y-1">
                        {validationErrors.map((error, idx) => <li key={`global-${idx}`}>{error}</li>)}
                        {validationStats.errors > 0 && <li>{validationStats.errors} row(s) have validation errors and will be skipped.</li>}
                      </ul>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} /> {validationStats.ready} valid row(s) ready to import.
                    </div>
                  )}

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <tr>{headers.map((header, i) => <th key={i} className="px-3 py-2">{header}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.slice(0, 5).map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {headers.map((_, colIdx) => <td key={colIdx} className="px-3 py-2">{row[colIdx] || ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                {importStatus === 'idle' && (
                  <button
                    disabled={!selectedFile || isProcessing}
                    onClick={parseCSV}
                    className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${selectedFile ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />} Read & Validate
                  </button>
                )}
                {importStatus === 'preview' && (
                  <>
                    <button onClick={resetImport} className="px-4 py-2 rounded-lg text-sm font-bold border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                      <RefreshCw size={14} /> Reset
                    </button>
                    <button
                      disabled={validationStats.ready === 0 || isProcessing}
                      onClick={finalImport}
                      className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${validationStats.ready > 0 ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Complete Import ({validationStats.ready})
                    </button>
                  </>
                )}
              </div>
            </div>

            {rowReports.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Row Validation Report</div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Contact ID</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rowReports.map((report) => (
                        <tr key={`preview-${report.rowNumber}`}>
                          <td className="px-3 py-2 font-mono">{report.rowNumber}</td>
                          <td className="px-3 py-2">{report.contactType || '--'}</td>
                          <td className="px-3 py-2">{report.name}</td>
                          <td className="px-3 py-2">{report.contactId}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              report.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">{report.errors.join(' | ') || report.warnings.join(' | ') || 'Ready'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-bold text-slate-800">Column Mapping Guide ({columns.length})</div>
            <div className="max-h-[760px] overflow-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Column</th>
                    <th className="px-3 py-2">Requirement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columns.map((column) => (
                    <tr key={column.num}>
                      <td className="px-3 py-2">{column.num}</td>
                      <td className="px-3 py-2 font-medium">{column.name}</td>
                      <td className="px-3 py-2">{String(column.required)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportContacts;
