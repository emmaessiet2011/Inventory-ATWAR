import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, MapPin, X, Settings, PowerOff, Info, FileText, Printer } from 'lucide-react';
import { useGlobalContext, Location, PaymentMethod } from '../src/context/GlobalContext';

const defaultPaymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Cash', enabled: true, account: 'None' },
  { id: '2', name: 'Card', enabled: true, account: 'None' },
  { id: '3', name: 'Cheque', enabled: true, account: 'None' },
  { id: '4', name: 'Bank Transfer', enabled: true, account: 'None' },
  { id: '5', name: 'Other', enabled: true, account: 'None' },
  { id: '6', name: 'Credit', enabled: true, account: 'None' },
  { id: '7', name: 'Yahya', enabled: true, account: 'None' },
  { id: '8', name: 'Emad', enabled: true, account: 'None' },
  { id: '9', name: 'Jaifar', enabled: true, account: 'None' },
  { id: '10', name: 'Khalil', enabled: true, account: 'None' },
  { id: '11', name: 'Custom Payment 6', enabled: true, account: 'None' },
  { id: '12', name: 'Custom Payment 7', enabled: true, account: 'None' },
];

const Locations: React.FC = () => {
  const { locations, setLocations, addLocation, updateLocation, deleteLocation } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedLocationForSettings, setSelectedLocationForSettings] = useState<Location | null>(null);
  const [formData, setFormData] = useState<Partial<Location>>({});

  const handleInputChange = (field: keyof Location, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddPaymentMethod = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setFormData(prev => ({
      ...prev,
      paymentMethods: [
        ...(prev.paymentMethods || defaultPaymentMethods),
        { id: newId, name: 'New Payment Method', enabled: true, account: 'None' }
      ]
    }));
  };

  const handlePaymentMethodChange = (id: string, field: keyof PaymentMethod, value: any) => {
    setFormData(prev => {
      const currentMethods = prev.paymentMethods || defaultPaymentMethods;
      return {
        ...prev,
        paymentMethods: currentMethods.map(pm => pm.id === id ? { ...pm, [field]: value } : pm)
      };
    });
  };
  
  const handleRemovePaymentMethod = (id: string) => {
    setFormData(prev => {
      const currentMethods = prev.paymentMethods || defaultPaymentMethods;
      return {
        ...prev,
        paymentMethods: currentMethods.filter(pm => pm.id !== id)
      };
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.city) {
      alert('Please fill in required fields: Name and City');
      return;
    }

    if (formData.id && locations.some(l => l.id === formData.id)) {
      updateLocation({ ...locations.find(l => l.id === formData.id)!, ...formData } as Location);
    } else {
      const newLoc: Location = {
        id: formData.id || `LOC-${Math.floor(1000 + Math.random() * 9000)}`,
        name: formData.name,
        landmark: formData.landmark || '',
        city: formData.city,
        zipCode: formData.zipCode || '',
        state: formData.state || '',
        country: formData.country || '',
        mobile: formData.mobile || '',
        email: formData.email || '',
        website: formData.website || '',
        isActive: formData.isActive !== undefined ? formData.isActive : true,
        priceGroup: formData.priceGroup || '',
        invoiceScheme: formData.invoiceScheme || '',
        invoiceLayoutPos: formData.invoiceLayoutPos || '',
        invoiceLayoutSale: formData.invoiceLayoutSale || '',
        paymentMethods: formData.paymentMethods || defaultPaymentMethods,
      };
      addLocation(newLoc);
    }
    setIsModalOpen(false);
    setFormData({});
  };

  const handleEdit = (id: string) => {
    const loc = locations.find(l => l.id === id);
    if (loc) {
      setFormData({ ...loc, paymentMethods: loc.paymentMethods || defaultPaymentMethods });
      setIsModalOpen(true);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      deleteLocation(id);
    }
  };

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Business Locations</h2>
        <span className="text-sm text-slate-500 mt-1">Manage your business locations</span>
      </div>

      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-blue-800">All your business locations ({filteredLocations.length})</h3>
          <button 
            onClick={() => {
              setFormData({ isActive: true, paymentMethods: defaultPaymentMethods });
              setIsModalOpen(true);
            }}
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
                <th className="px-4 py-3 border-r border-slate-200">Name <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Location ID <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Landmark <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">City <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Zip Code <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">State <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Country <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Price Group <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice scheme <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice layout for POS <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3 border-r border-slate-200">Invoice layout for sale <span className="text-slate-300 ml-1">⇅</span></th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.length > 0 ? (
                filteredLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{loc.name}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.id}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.landmark}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.city}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.zipCode}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.state}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.country}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.priceGroup}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceScheme}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceLayoutPos}</td>
                    <td className="px-4 py-3 text-slate-700">{loc.invoiceLayoutSale}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(loc.id)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                          <Edit size={12} /> Edit
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedLocationForSettings(loc);
                            setIsSettingsModalOpen(true);
                          }}
                          className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded flex items-center gap-1 hover:bg-cyan-50"
                        >
                          <Settings size={12} /> Settings
                        </button>
                        <button className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                          <PowerOff size={12} /> Deactivate Location
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    No locations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 border-t border-slate-100 text-sm text-slate-600 flex flex-col gap-2">
          <div>Showing 1 to {filteredLocations.length} of {filteredLocations.length} entries</div>
          <div className="h-4 bg-slate-400 rounded-full w-full opacity-50"></div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full rounded shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-lg text-blue-800">{formData.id ? 'Edit business location' : 'Add a new business location'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                    disabled={!!formData.id && locations.some(l => l.id === formData.id)}
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
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Invoice scheme for POS:* <Info size={14} className="text-[#06b6d4]" /></label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                    value={formData.invoiceScheme || ''}
                    onChange={(e) => handleInputChange('invoiceScheme', e.target.value)}
                  >
                    <option value="">Please Select</option>
                    <option value="Atwar">Atwar</option>
                    <option value="Knwz Ard Alkhlyj">Knwz Ard Alkhlyj</option>
                  </select>
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Invoice scheme for sale:*</label>
                  <select 
                    className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
                  >
                    <option value="">Please Select</option>
                    <option value="Atwar">Atwar</option>
                    <option value="Knwz Ard Alkhlyj">Knwz Ard Alkhlyj</option>
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
                    <option value="Default">Default</option>
                    <option value="Knwz Ard Alkhlyj">Knwz Ard Alkhlyj</option>
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
                    <option value="Default">Default</option>
                    <option value="Knwz Ard Alkhlyj">Knwz Ard Alkhlyj</option>
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
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Custom field 1:</label>
                  <input type="text" placeholder="Custom field 1" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Custom field 2:</label>
                  <input type="text" placeholder="Custom field 2" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Custom field 3:</label>
                  <input type="text" placeholder="Custom field 3" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="group">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Custom field 4:</label>
                  <input type="text" placeholder="Custom field 4" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>

              <hr className="my-6 border-slate-200" />

              <div className="group">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">POS screen Featured Products: <Info size={14} className="text-[#06b6d4]" /></label>
                <input type="text" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
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
                    {(formData.paymentMethods || defaultPaymentMethods).map((method) => (
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
                            <option value="None">None</option>
                            <option value="Main Warehouse Cash">Main Warehouse Cash</option>
                            <option value="Bank Muscat - Main">Bank Muscat - Main</option>
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
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-[#343a40] text-white rounded text-sm hover:bg-[#23272b] transition-colors">
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
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                                    <select className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none">
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
                                    <select className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none">
                                        <option value="browser">Browser Based Printing</option>
                                        <option value="network">Network/Thermal Printer</option>
                                    </select>
                                </div>
                            </div>

                            {/* Invoice layout */}
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">
                                    Invoice layout:* <Info size={14} className="text-[#06b6d4]" />
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none border-r border-slate-300 pr-3">
                                        <Info size={16} className="text-slate-600" />
                                    </div>
                                    <select className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none">
                                        <option value="default">Default</option>
                                        <option value="custom">Custom Layout</option>
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
                                    <select className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white appearance-none">
                                        <option value="atwar">Atwar</option>
                                        <option value="default">Default Scheme</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
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
