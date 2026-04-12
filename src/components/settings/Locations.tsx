import React, { useMemo, useState } from 'react';
import { Plus, Edit, Trash2, X, Settings, PowerOff, Info, FileText, Printer } from 'lucide-react';
import {
  DEFAULT_LOCATION_PAYMENT_METHODS,
  useGlobalContext,
  Location,
  PaymentMethod,
} from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { bootstrapRegisterFromDB, getActiveRegisterSession } from '@/utils/registerLedger';
import { buildPaymentAccountOptions, resolveDefaultAccountFromMethod } from '@/utils/paymentAccounts';

const cloneDefaultPaymentMethods = (): PaymentMethod[] =>
  DEFAULT_LOCATION_PAYMENT_METHODS.map(method => ({
    ...method,
    account: resolveDefaultAccountFromMethod(String(method.name || '')),
  }));

type LocationSettingsFormState = {
  autoPrintInvoiceAfterFinalizing: boolean;
  receiptPrinterType: 'browser' | 'network';
  receiptPrinterId: string;
  invoiceScheme: string;
  invoiceLayoutPos: string;
  invoiceLayoutSale: string;
};

const Locations: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    locations,
    addLocation,
    updateLocation,
    deleteLocation,
    invoiceSchemes,
    invoiceLayouts,
    updateInvoiceScheme,
    updateInvoiceLayout,
    sellingPriceGroups,
    printers,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedLocationForSettings, setSelectedLocationForSettings] = useState<Location | null>(null);
  const [settingsForm, setSettingsForm] = useState<LocationSettingsFormState>({
    autoPrintInvoiceAfterFinalizing: false,
    receiptPrinterType: 'browser',
    receiptPrinterId: '',
    invoiceScheme: '',
    invoiceLayoutPos: '',
    invoiceLayoutSale: '',
  });
  const [formData, setFormData] = useState<Partial<Location>>({});

  const invoiceSchemeOptions = useMemo(
    () => Array.from(new Set([
      ...invoiceSchemes.map(scheme => scheme.name),
      ...locations.map(location => location.invoiceScheme),
    ].filter(Boolean))),
    [invoiceSchemes, locations]
  );

  const invoiceLayoutOptions = useMemo(
    () => Array.from(new Set([
      ...invoiceLayouts.map(layout => layout.name),
      ...locations.map(location => location.invoiceLayoutPos),
      ...locations.map(location => location.invoiceLayoutSale),
    ].filter(Boolean))),
    [invoiceLayouts, locations]
  );

  const defaultInvoiceSchemeName = useMemo(
    () => invoiceSchemes.find(scheme => scheme.isDefault)?.name || invoiceSchemeOptions[0] || '',
    [invoiceSchemes, invoiceSchemeOptions]
  );

  const defaultInvoiceLayoutName = useMemo(
    () => invoiceLayouts.find(layout => layout.isDefault)?.name || invoiceLayoutOptions[0] || '',
    [invoiceLayouts, invoiceLayoutOptions]
  );

  const printerOptions = useMemo(
    () =>
      [...printers]
        .filter(printer => String(printer.name || '').trim())
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [printers]
  );

  const priceGroupOptions = useMemo(
    () =>
      Array.from(new Set(
        (sellingPriceGroups || [])
          .filter(group => String(group.status || 'Active') !== 'Inactive')
          .map(group => String(group.name || '').trim())
          .filter(Boolean)
      )),
    [sellingPriceGroups]
  );

  const activeLocationCount = useMemo(
    () => locations.filter(location => location.isActive !== false).length,
    [locations]
  );
  const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
  const resolvePaymentMethodAccount = (methodName: string, account?: string) => {
    const normalizedAccount = String(account || '').trim();
    if (normalizedAccount && normalizeText(normalizedAccount) !== 'none') {
      return normalizedAccount;
    }
    return resolveDefaultAccountFromMethod(String(methodName || ''));
  };
  const paymentAccountOptions = useMemo(() => {
    const currentAccounts = (formData.paymentMethods || [])
      .map(method => String(method.account || '').trim())
      .filter(account => account && normalizeText(account) !== 'none');
    return buildPaymentAccountOptions({
      locations,
      activeLocationName: String(formData.name || '').trim(),
      includeNone: false,
      includeAllLocationAccounts: true,
      includeStoredAccounts: true,
      additionalAccountNames: currentAccounts,
    });
  }, [locations, formData.name, formData.paymentMethods]);

  const handleInputChange = (field: keyof Location, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddPaymentMethod = () => {
    const newId = Math.random().toString(36).slice(2, 11);
    setFormData(prev => ({
      ...prev,
      paymentMethods: [
        ...(prev.paymentMethods || cloneDefaultPaymentMethods()),
        {
          id: newId,
          name: 'New Payment Method',
          enabled: true,
          account: resolveDefaultAccountFromMethod('New Payment Method'),
        }
      ]
    }));
  };

  const handlePaymentMethodChange = (id: string, field: keyof PaymentMethod, value: any) => {
    setFormData(prev => {
      const currentMethods = prev.paymentMethods || cloneDefaultPaymentMethods();
      return {
        ...prev,
        paymentMethods: currentMethods.map(pm => {
          if (pm.id !== id) return pm;
          const updated = { ...pm, [field]: value } as PaymentMethod;
          if (field === 'name') {
            updated.account = resolvePaymentMethodAccount(String(value || ''), updated.account);
          }
          if (field === 'account') {
            updated.account = resolvePaymentMethodAccount(updated.name, updated.account);
          }
          return updated;
        })
      };
    });
  };
  
  const handleRemovePaymentMethod = (id: string) => {
    setFormData(prev => {
      const currentMethods = prev.paymentMethods || cloneDefaultPaymentMethods();
      return {
        ...prev,
        paymentMethods: currentMethods.filter(pm => pm.id !== id)
      };
    });
  };

  const openAddModal = () => {
    setEditingLocationId(null);
    setFormData({
      id: '',
      name: '',
      landmark: '',
      city: '',
      zipCode: '',
      state: '',
      country: '',
      mobile: '',
      altContact: '',
      email: '',
      website: '',
      isActive: true,
      priceGroup: '',
      invoiceScheme: defaultInvoiceSchemeName,
      invoiceLayoutPos: defaultInvoiceLayoutName,
      invoiceLayoutSale: defaultInvoiceLayoutName,
      paymentMethods: cloneDefaultPaymentMethods(),
      posFeaturedProducts: '',
      autoPrintInvoiceAfterFinalizing: false,
      receiptPrinterType: 'browser',
      receiptPrinterId: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const name = String(formData.name || '').trim();
    const city = String(formData.city || '').trim();
    const zipCode = String(formData.zipCode || '').trim();
    const state = String(formData.state || '').trim();
    const country = String(formData.country || '').trim();
    const locationId = String(formData.id || '').trim();
    const normalizedName = name.toLowerCase();

    if (!name || !city || !zipCode || !state || !country) {
      addNotification({
        title: 'Missing required fields',
        message: 'Please fill Name, City, Zip Code, State, and Country.',
        type: 'error',
      });
      return;
    }

    const duplicateName = locations.some(location =>
      location.id !== editingLocationId &&
      String(location.name || '').trim().toLowerCase() === normalizedName
    );
    if (duplicateName) {
      addNotification({
        title: 'Duplicate location name',
        message: `Location name "${name}" already exists.`,
        type: 'error',
      });
      return;
    }

    if (!editingLocationId && locationId && locations.some(location => location.id === locationId)) {
      addNotification({
        title: 'Duplicate location ID',
        message: `Location ID "${locationId}" already exists.`,
        type: 'error',
      });
      return;
    }

    const methods = (formData.paymentMethods || cloneDefaultPaymentMethods())
      .map(method => ({
        ...method,
        id: String(method.id || '').trim() || `PM-${Math.random().toString(36).slice(2, 8)}`,
        name: String(method.name || '').trim(),
        account: resolvePaymentMethodAccount(String(method.name || ''), String(method.account || '')),
      }))
      .filter(method => method.name);

    if (methods.length === 0) {
      addNotification({
        title: 'Payment methods required',
        message: 'At least one payment method is required.',
        type: 'error',
      });
      return;
    }

    if (editingLocationId) {
      const existing = locations.find(location => location.id === editingLocationId);
      if (!existing) {
        addNotification({
          title: 'Location not found',
          message: 'The selected location no longer exists.',
          type: 'error',
        });
        return;
      }
      const result = await updateLocation({
        ...existing,
        ...formData,
        id: existing.id,
        name,
        city,
        zipCode,
        state,
        country,
        paymentMethods: methods,
      } as Location);
      if (!result.success) {
        addNotification({
          title: 'Unable to update location',
          message: result.message || 'Failed to save location changes.',
          type: 'error',
        });
        return;
      }
    } else {
      const newLoc: Location = {
        id: locationId || `LOC-${Math.floor(1000 + Math.random() * 9000)}`,
        name,
        landmark: formData.landmark || '',
        city,
        zipCode,
        state,
        country,
        mobile: formData.mobile || '',
        altContact: formData.altContact || '',
        email: formData.email || '',
        website: formData.website || '',
        isActive: formData.isActive !== undefined ? formData.isActive : true,
        priceGroup: formData.priceGroup || '',
        invoiceScheme: formData.invoiceScheme || defaultInvoiceSchemeName || '',
        invoiceLayoutPos: formData.invoiceLayoutPos || defaultInvoiceLayoutName || '',
        invoiceLayoutSale: formData.invoiceLayoutSale || defaultInvoiceLayoutName || '',
        paymentMethods: methods,
        posFeaturedProducts: formData.posFeaturedProducts || '',
        autoPrintInvoiceAfterFinalizing: formData.autoPrintInvoiceAfterFinalizing || false,
        receiptPrinterType: formData.receiptPrinterType === 'network' ? 'network' : 'browser',
        receiptPrinterId:
          formData.receiptPrinterType === 'network'
            ? String(formData.receiptPrinterId || '').trim()
            : '',
      };
      const result = await addLocation(newLoc);
      if (!result.success) {
        addNotification({
          title: 'Unable to add location',
          message: result.message || 'Failed to save location.',
          type: 'error',
        });
        return;
      }
    }
    setIsModalOpen(false);
    setEditingLocationId(null);
    setFormData({});
  };

  const handleEdit = (id: string) => {
    const loc = locations.find(l => l.id === id);
    if (loc) {
      setEditingLocationId(loc.id);
      setFormData({
        ...loc,
        paymentMethods: (loc.paymentMethods || cloneDefaultPaymentMethods()).map(method => ({
          ...method,
          account: resolvePaymentMethodAccount(method.name, method.account),
        })),
      });
      setIsModalOpen(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      const result = await deleteLocation(id);
      if (!result.success) {
        addNotification({
          title: 'Unable to delete location',
          message: result.message || 'Unable to delete this location.',
          type: 'warning',
        });
      }
    }
  };

  const handleToggleLocationStatus = async (location: Location) => {
    const nextActiveState = location.isActive === false;
    if (!nextActiveState) {
      if (activeLocationCount <= 1) {
        addNotification({
          title: 'Action blocked',
          message: 'At least one active location must remain.',
          type: 'warning',
        });
        return;
      }
      await bootstrapRegisterFromDB().catch(() => {});
      const activeRegister = getActiveRegisterSession();
      if (
        activeRegister &&
        (
          activeRegister.locationId === location.id ||
          normalizeText(activeRegister.locationName) === normalizeText(location.name)
        )
      ) {
        addNotification({
          title: 'Cannot deactivate location',
          message: `Cannot deactivate "${location.name}" while its register is open.`,
          type: 'warning',
        });
        return;
      }
    }
    const result = await updateLocation({
      ...location,
      isActive: nextActiveState,
    });
    if (!result.success) {
      addNotification({
        title: 'Unable to update location',
        message: result.message || 'Failed to update location status.',
        type: 'error',
      });
    }
  };

  const openSettingsModal = (location: Location) => {
    setSelectedLocationForSettings(location);
    setSettingsForm({
      autoPrintInvoiceAfterFinalizing: location.autoPrintInvoiceAfterFinalizing === true,
      receiptPrinterType: location.receiptPrinterType === 'network' ? 'network' : 'browser',
      receiptPrinterId: String(location.receiptPrinterId || '').trim(),
      invoiceScheme: location.invoiceScheme || defaultInvoiceSchemeName || '',
      invoiceLayoutPos: location.invoiceLayoutPos || defaultInvoiceLayoutName || '',
      invoiceLayoutSale: location.invoiceLayoutSale || defaultInvoiceLayoutName || '',
    });
    setIsSettingsModalOpen(true);
  };

  const handleSaveLocationSettings = async () => {
    if (!selectedLocationForSettings) return;
    if (settingsForm.receiptPrinterType === 'network' && !String(settingsForm.receiptPrinterId || '').trim()) {
      addNotification({
        title: 'Printer required',
        message: 'Select a configured receipt printer for Network/Thermal Printer mode.',
        type: 'error',
      });
      return;
    }
    const selectedSchemeName = String(
      settingsForm.invoiceScheme
      || selectedLocationForSettings.invoiceScheme
      || defaultInvoiceSchemeName
      || ''
    ).trim();
    const selectedPosLayoutName = String(
      settingsForm.invoiceLayoutPos
      || selectedLocationForSettings.invoiceLayoutPos
      || defaultInvoiceLayoutName
      || ''
    ).trim();
    const selectedSaleLayoutName = String(
      settingsForm.invoiceLayoutSale
      || selectedLocationForSettings.invoiceLayoutSale
      || defaultInvoiceLayoutName
      || ''
    ).trim();

    const selectedScheme = invoiceSchemes.find(scheme => normalizeText(scheme.name) === normalizeText(selectedSchemeName));
    if (selectedScheme) {
      invoiceSchemes
        .filter(scheme => scheme.id !== selectedScheme.id && scheme.isDefault)
        .forEach(scheme => updateInvoiceScheme({ ...scheme, isDefault: false }));
      updateInvoiceScheme({ ...selectedScheme, isDefault: true });
    }

    const defaultLayoutName = selectedSaleLayoutName || selectedPosLayoutName;
    const selectedLayout = invoiceLayouts.find(layout => normalizeText(layout.name) === normalizeText(defaultLayoutName));
    if (selectedLayout) {
      invoiceLayouts
        .filter(layout => layout.id !== selectedLayout.id && layout.isDefault)
        .forEach(layout => updateInvoiceLayout({ ...layout, isDefault: false }));
      updateInvoiceLayout({ ...selectedLayout, isDefault: true });
    }

    const result = await updateLocation({
      ...selectedLocationForSettings,
      autoPrintInvoiceAfterFinalizing: settingsForm.autoPrintInvoiceAfterFinalizing,
      receiptPrinterType: settingsForm.receiptPrinterType,
      receiptPrinterId: settingsForm.receiptPrinterType === 'network' ? settingsForm.receiptPrinterId : '',
      invoiceScheme: selectedSchemeName,
      invoiceLayoutPos: selectedPosLayoutName,
      invoiceLayoutSale: selectedSaleLayoutName,
    });
    if (!result.success) {
      addNotification({
        title: 'Unable to save location settings',
        message: result.message || 'Failed to update location settings.',
        type: 'error',
      });
      return;
    }
    setIsSettingsModalOpen(false);
    setSelectedLocationForSettings(null);
  };

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const showingStart = filteredLocations.length > 0 ? 1 : 0;
  const showingEnd = filteredLocations.length;

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Business Locations</h2>
        <span className="text-sm text-slate-500 mt-1">Manage your business locations</span>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-blue-800">All your business locations ({filteredLocations.length})</h3>
          <button 
            onClick={openAddModal}
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="px-4 py-3 border-r border-slate-200">Name</th>
                <th className="px-4 py-3 border-r border-slate-200">Location ID</th>
                <th className="px-4 py-3 border-r border-slate-200">Landmark</th>
                <th className="px-4 py-3 border-r border-slate-200">City</th>
                <th className="px-4 py-3 border-r border-slate-200">Zip Code</th>
                <th className="px-4 py-3 border-r border-slate-200">State</th>
                <th className="px-4 py-3 border-r border-slate-200">Country</th>
                <th className="px-4 py-3 border-r border-slate-200">Price Group</th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice Scheme</th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice Layout POS</th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice Layout Sale</th>
                <th className="px-4 py-3 border-r border-slate-200">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.length > 0 ? (
                filteredLocations.map((loc) => (
                  <tr key={loc.id} className={`hover:bg-slate-50 transition-colors ${loc.isActive === false ? 'bg-slate-50/70' : ''}`}>
                    <td className="px-4 py-3 text-slate-700">{loc.name}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.id}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.landmark || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.city || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.zipCode || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.state || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.country || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.priceGroup || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceScheme || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceLayoutPos || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceLayoutSale || '--'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        loc.isActive === false ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {loc.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(loc.id)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          onClick={() => openSettingsModal(loc)}
                          className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded flex items-center gap-1 hover:bg-cyan-50"
                        >
                          <Settings size={12} /> Settings
                        </button>
                        <button
                          onClick={() => handleToggleLocationStatus(loc)}
                          className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
                            loc.isActive === false
                              ? 'text-emerald-600 border border-emerald-500 hover:bg-emerald-50'
                              : 'text-red-500 border border-red-500 hover:bg-red-50'
                          }`}
                        >
                          <PowerOff size={12} /> {loc.isActive === false ? 'Activate' : 'Deactivate'}
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          className="px-2 py-1 text-xs text-red-600 border border-red-600 rounded flex items-center gap-1 hover:bg-red-50"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                    No locations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-100 text-sm text-slate-600">
          <div>Showing {showingStart} to {showingEnd} of {filteredLocations.length} entries</div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full rounded shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg text-blue-800">{editingLocationId ? 'Edit business location' : 'Add a new business location'}</h3>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingLocationId(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="group col-span-1 md:col-span-2">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Name:*</label>
                  <input 
                    type="text" 
                    placeholder="Name"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Location ID:</label>
                  <input 
                    type="text" 
                    placeholder="Location ID"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.id || ''}
                    onChange={(e) => handleInputChange('id', e.target.value)}
                    disabled={!!editingLocationId}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Landmark:</label>
                  <input 
                    type="text" 
                    placeholder="Landmark"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.landmark || ''}
                    onChange={(e) => handleInputChange('landmark', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">City:*</label>
                  <input 
                    type="text" 
                    placeholder="City"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Zip Code:*</label>
                  <input 
                    type="text" 
                    placeholder="Zip Code"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.zipCode || ''}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">State:*</label>
                  <input 
                    type="text" 
                    placeholder="State"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.state || ''}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Country:*</label>
                  <input 
                    type="text" 
                    placeholder="Country"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.country || ''}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Mobile:</label>
                  <input 
                    type="text" 
                    placeholder="Mobile"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.mobile || ''}
                    onChange={(e) => handleInputChange('mobile', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Alternate contact number:</label>
                  <input 
                    type="text" 
                    placeholder="Alternate contact number"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.altContact || ''}
                    onChange={(e) => handleInputChange('altContact', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Email:</label>
                  <input 
                    type="text" 
                    placeholder="Email"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Website:</label>
                  <input 
                    type="text" 
                    placeholder="Website"
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                    value={formData.website || ''}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Invoice scheme:* <Info size={14} className="text-[#06b6d4]" /></label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                    value={formData.invoiceScheme || ''}
                    onChange={(e) => handleInputChange('invoiceScheme', e.target.value)}
                  >
                    <option value="">Please Select</option>
                    {invoiceSchemeOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="group">
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Invoice layout for POS:* <Info size={14} className="text-[#06b6d4]" /></label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                    value={formData.invoiceLayoutPos || ''}
                    onChange={(e) => handleInputChange('invoiceLayoutPos', e.target.value)}
                  >
                    <option value="">Please Select</option>
                    {invoiceLayoutOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="group">
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Invoice layout for sale:* <Info size={14} className="text-[#06b6d4]" /></label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                    value={formData.invoiceLayoutSale || ''}
                    onChange={(e) => handleInputChange('invoiceLayoutSale', e.target.value)}
                  >
                    <option value="">Please Select</option>
                    {invoiceLayoutOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="group">
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Default Selling Price Group: <Info size={14} className="text-[#06b6d4]" /></label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                    value={formData.priceGroup || ''}
                    onChange={(e) => handleInputChange('priceGroup', e.target.value)}
                  >
                    <option value="">Please Select</option>
                    {priceGroupOptions.map(groupName => (
                      <option key={groupName} value={groupName}>{groupName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <hr className="my-6 border-slate-200" />

              <div className="group">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">POS screen Featured Products: <Info size={14} className="text-[#06b6d4]" /></label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
                  value={formData.posFeaturedProducts || ''}
                  onChange={(e) => handleInputChange('posFeaturedProducts', e.target.value)}
                />
              </div>

              <hr className="my-6 border-slate-200" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800">Payment Options: <Info size={14} className="text-[#06b6d4]" /></label>
                  <button 
                    onClick={handleAddPaymentMethod}
                    className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Payment Method
                  </button>
                </div>
                <table className="w-full text-sm text-center">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 font-bold text-slate-800 text-left">Payment Method</th>
                      <th className="py-2 font-bold text-slate-800">Enable</th>
                      <th className="py-2 font-bold text-slate-800 flex items-center justify-center gap-1">Default Account <Info size={14} className="text-[#06b6d4]" /></th>
                      <th className="py-2 font-bold text-slate-800">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.paymentMethods || cloneDefaultPaymentMethods()).map((method) => (
                      <tr key={method.id} className="border-b border-slate-100">
                        <td className="py-2 text-left">
                          <input 
                            type="text" 
                            value={method.name}
                            onChange={(e) => handlePaymentMethodChange(method.id, 'name', e.target.value)}
                            className="w-full max-w-[200px] px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                          />
                        </td>
                        <td className="py-2">
                          <input 
                            type="checkbox" 
                            checked={method.enabled}
                            onChange={(e) => handlePaymentMethodChange(method.id, 'enabled', e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                          />
                        </td>
                        <td className="py-2">
                          <select 
                            value={method.account}
                            onChange={(e) => handlePaymentMethodChange(method.id, 'account', e.target.value)}
                            className="w-full max-w-[200px] mx-auto px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                          >
                            {paymentAccountOptions.map(accountName => (
                              <option key={accountName} value={accountName}>{accountName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2">
                          <button 
                            onClick={() => handleRemovePaymentMethod(method.id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="Remove Payment Method"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={handleSave} className="px-6 py-2 bg-[#5c1ac3] text-white rounded text-sm hover:bg-[#4a159c] transition-colors">
                Save
              </button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingLocationId(null);
                }}
                className="px-6 py-2 bg-[#343a40] text-white rounded text-sm hover:bg-[#23272b] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && selectedLocationForSettings && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full rounded shadow-2xl max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Business Location Settings - {selectedLocationForSettings.name}</h3>
              </div>
              <button
                onClick={() => {
                  setIsSettingsModalOpen(false);
                  setSelectedLocationForSettings(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
                <div className="bg-white border border-slate-200 rounded shadow-sm">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200">
                        <button className="px-6 py-3 text-sm font-bold text-slate-700 border-b-2 border-blue-600 bg-white">
                            Receipt Settings
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        <div className="mb-6">
                            <h4 className="text-base text-slate-700 flex items-center gap-1">
                                Receipt Settings <span className="text-xs text-slate-500 font-normal">All receipt related settings for this location</span>
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            {/* Auto print invoice after finalizing */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Auto print invoice after finalizing: <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <FileText size={16} className="text-slate-600" />
                                    </div>
                                    <select
                                      className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                      value={settingsForm.autoPrintInvoiceAfterFinalizing ? 'yes' : 'no'}
                                      onChange={(e) => setSettingsForm(prev => ({
                                        ...prev,
                                        autoPrintInvoiceAfterFinalizing: e.target.value === 'yes',
                                      }))}
                                    >
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>
                            </div>

                            {/* Receipt Printer Type */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Receipt Printer Type:* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <Printer size={16} className="text-slate-600" />
                                    </div>
                                    <select
                                      className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                      value={settingsForm.receiptPrinterType}
                                      onChange={(e) => setSettingsForm(prev => ({
                                        ...prev,
                                        receiptPrinterType: e.target.value === 'network' ? 'network' : 'browser',
                                      }))}
                                    >
                                        <option value="browser">Browser Based Printing</option>
                                        <option value="network">Network/Thermal Printer</option>
                                    </select>
                                </div>
                            </div>

                            {settingsForm.receiptPrinterType === 'network' && (
                              <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                  Receipt Printer:* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                    <Printer size={16} className="text-slate-600" />
                                  </div>
                                  <select
                                    className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                    value={settingsForm.receiptPrinterId}
                                    onChange={(e) => setSettingsForm(prev => ({ ...prev, receiptPrinterId: e.target.value }))}
                                  >
                                    <option value="">Select receipt printer</option>
                                    {printerOptions.map(printer => (
                                      <option key={printer.id} value={printer.id}>
                                        {printer.name} ({printer.connectionType})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {printerOptions.length === 0 && (
                                  <p className="mt-1 text-xs text-amber-600">
                                    No receipt printers found. Add one from Settings &gt; Receipt Printers.
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Invoice layout for POS */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Invoice layout (POS):* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <Info size={16} className="text-slate-600" />
                                    </div>
                                    <select
                                      className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                      value={settingsForm.invoiceLayoutPos}
                                      onChange={(e) => setSettingsForm(prev => ({ ...prev, invoiceLayoutPos: e.target.value }))}
                                    >
                                        <option value="">Select layout</option>
                                        {invoiceLayoutOptions.map(name => (
                                          <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Invoice layout for Sale */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Invoice layout (Sale):* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <Info size={16} className="text-slate-600" />
                                    </div>
                                    <select
                                      className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                      value={settingsForm.invoiceLayoutSale}
                                      onChange={(e) => setSettingsForm(prev => ({ ...prev, invoiceLayoutSale: e.target.value }))}
                                    >
                                        <option value="">Select layout</option>
                                        {invoiceLayoutOptions.map(name => (
                                          <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Invoice scheme */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Invoice scheme:* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <Info size={16} className="text-slate-600" />
                                    </div>
                                    <select
                                      className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none"
                                      value={settingsForm.invoiceScheme}
                                      onChange={(e) => setSettingsForm(prev => ({ ...prev, invoiceScheme: e.target.value }))}
                                    >
                                        <option value="">Select scheme</option>
                                        {invoiceSchemeOptions.map(name => (
                                          <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button 
                onClick={handleSaveLocationSettings}
                className="bg-[#4F46E5] text-white px-6 py-2 rounded text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Locations;
