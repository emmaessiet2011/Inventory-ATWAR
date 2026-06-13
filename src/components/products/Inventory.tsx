
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Search, Edit, Trash2, Printer, 
  FileText, Download, FileSpreadsheet, Eye, Copy, ChevronDown, 
  Database, BarChart3, Tag, History, Package, Zap, SlidersHorizontal,
  Columns, ArrowUpDown as ArrowUpDownIcon, Image as ImageIcon, X
} from 'lucide-react';
import ViewProduct from './ViewProduct';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext, Product } from '@/context/GlobalContext';
import {
  appendStockLedgerEntries,
  bootstrapStockTransfersFromDB,
  readStockLedger,
} from '@/utils/stockTransfers';
import {
  fetchLocationInventoryFromDB,
  ProductLocationInventory,
  calculateAvailableStock,
  LOCATION_INVENTORY_UPDATED_EVENT,
} from '@/utils/stockLocationInventory';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument } from '@/utils/printUtils';
import { formatUnitWithPack } from '@/utils/productPackaging';
import { buildPaginationItems } from '@/utils/pagination';
import { productVisibleAtLocation, productVisibleToUser } from '@/utils/productVisibility';
import { getContainerSize, getStockDisplay, isFractionalProduct } from '@/utils/fractionalProducts';

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
// isWarehouseLocation and productBelongsToLocation removed for unified architecture

const downloadFile = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

interface StockReportItem {
  id: string;
  productId: string;
  sku: string;
  product: string;
  variation: string;
  category: string;
  brand: string;
  productType: Product['type'];
  tax: string;
  location: string;
  unitSellingPrice: number;
  unitPurchasePrice: number;
  currentStock: number;
  unit: string;
  stockValuePurchase: number;
  stockValueSale: number;
  potentialProfit: number;
  totalUnitSold: number;
  totalUnitTransferred: number;
  totalUnitAdjusted: number;
  stockDisplay: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
}

interface InventoryProps {
    onNavigate: (page: string) => void;
}

type ColumnKey = 'businessLocation' | 'sellingPrice' | 'stock' | 'type' | 'category' | 'brand' | 'tax' | 'sku';

