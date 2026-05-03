import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit, FileText, Plus, Search, Trash2, X } from 'lucide-react';
import { useGlobalContext, InvoiceLayout, InvoiceScheme } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { compressImageFileToDataUrl } from '@/utils/imageCompression';

type ActiveTab = 'schemes' | 'layouts';
const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

type LayoutTemplateForm = {
  invoiceHeading: string;
  showInvoiceLogo: boolean;
  showBusinessName: boolean;
  showLocationName: boolean;
  showCustomerTaxNumber: boolean;
  showCustomerMobile: boolean;
  showPaymentInformation: boolean;
  footerText: string;
  labels: {
    invoiceNo: string;
    date: string;
    customer: string;
    customerTaxNumber: string;
    mobile: string;
    product: string;
    quantity: string;
    unitPrice: string;
    subtotal: string;
    tax: string;
    total: string;
    paid: string;
    due: string;
  };
};

const createDefaultLayoutTemplate = (): LayoutTemplateForm => ({
  invoiceHeading: 'Tax Invoice',
  showInvoiceLogo: true,
  showBusinessName: true,
  showLocationName: true,
  showCustomerTaxNumber: true,
  showCustomerMobile: true,
  showPaymentInformation: true,
  footerText: '',
  labels: {
    invoiceNo: 'Invoice No.',
    date: 'Date',
    customer: 'Customer',
    customerTaxNumber: 'VATIN',
    mobile: 'Mobile',
    product: 'Product',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    subtotal: 'Subtotal',
    tax: 'VATIN',
    total: 'Total',
    paid: 'Amount Paid',
    due: 'Due',
  },
});

const normalizeLayoutTemplate = (layout?: Partial<InvoiceLayout>): LayoutTemplateForm => {
  const fallback = createDefaultLayoutTemplate();
  const bodyTemplate = (
    layout?.bodyTemplate && typeof layout.bodyTemplate === 'object'
      ? layout.bodyTemplate
      : {}
  ) as Record<string, any>;
  const labels = (
    bodyTemplate.labels && typeof bodyTemplate.labels === 'object'
      ? bodyTemplate.labels
      : {}
  ) as Record<string, any>;

  return {
    invoiceHeading: String(bodyTemplate.invoiceHeading || (layout as any)?.invoiceHeading || fallback.invoiceHeading),
    showInvoiceLogo:
      bodyTemplate.showInvoiceLogo !== undefined
        ? bodyTemplate.showInvoiceLogo !== false
        : ((layout as any)?.showInvoiceLogo !== false && layout?.showClientLogo !== false),
    showBusinessName:
      bodyTemplate.showBusinessName !== undefined
        ? bodyTemplate.showBusinessName !== false
        : (layout as any)?.showBusinessName !== false,
    showLocationName:
      bodyTemplate.showLocationName !== undefined
        ? bodyTemplate.showLocationName !== false
        : (layout as any)?.showLocationName !== false,
    showCustomerTaxNumber:
      bodyTemplate.showCustomerTaxNumber !== undefined
        ? bodyTemplate.showCustomerTaxNumber !== false
        : (layout as any)?.showCustomerTaxNumber !== false,
    showCustomerMobile:
      bodyTemplate.showCustomerMobile !== undefined
        ? bodyTemplate.showCustomerMobile !== false
        : (layout as any)?.showCustomerMobile !== false,
    showPaymentInformation:
      bodyTemplate.showPaymentInformation !== undefined
        ? bodyTemplate.showPaymentInformation !== false
        : (layout as any)?.showPaymentInformation !== false,
    footerText: String(bodyTemplate.footerText || (layout as any)?.footerText || ''),
    labels: {
      invoiceNo: String(labels.invoiceNo || bodyTemplate.invoiceNo || (layout as any)?.invoiceNo || fallback.labels.invoiceNo),
      date: String(labels.date || bodyTemplate.date || (layout as any)?.date || fallback.labels.date),
      customer: String(labels.customer || bodyTemplate.customer || (layout as any)?.customer || fallback.labels.customer),
      customerTaxNumber: String(
        labels.customerTaxNumber ||
          bodyTemplate.customerTaxNumber ||
          (layout as any)?.customerTaxNumber ||
          fallback.labels.customerTaxNumber
      ),
      mobile: String(labels.mobile || bodyTemplate.mobile || (layout as any)?.mobile || fallback.labels.mobile),
      product: String(labels.product || bodyTemplate.product || (layout as any)?.product || fallback.labels.product),
      quantity: String(labels.quantity || bodyTemplate.quantity || (layout as any)?.quantity || fallback.labels.quantity),
      unitPrice: String(labels.unitPrice || bodyTemplate.unitPrice || (layout as any)?.unitPrice || fallback.labels.unitPrice),
      subtotal: String(labels.subtotal || bodyTemplate.subtotal || (layout as any)?.subtotal || fallback.labels.subtotal),
      tax: String(labels.tax || bodyTemplate.tax || (layout as any)?.tax || fallback.labels.tax),
      total: String(labels.total || bodyTemplate.total || (layout as any)?.total || fallback.labels.total),
      paid: String(labels.paid || bodyTemplate.paid || (layout as any)?.paid || fallback.labels.paid),
      due: String(labels.due || bodyTemplate.due || (layout as any)?.due || fallback.labels.due),
    },
  };
};

