import React from 'react';
import { X, Info } from 'lucide-react';

interface InvoiceLayoutFormProps {
    onClose: () => void;
}

const InvoiceLayoutForm: React.FC<InvoiceLayoutFormProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full h-full md:h-[95vh] md:w-[95vw] md:rounded shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-white">
                    <h2 className="text-xl font-bold text-slate-800">Edit invoice layout</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="bg-white border border-slate-200 rounded p-6 space-y-8">
                        {/* Top Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Layout name:*</label>
                                <input type="text" defaultValue="Knwz Ard Alkhlyj" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Design:*</label>
                                <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm">
                                    <option>Classic (For normal printer)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Used for browser based printing</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show letter head
                                </label>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Invoice Logo:</label>
                                    <input type="file" className="text-sm text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                                    <p className="text-xs text-slate-500 mt-1">Max 1 MB, jpeg,gif,png formats only.<br/>Upload only if you want to replace previous logo</p>
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show invoice Logo
                                </label>
                            </div>
                        </div>

                        {/* Header Text Editor (Mock) */}
                        <div>
                            <label className="block text-sm font-bold text-slate-800 mb-1">Header text:</label>
                            <div className="border border-slate-300 rounded overflow-hidden">
                                <div className="bg-slate-100 border-b border-slate-300 p-2 flex gap-2 flex-wrap text-slate-600 text-sm">
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">File</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Edit</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">View</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Insert</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Format</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Tools</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Table</span>
                                    <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Help</span>
                                </div>
                                <div className="bg-slate-50 border-b border-slate-300 p-2 flex gap-2 flex-wrap items-center">
                                    <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"><option>Paragraph</option></select>
                                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                    <button className="font-bold px-2 hover:bg-slate-200 rounded">B</button>
                                    <button className="italic px-2 hover:bg-slate-200 rounded">I</button>
                                    <button className="underline px-2 hover:bg-slate-200 rounded">U</button>
                                </div>
                                <textarea className="w-full h-32 p-3 focus:outline-none text-sm" placeholder="Header text"></textarea>
                                <div className="bg-slate-50 border-t border-slate-300 p-1 text-right text-[10px] text-slate-400">
                                    0 WORDS POWERED BY TINY
                                </div>
                            </div>
                        </div>

                        {/* Sub Headings */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4, 5].map(num => (
                                <div key={num}>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Sub Heading Line {num}:</label>
                                    <input type="text" placeholder={`Sub Heading Line ${num}`} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Middle Sections */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Invoice heading:</label>
                                <input type="text" defaultValue="Tax Invoice" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Heading Suffix for not paid:</label>
                                <input type="text" placeholder="Heading Suffix for not paid" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Heading Suffix for paid:</label>
                                <input type="text" placeholder="Heading Suffix for paid" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Proforma invoice heading: <Info size={14} className="text-[#06b6d4]" /></label>
                                <input type="text" defaultValue="Proforma invoice" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Quotation Heading: <Info size={14} className="text-[#06b6d4]" /></label>
                                <input type="text" defaultValue="Quotation" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Sales Order Heading:</label>
                                <input type="text" defaultValue="Sales Order" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Invoice no. label:</label>
                                <input type="text" defaultValue="Invoice No." className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Quotation no. label:</label>
                                <input type="text" defaultValue="Quotation number" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Date Label:</label>
                                <input type="text" defaultValue="Date" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Due date label:</label>
                                <input type="text" defaultValue="Due Date" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show due date
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Date time format:</label>
                                <input type="text" placeholder="Date time format" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                <p className="text-xs text-slate-500 mt-1">Enter date and time format in <a href="#" className="text-blue-600">PHP datetime format</a>. If blank business date time format will be applied</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Sales Person Label:</label>
                                <input type="text" defaultValue="Sales Person Label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Commission agent label:</label>
                                <input type="text" defaultValue="Commission Agent" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div className="col-span-2"></div>

                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show business name
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show location name
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show Sales Person
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show commission agent
                                </label>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-bold text-slate-800 mb-4">Fields for customer details:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                                        <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        Show Customer information
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Customer Label:</label>
                                    <input type="text" defaultValue="Customer" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                                        <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        Show client ID
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Client ID Label:</label>
                                    <input type="text" placeholder="Client ID Label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                                
                                <div className="col-span-1">
                                    <label className="block text-sm font-bold text-slate-800 mb-1">Client tax number label:</label>
                                    <input type="text" placeholder="Client tax number label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                                </div>
                                <div className="col-span-3 flex items-center gap-6 mt-6">
                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                        Show reward point
                                    </label>
                                </div>

                                {[1, 2, 3, 4].map(num => (
                                    <div key={`cf-${num}`}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            Custom Field {num}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-bold text-slate-800 mb-4">Fields to be shown in location address:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['Landmark', 'City', 'State', 'Country', 'Zip Code', 'Custom field 1', 'Custom field 2', 'Custom field 3', 'Custom field 4'].map((field, idx) => (
                                    <div key={field}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="checkbox" defaultChecked={['City', 'Country'].includes(field)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            {field}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-bold text-slate-800 mb-4">Fields for Communication details:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['Mobile number', 'Alternate number', 'Email'].map((field) => (
                                    <div key={field}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="checkbox" defaultChecked={field === 'Mobile number'} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            {field}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-bold text-slate-800 mb-4">Fields for Tax details:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['Tax 1 details', 'Tax 2 details'].map((field) => (
                                    <div key={field}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="checkbox" defaultChecked={field === 'Tax 2 details'} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            {field}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Details Section */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Product Label:</label>
                                <input type="text" defaultValue="Product" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Quantity Label:</label>
                                <input type="text" defaultValue="Quantity" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Unit Price Label:</label>
                                <input type="text" defaultValue="Unit Price" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Subtotal Label:</label>
                                <input type="text" defaultValue="Subtotal" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Category or HSN code label:</label>
                                <input type="text" placeholder="HSN or Category Code" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total quantity label:</label>
                                <input type="text" placeholder="Total quantity label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Item discount label:</label>
                                <input type="text" placeholder="Item discount label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Discounted unit price label:</label>
                                <input type="text" placeholder="Discounted unit price label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-bold text-slate-800 mb-4">Product details to be shown:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {['Show brand', 'Show SKU', 'Show category code or HSN code', 'Show sale description', 'Show product description', 'Custom Field1', 'Custom Field2', 'Custom Field3', 'Custom Field4', 'Show lot number', 'Show product image', 'Show product expiry', 'Show warranty name', 'Show warranty expiry date', 'Show warranty description', 'Show base unit details (if applicable)'].map((field) => (
                                    <div key={field}>
                                        <label className="flex items-center gap-2 text-sm text-slate-700">
                                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            {field}
                                        </label>
                                        {field === 'Show sale description' && <p className="text-xs text-slate-500 ml-6 mt-1">(Product IMEI or Serial Number)</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Subtotal label:</label>
                                <input type="text" defaultValue="Subtotal" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Discount label:</label>
                                <input type="text" defaultValue="Discount" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Tax label:</label>
                                <input type="text" defaultValue="VATIN" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total label:</label>
                                <input type="text" defaultValue="Total" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total items label:</label>
                                <input type="text" placeholder="Total items label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Round off label:</label>
                                <input type="text" defaultValue="Round Off" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total Due Label (Current sale):</label>
                                <input type="text" defaultValue="Due" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Amount Paid Label:</label>
                                <input type="text" placeholder="Total paid" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show Payment information
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm text-slate-700 mt-6">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show Barcode
                                </label>
                            </div>
                            <div className="col-span-2"></div>

                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total Due Label (All sales):</label>
                                <input type="text" placeholder="Total Due Label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-sm text-slate-700 mt-6">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show total balance due (All sales) <Info size={14} className="text-[#06b6d4]" />
                                </label>
                            </div>
                            <div className="col-span-2">
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Change return label: <Info size={14} className="text-[#06b6d4]" /></label>
                                <input type="text" placeholder="Change Return" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm text-slate-700 mt-6">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    Show total in words <Info size={14} className="text-[#06b6d4]" />
                                </label>
                            </div>
                            <div>
                                <label className="flex items-center gap-1 text-sm font-bold text-slate-800 mb-1">Word Format: <Info size={14} className="text-[#06b6d4]" /></label>
                                <select className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm">
                                    <option>International</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-bold text-slate-800 mb-1">Tax summary label:</label>
                                <input type="text" placeholder="Tax summary label" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6">
                        <label className="block text-sm font-bold text-slate-800 mb-1">Footer text:</label>
                        <div className="border border-slate-300 rounded overflow-hidden">
                            <div className="bg-slate-100 border-b border-slate-300 p-2 flex gap-2 flex-wrap text-slate-600 text-sm">
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">File</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Edit</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">View</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Insert</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Format</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Tools</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Table</span>
                                <span className="px-2 py-1 hover:bg-slate-200 cursor-pointer rounded">Help</span>
                            </div>
                            <div className="bg-slate-50 border-b border-slate-300 p-2 flex gap-2 flex-wrap items-center">
                                <select className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"><option>Paragraph</option></select>
                                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                <button className="font-bold px-2 hover:bg-slate-200 rounded">B</button>
                                <button className="italic px-2 hover:bg-slate-200 rounded">I</button>
                                <button className="underline px-2 hover:bg-slate-200 rounded">U</button>
                            </div>
                            <div className="w-full h-32 p-3 focus:outline-none text-sm border-none">
                                <p className="font-bold underline italic mb-2">Received By</p>
                                <p className="font-bold italic mb-2">Name:</p>
                                <p className="font-bold italic mb-2">Signature:</p>
                                <p className="font-bold italic">"Received in good condition; payment as agreed."</p>
                            </div>
                            <div className="bg-slate-50 border-t border-slate-300 p-1 flex justify-between text-[10px] text-slate-400">
                                <span>P » SPAN » SPAN » EM » STRONG</span>
                                <span>11 WORDS POWERED BY TINY</span>
                            </div>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6">
                        <h4 className="font-bold text-slate-800 mb-4">QR Code</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                Show QR Code
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                Show Labels
                            </label>
                            <label className="flex items-center gap-1 text-sm text-slate-700">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                ZATCA (Fatoora) QR code <Info size={14} className="text-[#06b6d4]" />
                            </label>
                        </div>

                        <h4 className="font-bold text-slate-800 mb-4">Fields to be shown:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {['Business Name', 'Business location address', 'Business tax 1', 'Business tax 2', 'Invoice No.', 'Invoice Datetime', 'Subtotal', 'Total amount with tax', 'Total Tax', 'Customer name', 'Invoice URL'].map((field) => (
                                <label key={field} className="flex items-center gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    {field}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Credit Note / Sell Return Details */}
                    <div className="bg-white border border-slate-200 rounded p-6 mt-6 space-y-6">
                        <h4 className="font-bold text-slate-800">Credit Note / Sell Return Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Heading:</label>
                                <input type="text" defaultValue="Credit Note" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Reference Number:</label>
                                <input type="text" defaultValue="Reference No" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-800 mb-1">Total Amount:</label>
                                <input type="text" defaultValue="Credit Amount" className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-center">
                    <button onClick={onClose} className="bg-[#4F46E5] text-white px-8 py-2 rounded font-bold hover:bg-indigo-700 transition">
                        Update
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceLayoutForm;