const Inventory: React.FC<InventoryProps> = ({ onNavigate }) => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct: globalDeleteProduct,
    locations,
    productCategories,
    productBrands,
    productUnits,
    taxRates,
    sales,
    purchases,
    currentUser,
    formatCurrency,
    generateId,
    settings,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const [view, setView] = useState<'list' | 'view'>('list');
  const [activeTab, setActiveTab] = useState<'all_products' | 'stock_report'>('all_products');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [productPage, setProductPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, transformOrigin: 'origin-top-right' });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showColMenu, setShowColMenu] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<ColumnKey[]>([]);
  const colMenuRef = useRef<HTMLDivElement>(null);
  
  // Modals for Actions
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [productToAction, setProductToAction] = useState<Product | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateSku, setDuplicateSku] = useState('');

  // Filter States
  const [filters, setFilters] = useState({
      productType: [] as string[],
      category: [] as string[],
      unit: [] as string[],
      tax: [] as string[],
      brand: [] as string[],
      businessLocation: [] as string[]
  });
  const [notForSellingOnly, setNotForSellingOnly] = useState(false);

  // View Product Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Inline Edit State
  const [editingCell, setEditingCell] = useState<{ id: string, field: 'sellingPrice' | 'stock' } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Bulk Actions State
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void | Promise<void>} | null>(null);
  const [stockLedgerVersion, setStockLedgerVersion] = useState(0);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);

  useEffect(() => {
    const refreshLedger = () => setStockLedgerVersion((prev) => prev + 1);
    let isMounted = true;

    const refreshFromDB = async () => {
      const [inventoryRows] = await Promise.all([
        fetchLocationInventoryFromDB().catch(() => [] as ProductLocationInventory[]),
        bootstrapStockTransfersFromDB().catch(() => {}),
      ]);
      if (isMounted) setLocationInventory(inventoryRows);
      if (isMounted) refreshLedger();
    };

    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    const onTransfersUpdated = () => { void refreshFromDB(); };
    const onLedgerUpdated = () => { void refreshFromDB(); };
    const onInventoryUpdated = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-transfers-updated', onTransfersUpdated);
    window.addEventListener('app:stock-ledger-updated', onLedgerUpdated);
    window.addEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-transfers-updated', onTransfersUpdated);
      window.removeEventListener('app:stock-ledger-updated', onLedgerUpdated);
      window.removeEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    };
  }, []);

  const typeOptions = useMemo(
    () => Array.from(new Set(['Single', 'Variable', 'Combo', ...products.map(p => p.type)])).sort(),
    [products]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set([...productCategories.map(c => c.name), ...products.map(p => p.category)].filter(Boolean))).sort(),
    [productCategories, products]
  );
  const unitOptions = useMemo(
    () => Array.from(new Set([...productUnits.map(u => u.shortName), ...products.map(p => p.unit)].filter(Boolean))).sort(),
    [productUnits, products]
  );
  const taxOptions = useMemo(
    () => Array.from(new Set([...taxRates.map(t => t.name), ...products.map(p => p.tax)].filter(Boolean))).sort(),
    [taxRates, products]
  );
  const brandOptions = useMemo(
    () => Array.from(new Set([...productBrands.map(b => b.name), ...products.map(p => p.brand)].filter(Boolean))).sort(),
    [productBrands, products]
  );
  const userVisibleProducts = useMemo(
    () => products.filter(product => productVisibleToUser(product, currentUser, locations)),
    [products, currentUser, locations],
  );
  const selectedProductListLocations = useMemo(
    () => locations.filter(location => filters.businessLocation.includes(location.name)),
    [locations, filters.businessLocation],
  );
  
  const getProductStockForList = (product: Product): number => {
    const locationsToUse = selectedProductListLocations.length > 0 
      ? selectedProductListLocations 
      : locations;

    if (!locationsToUse.length) return Number(product.stock || 0);

    const selectedStock = locationsToUse.reduce((sum, location) => {
      return sum + calculateAvailableStock(product as any, location.id, locationInventory);
    }, 0);

    return Number(selectedStock.toFixed(3));
  };
  const getProductLocationLabelForList = (product: Product): string => {
    if (!selectedProductListLocations.length) return product.businessLocation || '';
    return selectedProductListLocations.map(location => location.name).join(', ');
  };
  const getStockValueQuantity = (product: Product, stock: number): number => (
    isFractionalProduct(product) && getContainerSize(product) > 0
      ? stock / getContainerSize(product)
      : stock
  );
  const getProductStockDisplayForList = (product: Product): string => {
    const stock = getProductStockForList(product);
    return isFractionalProduct(product)
      ? getStockDisplay(stock, product)
      : `${stock.toFixed(3)} ${formatUnitWithPack(product.unit, product.packagingType, product.unitsPerPackage)}`.trim();
  };

  const filteredProducts = useMemo(() => {
    const q = normalize(searchTerm);
    return userVisibleProducts.filter((p) => {
      if (q) {
        const hay = [p.name, p.sku, p.category, p.brand, p.businessLocation, getProductLocationLabelForList(p), p.unit, p.tax].map(normalize);
        if (!hay.some(v => v.includes(q))) return false;
      }
      if (filters.productType.length && !filters.productType.includes(p.type)) return false;
      if (filters.category.length && !filters.category.includes(p.category)) return false;
      if (filters.unit.length && !filters.unit.includes(p.unit)) return false;
      if (filters.tax.length && !filters.tax.includes(p.tax)) return false;
      if (filters.brand.length && !filters.brand.includes(p.brand)) return false;
      if (filters.businessLocation.length) {
        const selectedLocations = locations.filter(location => filters.businessLocation.includes(location.name));
        if (!selectedLocations.some(location => productVisibleAtLocation(p, location))) return false;
      }
      if (notForSellingOnly && !p.notForSelling) return false;
      return true;
    });
  }, [userVisibleProducts, searchTerm, filters, notForSellingOnly, locations, selectedProductListLocations]);

  const soldByProductName = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((sale) => {
      const status = sale.status || sale.saleStatus;
      if (status !== 'Final') return;
      sale.items.forEach((item) => {
        const key = normalize(item.name);
        map.set(key, (map.get(key) || 0) + (Number(item.qty) || 0));
      });
    });
    return map;
  }, [sales]);

  const stockMovementByProductId = useMemo(() => {
    const map = new Map<string, { transferred: number; adjusted: number }>();
    readStockLedger().forEach((entry) => {
      const productId = String(entry.productId || '').trim();
      if (!productId) return;
      const qty = Math.abs(Number(entry.change) || 0);
      if (!qty) return;

      const current = map.get(productId) || { transferred: 0, adjusted: 0 };
      const type = normalize(entry.type);
      const note = normalize(entry.note);
      if (type === 'stock transfer out' || type === 'stock transfer in') {
        current.transferred += qty;
      } else if (type === 'stock transfer reversal in' || type === 'stock transfer reversal out') {
        current.transferred = Math.max(0, current.transferred - qty);
      } else if (
        type === 'stock adjustment reversal'
        || (type === 'stock adjustment' && (note.startsWith('edit rollback') || note.startsWith('delete rollback')))
      ) {
        current.adjusted = Math.max(0, current.adjusted - qty);
      } else if (type === 'stock adjustment') {
        current.adjusted += qty;
      }

      map.set(productId, {
        transferred: Number(current.transferred.toFixed(3)),
        adjusted: Number(current.adjusted.toFixed(3)),
      });
    });
    return map;
  }, [products, stockLedgerVersion]);

  const stockReport = useMemo<StockReportItem[]>(() => {
    const productById = new Map<string, Product>(products.map((product) => [product.id, product]));
    const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
    const buildRow = (
      product: Product,
      location: string,
      currentStock: number,
      unitPurchasePrice: number,
      rowId: string,
    ): StockReportItem => {
      const unitSellingPrice = Number(product.sellingPrice) || 0;
      const stockValueQty = isFractionalProduct(product) && getContainerSize(product) > 0
        ? currentStock / getContainerSize(product)
        : currentStock;
      const stockValuePurchase = stockValueQty * unitPurchasePrice;
      const stockValueSale = stockValueQty * unitSellingPrice;
      const movement = stockMovementByProductId.get(product.id) || { transferred: 0, adjusted: 0 };
      return {
        id: rowId,
        productId: product.id,
        sku: product.sku,
        product: product.name,
        variation: '-',
        category: product.category,
        brand: product.brand,
        productType: product.type,
        tax: product.tax,
        location,
        unitSellingPrice,
        unitPurchasePrice,
        currentStock: Number(currentStock.toFixed(3)),
        unit: product.unit,
        stockValuePurchase,
        stockValueSale,
        potentialProfit: stockValueSale - stockValuePurchase,
        totalUnitSold: soldByProductName.get(normalize(product.name)) || 0,
        totalUnitTransferred: movement.transferred,
        totalUnitAdjusted: movement.adjusted,
        stockDisplay: getStockDisplay(currentStock, product),
      };
    };

    const rows = products.map((product) => buildRow(
      product,
      product.businessLocation,
      Number(product.stock) || 0,
      Number(product.unitPurchasePrice) || 0,
      product.id,
    ));

    locationInventory.forEach((inventory) => {
      const product = productById.get(inventory.productId);
      if (!product) return;
      rows.push(buildRow(
        product,
        inventory.locationName || locationNameById.get(inventory.locationId) || '',
        Number(inventory.stock) || 0,
        Number(inventory.unitCost ?? product.unitPurchasePrice ?? 0) || 0,
        `${product.id}@@${inventory.locationId}`,
      ));
    });

    return rows;
  }, [products, locations, locationInventory, soldByProductName, stockMovementByProductId]);

  const filteredStockReport = useMemo(() => {
    const q = normalize(searchTerm);
    return stockReport.filter((r) => {
      if (q) {
        const hay = [r.sku, r.product, r.category, r.brand, r.location].map(normalize);
        if (!hay.some(v => v.includes(q))) return false;
      }
      if (filters.productType.length && !filters.productType.includes(r.productType)) return false;
      if (filters.category.length && !filters.category.includes(r.category)) return false;
      if (filters.unit.length && !filters.unit.includes(r.unit)) return false;
      if (filters.tax.length && !filters.tax.includes(r.tax)) return false;
      if (filters.brand.length && !filters.brand.includes(r.brand)) return false;
      if (filters.businessLocation.length && !filters.businessLocation.includes(r.location)) return false;
      if (notForSellingOnly && !products.find(p => p.id === r.productId)?.notForSelling) return false;
      return true;
    });
  }, [stockReport, searchTerm, filters, notForSellingOnly, products]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / entriesPerPage));
  const safeProductPage = Math.min(Math.max(productPage, 1), totalProductPages);
  const productPageStart = (safeProductPage - 1) * entriesPerPage;
  const pagedFilteredProducts = filteredProducts.slice(productPageStart, productPageStart + entriesPerPage);
  const productPageItems = buildPaginationItems(safeProductPage, totalProductPages);
  const showingProductsFrom = filteredProducts.length === 0 ? 0 : productPageStart + 1;
  const showingProductsTo = Math.min(productPageStart + pagedFilteredProducts.length, filteredProducts.length);

  const totalStockPages = Math.max(1, Math.ceil(filteredStockReport.length / entriesPerPage));
  const safeStockPage = Math.min(Math.max(stockPage, 1), totalStockPages);
  const stockPageStart = (safeStockPage - 1) * entriesPerPage;
  const pagedStockReport = filteredStockReport.slice(stockPageStart, stockPageStart + entriesPerPage);
  const stockPageItems = buildPaginationItems(safeStockPage, totalStockPages);
  const showingStockFrom = filteredStockReport.length === 0 ? 0 : stockPageStart + 1;
  const showingStockTo = Math.min(stockPageStart + pagedStockReport.length, filteredStockReport.length);

  const allFilteredSelected = pagedFilteredProducts.length > 0
    && pagedFilteredProducts.every(p => selectedProducts.includes(p.id));
  const totalStockValue = useMemo(
    () => products.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.sellingPrice) || 0)), 0),
    [products]
  );
  const stockReportTotals = useMemo(() => filteredStockReport.reduce((acc, row) => {
    acc.purchase += row.stockValuePurchase;
    acc.sale += row.stockValueSale;
    acc.profit += row.potentialProfit;
    acc.sold += row.totalUnitSold;
    acc.transferred += row.totalUnitTransferred;
    acc.adjusted += row.totalUnitAdjusted;
    return acc;
  }, { purchase: 0, sale: 0, profit: 0, sold: 0, transferred: 0, adjusted: 0 }), [filteredStockReport]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProducts(prev => [...new Set([...prev, ...pagedFilteredProducts.map(p => p.id)])]);
      return;
    }
    setSelectedProducts(prev => prev.filter(id => !pagedFilteredProducts.some(p => p.id === id)));
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };

  const handleBulkDelete = () => {
    if (selectedProducts.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Products',
      message: `Are you sure you want to delete ${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''}? This cannot be undone.`,
      onConfirm: async () => { await executeBulkDelete(); setConfirmModal(null); },
    });
  };

  const executeBulkDelete = async () => {
    const blockedIds = selectedProducts.filter(id => {
      const pid = String(id);
      return (
        sales.some(sale => (sale.items || []).some((item: any) => String(item.productId || item.id || '') === pid)) ||
        purchases.some(purchase => (purchase.items || []).some((item: any) => String(item.productId || item.id || '') === pid))
      );
    });
    if (blockedIds.length > 0) {
      const blockedNames = blockedIds.map(id => products.find(p => String(p.id) === id)?.name || id).join(', ');
      addNotification({
        title: 'Some Products Skipped',
        message: `${blockedIds.length} product(s) used in sales/purchases were skipped: ${blockedNames}`,
        type: 'warning',
      });
    }
    const deletableIds = selectedProducts.filter(id => !blockedIds.includes(id));
    let deletedCount = 0;
    const failedNames: string[] = [];
    for (const id of deletableIds) {
      const result = await globalDeleteProduct(id);
      if (result.ok) {
        deletedCount += 1;
      } else {
        failedNames.push(products.find(p => String(p.id) === id)?.name || id);
      }
    }
    if (deletedCount > 0) {
      addNotification({ title: 'Deleted', message: `${deletedCount} product(s) deleted successfully.`, type: 'success' });
    }
    if (failedNames.length > 0) {
      addNotification({
        title: 'Delete Failed',
        message: `${failedNames.length} product(s) could not be deleted from Postgres: ${failedNames.join(', ')}`,
        type: 'error',
      });
    }
    setSelectedProducts([]);
    setIsBulkActionOpen(false);
  };

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const dropdownHeight = 320; 
      const spaceBelow = window.innerHeight - rect.bottom;
      
      const isDropUp = spaceBelow < dropdownHeight;
      
      setDropdownPosition({
        top: isDropUp ? undefined : rect.bottom + 8,
        bottom: isDropUp ? window.innerHeight - rect.top + 8 : undefined,
        left: rect.left,
        transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left'
      });
      setActiveActionId(id);
    }
  };

  const handleViewProduct = (product: Product) => {
      setSelectedProduct(product);
      setView('view');
      setActiveActionId(null);
  };

  const handleProductHistory = (product: Product) => {
      onNavigate(`product-stock-history/${encodeURIComponent(product.id)}`);
      setActiveActionId(null);
  };

  const openAddOpeningStock = (product: Product) => {
      onNavigate(`add-opening-stock/${encodeURIComponent(product.id)}`);
      setActiveActionId(null);
  };

  // Action Logic
  const handleEdit = (id: string) => {
      onNavigate(`edit-product/${id}`);
      setActiveActionId(null);
  };

  const openDuplicateModal = (product: Product) => {
      setProductToAction(product);
      setDuplicateName(`${product.name} (Copy)`);
      setDuplicateSku(`${product.sku}-COPY`);
      setIsDuplicateModalOpen(true);
      setActiveActionId(null);
  };

  const executeDuplicate = async () => {
      if (!productToAction) return;
      const name = duplicateName.trim();
      const sku = duplicateSku.trim();
      if (!name || !sku) {
        addNotification({ title: 'Validation Error', message: 'New product name and SKU are required.', type: 'error' });
        return;
      }
      if (products.some(p => normalize(p.sku) === normalize(sku))) {
        addNotification({ title: 'Validation Error', message: `SKU "${sku}" already exists.`, type: 'error' });
        return;
      }
      const newProduct: Product = {
          ...productToAction,
          id: generateId('PRD'),
          name,
          sku,
          stock: 0,
          openingStock: 0
      };
      const created = await addProduct(newProduct);
      if (!created.ok) {
        addNotification({
          title: 'Duplicate Failed',
          message: created.error || 'Could not duplicate product in Postgres.',
          type: 'error',
        });
        return;
      }
      addNotification({ title: 'Success', message: `Product "${name}" duplicated successfully.`, type: 'success' });
      setIsDuplicateModalOpen(false);
      setProductToAction(null);
  };

  const openDeleteModal = (product: Product) => {
      setProductToAction(product);
      setIsDeleteModalOpen(true);
      setActiveActionId(null);
  };

  const executeDelete = async () => {
      if (!productToAction) return;
      const pid = String(productToAction.id);
      const usedInSales = sales.some(sale =>
        (sale.items || []).some((item: any) => String(item.productId || item.id || '') === pid)
      );
      const usedInPurchases = purchases.some(purchase =>
        (purchase.items || []).some((item: any) => String(item.productId || item.id || '') === pid)
      );
      if (usedInSales || usedInPurchases) {
        const usedIn = [usedInSales && 'sales', usedInPurchases && 'purchases'].filter(Boolean).join(' and ');
        addNotification({
          title: 'Cannot Delete',
          message: `"${productToAction.name}" is used in existing ${usedIn} and cannot be deleted.`,
          type: 'error',
        });
        setIsDeleteModalOpen(false);
        setProductToAction(null);
        return;
      }
      const deleted = await globalDeleteProduct(productToAction.id);
      if (!deleted.ok) {
        addNotification({
          title: 'Delete Failed',
          message: deleted.error || `Unable to delete "${productToAction.name}" from Postgres.`,
          type: 'error',
        });
        return;
      }
      addNotification({ title: 'Deleted', message: `"${productToAction.name}" deleted successfully.`, type: 'success' });
      setIsDeleteModalOpen(false);
      setProductToAction(null);
  };

  const handleCellEdit = (product: Product, field: 'sellingPrice' | 'stock') => {
      setEditingCell({ id: product.id, field });
      setEditValue(product[field].toString());
  };

  const handleCellSave = async () => {
      if (!editingCell) return;
      const val = parseFloat(editValue);
      const product = products.find(p => p.id === editingCell.id);
      if (!product) {
        setEditingCell(null);
        return;
      }
      if (!Number.isFinite(val) || val < 0) {
        addNotification({ title: 'Validation Error', message: 'Please enter a valid non-negative number.', type: 'error' });
        setEditingCell(null);
        return;
      }
      const nextValue = Number(val.toFixed(3));
      if (editingCell.field === 'sellingPrice' && nextValue !== product.sellingPrice) {
        const updated = await updateProduct({ ...product, sellingPrice: nextValue });
        if (!updated.ok) {
          addNotification({
            title: 'Save Failed',
            message: updated.error || 'Unable to update product price in Postgres.',
            type: 'error',
          });
          setEditingCell(null);
          return;
        }
      }
      if (editingCell.field === 'stock' && nextValue !== product.stock) {
        const ledgerSaved = await appendStockLedgerEntries([{
          id: `STK-${Date.now()}-${product.id}`,
          productId: product.id,
          type: 'Stock Adjustment',
          change: Number((nextValue - product.stock).toFixed(3)),
          newQty: nextValue,
          date: new Date().toISOString(),
          ref: `ADJ-${Date.now().toString().slice(-6)}`,
          party: currentUser?.name || 'System',
          location: product.businessLocation,
          note: 'Inline update from product list',
        }]);
        if (!ledgerSaved) {
          addNotification({
            title: 'Save Failed',
            message: 'Unable to save stock ledger update in Postgres.',
            type: 'error',
          });
          setEditingCell(null);
          return;
        }
        const updated = await updateProduct({ ...product, stock: nextValue });
        if (!updated.ok) {
          addNotification({
            title: 'Save Failed',
            message: updated.error || 'Unable to update product stock in Postgres.',
            type: 'error',
          });
          setEditingCell(null);
          return;
        }
      }
      setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          void handleCellSave();
      } else if (e.key === 'Escape') {
          setEditingCell(null);
      }
  };

  // Close action menu on scroll or click outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
        if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
            return;
        }
        setActiveActionId(null);
    };

    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => setActiveActionId(null);

    if (activeActionId) {
        window.addEventListener('mousedown', handleOutsideClick);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }

    return () => {
        window.removeEventListener('mousedown', handleOutsideClick);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId]);

  useEffect(() => {
    setSelectedProducts(prev => prev.filter(id => products.some(p => p.id === id)));
  }, [products]);

  useEffect(() => {
    setProductPage(1);
    setStockPage(1);
  }, [searchTerm, filters, notForSellingOnly, entriesPerPage]);

  useEffect(() => {
    if (productPage > totalProductPages) setProductPage(totalProductPages);
  }, [productPage, totalProductPages]);

  useEffect(() => {
    if (stockPage > totalStockPages) setStockPage(totalStockPages);
  }, [stockPage, totalStockPages]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setShowColMenu(false);
      }
    };
    if (showColMenu) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showColMenu]);

  const exportCSV = () => {
    if (activeTab === 'all_products') {
      const headers = ['Name', 'SKU', 'Type', 'Category', 'Brand', 'Unit', 'Purchase Price', 'Selling Price', 'Stock', 'Tax', 'Location'];
      const rows = filteredProducts.map(p => [
        csvCell(p.name),
        csvCell(p.sku),
        csvCell(p.type),
        csvCell(p.category),
        csvCell(p.brand),
        csvCell(formatUnitWithPack(p.unit, p.packagingType, p.unitsPerPackage)),
        csvCell((p.unitPurchasePrice || 0).toFixed(3)),
        csvCell((p.sellingPrice || 0).toFixed(3)),
        csvCell(getProductStockDisplayForList(p)),
        csvCell(p.tax || '--'),
        csvCell(getProductLocationLabelForList(p) || ''),
      ].join(','));
      downloadFile('products.csv', [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
      addNotification({ title: 'Exported', message: `${filteredProducts.length} product row(s) exported to CSV.`, type: 'success' });
      return;
    }

    const headers = ['SKU', 'Product', 'Category', 'Brand', 'Location', 'Unit Selling Price', 'Current Stock', 'Stock Value (Purchase)', 'Stock Value (Sale)', 'Potential Profit', 'Total Sold'];
    const rows = filteredStockReport.map(r => [
      csvCell(r.sku),
      csvCell(r.product),
      csvCell(r.category),
      csvCell(r.brand),
      csvCell(r.location),
      csvCell(r.unitSellingPrice.toFixed(3)),
      csvCell(r.stockDisplay || r.currentStock.toFixed(3)),
      csvCell(r.stockValuePurchase.toFixed(3)),
      csvCell(r.stockValueSale.toFixed(3)),
      csvCell(r.potentialProfit.toFixed(3)),
      csvCell(r.totalUnitSold.toFixed(3)),
    ].join(','));
    downloadFile('stock-report.csv', [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;');
    addNotification({ title: 'Exported', message: `${filteredStockReport.length} stock row(s) exported to CSV.`, type: 'success' });
  };

  const exportExcel = () => {
    if (activeTab === 'all_products') {
      const headers = ['Name', 'SKU', 'Type', 'Category', 'Brand', 'Unit', 'Purchase Price', 'Selling Price', 'Stock', 'Tax', 'Location'];
      const rows = filteredProducts.map(p => [
        p.name, p.sku, p.type, p.category, p.brand, formatUnitWithPack(p.unit, p.packagingType, p.unitsPerPackage),
        (p.unitPurchasePrice || 0).toFixed(3),
        (p.sellingPrice || 0).toFixed(3),
        getProductStockDisplayForList(p),
        p.tax || '--',
        getProductLocationLabelForList(p) || '',
      ].join('\t'));
      downloadFile('products.xls', [headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
      addNotification({ title: 'Exported', message: `${filteredProducts.length} product row(s) exported to Excel.`, type: 'success' });
      return;
    }

    const headers = ['SKU', 'Product', 'Category', 'Brand', 'Location', 'Unit Selling Price', 'Current Stock', 'Stock Value (Purchase)', 'Stock Value (Sale)', 'Potential Profit', 'Total Sold'];
    const rows = filteredStockReport.map(r => [
      r.sku, r.product, r.category, r.brand, r.location,
      r.unitSellingPrice.toFixed(3),
      r.stockDisplay || r.currentStock.toFixed(3),
      r.stockValuePurchase.toFixed(3),
      r.stockValueSale.toFixed(3),
      r.potentialProfit.toFixed(3),
      r.totalUnitSold.toFixed(3),
    ].join('\t'));
    downloadFile('stock-report.xls', [headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
    addNotification({ title: 'Exported', message: `${filteredStockReport.length} stock row(s) exported to Excel.`, type: 'success' });
  };

  const exportPDF = () => {
    handlePrint();
  };

  const inventoryPrintFilterParts = [
    searchTerm.trim() ? `Search: ${searchTerm.trim()}` : '',
    filters.productType.length ? `Type: ${filters.productType.join(', ')}` : '',
    filters.category.length ? `Category: ${filters.category.join(', ')}` : '',
    filters.unit.length ? `Unit: ${filters.unit.join(', ')}` : '',
    filters.tax.length ? `Tax: ${filters.tax.join(', ')}` : '',
    filters.brand.length ? `Brand: ${filters.brand.join(', ')}` : '',
    filters.businessLocation.length ? `Location: ${filters.businessLocation.join(', ')}` : '',
    notForSellingOnly ? 'Not for selling only' : '',
  ].filter(Boolean);
  const inventoryFilterSubtitle = inventoryPrintFilterParts.length
    ? `Filters: ${inventoryPrintFilterParts.join(' | ')}`
    : undefined;
  const inventoryListSubtotalPurchase = filteredProducts.reduce(
    (sum, p) => {
      const stock = getProductStockForList(p);
      return sum + (Number(p.unitPurchasePrice || 0) * getStockValueQuantity(p, stock));
    },
    0
  );
  const inventoryListSubtotalSale = filteredProducts.reduce(
    (sum, p) => {
      const stock = getProductStockForList(p);
      return sum + (Number(p.sellingPrice || 0) * getStockValueQuantity(p, stock));
    },
    0
  );
  const inventoryListTotalQty = filteredProducts.reduce((sum, p) => sum + getProductStockForList(p), 0);
  const stockReportTotalQty = filteredStockReport.reduce((sum, row) => sum + Number(row.currentStock || 0), 0);

  const handlePrint = () => {
    const isStockView = activeTab === 'stock_report';
    if (isStockView) {
      // Stock report view
      printDocument({
        title: 'Stock Report',
        subtitle: inventoryFilterSubtitle
          ? `${inventoryFilterSubtitle} | View: Stock Report`
          : 'View: Stock Report',
        businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
        businessAddress: settings?.address || '',
        printedBy: currentUser?.name || '',
        columns: [
          { label: 'Product' },
          { label: 'SKU', width: '80px' },
          { label: 'Category', width: '90px' },
          { label: 'Location', width: '80px' },
          { label: 'Selling Price', align: 'right', width: '90px' },
          { label: 'Current Stock', align: 'right', width: '80px' },
          { label: 'Stock Value (Cost)', align: 'right', width: '100px' },
          { label: 'Stock Value (Sale)', align: 'right', width: '100px' },
          { label: 'Units Sold', align: 'right', width: '70px' },
        ],
        rows: filteredStockReport.map(r => [
          r.product,
          r.sku,
          r.category || '--',
          r.location || '--',
          formatCurrency(r.unitSellingPrice),
          r.stockDisplay || r.currentStock.toFixed(3),
          formatCurrency(r.stockValuePurchase),
          formatCurrency(r.stockValueSale),
          r.totalUnitSold.toFixed(3),
        ]),
        stats: [
          { label: 'Total Products', value: String(filteredStockReport.length), color: 'blue' },
          { label: 'Stock Value (Cost)', value: formatCurrency(stockReportTotals.purchase), color: 'amber' },
          { label: 'Stock Value (Sale)', value: formatCurrency(stockReportTotals.sale), color: 'green' },
          { label: 'Units Sold', value: stockReportTotals.sold.toFixed(3), color: 'blue' },
        ],
        totalRow: [
          'TOTAL',
          '',
          '',
          '',
          '',
          stockReportTotalQty.toFixed(3),
          formatCurrency(stockReportTotals.purchase),
          formatCurrency(stockReportTotals.sale),
          stockReportTotals.sold.toFixed(3),
        ],
      });
    } else {
      // Product list view
      printDocument({
        title: 'Inventory',
        subtitle: inventoryFilterSubtitle
          ? `${inventoryFilterSubtitle} | View: Product List`
          : 'View: Product List',
        businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
        businessAddress: settings?.address || '',
        printedBy: currentUser?.name || '',
        columns: [
          { label: 'Name' },
          { label: 'SKU', width: '90px' },
          { label: 'Type', width: '70px' },
          { label: 'Category', width: '90px' },
          { label: 'Location', width: '80px' },
          { label: 'Purchase Price', align: 'right', width: '90px' },
          { label: 'Selling Price', align: 'right', width: '90px' },
          { label: 'Stock', align: 'right', width: '60px' },
        ],
        rows: filteredProducts.map(p => [
          p.name,
          p.sku,
          p.type,
          p.category || '--',
          getProductLocationLabelForList(p) || '--',
          formatCurrency(p.unitPurchasePrice || 0),
          formatCurrency(p.sellingPrice || 0),
          getProductStockDisplayForList(p),
        ]),
        stats: [
          { label: 'Total Products', value: String(filteredProducts.length), color: 'blue' },
          { label: 'Stock Value (Cost)', value: formatCurrency(inventoryListSubtotalPurchase), color: 'amber' },
          { label: 'Stock Value (Sale)', value: formatCurrency(inventoryListSubtotalSale), color: 'green' },
        ],
        totalRow: [
          'TOTAL',
          '',
          '',
          '',
          '',
          formatCurrency(inventoryListSubtotalPurchase),
          formatCurrency(inventoryListSubtotalSale),
          inventoryListTotalQty.toFixed(3),
        ],
      });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {view === 'list' ? (
        <>
      {/* 1. Futuristic Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-10 text-white shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
            <div className="space-y-2">
                <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest border border-white/10 flex items-center gap-2">
                        <Package size={12} className="text-blue-400" /> Inventory 2.0
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-xs font-bold text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                        <Zap size={10} fill="currentColor" /> Live Sync
                    </span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter">Product<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Intelligence</span></h2>
                <p className="text-slate-400 text-lg font-light max-w-xl">
                    Centralized catalog management with real-time stock velocity tracking.
                </p>
            </div>

            <div className="flex items-center gap-6">
                 <div className="hidden lg:flex flex-col items-end border-r border-white/10 pr-6">
                    <span className="text-sm font-bold text-slate-400">Total SKUs</span>
                    <span className="text-3xl font-mono font-bold text-white tracking-tight">{products.length}</span>
                </div>
                 <div className="hidden lg:flex flex-col items-end mr-2">
                    <span className="text-sm font-bold text-slate-400">Stock Value</span>
                    <span className="text-3xl font-mono font-bold text-emerald-400 tracking-tight">{formatCurrency(totalStockValue)}</span>
                </div>
                {activeTab === 'all_products' && (
                  <button 
                    onClick={() => onNavigate('add-product')}
                    className="group relative px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.4)] transition-all duration-300 active:scale-95 flex items-center gap-3 overflow-hidden"
                  >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-100 via-white to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <Plus size={22} className="relative z-10" /> 
                      <span className="relative z-10 text-lg">Add New Product</span>
                  </button>
                )}
            </div>
        </div>
      </div>

      {/* 2. Main Interface Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col z-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
        
        {/* Navigation Tabs */}
        <div className="px-8 pt-8 pb-0">
           <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl w-fit border border-slate-200">
                <button 
                    onClick={() => setActiveTab('all_products')}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                        activeTab === 'all_products' 
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <Database size={16} className={activeTab === 'all_products' ? 'text-blue-600' : ''} />
                    All Products
                </button>
                <button 
                    onClick={() => setActiveTab('stock_report')}
                    className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                        activeTab === 'stock_report' 
                        ? 'bg-white text-slate-900 shadow-md shadow-slate-200' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <BarChart3 size={16} className={activeTab === 'stock_report' ? 'text-purple-600' : ''} />
                    Stock Report
                </button>
            </div>
        </div>

        {/* Command Center (Filters & Actions) */}
        <div className="p-8 pb-4">
            <div className="flex flex-col xl:flex-row gap-6 items-center justify-between bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-200 transition-all">
                 {/* Search */}
                 <div className="relative w-full xl:max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search SKU, name, or category..." 
                        className="block w-full pl-14 pr-4 py-4 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800 placeholder:text-slate-400 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Report Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Bulk Actions (Conditional) */}
                    {selectedProducts.length > 0 && (
                        <div className="relative">
                            <button 
                                onClick={() => setIsBulkActionOpen(!isBulkActionOpen)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-sm"
                            >
                                <span>{selectedProducts.length} Selected</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${isBulkActionOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isBulkActionOpen && (
                                <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <button 
                                        onClick={handleBulkDelete}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                                    >
                                        <Trash2 size={14} /> Delete Selected
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Export Actions Group */}
                    <div className="flex items-center p-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto max-w-full no-scrollbar">
                        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap hover:text-emerald-600 hover:bg-emerald-50">
                            <FileText size={14} />
                            <span>Export CSV</span>
                        </button>
                        <div className="w-px h-4 bg-slate-200 my-auto shrink-0"></div>
                        <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap hover:text-emerald-600 hover:bg-emerald-50">
                            <FileSpreadsheet size={14} />
                            <span>Export Excel</span>
                        </button>
                        <div className="w-px h-4 bg-slate-200 my-auto shrink-0"></div>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap hover:text-blue-600 hover:bg-blue-50">
                            <Printer size={14} />
                            <span>Print</span>
                        </button>
                        <div className="w-px h-4 bg-slate-200 my-auto shrink-0"></div>
                        <div className="relative" ref={colMenuRef}>
                            <button onClick={() => setShowColMenu(v => !v)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap hover:text-purple-600 hover:bg-purple-50">
                                <Columns size={14} />
                                <span>Column visibility</span>
                            </button>
                            {showColMenu && activeTab === 'all_products' && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-3 min-w-[190px]">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Toggle Columns</p>
                                    {([
                                      { key: 'businessLocation', label: 'Business Location' },
                                      { key: 'sellingPrice', label: 'Selling Price' },
                                      { key: 'stock', label: 'Current Stock' },
                                      { key: 'type', label: 'Product Type' },
                                      { key: 'category', label: 'Category' },
                                      { key: 'brand', label: 'Brand' },
                                      { key: 'tax', label: 'Tax' },
                                      { key: 'sku', label: 'SKU' },
                                    ] as { key: ColumnKey; label: string }[]).map(col => (
                                      <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-blue-600">
                                        <input
                                          type="checkbox"
                                          checked={!hiddenCols.includes(col.key)}
                                          onChange={() => setHiddenCols(prev => prev.includes(col.key) ? prev.filter(c => c !== col.key) : [...prev, col.key])}
                                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-medium text-slate-700">{col.label}</span>
                                      </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="w-px h-4 bg-slate-200 my-auto shrink-0"></div>
                        <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 transition-all whitespace-nowrap hover:text-red-600 hover:bg-red-50">
                            <Download size={14} />
                            <span>Export PDF</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
                        <select
                          value={entriesPerPage}
                          onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
                          className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
                    </div>
                    
                    {/* Filter Button */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold transition-all border shadow-sm ${
                            showFilters 
                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                     >
                        <SlidersHorizontal size={16} /> 
                        <span>Filter</span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Expanded Filter Panel */}
            {showFilters && (
                <div className="mt-4 p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                         <MultiSelect 
                            label="Product Type"
                            options={typeOptions}
                            selected={filters.productType}
                            onChange={(val) => setFilters({...filters, productType: val})}
                        />
                         <MultiSelect 
                            label="Category"
                            options={categoryOptions}
                            selected={filters.category}
                            onChange={(val) => setFilters({...filters, category: val})}
                        />
                         <MultiSelect 
                            label="Unit"
                            options={unitOptions}
                            selected={filters.unit}
                            onChange={(val) => setFilters({...filters, unit: val})}
                        />
                         <MultiSelect 
                            label="Tax"
                            options={taxOptions}
                            selected={filters.tax}
                            onChange={(val) => setFilters({...filters, tax: val})}
                        />
                         <MultiSelect 
                            label="Brand"
                            options={brandOptions}
                            selected={filters.brand}
                            onChange={(val) => setFilters({...filters, brand: val})}
                        />
                         <MultiSelect 
                            label="Business Location"
                            options={locations.map(loc => loc.name)}
                            selected={filters.businessLocation}
                            onChange={(val) => setFilters({...filters, businessLocation: val})}
                        />

                        <div className="lg:col-span-2 flex items-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer group bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all w-full">
                                <input
                                  type="checkbox"
                                  checked={notForSellingOnly}
                                  onChange={(e) => setNotForSellingOnly(e.target.checked)}
                                  className="w-5 h-5 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500 transition-all"
                                />
                                <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700 transition-colors">Show "Not for selling" only</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Table Content Switch */}
        {activeTab === 'all_products' ? (
            <div className="overflow-x-auto min-h-[600px] px-2">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    checked={allFilteredSelected}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-4 py-3 w-24">Product image</th>
                            <th className="px-4 py-3 text-center w-24">Action</th>
                            <th className="px-4 py-3">Product</th>
                            {!hiddenCols.includes('businessLocation') && <th className="px-4 py-3">Business Location</th>}
                            {!hiddenCols.includes('sellingPrice') && <th className="px-4 py-3 text-right" title="Click a value to edit">Selling Price</th>}
                            {!hiddenCols.includes('stock') && <th className="px-4 py-3 text-right" title="Click a value to edit">Current stock</th>}
                            {!hiddenCols.includes('type') && <th className="px-4 py-3">Product Type</th>}
                            {!hiddenCols.includes('category') && <th className="px-4 py-3">Category</th>}
                            {!hiddenCols.includes('brand') && <th className="px-4 py-3">Brand</th>}
                            {!hiddenCols.includes('tax') && <th className="px-4 py-3">Tax</th>}
                            {!hiddenCols.includes('sku') && <th className="px-4 py-3">SKU</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {pagedFilteredProducts.map((product) => (
                            <tr key={product.id} className={`group transition-all duration-300 relative text-sm ${selectedProducts.includes(product.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}>
                                <td className="px-4 py-3 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                        checked={selectedProducts.includes(product.id)}
                                        onChange={() => handleSelectProduct(product.id)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                        {product.image && !brokenImages[product.id] ? (
                                          <img
                                            src={product.image}
                                            alt={product.name}
                                            className="w-full h-full object-contain bg-slate-50"
                                            onError={() => setBrokenImages(prev => ({ ...prev, [product.id]: true }))}
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                            <ImageIcon size={16} className="text-slate-400" />
                                          </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button 
                                        onClick={(e) => toggleActions(e, product.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto transition-all duration-200 ${
                                            activeActionId === product.id 
                                            ? 'bg-slate-900 text-white shadow-lg scale-105' 
                                            : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50'
                                        }`}
                                    >
                                        Actions <ChevronDown size={10} />
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800">{product.name}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {formatUnitWithPack(product.unit, product.packagingType, product.unitsPerPackage)}
                                  </div>
                                </td>
                                {!hiddenCols.includes('businessLocation') && <td className="px-4 py-3 text-slate-500 text-xs">{getProductLocationLabelForList(product)}</td>}
                                {!hiddenCols.includes('sellingPrice') && <td 
                                    className="px-4 py-3 text-right font-bold text-slate-800 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => handleCellEdit(product, 'sellingPrice')}
                                >
                                    {editingCell?.id === product.id && editingCell.field === 'sellingPrice' ? (
                                        <input 
                                            type="number" 
                                            className="w-24 text-right px-2 py-1 border border-blue-500 rounded outline-none"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleCellSave}
                                            onKeyDown={handleCellKeyDown}
                                            autoFocus
                                        />
                                    ) : (
                                        formatCurrency(product.sellingPrice || 0)
                                    )}
                                </td>}
                                {!hiddenCols.includes('stock') && <td 
                                    className={`px-4 py-3 text-right font-medium text-slate-700 transition-colors ${
                                      selectedProductListLocations.length ? '' : 'cursor-pointer hover:bg-slate-100'
                                    }`}
                                    onClick={() => {
                                      if (!selectedProductListLocations.length) handleCellEdit(product, 'stock');
                                    }}
                                >
                                    {editingCell?.id === product.id && editingCell.field === 'stock' ? (
                                        <input 
                                            type="number" 
                                            className="w-20 text-right px-2 py-1 border border-blue-500 rounded outline-none"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={handleCellSave}
                                            onKeyDown={handleCellKeyDown}
                                            autoFocus
                                        />
                                    ) : (
                                        <>{getProductStockDisplayForList(product)}</>
                                    )}
                                </td>}
                                {!hiddenCols.includes('type') && <td className="px-4 py-3">
                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        {product.type}
                                    </span>
                                </td>}
                                {!hiddenCols.includes('category') && <td className="px-4 py-3 text-slate-600">{product.category}</td>}
                                {!hiddenCols.includes('brand') && <td className="px-4 py-3 text-slate-600">{product.brand}</td>}
                                {!hiddenCols.includes('tax') && <td className="px-4 py-3 text-slate-500">{product.tax}</td>}
                                {!hiddenCols.includes('sku') && <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.sku}</td>}
                            </tr>
                        ))}
                        {pagedFilteredProducts.length === 0 && (
                          <tr>
                            <td className="px-4 py-10 text-center text-slate-400 italic" colSpan={12}>
                              No products found for the current filters.
                            </td>
                          </tr>
                        )}
                    </tbody>
                </table>
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
                  <div>Showing {showingProductsFrom} to {showingProductsTo} of {filteredProducts.length} entries</div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                      disabled={safeProductPage <= 1}
                      onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    {productPageItems.map((item, index) => item === '...'
                      ? <span key={`products-page-ellipsis-${index}`} className="px-2 py-1.5 text-slate-400">...</span>
                      : (
                        <button
                          key={item}
                          onClick={() => setProductPage(item)}
                          className={`px-3 py-1.5 rounded shadow-sm transition ${item === safeProductPage ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                          {item}
                        </button>
                      ))}
                    <button
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                      disabled={safeProductPage >= totalProductPages}
                      onClick={() => setProductPage((prev) => Math.min(totalProductPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
            </div>
        ) : (
             <div className="overflow-x-auto min-h-[600px] px-2">
                <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Action</th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white hidden sm:table-cell">SKU <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white">Product <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white hidden lg:table-cell">Variation <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white hidden md:table-cell">Category <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white hidden md:table-cell">Location</th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Unit Selling Price <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right">Current stock <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden lg:table-cell">Stock Value <br/>(Purchase) <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden lg:table-cell">Stock Value <br/>(Sale) <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden lg:table-cell">Profit Potential</th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden xl:table-cell">Total Sold <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden xl:table-cell">Transferred <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                            <th className="px-2 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white text-right hidden xl:table-cell">Adjusted <ArrowUpDownIcon size={12} className="inline ml-1"/></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {pagedStockReport.map((item, idx) => (
                            <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                                    <button
                                        onClick={() => {
                                          const product = products.find(p => p.id === item.productId);
                                          if (product) handleProductHistory(product);
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-white border border-slate-200 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-50 hover:border-indigo-200 shadow-sm whitespace-nowrap transition-all"
                                    >
                                        <History size={10} /> <span className="hidden sm:inline">Product stock</span> history
                                    </button>
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 font-mono font-bold text-slate-500 hidden sm:table-cell">{item.sku}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 font-bold text-slate-700">{item.product}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-slate-500 italic hidden lg:table-cell">{item.variation || '-'}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-slate-600 hidden md:table-cell">{item.category}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-slate-500 truncate max-w-[120px] hidden md:table-cell" title={item.location}>{item.location}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right font-medium text-slate-700 whitespace-nowrap">{formatCurrency(item.unitSellingPrice)}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap">
                                    <span className="font-bold text-slate-800">{item.stockDisplay || item.currentStock.toFixed(3)}</span>
                                    {!item.stockDisplay && <span className="text-[10px] text-slate-400"> {item.unit}</span>}
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap text-slate-500 hidden lg:table-cell">{formatCurrency(item.stockValuePurchase)}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap text-slate-500 hidden lg:table-cell">{formatCurrency(item.stockValueSale)}</td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap hidden lg:table-cell">
                                    <span className={`font-bold ${item.potentialProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {formatCurrency(item.potentialProfit)}
                                    </span>
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap hidden xl:table-cell">
                                    <span className="font-medium text-slate-700">{item.totalUnitSold.toFixed(3)}</span>
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap text-slate-500 hidden xl:table-cell">
                                    {item.totalUnitTransferred.toFixed(3)}
                                </td>
                                <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-right whitespace-nowrap text-slate-500 hidden xl:table-cell">
                                    {item.totalUnitAdjusted.toFixed(3)}
                                </td>
                            </tr>
                        ))}
                        {pagedStockReport.length === 0 && (
                          <tr>
                            <td colSpan={14} className="px-6 py-10 text-center text-slate-400 italic">
                              No stock rows found for the current filters.
                            </td>
                          </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-200 sticky bottom-0 z-10 shadow-inner">
                        <tr>
                            <td colSpan={8} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-slate-500">Total Aggregated:</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(stockReportTotals.purchase)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{formatCurrency(stockReportTotals.sale)}</td>
                            <td className="px-6 py-4 text-right font-mono text-emerald-700">{formatCurrency(stockReportTotals.profit)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{stockReportTotals.sold.toFixed(3)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{stockReportTotals.transferred.toFixed(3)}</td>
                            <td className="px-6 py-4 text-right font-mono text-slate-700">{stockReportTotals.adjusted.toFixed(3)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
                  <div>Showing {showingStockFrom} to {showingStockTo} of {filteredStockReport.length} entries</div>
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                      disabled={safeStockPage <= 1}
                      onClick={() => setStockPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    {stockPageItems.map((item, index) => item === '...'
                      ? <span key={`stock-page-ellipsis-${index}`} className="px-2 py-1.5 text-slate-400">...</span>
                      : (
                        <button
                          key={item}
                          onClick={() => setStockPage(item)}
                          className={`px-3 py-1.5 rounded shadow-sm transition ${item === safeStockPage ? 'bg-blue-600 text-white shadow-md shadow-blue-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                          {item}
                        </button>
                      ))}
                    <button
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
                      disabled={safeStockPage >= totalStockPages}
                      onClick={() => setStockPage((prev) => Math.min(totalStockPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
            </div>
        )}
      </div>

      {/* Action Menu Portal */}
      {activeActionId && createPortal(
        <div 
            ref={dropdownRef}
            className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200 ${dropdownPosition.transformOrigin}`}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left, bottom: dropdownPosition.bottom }}
        >
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Actions</span>
            </div>
            
            <button 
                onClick={() => {
                    if (activeActionId) onNavigate(`print-labels/${encodeURIComponent(activeActionId)}`);
                    else onNavigate('print-labels');
                    setActiveActionId(null);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Tag size={16} className="text-blue-500" /> Labels
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openAddOpeningStock(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Plus size={16} className="text-green-600" /> Add or edit opening stock
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) handleViewProduct(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Eye size={16} className="text-emerald-500" /> Product View
            </button>
            <button 
                onClick={() => { if (activeActionId) handleEdit(activeActionId); }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Edit size={16} className="text-amber-500" /> Edit
            </button>
            <button 
                onClick={() => {
                   const product = products.find(p => p.id === activeActionId);
                    if (product) handleProductHistory(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <History size={16} className="text-purple-500" /> Product stock history
            </button>
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openDuplicateModal(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
            >
                <Copy size={16} className="text-cyan-500" /> Duplicate
            </button>
            <div className="h-px bg-slate-100 my-1 mx-2"></div>
            
            <button 
                onClick={() => {
                    const product = products.find(p => p.id === activeActionId);
                    if (product) openDeleteModal(product);
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors"
            >
                <Trash2 size={16} /> Delete
            </button>
        </div>,
        document.body
      )}
      </>
      ) : (
        <ViewProduct 
          onBack={() => setView('list')} 
          onEdit={(product) => handleEdit(product.id)}
          product={selectedProduct}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && productToAction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 size={32} />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">Delete Product?</h3>
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                          Are you sure you want to delete <span className="font-bold text-slate-800">"{productToAction.name}"</span>? 
                          This action cannot be undone and will remove it from all locations.
                      </p>
                      <div className="flex gap-3">
                          <button 
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={executeDelete}
                            className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20"
                          >
                              Delete Product
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Duplicate Modal */}
      {isDuplicateModalOpen && productToAction && (
           <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                           <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                               <Copy size={20} className="text-cyan-500" /> Duplicate Product
                           </h3>
                           <button onClick={() => setIsDuplicateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                      </div>
                      
                      <div className="space-y-4">
                           <div className="group">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Product Name</label>
                               <input 
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm font-bold text-slate-800"
                                    value={duplicateName}
                                    onChange={(e) => setDuplicateName(e.target.value)}
                               />
                           </div>
                           <div className="group">
                               <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New SKU</label>
                               <input 
                                    type="text"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-sm font-mono text-slate-700"
                                    value={duplicateSku}
                                    onChange={(e) => setDuplicateSku(e.target.value)}
                               />
                           </div>
                      </div>

                      <div className="mt-8 flex gap-3">
                          <button 
                            onClick={() => setIsDuplicateModalOpen(false)}
                            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                          >
                              Cancel
                          </button>
                          <button 
                            onClick={executeDuplicate}
                            className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-900/20"
                          >
                              Confirm Duplicate
                          </button>
                      </div>
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

export default Inventory;
