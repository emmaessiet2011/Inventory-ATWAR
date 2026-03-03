import React from 'react';
import { ArrowLeft, Printer, Edit } from 'lucide-react';

interface ViewProductProps {
  onBack: () => void;
  product: any;
}

const ViewProduct: React.FC<ViewProductProps> = ({ onBack, product }) => {
  // Use passed product data or fallbacks if specific fields are missing
  const data = {
    name: product?.name || 'Activated Carbon 10L',
    sku: product?.sku || '0147',
    brand: product?.brand || 'ClearCat Blanco',
    unit: product?.unit || 'Pc(s)',
    barcodeType: 'C128',
    locations: product?.businessLocation || 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
    category: product?.category || 'Sand (clear cat)',
    subCategory: '--',
    manageStock: 'Yes',
    alertQty: '50.0000',
    expiresIn: '12.00 Months',
    weight: '10Kg',
    tax: product?.tax || 'None',
    taxType: 'Inclusive',
    productType: product?.type || 'Single',
    image: product?.image || 'https://images.unsplash.com/photo-1597843786271-105124152c74?w=300&h=300&fit=crop&q=80',
    sellingPriceExc: product?.sellingPrice || 2.565,
    sellingPriceInc: product?.sellingPrice || 2.565,
    currentStock: product?.stock || 3.000,
    stockValue: (product?.stock || 3) * (product?.sellingPrice || 2.565),
    totalSold: 231.000,
  };

  return (
    <div className="animate-in slide-in-from-right-10 duration-300 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{data.name}</h2>
            <p className="text-slate-500 mt-1 text-lg font-light">Product Details & Stock Information</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={onBack}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm flex items-center gap-2"
            >
                <ArrowLeft size={18} /> Back to List
            </button>
            <button className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 text-sm flex items-center gap-2">
                <Edit size={18} /> Edit Product
            </button>
            <button className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-900/20 text-sm flex items-center gap-2">
                <Printer size={18} /> Print
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Content */}
        <div className="p-8 space-y-10">
            
            {/* Top Info Grid */}
            <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 text-sm text-slate-700">
                    <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">SKU</span>
                            <span className="col-span-2 text-slate-600 font-mono">{data.sku}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Brand</span>
                            <span className="col-span-2 text-slate-600">{data.brand}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Unit</span>
                            <span className="col-span-2 text-slate-600">{data.unit}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Barcode Type</span>
                            <span className="col-span-2 text-slate-600">{data.barcodeType}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Locations</span>
                            <span className="col-span-2 text-slate-600">{data.locations}</span>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                             <span className="font-bold text-slate-900">Category</span>
                             <span className="col-span-2 text-slate-600">{data.category}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                             <span className="font-bold text-slate-900">Sub category</span>
                             <span className="col-span-2 text-slate-600">{data.subCategory}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                             <span className="font-bold text-slate-900">Manage Stock?</span>
                             <span className="col-span-2 text-slate-600">{data.manageStock}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                             <span className="font-bold text-slate-900">Alert quantity</span>
                             <span className="col-span-2 text-slate-600">{data.alertQty}</span>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Expires in</span>
                            <span className="col-span-2 text-slate-600">{data.expiresIn}</span>
                        </div>
                         <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Weight</span>
                            <span className="col-span-2 text-slate-600">{data.weight}</span>
                        </div>
                         <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Applicable Tax</span>
                            <span className="col-span-2 text-slate-600">{data.tax}</span>
                        </div>
                    </div>

                    <div className="space-y-5">
                         <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Tax Type</span>
                            <span className="col-span-2 text-slate-600">{data.taxType}</span>
                        </div>
                         <div className="grid grid-cols-3 gap-4 border-b border-slate-50 pb-2">
                            <span className="font-bold text-slate-900">Product Type</span>
                            <span className="col-span-2 text-slate-600">{data.productType}</span>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-72 flex-shrink-0">
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex items-center justify-center h-full min-h-[200px]">
                        <img src={data.image} alt={data.name} className="w-full h-auto object-contain max-h-64 rounded-lg mix-blend-multiply" />
                    </div>
                </div>
            </div>

            {/* Rack Row Position */}
            <div>
                 <h4 className="text-base font-bold text-slate-900 mb-4">Rack / Row / Position Details</h4>
                 <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <div className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider px-6 py-3 grid grid-cols-12 border-b border-slate-200 min-w-[600px]">
                        <div className="col-span-6">Location</div>
                        <div className="col-span-2">Rack</div>
                        <div className="col-span-2">Row</div>
                        <div className="col-span-2">Position</div>
                    </div>
                    <div className="bg-white text-sm text-slate-700 px-6 py-4 grid grid-cols-12 font-medium min-w-[600px]">
                         <div className="col-span-6">{data.locations}</div>
                         <div className="col-span-2 text-slate-400">--</div>
                         <div className="col-span-2 text-slate-400">--</div>
                         <div className="col-span-2 text-slate-400">--</div>
                    </div>
                 </div>
            </div>

             {/* Pricing */}
             <div>
                 <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <div className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider px-6 py-3 grid grid-cols-12 border-b border-slate-200 min-w-[600px]">
                        <div className="col-span-4">Default Selling Price (Exc. tax)</div>
                        <div className="col-span-4">Default Selling Price (Inc. tax)</div>
                        <div className="col-span-4">Variation Images</div>
                    </div>
                    <div className="bg-white text-sm text-slate-700 px-6 py-4 grid grid-cols-12 font-medium items-center min-w-[600px]">
                         <div className="col-span-4 font-bold text-slate-900">{data.sellingPriceExc.toFixed(3)} OMR</div>
                         <div className="col-span-4 font-bold text-slate-900">{data.sellingPriceInc.toFixed(3)} OMR</div>
                         <div className="col-span-4">
                             <img src={data.image} className="w-10 h-10 object-cover border border-slate-200 rounded-lg bg-white" />
                         </div>
                    </div>
                 </div>
            </div>

            {/* Stock Details */}
             <div>
                 <h4 className="text-base font-bold text-slate-900 mb-4">Product Stock Details</h4>
                 <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <div className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider px-6 py-3 grid grid-cols-9 min-w-[1000px] border-b border-slate-200">
                        <div>SKU</div>
                        <div className="col-span-2">Product</div>
                        <div className="col-span-2">Location</div>
                        <div>Unit Price</div>
                        <div>Current stock</div>
                        <div>Stock Value</div>
                        <div>Total sold</div>
                        <div>Total Transfered</div>
                        <div>Total Adjusted</div>
                    </div>
                    <div className="bg-white text-sm text-slate-700 px-6 py-4 grid grid-cols-9 font-medium min-w-[1000px]">
                         <div className="font-mono text-xs">{data.sku}</div>
                         <div className="col-span-2 font-bold text-slate-900">{data.name}</div>
                         <div className="col-span-2 truncate pr-4 text-slate-500" title={data.locations}>{data.locations}</div>
                         <div>{data.sellingPriceInc.toFixed(3)} OMR</div>
                         <div>
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${data.currentStock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {data.currentStock.toFixed(3)} {data.unit}
                            </span>
                         </div>
                         <div>{data.stockValue.toFixed(3)} OMR</div>
                         <div>{data.totalSold.toFixed(3)} {data.unit}</div>
                         <div className="text-slate-400">0.000 {data.unit}</div>
                         <div className="text-slate-400">0.000 {data.unit}</div>
                    </div>
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default ViewProduct;