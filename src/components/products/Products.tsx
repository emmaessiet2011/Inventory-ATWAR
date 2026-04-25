import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, Download, Edit, Trash2, Eye,
  ChevronDown, X, Image as ImageIcon, Upload, Save, Info,
  AlertTriangle
} from 'lucide-react';
import { useGlobalContext, Product } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument } from '@/utils/printUtils';
import { buildPaginationItems } from '@/utils/pagination';
import { compressImageFileToDataUrl } from '@/utils/imageCompression';
import ViewProduct from './ViewProduct';

const Products: React.FC = () => {
  const {
    products, addProduct, updateProduct, deleteProduct,
    productCategories, productBrands, productUnits, taxRates, locations,
    formatCurrency, generateId, settings, currentUser,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const imageRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<'list' | 'add' | 'view'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Pagination & row selection
  const [pageSize, setPageSize] = useState(Number(settings.defaultTableEntries) || 25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column visibility
  const [showColMenu, setShowColMenu] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);

  // Filter states
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterTax, setFilterTax] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  // Product image state for add/edit form
  const [productImage, setProductImage] = useState('');
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcodeType: 'Code 128 (C128)',
    unit: '',
    brand: '',
    category: '',
    subCategory: '',
    businessLocation: '',
    alertQuantity: '',
    description: '',
    weight: '',
    tax: '--',
    taxType: 'Exclusive',
    type: 'Single',
    purchasePrice: '',
    profitMargin: '',
    sellingPrice: '',
  });

  const resetForm = () => {
    setFormData({
      name: '', sku: '', barcodeType: 'Code 128 (C128)', unit: '', brand: '',
      category: '', subCategory: '', businessLocation: '', alertQuantity: '',
      description: '', weight: '', tax: '--', taxType: 'Exclusive',
      type: 'Single', purchasePrice: '', profitMargin: '', sellingPrice: '',
    });
    setProductImage('');
    setEditingProduct(null);
  };

  const resolveCategoryLink = (rawCategoryName: string, existingCategoryId?: string): { id: string; name: string } => {
    const categoryName = String(rawCategoryName || '').trim();
    const byId = existingCategoryId
      ? productCategories.find(category => category.id === existingCategoryId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };
    if (categoryName) {
      const byName = productCategories.find(category => category.name.trim().toLowerCase() === categoryName.toLowerCase());
      if (byName) return { id: byName.id, name: byName.name };
      return { id: '', name: categoryName };
    }
    const uncategorized = productCategories.find(category => category.name.trim().toLowerCase() === 'uncategorized');
    return uncategorized
      ? { id: uncategorized.id, name: uncategorized.name }
      : { id: '', name: 'Uncategorized' };
  };

  const resolveBrandLink = (rawBrandName: string, existingBrandId?: string): { id: string; name: string } => {
    const brandName = String(rawBrandName || '').trim();
    const byId = existingBrandId
      ? productBrands.find(brand => brand.id === existingBrandId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };
    if (brandName) {
      const byName = productBrands.find(brand => brand.name.trim().toLowerCase() === brandName.toLowerCase());
      if (byName) return { id: byName.id, name: byName.name };
      return { id: '', name: brandName };
    }
    const unknown = productBrands.find(brand => brand.name.trim() === '--');
    return unknown
      ? { id: unknown.id, name: unknown.name }
      : { id: '', name: '--' };
  };

  // ── Tax calc helpers ─────────────────────────────────────────
  const selectedTaxRate = formData.tax === '--' ? 0 : (taxRates.find(t => t.name === formData.tax)?.rate || 0);
  const purchasePriceInc = formData.purchasePrice
    ? parseFloat((parseFloat(formData.purchasePrice) * (1 + selectedTaxRate / 100)).toFixed(3))
    : 0;
  const sellingPriceInc = formData.sellingPrice
    ? parseFloat((parseFloat(formData.sellingPrice) * (1 + selectedTaxRate / 100)).toFixed(3))
    : 0;

  // ── Price change handlers ────────────────────────────────────
  const calcSP = (purchase: number, margin: number) =>
    parseFloat((purchase + purchase * (margin / 100)).toFixed(3));

  const handlePriceChange = (field: 'purchase' | 'margin' | 'selling', value: string) => {
    const d = { ...formData, [field === 'purchase' ? 'purchasePrice' : field === 'margin' ? 'profitMargin' : 'sellingPrice']: value };
    if (field === 'purchase' && d.profitMargin) {
      d.sellingPrice = String(calcSP(parseFloat(value) || 0, parseFloat(d.profitMargin) || 0));
    } else if (field === 'margin' && d.purchasePrice) {
      d.sellingPrice = String(calcSP(parseFloat(d.purchasePrice) || 0, parseFloat(value) || 0));
    } else if (field === 'selling' && d.purchasePrice) {
      const purchase = parseFloat(d.purchasePrice) || 0;
      const selling = parseFloat(value) || 0;
      if (purchase > 0) d.profitMargin = (((selling - purchase) / purchase) * 100).toFixed(2);
    }
    setFormData(d);
  };

  // ── Image upload ─────────────────────────────────────────────
  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      addNotification({ title: 'Error', message: 'Please select a valid image file.', type: 'error' });
      return;
    }
    try {
      const compressed = await compressImageFileToDataUrl(file, {
        maxWidth: 640,
        maxHeight: 640,
        frameWidth: 640,
        frameHeight: 640,
        frameBackground: '#ffffff',
        targetMaxKB: 120,
        quality: 0.62,
        minQuality: 0.35,
        format: 'image/webp',
      });
      setProductImage(compressed);
    } catch {
      addNotification({ title: 'Error', message: 'Unable to process this image.', type: 'error' });
    }
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = () => {
    if (!formData.name.trim()) {
      addNotification({ title: 'Validation Error', message: 'Product Name is required.', type: 'error' });
      return;
    }

    const generatedSku = `${settings.skuPrefix || ''}${Date.now().toString().slice(-6)}`;
    const resolvedSku = (formData.sku.trim() || generatedSku).trim();
    const duplicate = products.find(p =>
      p.sku.trim().toLowerCase() === resolvedSku.toLowerCase() &&
      (!editingProduct || p.id !== editingProduct.id)
    );
    if (duplicate) {
      addNotification({ title: 'Validation Error', message: `SKU "${resolvedSku}" already exists.`, type: 'error' });
      return;
    }

    const resolvedLocation = formData.businessLocation || locations[0]?.name || '';
    const resolvedCategory = resolveCategoryLink(formData.category, editingProduct?.categoryId);
    const resolvedBrand = resolveBrandLink(formData.brand, editingProduct?.brandId);

    if (editingProduct) {
      const parsedPurchasePrice = formData.purchasePrice === '' ? editingProduct.unitPurchasePrice : Number(formData.purchasePrice);
      const parsedSellingPrice = formData.sellingPrice === '' ? editingProduct.sellingPrice : Number(formData.sellingPrice);
      const updated: Product = {
        ...editingProduct,
        name: formData.name.trim(),
        sku: resolvedSku,
        type: formData.type as Product['type'],
        categoryId: resolvedCategory.id || editingProduct.categoryId || '',
        category: resolvedCategory.name || editingProduct.category,
        brandId: resolvedBrand.id || editingProduct.brandId || '',
        brand: resolvedBrand.name || editingProduct.brand,
        unit: formData.unit || editingProduct.unit,
        alertQuantity: formData.alertQuantity ? Number(formData.alertQuantity) : editingProduct.alertQuantity,
        unitPurchasePrice: Number.isFinite(parsedPurchasePrice) ? parsedPurchasePrice : editingProduct.unitPurchasePrice,
        sellingPrice: Number.isFinite(parsedSellingPrice) ? parsedSellingPrice : editingProduct.sellingPrice,
        tax: formData.tax || editingProduct.tax,
        taxType: formData.taxType || editingProduct.taxType,
        description: formData.description || editingProduct.description,
        barcodeType: formData.barcodeType,
        weight: formData.weight ? parseFloat(formData.weight) : editingProduct.weight,
        subCategory: formData.subCategory || editingProduct.subCategory,
        businessLocation: resolvedLocation,
        image: productImage || editingProduct.image,
      };
      updateProduct(updated);
      addNotification({ title: 'Success', message: `"${updated.name}" updated successfully.`, type: 'success' });
    } else {
      const newProduct: Product = {
        id: generateId('PRD'),
        name: formData.name.trim(),
        sku: resolvedSku,
        type: formData.type as Product['type'],
        categoryId: resolvedCategory.id,
        category: resolvedCategory.name || 'Uncategorized',
        brandId: resolvedBrand.id,
        brand: resolvedBrand.name || '--',
        businessLocation: resolvedLocation,
        unit: formData.unit || 'Pc(s)',
        alertQuantity: formData.alertQuantity ? Number(formData.alertQuantity) : undefined,
        unitPurchasePrice: Number(formData.purchasePrice) || 0,
        sellingPrice: Number(formData.sellingPrice) || 0,
        stock: 0,
        tax: formData.tax || '--',
        taxType: formData.taxType,
        image: productImage,
        description: formData.description || undefined,
        barcodeType: formData.barcodeType,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        subCategory: formData.subCategory || undefined,
      };
      addProduct(newProduct);
      addNotification({ title: 'Success', message: `"${newProduct.name}" added successfully.`, type: 'success' });
    }
    resetForm();
    setView('list');
  };

  const handleEdit = (product: Product) => {
    const linkedCategory = product.categoryId
      ? productCategories.find(category => category.id === product.categoryId)
      : undefined;
    setEditingProduct(product);
    setProductImage(product.image || '');
    setFormData({
      name: product.name,
      sku: product.sku,
      barcodeType: product.barcodeType || 'Code 128 (C128)',
      unit: product.unit,
      brand: product.brand,
      category: linkedCategory?.name || product.category,
      subCategory: product.subCategory || '',
      businessLocation: product.businessLocation || '',
      alertQuantity: String(product.alertQuantity || ''),
      description: product.description || '',
      weight: product.weight != null ? String(product.weight) : '',
      tax: product.tax || '--',
      taxType: product.taxType || 'Exclusive',
      type: product.type,
      purchasePrice: String(product.unitPurchasePrice || ''),
      profitMargin: product.unitPurchasePrice > 0
        ? String((((product.sellingPrice - product.unitPurchasePrice) / product.unitPurchasePrice) * 100).toFixed(2))
        : '',
      sellingPrice: String(product.sellingPrice || ''),
    });
    setView('add');
  };

  // ── Delete with confirmation ──────────────────────────────────
  const handleDelete = (id: string) => setPendingDeleteId(id);
  const confirmDelete = () => {
    if (pendingDeleteId) {
      deleteProduct(pendingDeleteId);
      setSelectedIds(prev => prev.filter(i => i !== pendingDeleteId));
      addNotification({ title: 'Deleted', message: 'Product deleted successfully.', type: 'success' });
      setPendingDeleteId(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Products',
      message: `Delete ${selectedIds.length} selected product(s)? This cannot be undone.`,
      onConfirm: () => {
        selectedIds.forEach(id => deleteProduct(id));
        addNotification({ title: 'Deleted', message: `${selectedIds.length} product(s) deleted successfully.`, type: 'success' });
        setSelectedIds([]);
        setConfirmModal(null);
      },
    });
  };

  // ── Row selection ─────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const q = searchTerm.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    if (filterType && p.type !== filterType) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterUnit && p.unit !== filterUnit) return false;
    if (filterTax && p.tax !== filterTax) return false;
    if (filterBrand && p.brand !== filterBrand) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pagedProducts = filteredProducts.slice(pageStart, pageEnd);
  const pageItems = buildPaginationItems(safePage, totalPages);
  const allPageSelected = pagedProducts.length > 0 && pagedProducts.every(p => selectedIds.includes(p.id));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterCategory, filterUnit, filterTax, filterBrand, pageSize, products.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => prev.filter(id => !pagedProducts.some(p => p.id === id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pagedProducts.map(p => p.id)])]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // ── Export helpers ───────────────────────────────────────────
  const colDefs = [
    { key: 'name', label: 'Product' },
    { key: 'businessLocation', label: 'Business Location' },
    { key: 'unitPurchasePrice', label: 'Unit Purchase Price' },
    { key: 'sellingPrice', label: 'Selling Price' },
    { key: 'stock', label: 'Current Stock' },
    { key: 'type', label: 'Product Type' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'tax', label: 'Tax' },
    { key: 'sku', label: 'SKU' },
  ];

  const visibleCols = colDefs.filter(c => !hiddenCols.includes(c.key));

  const exportCSV = () => {
    const rows = filteredProducts;
    const headers = ['Name', 'SKU', 'Type', 'Category', 'Brand', 'Unit', 'Purchase Price', 'Selling Price', 'Stock', 'Tax', 'Location'];
    const lines = rows.map(p => [
      `"${p.name}"`, `"${p.sku}"`, p.type, `"${p.category}"`, `"${p.brand}"`,
      p.unit, Number(p.unitPurchasePrice || 0).toFixed(3), Number(p.sellingPrice || 0).toFixed(3),
      Number(p.stock || 0).toFixed(3), p.tax, `"${p.businessLocation}"`,
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
    addNotification({ title: 'Exported', message: `${rows.length} products exported as CSV.`, type: 'success' });
  };

  const exportExcel = () => {
    const rows = filteredProducts;
    const headers = ['Name', 'SKU', 'Type', 'Category', 'Brand', 'Unit', 'Purchase Price', 'Selling Price', 'Stock', 'Tax', 'Location'];
    const lines = rows.map(p => [
      p.name, p.sku, p.type, p.category, p.brand, p.unit,
      Number(p.unitPurchasePrice || 0).toFixed(3), Number(p.sellingPrice || 0).toFixed(3), Number(p.stock || 0).toFixed(3),
      p.tax, p.businessLocation,
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.xls';
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ title: 'Exported', message: `${rows.length} products exported as Excel-compatible file.`, type: 'success' });
  };

  const exportPDF = () => {
    const rowsHtml = filteredProducts.map(p => `
      <tr>
        <td>${p.name}</td><td>${p.sku}</td><td>${p.type}</td><td>${p.category}</td><td>${p.brand}</td>
        <td>${p.unit}</td><td>${formatCurrency(p.unitPurchasePrice || 0)}</td><td>${formatCurrency(p.sellingPrice || 0)}</td>
        <td>${Number(p.stock || 0).toFixed(3)}</td><td>${p.tax}</td><td>${p.businessLocation}</td>
      </tr>
    `).join('');
    const w = window.open('', '_blank', 'width=1200,height=800');
    if (!w) return;
    w.document.write(`<html><head><title>Products Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #f5f5f5; }
      </style>
    </head><body>
      <h2>Products Report</h2>
      <table>
        <thead><tr><th>Name</th><th>SKU</th><th>Type</th><th>Category</th><th>Brand</th><th>Unit</th><th>Purchase</th><th>Selling</th><th>Stock</th><th>Tax</th><th>Location</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`);
    w.document.close();
  };

  const totalStockQty = filteredProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const totalPurchaseStockValue = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.unitPurchasePrice || 0) * Number(p.stock || 0)),
    0
  );
  const totalSellingStockValue = filteredProducts.reduce(
    (sum, p) => sum + (Number(p.sellingPrice || 0) * Number(p.stock || 0)),
    0
  );
  const productPrintFilterParts = [
    searchTerm.trim() ? `Search: ${searchTerm.trim()}` : '',
    filterType ? `Type: ${filterType}` : '',
    filterCategory ? `Category: ${filterCategory}` : '',
    filterUnit ? `Unit: ${filterUnit}` : '',
    filterTax ? `Tax: ${filterTax}` : '',
    filterBrand ? `Brand: ${filterBrand}` : '',
  ].filter(Boolean);
  const productPrintSubtitle = productPrintFilterParts.length
    ? `Filters: ${productPrintFilterParts.join(' | ')}`
    : undefined;

  const handlePrint = () => {
    printDocument({
      title: 'Products',
      subtitle: productPrintSubtitle,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Name' },
        { label: 'SKU', width: '90px' },
        { label: 'Type', width: '70px' },
        { label: 'Category', width: '90px' },
        { label: 'Brand', width: '80px' },
        { label: 'Unit', width: '55px' },
        { label: 'Purchase Price', align: 'right', width: '90px' },
        { label: 'Selling Price', align: 'right', width: '90px' },
        { label: 'Stock', align: 'right', width: '60px' },
        { label: 'Tax', width: '55px' },
        { label: 'Location', width: '80px' },
      ],
      rows: filteredProducts.map(p => [
        p.name,
        p.sku,
        p.type,
        p.category || '--',
        p.brand || '--',
        p.unit || '--',
        formatCurrency(p.unitPurchasePrice || 0),
        formatCurrency(p.sellingPrice || 0),
        Number(p.stock || 0).toFixed(3),
        p.tax || '--',
        p.businessLocation || '--',
      ]),
      stats: [
        { label: 'Total Products', value: String(filteredProducts.length), color: 'blue' },
        { label: 'Stock Value (Cost)', value: formatCurrency(totalPurchaseStockValue), color: 'amber' },
        { label: 'Stock Value (Sale)', value: formatCurrency(totalSellingStockValue), color: 'green' },
      ],
      totalRow: [
        'TOTAL', '', '', '', '', '',
        formatCurrency(totalPurchaseStockValue),
        formatCurrency(totalSellingStockValue),
        totalStockQty.toFixed(3),
        '',
        '',
      ],
    });
  };

  // ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in pb-10">

      {/* ── Delete Confirmation Modal ────────────────────────── */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={28} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Delete Product?</h3>
              <p className="text-sm text-slate-500">
                This action cannot be undone. The product will be permanently removed.
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
                <Plus size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Products</h2>
                <p className="text-slate-500 mt-0.5 text-sm">Manage your product inventory</p>
              </div>
            </div>
            <button onClick={() => { resetForm(); setView('add'); }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
              <Plus size={18} /> Add New Product
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                  <option value="">All</option>
                  <option value="Single">Single</option>
                  <option value="Variable">Variable</option>
                  <option value="Combo">Combo</option>
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                  <option value="">All</option>
                  {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Unit</label>
                <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                  <option value="">All</option>
                  {productUnits.map(u => <option key={u.id} value={u.shortName}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tax</label>
                <select value={filterTax} onChange={(e) => setFilterTax(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                  <option value="">All</option>
                  {taxRates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Brand</label>
                <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                  <option value="">All</option>
                  {productBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>

            {/* Controls Bar */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
                {/* Show entries */}
                <div className="flex items-center gap-3 w-full xl:w-auto">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                  <div className="relative">
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:outline-none cursor-pointer appearance-none">
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    entries ({filteredProducts.length} total{selectedIds.length > 0 ? `, ${selectedIds.length} selected` : ''})
                  </span>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="ml-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 transition"
                    >
                      Delete Selected
                    </button>
                  )}
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto relative">
                  <button onClick={exportCSV}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                    <FileText size={14} /> CSV
                  </button>
                  <button onClick={exportExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={handlePrint}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                    <Printer size={14} /> Print
                  </button>
                  <div className="relative">
                    <button onClick={() => setShowColMenu(v => !v)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                      <Columns size={14} /> Columns
                    </button>
                    {showColMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3 min-w-[180px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Toggle Columns</p>
                        {colDefs.map(col => (
                          <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-blue-600">
                            <input type="checkbox"
                              checked={!hiddenCols.includes(col.key)}
                              onChange={() => setHiddenCols(prev => prev.includes(col.key) ? prev.filter(c => c !== col.key) : [...prev, col.key])}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-xs font-medium text-slate-700">{col.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={exportPDF}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                    <Download size={14} /> Export PDF
                  </button>
                </div>

                {/* Search */}
                <div className="relative w-full xl:w-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    className="w-full xl:w-64 pl-9 pr-4 py-2.5 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50/80 sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">
                      <input type="checkbox" className="rounded border-slate-300"
                        checked={allPageSelected}
                        onChange={handleSelectAll} />
                    </th>
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4 text-center">Action</th>
                    {visibleCols.map(col => (
                      <th key={col.key} className="px-6 py-4">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedProducts.map((product) => (
                    <tr key={product.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(product.id) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded border-slate-300"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => handleSelectRow(product.id)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-contain bg-slate-50" />
                          ) : (
                            <ImageIcon size={20} className="text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(product)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => { setSelectedProduct(product); setView('view'); }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="View">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => handleDelete(product.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                      {visibleCols.map(col => {
                        let cell: React.ReactNode;
                        if (col.key === 'name') cell = <span className="font-bold text-slate-900">{product.name}</span>;
                        else if (col.key === 'businessLocation') cell = <span className="text-slate-600">{product.businessLocation}</span>;
                        else if (col.key === 'unitPurchasePrice') cell = <span className="font-medium">{formatCurrency(product.unitPurchasePrice || 0)}</span>;
                        else if (col.key === 'sellingPrice') cell = <span className="font-medium">{formatCurrency(product.sellingPrice)}</span>;
                        else if (col.key === 'stock') cell = (
                          <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${product.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {Number(product.stock || 0).toFixed(3)} {product.unit}
                          </span>
                        );
                        else if (col.key === 'type') cell = (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">{product.type}</span>
                        );
                        else if (col.key === 'category') cell = <span className="text-slate-600">{product.category}</span>;
                        else if (col.key === 'brand') cell = <span className="text-slate-600">{product.brand}</span>;
                        else if (col.key === 'tax') cell = <span className="text-slate-600">{product.tax}</span>;
                        else if (col.key === 'sku') cell = <span className="font-mono text-xs text-slate-500">{product.sku}</span>;
                        else cell = null;
                        return <td key={col.key} className="px-6 py-4">{cell}</td>;
                      })}
                    </tr>
                  ))}
                  {pagedProducts.length === 0 && (
                    <tr>
                      <td colSpan={3 + visibleCols.length} className="px-6 py-16 text-center text-slate-400 italic">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span>Showing {filteredProducts.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filteredProducts.length)} of {filteredProducts.length} entries</span>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    {[10, 25, 50, 100].map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                {pageItems.map((item, index) => item === '...'
                  ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
                  : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`px-4 py-2 rounded-lg shadow-sm ${item === safePage ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition'}`}
                    >
                      {item}
                    </button>
                  ))}
                <button
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : view === 'add' ? (

        /* ── Add / Edit Product Form ──────────────────────────── */
        <div className="animate-in slide-in-from-right-10 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button onClick={() => { resetForm(); setView('list'); }}
              className="text-slate-500 hover:text-slate-700 font-bold flex items-center gap-2">
              <X size={20} /> Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-8">

              {/* General Information */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Info className="text-blue-600" size={20} /> General Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Product Name"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                      value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">SKU</label>
                    <input type="text" placeholder="SKU (auto-generated if blank)"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                      value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Barcode Type</label>
                    <select value={formData.barcodeType} onChange={(e) => setFormData({ ...formData, barcodeType: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="Code 128 (C128)">Code 128 (C128)</option>
                      <option value="Code 39 (C39)">Code 39 (C39)</option>
                      <option value="EAN-13">EAN-13</option>
                      <option value="UPC-A">UPC-A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Unit <span className="text-red-500">*</span></label>
                    <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="">Select Unit</option>
                      {productUnits.map(u => <option key={u.id} value={u.shortName}>{u.name} ({u.shortName})</option>)}
                    </select>
                  </div>
                  {settings.enableBrands && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Brand</label>
                      <select value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                        <option value="">Select Brand</option>
                        {productBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {settings.enableCategories && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Category</label>
                      <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                        <option value="">Select Category</option>
                        {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  {settings.enableSubCategories && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Sub Category</label>
                      <input type="text" placeholder="Sub category name"
                        value={formData.subCategory} onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Business Location</label>
                    <select value={formData.businessLocation} onChange={(e) => setFormData({ ...formData, businessLocation: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="">Select Location</option>
                      {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Description</label>
                    <textarea rows={4} placeholder="Product Description"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm resize-none"
                      value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Pricing & Tax */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><FileSpreadsheet size={18} /></span> Pricing & Tax
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Applicable Tax</label>
                    <select value={formData.tax} onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="--">None</option>
                      {taxRates.map(t => <option key={t.id} value={t.name}>{t.name} ({t.rate}%)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Selling Price Tax Type</label>
                    <select value={formData.taxType} onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="Exclusive">Exclusive</option>
                      <option value="Inclusive">Inclusive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Product Type</label>
                    <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700">
                      <option value="Single">Single</option>
                      <option value="Variable">Variable</option>
                      <option value="Combo">Combo</option>
                    </select>
                  </div>
                </div>

                {/* Price Table */}
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-slate-200 rounded-xl">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-200">Default Purchase Price</th>
                        <th className="px-4 py-3 border-b border-slate-200">x Margin (%)</th>
                        <th className="px-4 py-3 border-b border-slate-200">Default Selling Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3 border-b border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-slate-400 font-medium text-xs w-14 shrink-0">Exc. Tax</span>
                            <input type="number" placeholder="0.000" step="0.001" min="0"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                              value={formData.purchasePrice}
                              onChange={(e) => handlePriceChange('purchase', e.target.value)} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-medium text-xs w-14 shrink-0">Inc. Tax</span>
                            <input type="number" placeholder="0.000" step="0.001" readOnly
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                              value={purchasePriceInc || ''} />
                          </div>
                        </td>
                        <td className="p-3 border-b border-slate-200 align-top">
                          <input type="number" placeholder="25.00" step="0.01" min="0"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                            value={formData.profitMargin}
                            onChange={(e) => handlePriceChange('margin', e.target.value)} />
                        </td>
                        <td className="p-3 border-b border-slate-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-slate-400 font-medium text-xs w-14 shrink-0">Exc. Tax</span>
                            <input type="number" placeholder="0.000" step="0.001" min="0"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold"
                              value={formData.sellingPrice}
                              onChange={(e) => handlePriceChange('selling', e.target.value)} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-medium text-xs w-14 shrink-0">Inc. Tax</span>
                            <input type="number" placeholder="0.000" step="0.001" readOnly
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                              value={sellingPriceInc || ''} />
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Image Upload */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Product Image</h3>
                <div
                  onClick={() => imageRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 hover:bg-slate-50 transition-colors cursor-pointer group overflow-hidden"
                >
                  {productImage ? (
                    <img src={productImage} alt="Preview" className="w-full h-48 object-contain rounded-xl bg-slate-50" />
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Upload Product Image</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP · auto-compressed after upload</p>
                    </>
                  )}
                </div>
                <input ref={imageRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                {productImage && (
                  <button type="button" onClick={() => setProductImage('')}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                    <X size={12} /> Remove
                  </button>
                )}
              </div>

              {/* Alert Qty & Weight */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Alert Quantity</label>
                  <input type="number" placeholder="Alert Quantity" min="0"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    value={formData.alertQuantity}
                    onChange={(e) => setFormData({ ...formData, alertQuantity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Weight (kg)</label>
                  <input type="number" placeholder="Weight" min="0" step="0.001"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex justify-end gap-4">
            <button onClick={() => { resetForm(); setView('list'); }}
              className="px-8 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
              Cancel
            </button>
            <button onClick={handleSave}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2">
              <Save size={18} /> {editingProduct ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </div>
      ) : (
        /* View Product Details */
        <ViewProduct onBack={() => setView('list')} product={selectedProduct} />
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

export default Products;
