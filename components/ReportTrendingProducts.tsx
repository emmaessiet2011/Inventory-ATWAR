import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Filter, Info, Printer, TrendingUp} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

import MultiSelect from './MultiSelect';

import { printActiveReportTable } from '../src/utils/printUtils';
import { parseExpenseDateToMs } from '../src/utils/expenses';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface TrendingRow {
  key: string;
  name: string;
  sold: number;
  category: string;
  subCategory: string;
  brand: string;
  unit: string;
  productType: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const toDayStartMs = (value: Date | null): number | null => (
  value
    ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime()
    : null
);

const toDayEndMs = (value: Date | null): number | null => (
  value
    ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999).getTime()
    : null
);

const parseTopN = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(500, Math.max(1, Math.floor(parsed)));
};

const parseDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const buildTrendKey = (productId: string, sku: string, name: string): string => {
  const idKey = normalize(productId);
  if (idKey) return `id@@${idKey}`;
  const skuKey = normalize(sku);
  if (skuKey) return `sku@@${skuKey}`;
  return `name@@${normalize(name)}`;
};

const downloadBlob = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ReportTrendingProducts: React.FC = () => {
  const { locations, products, sales, sellReturns } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [pendingFilters, setPendingFilters] = useState({
      location: [] as string[],
      category: [] as string[],
      subCategory: [] as string[],
      brand: [] as string[],
      unit: [] as string[],
      productType: [] as string[],
  });
  const [appliedFilters, setAppliedFilters] = useState(pendingFilters);
  const [pendingRange, setPendingRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [appliedRange, setAppliedRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [pendingTopN, setPendingTopN] = useState('5');
  const [appliedTopN, setAppliedTopN] = useState(5);

  const startMs = useMemo(() => toDayStartMs(appliedRange.startDate), [appliedRange.startDate]);
  const endMs = useMemo(() => toDayEndMs(appliedRange.endDate), [appliedRange.endDate]);

  const selectedLocations = useMemo(
    () => new Set(appliedFilters.location.map(normalize)),
    [appliedFilters.location],
  );
  const selectedCategories = useMemo(
    () => new Set(appliedFilters.category.map(normalize)),
    [appliedFilters.category],
  );
  const selectedSubCategories = useMemo(
    () => new Set(appliedFilters.subCategory.map(normalize)),
    [appliedFilters.subCategory],
  );
  const selectedBrands = useMemo(
    () => new Set(appliedFilters.brand.map(normalize)),
    [appliedFilters.brand],
  );
  const selectedUnits = useMemo(
    () => new Set(appliedFilters.unit.map(normalize)),
    [appliedFilters.unit],
  );
  const selectedProductTypes = useMemo(
    () => new Set(appliedFilters.productType.map(normalize)),
    [appliedFilters.productType],
  );

  const productById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => map.set(String(product.id || ''), product));
    return map;
  }, [products]);

  const productByName = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      const key = normalize(product.name);
      if (key) map.set(key, product);
    });
    return map;
  }, [products]);

  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((loc) => String(loc.name || '').trim()),
      ...sales.map((sale) => String(sale.location || '').trim()),
      ...sellReturns.map((row) => String(row.location || '').trim()),
    ].filter(Boolean))).sort(),
    [locations, sales, sellReturns],
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.category || '').trim()).filter(Boolean))).sort(),
    [products],
  );
  const subCategoryOptions = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.subCategory || '').trim()).filter(Boolean))).sort(),
    [products],
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.brand || '').trim()).filter(Boolean))).sort(),
    [products],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.unit || '').trim()).filter(Boolean))).sort(),
    [products],
  );
  const productTypeOptions = useMemo(
    () => Array.from(new Set(products.map((product) => String(product.type || '').trim()).filter(Boolean))).sort(),
    [products],
  );

  const isWithinAppliedRange = (dateValue: string) => {
    const dateMs = parseDateToMs(dateValue);
    if (!Number.isFinite(dateMs)) return false;
    if (startMs != null && dateMs < startMs) return false;
    if (endMs != null && dateMs > endMs) return false;
    return true;
  };

  const passesMetaFilters = (row: Omit<TrendingRow, 'sold' | 'key'>) => {
    if (selectedCategories.size > 0 && !selectedCategories.has(normalize(row.category))) return false;
    if (selectedSubCategories.size > 0 && !selectedSubCategories.has(normalize(row.subCategory))) return false;
    if (selectedBrands.size > 0 && !selectedBrands.has(normalize(row.brand))) return false;
    if (selectedUnits.size > 0 && !selectedUnits.has(normalize(row.unit))) return false;
    if (selectedProductTypes.size > 0 && !selectedProductTypes.has(normalize(row.productType))) return false;
    return true;
  };

  const allTrendingRows = useMemo<TrendingRow[]>(() => {
    const map = new Map<string, TrendingRow>();

    const upsert = (base: Omit<TrendingRow, 'sold'>, qtyDelta: number) => {
      const existing = map.get(base.key);
      if (existing) {
        existing.sold = round3(existing.sold + qtyDelta);
        return;
      }
      map.set(base.key, { ...base, sold: round3(qtyDelta) });
    };

    sales.forEach((sale) => {
      const saleStatus = normalize(sale.status || sale.saleStatus);
      if (saleStatus !== 'final') return;
      if (!isWithinAppliedRange(String(sale.date || ''))) return;
      const saleLocation = String(sale.location || '').trim();
      if (selectedLocations.size > 0 && !selectedLocations.has(normalize(saleLocation))) return;

      (sale.items || []).forEach((item) => {
        const qty = Number(item.qty || 0);
        if (!Number.isFinite(qty) || qty <= 0) return;

        const matchedProduct = productById.get(String(item.id || '')) || productByName.get(normalize(item.name));
        const name = String(item.name || matchedProduct?.name || 'Unknown Product').trim() || 'Unknown Product';
        const productId = String(matchedProduct?.id || item.id || '').trim();
        const sku = String(matchedProduct?.sku || item.id || '').trim();
        const category = String(matchedProduct?.category || '--').trim() || '--';
        const subCategory = String(matchedProduct?.subCategory || '--').trim() || '--';
        const brand = String(matchedProduct?.brand || '--').trim() || '--';
        const unit = String(item.unit || matchedProduct?.unit || '').trim();
        const productType = String(matchedProduct?.type || 'Single').trim();
        const key = buildTrendKey(productId, sku, name);

        const row = { key, name, category, subCategory, brand, unit, productType };
        if (!passesMetaFilters(row)) return;
        upsert(row, qty);
      });
    });

    sellReturns.forEach((sellReturn) => {
      if (!isWithinAppliedRange(String(sellReturn.date || ''))) return;
      const returnLocation = String(sellReturn.location || '').trim();
      if (selectedLocations.size > 0 && !selectedLocations.has(normalize(returnLocation))) return;

      (sellReturn.items || []).forEach((item) => {
        const qty = Number(item.qty || 0);
        if (!Number.isFinite(qty) || qty <= 0) return;

        const matchedProduct = productById.get(String(item.productId || '')) || productByName.get(normalize(item.productName));
        const name = String(item.productName || matchedProduct?.name || 'Unknown Product').trim() || 'Unknown Product';
        const productId = String(matchedProduct?.id || item.productId || '').trim();
        const sku = String(matchedProduct?.sku || item.productId || '').trim();
        const category = String(matchedProduct?.category || '--').trim() || '--';
        const subCategory = String(matchedProduct?.subCategory || '--').trim() || '--';
        const brand = String(matchedProduct?.brand || '--').trim() || '--';
        const unit = String(item.unit || matchedProduct?.unit || '').trim();
        const productType = String(matchedProduct?.type || 'Single').trim();
        const key = buildTrendKey(productId, sku, name);

        const row = { key, name, category, subCategory, brand, unit, productType };
        if (!passesMetaFilters(row)) return;
        upsert(row, -qty);
      });
    });

    return Array.from(map.values())
      .filter((row) => row.sold > 0)
      .sort((a, b) => b.sold - a.sold);
  }, [
    sales,
    sellReturns,
    productById,
    productByName,
    selectedLocations,
    selectedCategories,
    selectedSubCategories,
    selectedBrands,
    selectedUnits,
    selectedProductTypes,
    startMs,
    endMs,
  ]);

  const filteredData = useMemo(
    () => allTrendingRows.slice(0, appliedTopN),
    [allTrendingRows, appliedTopN],
  );

  const totalUnitsSold = useMemo(
    () => round3(filteredData.reduce((sum, row) => sum + row.sold, 0)),
    [filteredData],
  );

  const chartWidth = useMemo(
    () => {
      const perBarWidth = filteredData.length > 100 ? 44 : filteredData.length > 40 ? 56 : 78;
      return Math.max(760, filteredData.length * perBarWidth);
    },
    [filteredData.length],
  );
  const xAxisInterval = useMemo(
    () => (filteredData.length <= 24 ? 0 : Math.ceil(filteredData.length / 24) - 1),
    [filteredData.length],
  );
  const shouldRotateTicks = filteredData.length > 12;
  const barSize = useMemo(() => {
    if (filteredData.length > 40) return 20;
    if (filteredData.length > 20) return 28;
    return 36;
  }, [filteredData.length]);

  const handleExportCsv = () => {
    const headers = ['Product', 'Sold Units', 'Category', 'Sub Category', 'Brand', 'Unit', 'Product Type'];
    const lines = filteredData.map((row) => [
      `"${String(row.name).replace(/"/g, '""')}"`,
      row.sold.toFixed(3),
      `"${String(row.category).replace(/"/g, '""')}"`,
      `"${String(row.subCategory).replace(/"/g, '""')}"`,
      `"${String(row.brand).replace(/"/g, '""')}"`,
      `"${String(row.unit).replace(/"/g, '""')}"`,
      `"${String(row.productType).replace(/"/g, '""')}"`,
    ].join(','));
    downloadBlob(
      `trending_products_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...lines].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  const handleExportExcel = () => {
    const headers = ['Product', 'Sold Units', 'Category', 'Sub Category', 'Brand', 'Unit', 'Product Type'];
    const lines = filteredData.map((row) => [
      row.name,
      row.sold.toFixed(3),
      row.category,
      row.subCategory,
      row.brand,
      row.unit,
      row.productType,
    ].join('\t'));
    downloadBlob(
      `trending_products_${new Date().toISOString().slice(0, 10)}.xls`,
      [headers.join('\t'), ...lines].join('\n'),
      'application/vnd.ms-excel;charset=utf-8;',
    );
  };

  const handleExportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) {
        printActiveReportTable();
        return;
      }

      const doc = new JsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const margin = 28;
      const rowHeight = 16;
      const maxY = 560;
      let y = 36;

      doc.setFontSize(14);
      doc.text('Trending Products Report', margin, y);
      y += rowHeight + 4;

      doc.setFontSize(9);
      doc.text(`Date Range: ${appliedRange.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Top N: ${appliedTopN}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight + 4;

      const x = {
        product: 28,
        sold: 312,
        category: 372,
        subCategory: 470,
        brand: 568,
        unit: 652,
        type: 710,
      };

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.text('Product', x.product, y);
        doc.text('Sold', x.sold, y);
        doc.text('Category', x.category, y);
        doc.text('Sub Category', x.subCategory, y);
        doc.text('Brand', x.brand, y);
        doc.text('Unit', x.unit, y);
        doc.text('Type', x.type, y);
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      drawHeader();

      if (filteredData.length === 0) {
        doc.text('No data available for selected filters.', margin, y);
        y += rowHeight;
      } else {
        filteredData.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 34;
            drawHeader();
          }
          doc.text(String(row.name || '').slice(0, 36), x.product, y);
          doc.text(row.sold.toFixed(3), x.sold, y);
          doc.text(String(row.category || '').slice(0, 16), x.category, y);
          doc.text(String(row.subCategory || '').slice(0, 16), x.subCategory, y);
          doc.text(String(row.brand || '').slice(0, 14), x.brand, y);
          doc.text(String(row.unit || '').slice(0, 8), x.unit, y);
          doc.text(String(row.productType || '').slice(0, 10), x.type, y);
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 34;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Units Sold: ${totalUnitsSold.toFixed(3)}`, margin, y + rowHeight);
      doc.save(`trending_products_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  const applyFilters = () => {
    const nextTopN = parseTopN(pendingTopN, appliedTopN);
    setAppliedFilters({ ...pendingFilters });
    setAppliedRange({ ...pendingRange });
    setAppliedTopN(nextTopN);
    setPendingTopN(String(nextTopN));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trending Products</h1>
          <p className="text-slate-500 text-sm mt-0.5">Top selling products by quantity and revenue</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
                <div className="group">
                    <MultiSelect 
                        label="Business Location"
                        options={locationOptions}
                        selected={pendingFilters.location}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, location: val })}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Category"
                        options={categoryOptions}
                        selected={pendingFilters.category}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, category: val })}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Sub category"
                        options={subCategoryOptions}
                        selected={pendingFilters.subCategory}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, subCategory: val })}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={brandOptions}
                        selected={pendingFilters.brand}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, brand: val })}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Unit"
                        options={unitOptions}
                        selected={pendingFilters.unit}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, unit: val })}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter onRangeSelect={(range) => setPendingRange(range as DateRangeValue)} />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">Number of products: <Info size={10} className="text-blue-500"/></label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={pendingTopN}
                      onChange={(event) => setPendingTopN(event.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none"
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Product Type"
                        options={productTypeOptions}
                        selected={pendingFilters.productType}
                        onChange={(val) => setPendingFilters({ ...pendingFilters, productType: val })}
                    />
                </div>
                <div className="md:col-span-4 flex justify-end">
                    <button
                      type="button"
                      onClick={applyFilters}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-blue-700"
                    >
                      Apply Filters
                    </button>
                </div>
            </div>
          )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">Top Trending Products <Info size={14} className="text-blue-500"/></h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                >
                  <FileText size={12} /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet size={12} /> Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => printActiveReportTable()}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={12} /> Print
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={12} /> Export PDF
                </button>
              </div>
          </div>
          
          <div className="h-96 w-full overflow-x-auto overflow-y-hidden">
            <div className="h-full" style={{ minWidth: `${chartWidth}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        interval={xAxisInterval}
                        angle={shouldRotateTicks ? -30 : 0}
                        textAnchor={shouldRotateTicks ? 'end' : 'middle'}
                        height={shouldRotateTicks ? 72 : 30}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="sold" fill="#7cb5ec" name="Total unit sold" barSize={barSize} />
                  </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 text-center">
            Showing top {appliedTopN} products for <span className="font-bold text-slate-700">{appliedRange.label || 'Selected range'}</span>
          </div>
          {filteredData.length === 0 && (
            <div className="mt-3 text-xs text-slate-400 text-center italic">No data available for selected filters.</div>
          )}
          <div className="flex justify-center items-center gap-2 mt-4 text-xs text-slate-600">
              <div className="w-3 h-3 bg-[#7cb5ec] rounded-full"></div> Total unit sold: {totalUnitsSold.toFixed(3)}
          </div>
      </div>
    </div>
  );
};

export default ReportTrendingProducts;

