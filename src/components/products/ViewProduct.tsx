import React from 'react';
import { ArrowLeft, Printer, Edit, Image as ImageIcon } from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { formatUnitWithPack, getPackHint } from '@/utils/productPackaging';
import { printDocument } from '@/utils/printUtils';
import {
  computeSellingPriceGroupProductPrice,
  findSellingPriceGroupProductRule,
  getSellingPriceGroupProductRules,
} from '@/utils/sellingPriceGroups';

interface ViewProductProps {
  onBack: () => void;
  onEdit?: (product: Product) => void;
  product: Product | null;
}

const ViewProduct: React.FC<ViewProductProps> = ({ onBack, onEdit, product }) => {
  const { formatCurrency, warranties, sellingPriceGroups, settings, currentUser } = useGlobalContext();

  if (!product) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-900">Product Details</h2>
          <button onClick={onBack} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600">
            <ArrowLeft size={14} className="inline mr-1" /> Back
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          No product selected.
        </div>
      </div>
    );
  }

  const locationRows = product.locationRackDetails
    ? Object.entries(product.locationRackDetails as Record<string, { rack: string; row: string; position: string }>).map(([location, details]) => ({
        location,
        rack: details?.rack || '--',
        row: details?.row || '--',
        position: details?.position || '--',
      }))
    : [{
        location: product.businessLocation || '--',
        rack: product.rack || '--',
        row: product.row || '--',
        position: product.position || '--',
      }];

  const stockValue = Number(((Number(product.stock) || 0) * (Number(product.sellingPrice) || 0)).toFixed(3));
  const unitDisplay = formatUnitWithPack(product.unit, product.packagingType, product.unitsPerPackage);
  const packHint = getPackHint(product.unit, product.packagingType, product.unitsPerPackage);
  const resolvedWarrantyLabel = (() => {
    const value = String(product.warranty || '').trim();
    if (!value) return '--';
    const byId = warranties.find(warranty => warranty.id === value);
    if (byId) return `${byId.name} (${byId.duration} ${byId.durationUnit})`;
    const byName = warranties.find(warranty => warranty.name.trim().toLowerCase() === value.toLowerCase());
    if (byName) return `${byName.name} (${byName.duration} ${byName.durationUnit})`;
    return value;
  })();

  const sellingPriceGroupRows = sellingPriceGroups
    .filter((group) => group.status === 'Active')
    .map((group) => {
      const basePrice = Number(product.sellingPrice || 0);
      const applicableProducts = getSellingPriceGroupProductRules(group);
      const productRule = findSellingPriceGroupProductRule(group, product);
      const computedPrice = computeSellingPriceGroupProductPrice(group, product, { basePrice });
      const hasSpecificRules = applicableProducts.length > 0;
      const appliesToProduct = !hasSpecificRules || !!productRule;
      const discount = appliesToProduct
        ? (productRule?.discount != null && Number.isFinite(Number(productRule.discount))
          ? Number(productRule.discount)
          : Number(group.discount || 0))
        : 0;

      return {
        id: group.id,
        name: group.name,
        discount,
        priceAdjustment: Number(group.priceCalcPercentage || 0),
        taxRate: Number(group.taxRate || 0),
        finalPrice: computedPrice.price,
        appliesToProduct,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const handlePrint = () => {
    const printRows: string[][] = [
      ['Product', 'Name', product.name || '--'],
      ['Product', 'SKU', product.sku || '--'],
      ['Product', 'Type', product.type || '--'],
      ['Product', 'Category', product.category || '--'],
      ['Product', 'Sub Category', product.subCategory || '--'],
      ['Product', 'Brand', product.brand || '--'],
      ['Product', 'Unit', unitDisplay || '--'],
      ['Product', 'Pack / Carton Size', packHint || '--'],
      ['Product', 'Barcode Type', product.barcodeType || '--'],
      ['Product', 'Warranty', resolvedWarrantyLabel],
      ['Inventory', 'Current Stock', `${Number(product.stock || 0).toFixed(3)} ${unitDisplay}`],
      ['Inventory', 'Unit Purchase Price', formatCurrency(product.unitPurchasePrice || 0)],
      ['Inventory', 'Unit Selling Price', formatCurrency(product.sellingPrice || 0)],
      ['Inventory', 'Stock Value', formatCurrency(stockValue)],
      ['Inventory', 'Alert Quantity', product.alertQuantity != null ? Number(product.alertQuantity).toFixed(3) : '--'],
      ['Tax', 'Applicable Tax', product.tax || '--'],
      ['Tax', 'Tax Type', product.taxType || '--'],
      ['Location', 'Business Location', product.businessLocation || '--'],
    ];

    sellingPriceGroupRows.forEach((row) => {
      const applicability = row.appliesToProduct ? 'Applies' : 'Not applied';
      const detail = `Adj ${row.priceAdjustment.toFixed(3)}% | Disc ${row.discount.toFixed(3)}% | Tax ${row.taxRate.toFixed(3)}% | ${applicability}`;
      printRows.push(['Selling Price Group', row.name, `${formatCurrency(row.finalPrice)} (${detail})`]);
    });

    locationRows.forEach((row) => {
      const locationDetail = `Rack: ${row.rack} | Row: ${row.row} | Position: ${row.position}`;
      printRows.push(['Location Detail', row.location || '--', locationDetail]);
    });

    if (product.description) {
      printRows.push(['Notes', 'Description', product.description]);
    }

    const subtitleParts = [
      product.businessLocation ? `Location: ${product.businessLocation}` : '',
      product.category ? `Category: ${product.category}` : '',
      product.brand ? `Brand: ${product.brand}` : '',
    ].filter(Boolean);

    printDocument({
      title: 'Product View',
      subtitle: subtitleParts.join(' | ') || undefined,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings.address || '',
      printedBy: currentUser?.name || currentUser?.username || '',
      columns: [
        { label: 'Section', width: '22%' },
        { label: 'Field', width: '30%' },
        { label: 'Value', width: '48%' },
      ],
      rows: printRows,
      stats: [
        { label: 'Current Stock', value: `${Number(product.stock || 0).toFixed(3)} ${unitDisplay}`, color: 'blue' },
        { label: 'Unit Selling Price', value: formatCurrency(product.sellingPrice || 0), color: 'green' },
        { label: 'Stock Value', value: formatCurrency(stockValue), color: 'amber' },
      ],
    });
  };

  return (
    <div className="animate-in slide-in-from-right-10 duration-300 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">{product.name}</h2>
          <p className="text-slate-500 mt-1 text-sm">Product details from GlobalContext</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 text-sm flex items-center gap-2"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={() => onEdit?.(product)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm flex items-center gap-2"
          >
            <Edit size={14} /> Edit Product
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="font-bold text-slate-700">SKU:</span> <span className="text-slate-600">{product.sku || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Brand:</span> <span className="text-slate-600">{product.brand || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Unit:</span> <span className="text-slate-600">{unitDisplay}</span></div>
            <div><span className="font-bold text-slate-700">Pack / Carton Size:</span> <span className="text-slate-600">{packHint || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Barcode Type:</span> <span className="text-slate-600">{product.barcodeType || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Location:</span> <span className="text-slate-600">{product.businessLocation || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Category:</span> <span className="text-slate-600">{product.category || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Warranty:</span> <span className="text-slate-600">{resolvedWarrantyLabel}</span></div>
            <div><span className="font-bold text-slate-700">Sub category:</span> <span className="text-slate-600">{product.subCategory || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Alert qty:</span> <span className="text-slate-600">{product.alertQuantity != null ? product.alertQuantity.toFixed(3) : '--'}</span></div>
            <div><span className="font-bold text-slate-700">Weight:</span> <span className="text-slate-600">{product.weight != null ? `${product.weight} kg` : '--'}</span></div>
            <div><span className="font-bold text-slate-700">Applicable tax:</span> <span className="text-slate-600">{product.tax || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Tax type:</span> <span className="text-slate-600">{product.taxType || '--'}</span></div>
            <div><span className="font-bold text-slate-700">Product type:</span> <span className="text-slate-600">{product.type}</span></div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-center min-h-[220px]">
            {product.image ? (
              <img src={product.image} alt={product.name} className="w-full h-auto object-contain max-h-60 rounded-lg" />
            ) : (
              <div className="text-slate-400 flex flex-col items-center gap-2">
                <ImageIcon size={28} />
                <span className="text-xs">No image</span>
              </div>
            )}
          </div>
        </div>

        {product.description && (
          <div className="text-sm">
            <span className="font-bold text-slate-700">Description:</span>
            <p className="mt-1 text-slate-600 whitespace-pre-wrap">{product.description}</p>
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Current Stock</th>
                <th className="px-4 py-3 text-left">Unit Purchase Price</th>
                <th className="px-4 py-3 text-left">Unit Selling Price</th>
                <th className="px-4 py-3 text-left">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3">{(product.stock || 0).toFixed(3)} {unitDisplay}</td>
                <td className="px-4 py-3">{formatCurrency(product.unitPurchasePrice || 0)}</td>
                <td className="px-4 py-3">{formatCurrency(product.sellingPrice || 0)}</td>
                <td className="px-4 py-3">{formatCurrency(stockValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Selling Price Group</th>
                <th className="px-4 py-3 text-left">Price Adj. %</th>
                <th className="px-4 py-3 text-left">Discount %</th>
                <th className="px-4 py-3 text-left">Tax %</th>
                <th className="px-4 py-3 text-left">Unit Price</th>
                <th className="px-4 py-3 text-left">Applies</th>
              </tr>
            </thead>
            <tbody>
              {sellingPriceGroupRows.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={6}>No active selling price groups.</td>
                </tr>
              )}
              {sellingPriceGroupRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.priceAdjustment.toFixed(3)}%</td>
                  <td className="px-4 py-3 text-slate-600">{row.discount.toFixed(3)}%</td>
                  <td className="px-4 py-3 text-slate-600">{row.taxRate.toFixed(3)}%</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{formatCurrency(row.finalPrice)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold ${
                        row.appliesToProduct
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.appliesToProduct ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Rack</th>
                <th className="px-4 py-3 text-left">Row</th>
                <th className="px-4 py-3 text-left">Position</th>
              </tr>
            </thead>
            <tbody>
              {locationRows.map((row, idx) => (
                <tr key={`${row.location}-${idx}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">{row.location}</td>
                  <td className="px-4 py-3">{row.rack}</td>
                  <td className="px-4 py-3">{row.row}</td>
                  <td className="px-4 py-3">{row.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ViewProduct;