const InvoiceSettings: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    invoiceSchemes,
    addInvoiceScheme,
    updateInvoiceScheme,
    deleteInvoiceScheme,
    invoiceLayouts,
    addInvoiceLayout,
    updateInvoiceLayout,
    deleteInvoiceLayout,
    locations,
    sales,
    generateId,
    settings,
    updateSettings,
  } = useGlobalContext();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('schemes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);

  const [schemeForm, setSchemeForm] = useState({
    name: '',
    prefix: 'INV-',
    startFrom: 1,
    numberOfDigits: 4,
    isDefault: false,
  });

  const [layoutForm, setLayoutForm] = useState<{
    name: string;
    design: string;
    isDefault: boolean;
    template: LayoutTemplateForm;
  }>({
    name: '',
    design: 'Classic',
    isDefault: false,
    template: createDefaultLayoutTemplate(),
  });
  const [printProfileForm, setPrintProfileForm] = useState(() => ({
    businessLogo: String(settings.businessLogo || '').trim(),
    invoiceFooterText:
      String(settings.invoiceFooterText || '').trim() || 'Received in good condition; payment as agreed.',
  }));

  const filteredSchemes = useMemo(
    () => invoiceSchemes.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.prefix.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [invoiceSchemes, searchTerm]
  );

  const filteredLayouts = useMemo(
    () => invoiceLayouts.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.design.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [invoiceLayouts, searchTerm]
  );

  useEffect(() => {
    setPrintProfileForm({
      businessLogo: String(settings.businessLogo || '').trim(),
      invoiceFooterText:
        String(settings.invoiceFooterText || '').trim() || 'Received in good condition; payment as agreed.',
    });
  }, [settings.businessLogo, settings.invoiceFooterText]);

  const selectedLogoLabel = useMemo(() => {
    const logo = String(printProfileForm.businessLogo || '').trim();
    if (!logo) return '';
    return logo.startsWith('data:') ? 'Logo selected' : logo;
  }, [printProfileForm.businessLogo]);

  const handleLogoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, {
        maxWidth: 640,
        maxHeight: 640,
        targetMaxKB: 120,
        quality: 0.62,
        minQuality: 0.35,
        format: 'image/webp',
      });
      setPrintProfileForm(prev => ({ ...prev, businessLogo: compressed }));
    } catch {
      addNotification({
        title: 'Logo Upload Failed',
        message: 'Unable to process logo file. Try a different image.',
        type: 'error',
      });
    }
    event.target.value = '';
  };

  const handleSavePrintProfile = async () => {
    const result = await updateSettings({
      ...settings,
      businessLogo: String(printProfileForm.businessLogo || '').trim(),
      invoiceFooterText: String(printProfileForm.invoiceFooterText || '').trim(),
    });
    if (!result.ok) {
      addNotification({
        title: 'Save Failed',
        message: result.error || 'Unable to update invoice print profile.',
        type: 'error',
      });
      return;
    }
    addNotification({
      title: 'Saved',
      message: 'Invoice print logo/footer were updated successfully.',
      type: 'success',
    });
  };

  const openAddScheme = () => {
    setEditingSchemeId(null);
    setSchemeForm({
      name: '',
      prefix: 'INV-',
      startFrom: 1,
      numberOfDigits: 4,
      isDefault: invoiceSchemes.length === 0,
    });
    setIsSchemeModalOpen(true);
  };

  const openEditScheme = (scheme: InvoiceScheme) => {
    setEditingSchemeId(scheme.id);
    setSchemeForm({
      name: scheme.name,
      prefix: scheme.prefix,
      startFrom: Number(scheme.startFrom || 1),
      numberOfDigits: Number(scheme.numberOfDigits || 4),
      isDefault: !!scheme.isDefault,
    });
    setIsSchemeModalOpen(true);
  };

  const handleSaveScheme = async () => {
    const name = schemeForm.name.trim();
    if (!name) {
      addNotification({ title: 'Validation', message: 'Scheme name is required.', type: 'error' });
      return;
    }

    const duplicate = invoiceSchemes.find(s =>
      s.id !== editingSchemeId &&
      s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      addNotification({ title: 'Validation', message: 'Scheme name already exists.', type: 'error' });
      return;
    }

    const record: InvoiceScheme = {
      id: editingSchemeId || generateId('INV-SCH-'),
      name,
      prefix: schemeForm.prefix.trim() || 'INV-',
      numberingType: 'Sequential',
      startFrom: Math.max(1, Number(schemeForm.startFrom || 1)),
      numberOfDigits: Math.max(1, Number(schemeForm.numberOfDigits || 4)),
      isDefault: schemeForm.isDefault,
    };

    const result = editingSchemeId
      ? await updateInvoiceScheme(record)
      : await addInvoiceScheme(record);
    if (!result.ok) {
      addNotification({
        title: 'Save Failed',
        message: result.error || 'Unable to save invoice scheme.',
        type: 'error',
      });
      return;
    }
    setIsSchemeModalOpen(false);
  };

  const handleDeleteScheme = (scheme: InvoiceScheme) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Invoice Scheme',
      message: `Delete invoice scheme "${scheme.name}"?`,
      onConfirm: async () => {
        const result = await deleteInvoiceScheme(scheme.id);
        if (!result.success) addNotification({ title: 'Blocked', message: result.message || 'Unable to delete invoice scheme.', type: 'error' });
        setConfirmModal(null);
      },
    });
  };

  const setDefaultScheme = async (scheme: InvoiceScheme) => {
    const others = invoiceSchemes.filter(record => record.id !== scheme.id && record.isDefault);
    for (const record of others) {
      await updateInvoiceScheme({ ...record, isDefault: false });
    }
    await updateInvoiceScheme({ ...scheme, isDefault: true });
  };

  const openAddLayout = () => {
    setEditingLayoutId(null);
    setLayoutForm({
      name: '',
      design: 'Classic',
      isDefault: invoiceLayouts.length === 0,
      template: createDefaultLayoutTemplate(),
    });
    setIsLayoutModalOpen(true);
  };

  const openEditLayout = (layout: InvoiceLayout) => {
    setEditingLayoutId(layout.id);
    setLayoutForm({
      name: layout.name,
      design: layout.design || 'Classic',
      isDefault: !!layout.isDefault,
      template: normalizeLayoutTemplate(layout),
    });
    setIsLayoutModalOpen(true);
  };

  const setLayoutTemplateLabel = (
    key: keyof LayoutTemplateForm['labels'],
    value: string,
  ) => {
    setLayoutForm(prev => ({
      ...prev,
      template: {
        ...prev.template,
        labels: {
          ...prev.template.labels,
          [key]: value,
        },
      },
    }));
  };

  const setLayoutTemplateFlag = (
    key: Exclude<keyof LayoutTemplateForm, 'labels' | 'invoiceHeading' | 'footerText'>,
    value: boolean,
  ) => {
    setLayoutForm(prev => ({
      ...prev,
      template: {
        ...prev.template,
        [key]: value,
      },
    }));
  };

  const handleSaveLayout = async () => {
    const name = layoutForm.name.trim();
    if (!name) {
      addNotification({ title: 'Validation', message: 'Layout name is required.', type: 'error' });
      return;
    }

    const duplicate = invoiceLayouts.find(l =>
      l.id !== editingLayoutId &&
      l.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      addNotification({ title: 'Validation', message: 'Layout name already exists.', type: 'error' });
      return;
    }

    const record: InvoiceLayout = {
      id: editingLayoutId || generateId('INV-LYT-'),
      name,
      design: layoutForm.design.trim() || 'Classic',
      isDefault: layoutForm.isDefault,
      showClientLogo: layoutForm.template.showInvoiceLogo,
      bodyTemplate: {
        invoiceHeading: String(layoutForm.template.invoiceHeading || '').trim() || 'Tax Invoice',
        showInvoiceLogo: !!layoutForm.template.showInvoiceLogo,
        showBusinessName: !!layoutForm.template.showBusinessName,
        showLocationName: !!layoutForm.template.showLocationName,
        showCustomerTaxNumber: !!layoutForm.template.showCustomerTaxNumber,
        showCustomerMobile: !!layoutForm.template.showCustomerMobile,
        showPaymentInformation: !!layoutForm.template.showPaymentInformation,
        footerText: String(layoutForm.template.footerText || '').trim(),
        labels: {
          invoiceNo: String(layoutForm.template.labels.invoiceNo || '').trim() || 'Invoice No.',
          date: String(layoutForm.template.labels.date || '').trim() || 'Date',
          customer: String(layoutForm.template.labels.customer || '').trim() || 'Customer',
          customerTaxNumber:
            String(layoutForm.template.labels.customerTaxNumber || '').trim() || 'VATIN',
          mobile: String(layoutForm.template.labels.mobile || '').trim() || 'Mobile',
          product: String(layoutForm.template.labels.product || '').trim() || 'Product',
          quantity: String(layoutForm.template.labels.quantity || '').trim() || 'Quantity',
          unitPrice: String(layoutForm.template.labels.unitPrice || '').trim() || 'Unit Price',
          subtotal: String(layoutForm.template.labels.subtotal || '').trim() || 'Subtotal',
          tax: String(layoutForm.template.labels.tax || '').trim() || 'VATIN',
          total: String(layoutForm.template.labels.total || '').trim() || 'Total',
          paid: String(layoutForm.template.labels.paid || '').trim() || 'Amount Paid',
          due: String(layoutForm.template.labels.due || '').trim() || 'Due',
        },
      },
    };

    const result = editingLayoutId
      ? await updateInvoiceLayout(record)
      : await addInvoiceLayout(record);
    if (!result.ok) {
      addNotification({
        title: 'Save Failed',
        message: result.error || 'Unable to save invoice layout.',
        type: 'error',
      });
      return;
    }
    setIsLayoutModalOpen(false);
  };

  const handleDeleteLayout = (layout: InvoiceLayout) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Invoice Layout',
      message: `Delete invoice layout "${layout.name}"?`,
      onConfirm: async () => {
        const result = await deleteInvoiceLayout(layout.id);
        if (!result.success) addNotification({ title: 'Blocked', message: result.message || 'Unable to delete invoice layout.', type: 'error' });
        setConfirmModal(null);
      },
    });
  };

  const setDefaultLayout = async (layout: InvoiceLayout) => {
    const others = invoiceLayouts.filter(record => record.id !== layout.id && record.isDefault);
    for (const record of others) {
      await updateInvoiceLayout({ ...record, isDefault: false });
    }
    await updateInvoiceLayout({ ...layout, isDefault: true });
  };

  const getInvoiceCountForScheme = (schemeName: string) =>
    sales.filter(s => normalizeText(s.invoiceScheme) === normalizeText(schemeName)).length;

  const getLocationsForLayout = (layoutName: string) =>
    locations
      .filter(l =>
        normalizeText(l.invoiceLayoutPos) === normalizeText(layoutName) ||
        normalizeText(l.invoiceLayoutSale) === normalizeText(layoutName)
      )
      .map(l => ({ id: l.id, name: l.name }));

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invoice Settings</h2>
        <span className="text-sm text-slate-500 mt-1">Manage your invoice schemes and layouts</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Invoice Print Content</h3>
          <p className="text-xs text-slate-500 mt-1">
            Set the invoice logo and footer text that appear at the bottom of printed invoices.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">Invoice Logo</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
            />
            <div className="flex">
              <input
                type="text"
                value={selectedLogoLabel}
                readOnly
                className="flex-1 px-3 py-2 rounded-l border border-slate-200 focus:outline-none text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded-r text-sm font-bold hover:bg-blue-700"
              >
                Browse
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-900">Invoice Footer Text</label>
            <textarea
              value={printProfileForm.invoiceFooterText}
              onChange={(e) => setPrintProfileForm(prev => ({ ...prev, invoiceFooterText: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Enter footer text that should appear at the bottom of invoice print."
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSavePrintProfile}
            className="bg-blue-600 text-white px-5 py-2 rounded text-sm font-bold hover:bg-blue-700 transition"
          >
            Save Invoice Print Content
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
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

        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-slate-700">
            {activeTab === 'schemes' ? 'All invoice schemes' : 'All invoice layouts'}
          </h3>
          <button
            onClick={activeTab === 'schemes' ? openAddScheme : openAddLayout}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition flex items-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-end">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeTab === 'schemes' ? 'Search scheme...' : 'Search layout...'}
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {activeTab === 'schemes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Prefix</th>
                  <th className="px-4 py-3">Numbering Type</th>
                  <th className="px-4 py-3">Start From</th>
                  <th className="px-4 py-3">Digits</th>
                  <th className="px-4 py-3">Invoice Count</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No invoice schemes found.</td>
                  </tr>
                )}
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">
                      {scheme.name}
                      {scheme.isDefault && <span className="ml-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Default</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{scheme.prefix}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.numberingType}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.startFrom}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.numberOfDigits}</td>
                    <td className="px-4 py-3 text-slate-700">{getInvoiceCountForScheme(scheme.name)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditScheme(scheme)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                          <Edit size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteScheme(scheme)} className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                          <Trash2 size={12} /> Delete
                        </button>
                        {!scheme.isDefault && (
                          <button onClick={() => setDefaultScheme(scheme)} className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50">
                            Set as default
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'layouts' && (
          <div className="p-8 flex flex-wrap gap-12 justify-center md:justify-start min-h-[300px]">
            {filteredLayouts.length === 0 && (
              <div className="text-sm text-slate-500">No invoice layouts found.</div>
            )}
            {filteredLayouts.map((layout) => {
              const usedInLocations = getLocationsForLayout(layout.name);
              return (
                <div key={layout.id} className="flex flex-col items-center text-center max-w-[260px] border border-slate-200 rounded p-4 bg-slate-50">
                  <div className="mb-2 relative">
                    <FileText size={48} className="text-blue-400" strokeWidth={1.5} />
                    {layout.isDefault && (
                      <span className="absolute -right-10 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{layout.name}</h4>
                  <p className="text-xs text-slate-600 mb-1">Design: {layout.design}</p>
                  <div className="text-xs text-slate-600 mb-3 min-h-[38px]">
                    <div className="font-bold text-slate-700 mb-1">Used in locations:</div>
                    {usedInLocations.length === 0 ? (
                      <span>None</span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {usedInLocations.map(loc => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => openEditLayout(layout)}
                            className="px-2 py-0.5 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 font-medium"
                            title={`Edit layout "${layout.name}" used by ${loc.name}`}
                          >
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditLayout(layout)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                      <Edit size={12} /> Edit
                    </button>
                    <button onClick={() => handleDeleteLayout(layout)} className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                      <Trash2 size={12} /> Delete
                    </button>
                    {!layout.isDefault && (
                      <button onClick={() => setDefaultLayout(layout)} className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50">
                        Set as default
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isSchemeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-xl text-slate-800">{editingSchemeId ? 'Edit invoice scheme' : 'Add invoice scheme'}</h3>
              <button onClick={() => setIsSchemeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Name *</label>
                <input value={schemeForm.name} onChange={(e) => setSchemeForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Prefix *</label>
                <input value={schemeForm.prefix} onChange={(e) => setSchemeForm(prev => ({ ...prev, prefix: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Start From</label>
                  <input type="number" min={1} value={schemeForm.startFrom} onChange={(e) => setSchemeForm(prev => ({ ...prev, startFrom: Number(e.target.value || 1) }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Digits</label>
                  <input type="number" min={1} value={schemeForm.numberOfDigits} onChange={(e) => setSchemeForm(prev => ({ ...prev, numberOfDigits: Number(e.target.value || 4) }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={schemeForm.isDefault} onChange={(e) => setSchemeForm(prev => ({ ...prev, isDefault: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-900">Set as default scheme</span>
              </label>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={handleSaveScheme} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsSchemeModalOpen(false)} className="bg-slate-700 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {isLayoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded shadow-xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-xl text-slate-800">{editingLayoutId ? 'Edit invoice layout' : 'Add invoice layout'}</h3>
              <button onClick={() => setIsLayoutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Layout name *</label>
                  <input
                    value={layoutForm.name}
                    onChange={(e) => setLayoutForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Design</label>
                  <select
                    value={layoutForm.design}
                    onChange={(e) => setLayoutForm(prev => ({ ...prev, design: e.target.value }))}
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="Classic">Classic (For normal printer)</option>
                    <option value="Modern">Modern</option>
                    <option value="Compact">Compact</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 border border-slate-200 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.isDefault}
                    onChange={(e) => setLayoutForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Set as default layout</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showInvoiceLogo}
                    onChange={(e) => setLayoutTemplateFlag('showInvoiceLogo', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show invoice logo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showBusinessName}
                    onChange={(e) => setLayoutTemplateFlag('showBusinessName', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show business name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showLocationName}
                    onChange={(e) => setLayoutTemplateFlag('showLocationName', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show location name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showCustomerTaxNumber}
                    onChange={(e) => setLayoutTemplateFlag('showCustomerTaxNumber', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show customer VATIN</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showCustomerMobile}
                    onChange={(e) => setLayoutTemplateFlag('showCustomerMobile', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show customer mobile</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutForm.template.showPaymentInformation}
                    onChange={(e) => setLayoutTemplateFlag('showPaymentInformation', e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-900">Show payment information</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Invoice heading</label>
                  <input
                    value={layoutForm.template.invoiceHeading}
                    onChange={(e) =>
                      setLayoutForm(prev => ({
                        ...prev,
                        template: { ...prev.template, invoiceHeading: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="Tax Invoice"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Footer text (layout-specific)</label>
                  <input
                    value={layoutForm.template.footerText}
                    onChange={(e) =>
                      setLayoutForm(prev => ({
                        ...prev,
                        template: { ...prev.template, footerText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="Leave blank to use global invoice footer text"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded p-4 space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Invoice labels</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Invoice no. label</label>
                    <input value={layoutForm.template.labels.invoiceNo} onChange={(e) => setLayoutTemplateLabel('invoiceNo', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Date label</label>
                    <input value={layoutForm.template.labels.date} onChange={(e) => setLayoutTemplateLabel('date', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer label</label>
                    <input value={layoutForm.template.labels.customer} onChange={(e) => setLayoutTemplateLabel('customer', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer VATIN label</label>
                    <input value={layoutForm.template.labels.customerTaxNumber} onChange={(e) => setLayoutTemplateLabel('customerTaxNumber', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile label</label>
                    <input value={layoutForm.template.labels.mobile} onChange={(e) => setLayoutTemplateLabel('mobile', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Product label</label>
                    <input value={layoutForm.template.labels.product} onChange={(e) => setLayoutTemplateLabel('product', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quantity label</label>
                    <input value={layoutForm.template.labels.quantity} onChange={(e) => setLayoutTemplateLabel('quantity', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit price label</label>
                    <input value={layoutForm.template.labels.unitPrice} onChange={(e) => setLayoutTemplateLabel('unitPrice', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subtotal label</label>
                    <input value={layoutForm.template.labels.subtotal} onChange={(e) => setLayoutTemplateLabel('subtotal', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tax label</label>
                    <input value={layoutForm.template.labels.tax} onChange={(e) => setLayoutTemplateLabel('tax', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Total label</label>
                    <input value={layoutForm.template.labels.total} onChange={(e) => setLayoutTemplateLabel('total', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Paid label</label>
                    <input value={layoutForm.template.labels.paid} onChange={(e) => setLayoutTemplateLabel('paid', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Due label</label>
                    <input value={layoutForm.template.labels.due} onChange={(e) => setLayoutTemplateLabel('due', e.target.value)} className="w-full px-2.5 py-2 rounded border border-slate-300 text-sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setLayoutForm(prev => ({ ...prev, template: createDefaultLayoutTemplate() }))}
                className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded font-bold hover:bg-slate-50 transition"
              >
                Reset Fields
              </button>
              <button onClick={handleSaveLayout} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsLayoutModalOpen(false)} className="bg-slate-700 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition">Close</button>
            </div>
          </div>
        </div>
      )}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-rose-50 text-rose-500 mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceSettings;
