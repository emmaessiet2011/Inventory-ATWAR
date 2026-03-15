
import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Plus, Image as ImageIcon,
  Info, X, ChevronDown, Barcode, DollarSign,
  Layers, MapPin, FileText, Box, AlertCircle,
  Clock, Bold, Italic, Underline, List, ListOrdered,
  Search, Trash2, Split, PackageCheck, Download,
  ArrowLeft
} from 'lucide-react';
import { useGlobalContext, Product, ProductVariationRow, ProductComboItem } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import {
  normalizePackagingType,
  normalizeUnitsPerPackage,
} from '../src/utils/productPackaging';
import type { ProductPackagingType } from '../src/utils/productPackaging';

interface AddProductProps {
  isEdit?: boolean;
  productId?: string;
  onNavigate?: (page: string) => void;
}

const AddProduct: React.FC<AddProductProps> = ({ isEdit, productId, onNavigate }) => {
  const {
    products, addProduct, updateProduct,
    locations, productCategories, productBrands, productUnits,
    taxRates, warranties, productVariations,
    settings, generateId, formatCurrency,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const imageRef = useRef<HTMLInputElement>(null);
  const brochureRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  // ── Core product state ──────────────────────────────────────
  const [productType, setProductType] = useState<'Single' | 'Variable' | 'Combo'>('Single');
  const [manageStock, setManageStock] = useState(false);
  const [productName, setProductName] = useState('');
  const [sku, setSku] = useState('');
  const [barcodeType, setBarcodeType] = useState('Code 128 (C128)');
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [margin, setMargin] = useState<number>(parseFloat(settings.defaultProfitPercent) || 25);
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(settings.defaultUnit || '');
  const [packagingType, setPackagingType] = useState<ProductPackagingType>('Piece');
  const [unitsPerPackage, setUnitsPerPackage] = useState<number | ''>('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [selectedTax, setSelectedTax] = useState('--');
  const [taxType, setTaxType] = useState('Exclusive');
  const [selectedWarranty, setSelectedWarranty] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // ── Inventory ───────────────────────────────────────────────
  const [openingStock, setOpeningStock] = useState<number | ''>('');
  const [alertQuantity, setAlertQuantity] = useState<number | ''>('');
  const [locationRackDetails, setLocationRackDetails] = useState<Record<string, { rack: string; row: string; position: string }>>({});
  const [weight, setWeight] = useState<number | ''>('');
  const [serviceTimer, setServiceTimer] = useState<number | ''>('');
  const [notForSelling, setNotForSelling] = useState(false);
  const [enableSerialNumber, setEnableSerialNumber] = useState(false);

  // ── Description & media ─────────────────────────────────────
  const [description, setDescription] = useState('');
  const [brochureName, setBrochureName] = useState('');
  const [brochureData, setBrochureData] = useState('');
  const [productImage, setProductImage] = useState('');

  // ── Variable product ────────────────────────────────────────
  const [variationSkuFormat, setVariationSkuFormat] = useState<'number' | 'variation'>('number');
  const [variationRows, setVariationRows] = useState<ProductVariationRow[]>([]);

  // ── Combo product ───────────────────────────────────────────
  const [comboItems, setComboItems] = useState<ProductComboItem[]>([]);
  const [comboSearchQuery, setComboSearchQuery] = useState('');
  const [comboSearchResults, setComboSearchResults] = useState<typeof products>([]);
  const [showComboDropdown, setShowComboDropdown] = useState(false);
  const [comboMargin, setComboMargin] = useState<number>(parseFloat(settings.defaultProfitPercent) || 25);

  // ── Derived ─────────────────────────────────────────────────
  const selectedTaxRate = selectedTax === '--' ? 0 : (taxRates.find(t => t.name === selectedTax)?.rate || 0);
  const purchasePriceInc = typeof purchasePrice === 'number' ? parseFloat((purchasePrice * (1 + selectedTaxRate / 100)).toFixed(3)) : 0;
  const sellingPriceInc = typeof sellingPrice === 'number' ? parseFloat((Number(sellingPrice) * (1 + selectedTaxRate / 100)).toFixed(3)) : 0;
  const activeComboItems = comboItems.filter((item) => Number(item.qty) > 0);
  const comboTotal = activeComboItems.reduce((sum, c) => sum + c.unitPrice * c.qty, 0);
  const comboSellingPrice = parseFloat((comboTotal + comboTotal * (comboMargin / 100)).toFixed(3));
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const normalizedPackagingType = normalizePackagingType(packagingType);
  const normalizedUnitsPerPackage = normalizeUnitsPerPackage(unitsPerPackage);
  const unitLabel = selectedUnit.trim() || 'Pc(s)';
  const packageUnitLabel = normalizedPackagingType === 'Piece' ? 'Carton' : normalizedPackagingType;
  const packageSizeHint = normalizedUnitsPerPackage
    ? `1 ${packageUnitLabel} = ${normalizedUnitsPerPackage} ${unitLabel}`
    : '';
  const pieceSellingPrice = productType === 'Combo'
    ? comboSellingPrice
    : (typeof sellingPrice === 'number' ? sellingPrice : 0);
  const packageSellingPrice = normalizedUnitsPerPackage && pieceSellingPrice > 0
    ? Number((pieceSellingPrice * normalizedUnitsPerPackage).toFixed(3))
    : null;
  const normalizedSkuInput = sku.trim().toLowerCase();
  const isSkuDuplicate = normalizedSkuInput !== '' && products.some(p =>
    p.sku.trim().toLowerCase() === normalizedSkuInput && (!isEdit || p.id !== productId)
  );

  const getUsedVariationSkus = (excludeProductId?: string) => {
    const used = new Set<string>();
    products.forEach((product) => {
      if (excludeProductId && product.id === excludeProductId) return;
      if (product.sku?.trim()) used.add(product.sku.trim().toLowerCase());
      (product.variationRows || []).forEach((row) => {
        if (row.sku?.trim()) used.add(row.sku.trim().toLowerCase());
      });
    });
    return used;
  };

  const getVariationValues = (variationId: string) =>
    productVariations.find(v => v.id === variationId)?.values || [];

  const resolveWarrantyId = (value?: string) => {
    if (!value) return '';
    const byId = warranties.find(w => w.id === value);
    if (byId) return byId.id;
    const byName = warranties.find(w => w.name === value);
    return byName?.id || '';
  };

  const resolveBrandLink = (brandName: string, existingBrandId?: string): { id: string; name: string } => {
    const normalizedName = brandName.trim().toLowerCase();
    const byId = existingBrandId
      ? productBrands.find(brand => brand.id === existingBrandId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };
    if (!normalizedName) return { id: '', name: '--' };

    const byName = productBrands.find(brand => brand.name.trim().toLowerCase() === normalizedName);
    if (byName) return { id: byName.id, name: byName.name };

    const selected = brandName.trim();
    return { id: '', name: selected || '--' };
  };

  const getLocationRack = (locationId: string) =>
    locationRackDetails[locationId] || { rack: '', row: '', position: '' };

  const updateLocationRack = (
    locationId: string,
    field: 'rack' | 'row' | 'position',
    value: string
  ) => {
    setLocationRackDetails(prev => ({
      ...prev,
      [locationId]: {
        ...(prev[locationId] || { rack: '', row: '', position: '' }),
        [field]: value,
      },
    }));
  };

  const buildVariationSku = (
    baseSku: string,
    rowValues: string,
    index: number,
    mode: 'number' | 'variation'
  ): string => {
    const base = (baseSku.trim() || 'SKU').replace(/\s+/g, '').toUpperCase();
    if (mode === 'variation') {
      const token = rowValues
        .replace(/[\t\r\n]+/g, ' ')
        .trim()
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
      return token ? `${base}-${token}` : `${base}-${index + 1}`;
    }
    return `${base}-${index + 1}`;
  };

  // ── Edit pre-fill ────────────────────────────────────────────
  useEffect(() => {
    if (isEdit && productId) {
      const p = products.find(pr => pr.id === productId);
      if (p) {
        setProductName(p.name);
        setSku(p.sku);
        setProductType(p.type);
        setSellingPrice(p.sellingPrice);
        setBusinessLocation(p.businessLocation || '');
        setManageStock(true);
        setPurchasePrice(p.unitPurchasePrice || 0);
        setSelectedUnit(p.unit || '');
        const existingPackagingType = normalizePackagingType(p.packagingType);
        const existingUnitsPerPackage = normalizeUnitsPerPackage(p.unitsPerPackage);
        setPackagingType(existingPackagingType);
        setUnitsPerPackage(existingUnitsPerPackage ?? '');
        setSelectedBrand(p.brand || '');
        const linkedCategoryName = p.categoryId
          ? (productCategories.find(c => c.id === p.categoryId)?.name || p.category || '')
          : (p.category || '');
        setSelectedCategory(linkedCategoryName);
        setSelectedTax(p.tax || '--');
        setSelectedWarranty(resolveWarrantyId(p.warranty));
        setDescription(p.description || '');
        setProductImage(p.image || '');
        setBrochureName(p.brochureName || '');
        setBrochureData(p.brochureData || '');
        setOpeningStock(p.openingStock ?? '');
        setAlertQuantity(p.alertQuantity ?? '');
        setExpiryDate(p.expiryDate || '');
        setBarcodeType(p.barcodeType || 'Code 128 (C128)');
        setTaxType(p.taxType || 'Exclusive');
        setWeight(p.weight ?? '');
        setServiceTimer(p.serviceStaffTimer ?? '');
        setNotForSelling(p.notForSelling || false);
        setEnableSerialNumber(p.enableSerialNumber || false);
        setSubCategory(p.subCategory || '');
        if (p.locationRackDetails && Object.keys(p.locationRackDetails).length > 0) {
          setLocationRackDetails(p.locationRackDetails);
        } else {
          const fallbackLoc = locations.find(l => l.name === (p.businessLocation || ''))?.id;
          if (fallbackLoc && (p.rack || p.row || p.position)) {
            setLocationRackDetails({
              [fallbackLoc]: {
                rack: p.rack || '',
                row: p.row || '',
                position: p.position || '',
              },
            });
          } else {
            setLocationRackDetails({});
          }
        }
        if (p.variationRows) setVariationRows(p.variationRows);
        if (p.comboItems) {
          setComboItems(
            p.comboItems.map(item => ({
              ...item,
              qty: Math.max(1, Number(item.qty) || 1),
            }))
          );
        }
        if (p.unitPurchasePrice > 0) {
          const m = ((p.sellingPrice - p.unitPurchasePrice) / p.unitPurchasePrice) * 100;
          setMargin(Math.round(m * 100) / 100);
        }
      }
    }
  }, [isEdit, productId, products, locations, warranties, productCategories]);

  // ── Price calculation helpers ────────────────────────────────
  const calcSP = (cost: number, m: number) => parseFloat((cost + cost * (m / 100)).toFixed(3));

  const handlePurchasePriceChange = (val: string) => {
    const p = parseFloat(val);
    setPurchasePrice(val === '' ? '' : p);
    if (!isNaN(p)) setSellingPrice(calcSP(p, margin));
  };

  const handlePurchasePriceIncChange = (val: string) => {
    const inc = parseFloat(val);
    if (!isNaN(inc) && selectedTaxRate > 0) {
      const exc = parseFloat((inc / (1 + selectedTaxRate / 100)).toFixed(3));
      setPurchasePrice(exc);
      setSellingPrice(calcSP(exc, margin));
    }
  };

  const handleMarginChange = (val: string) => {
    const m = parseFloat(val);
    const safeM = isNaN(m) ? 0 : m;
    setMargin(safeM);
    if (typeof purchasePrice === 'number') setSellingPrice(calcSP(purchasePrice, safeM));
  };

  const handleSellingPriceIncChange = (val: string) => {
    const inc = parseFloat(val);
    if (!isNaN(inc) && selectedTaxRate > 0) {
      const exc = parseFloat((inc / (1 + selectedTaxRate / 100)).toFixed(3));
      setSellingPrice(exc);
      if (typeof purchasePrice === 'number' && purchasePrice > 0) {
        setMargin(Math.round(((exc - purchasePrice) / purchasePrice) * 10000) / 100);
      }
    }
  };

  // ── Image upload ─────────────────────────────────────────────
  const handleImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addNotification({ title: 'Error', message: 'Image must be under 5MB.', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setProductImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleBrochureUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addNotification({ title: 'Error', message: 'Brochure must be under 5MB.', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setBrochureName(file.name);
      setBrochureData((e.target?.result as string) || '');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBrochure = () => {
    setBrochureName('');
    setBrochureData('');
    if (brochureRef.current) brochureRef.current.value = '';
  };

  // ── Variation row helpers ────────────────────────────────────
  const handleAddVariationRow = () => {
    const firstVar = productVariations[0];
    if (!firstVar) {
      addNotification({ title: 'Missing Variation Setup', message: 'Please create at least one variation type first.', type: 'warning' });
      return;
    }
    const defaultValue = firstVar.values[0] || '';
    setVariationRows(prev => [...prev, {
      id: generateId('VR'),
      variationId: firstVar?.id || '',
      values: defaultValue,
      sku: buildVariationSku(sku, defaultValue, prev.length, variationSkuFormat),
      purchasePrice: typeof purchasePrice === 'number' ? purchasePrice : 0,
      margin,
      sellingPrice: typeof sellingPrice === 'number' ? sellingPrice : 0,
    }]);
  };

  const handleRemoveVariationRow = (id: string) => setVariationRows(prev => prev.filter(r => r.id !== id));

  const handleDuplicateVariationRow = (id: string) => {
    setVariationRows(prev => {
      const row = prev.find(r => r.id === id);
      if (!row) return prev;
      return [
        ...prev,
        {
          ...row,
          id: generateId('VR'),
          sku: buildVariationSku(sku, row.values, prev.length, variationSkuFormat),
        },
      ];
    });
  };

  const handleVariationRowChange = (id: string, field: keyof ProductVariationRow, value: string | number) => {
    setVariationRows(prev => prev.map((r, rowIndex) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'variationId') {
        const nextVariationId = String(value);
        const nextValues = getVariationValues(nextVariationId);
        const nextValue = nextValues[0] || '';
        updated.values = nextValue;
        updated.sku = buildVariationSku(sku, nextValue, rowIndex, variationSkuFormat);
      }
      if (field === 'purchasePrice' || field === 'margin') {
        const cost = field === 'purchasePrice' ? Number(value) : r.purchasePrice;
        const pct = field === 'margin' ? Number(value) : r.margin;
        updated.sellingPrice = calcSP(cost, pct);
      }
      if (field === 'sellingPrice' && r.purchasePrice > 0) {
        const sp = Number(value);
        updated.margin = Math.round(((sp - r.purchasePrice) / r.purchasePrice) * 10000) / 100;
      }
      if (field === 'values') {
        updated.sku = buildVariationSku(sku, String(value), rowIndex, variationSkuFormat);
      }
      return updated;
    }));
  };

  useEffect(() => {
    setVariationRows(prev => prev.map((row, idx) => ({
      ...row,
      sku: buildVariationSku(sku, row.values, idx, variationSkuFormat),
    })));
  }, [variationSkuFormat, sku]);

  // ── Combo helpers ────────────────────────────────────────────
  const handleComboSearch = (query: string) => {
    setComboSearchQuery(query);
    if (query.length < 2) { setComboSearchResults([]); setShowComboDropdown(false); return; }
    const q = query.toLowerCase();
    const results = products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
    setComboSearchResults(results);
    setShowComboDropdown(results.length > 0);
  };

  const handleAddComboItem = (product: typeof products[0]) => {
    if (comboItems.find(c => c.productId === product.id)) {
      addNotification({ title: 'Already Added', message: 'This product is already in the combo.', type: 'warning' });
    } else {
      setComboItems(prev => [...prev, {
        id: generateId('CI'),
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        qty: 1,
        unitPrice: product.unitPurchasePrice,
      }]);
    }
    setComboSearchQuery('');
    setComboSearchResults([]);
    setShowComboDropdown(false);
  };

  const handleRemoveComboItem = (id: string) => setComboItems(prev => prev.filter(c => c.id !== id));

  const handleComboItemQtyChange = (id: string, qty: number) =>
    setComboItems(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, qty) } : c));

  // ── Reset form ───────────────────────────────────────────────
  const resetForm = () => {
    const defaultMargin = parseFloat(settings.defaultProfitPercent) || 25;
    setProductName(''); setSku(''); setBarcodeType('Code 128 (C128)');
    setPurchasePrice(''); setMargin(defaultMargin); setSellingPrice('');
    setBusinessLocation(''); setSelectedUnit(settings.defaultUnit || '');
    setPackagingType('Piece'); setUnitsPerPackage('');
    setSelectedBrand(''); setSelectedCategory(''); setSubCategory('');
    setSelectedTax('--'); setTaxType('Exclusive'); setSelectedWarranty('');
    setExpiryDate(''); setOpeningStock(''); setAlertQuantity('');
    setLocationRackDetails({}); setWeight(''); setServiceTimer('');
    setNotForSelling(false); setEnableSerialNumber(false);
    setDescription(''); setBrochureName(''); setBrochureData(''); setProductImage('');
    setVariationRows([]); setComboItems([]);
    setComboSearchQuery(''); setComboMargin(defaultMargin);
    setProductType('Single'); setManageStock(false);
    if (brochureRef.current) brochureRef.current.value = '';
  };

  const wrapSelectedDescriptionText = (prefix: string, suffix: string = prefix) => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = description.slice(start, end);
    const updated = `${description.slice(0, start)}${prefix}${selected}${suffix}${description.slice(end)}`;
    setDescription(updated);
    requestAnimationFrame(() => {
      const cursor = selected
        ? start + prefix.length + selected.length + suffix.length
        : start + prefix.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const formatDescriptionList = (ordered: boolean) => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = description.slice(start, end) || description;
    const lines = selected.split('\n');
    const updatedLines = lines.map((line, idx) => {
      const clean = line.replace(/^(\s*)([-*]|\d+\.)\s+/, '$1');
      return ordered ? `${idx + 1}. ${clean}` : `- ${clean}`;
    });
    const replaced = updatedLines.join('\n');
    const updated = selected === description
      ? replaced
      : `${description.slice(0, start)}${replaced}${description.slice(end)}`;
    setDescription(updated);
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = (addAnother = false) => {
    if (!productName.trim()) {
      addNotification({ title: 'Error', message: 'Product name is required.', type: 'error' });
      return;
    }

    if (!selectedUnit.trim()) {
      addNotification({ title: 'Error', message: 'Unit is required.', type: 'error' });
      return;
    }
    const hasUnitsPerPackageInput = unitsPerPackage !== '';
    if (hasUnitsPerPackageInput && (!Number.isInteger(Number(unitsPerPackage)) || Number(unitsPerPackage) <= 0)) {
      addNotification({
        title: 'Error',
        message: normalizedPackagingType === 'Piece'
          ? 'Enter a valid total number of pieces in one carton.'
          : `Enter a valid total number of pieces in one ${normalizedPackagingType.toLowerCase()}.`,
        type: 'error'
      });
      return;
    }
    if (normalizedPackagingType !== 'Piece' && !normalizedUnitsPerPackage) {
      addNotification({
        title: 'Error',
        message: `Enter a valid total number of pieces in one ${normalizedPackagingType.toLowerCase()}.`,
        type: 'error'
      });
      return;
    }

    if (!barcodeType.trim()) {
      addNotification({ title: 'Error', message: 'Barcode type is required.', type: 'error' });
      return;
    }

    if (!taxType.trim()) {
      addNotification({ title: 'Error', message: 'Selling price tax type is required.', type: 'error' });
      return;
    }

    if (locations.length > 0 && !businessLocation.trim()) {
      addNotification({ title: 'Error', message: 'Business location is required.', type: 'error' });
      return;
    }

    const existingProduct = isEdit && productId ? products.find(p => p.id === productId) : null;
    const autoSku = `${settings.skuPrefix || ''}${Date.now().toString().slice(-6)}`;
    const resolvedSku = (sku.trim() || autoSku).trim();
    const usedSkus = getUsedVariationSkus(isEdit && productId ? productId : undefined);
    if (usedSkus.has(resolvedSku.toLowerCase())) {
      addNotification({ title: 'Duplicate SKU', message: `SKU "${resolvedSku}" already exists. Use a unique SKU.`, type: 'error' });
      return;
    }

    const normalizedVariationRows = variationRows.map((row, index) => {
      const normalizedValues = row.values.trim();
      return {
        ...row,
        values: normalizedValues,
        sku: buildVariationSku(resolvedSku, normalizedValues, index, variationSkuFormat).trim(),
        purchasePrice: Number(row.purchasePrice) || 0,
        margin: Number(row.margin) || 0,
        sellingPrice: Number(row.sellingPrice) || 0,
      };
    });

    if (productType === 'Variable') {
      if (normalizedVariationRows.length === 0) {
        addNotification({ title: 'Missing Variations', message: 'Add at least one variation row before saving.', type: 'error' });
        return;
      }

      const localSkus = new Set<string>([resolvedSku.toLowerCase()]);
      for (let i = 0; i < normalizedVariationRows.length; i += 1) {
        const row = normalizedVariationRows[i];
        const rowNumber = i + 1;
        const variation = productVariations.find(v => v.id === row.variationId);

        if (!variation) {
          addNotification({ title: 'Variation Error', message: `Row ${rowNumber}: choose a valid variation.`, type: 'error' });
          return;
        }

        if (!row.values) {
          addNotification({ title: 'Variation Error', message: `Row ${rowNumber}: choose a variation value.`, type: 'error' });
          return;
        }

        if (variation.values.length > 0 && !variation.values.includes(row.values)) {
          addNotification({ title: 'Variation Error', message: `Row ${rowNumber}: variation value "${row.values}" is not valid for ${variation.name}.`, type: 'error' });
          return;
        }

        const rowSku = row.sku.trim().toLowerCase();
        if (!rowSku) {
          addNotification({ title: 'Variation Error', message: `Row ${rowNumber}: SKU could not be generated.`, type: 'error' });
          return;
        }

        if (localSkus.has(rowSku)) {
          addNotification({ title: 'Duplicate SKU', message: `Row ${rowNumber}: SKU "${row.sku}" is duplicated in this product.`, type: 'error' });
          return;
        }

        if (usedSkus.has(rowSku)) {
          addNotification({ title: 'Duplicate SKU', message: `Row ${rowNumber}: SKU "${row.sku}" already exists.`, type: 'error' });
          return;
        }

        localSkus.add(rowSku);
      }
    }

    if (productType === 'Combo' && activeComboItems.length === 0) {
      addNotification({ title: 'Empty Combo', message: 'Add at least one combo item before saving.', type: 'error' });
      return;
    }

    const resolvedLocationName = businessLocation.trim();
    const resolvedLocationId = locations.find(l => l.name === resolvedLocationName)?.id;
    const resolvedRackDetail = resolvedLocationId ? locationRackDetails[resolvedLocationId] : undefined;
    const shouldApplyOpeningStock = !isEdit || !existingProduct;
    const normalizedSelectedCategory = selectedCategory.trim();
    const matchedCategory = normalizedSelectedCategory
      ? (productCategories.find(category => category.name === normalizedSelectedCategory) ||
         productCategories.find(category => category.name.trim().toLowerCase() === normalizedSelectedCategory.toLowerCase()))
      : undefined;
    const resolvedCategoryName = matchedCategory?.name || normalizedSelectedCategory || existingProduct?.category || 'Uncategorized';
    const resolvedCategoryId = matchedCategory?.id || existingProduct?.categoryId || '';
    const resolvedBrand = resolveBrandLink(selectedBrand, existingProduct?.brandId);
    const normalizedRackDetails = Object.fromEntries(
      Object.entries(locationRackDetails).filter(([, val]) => {
        const detail = val as { rack: string; row: string; position: string };
        return detail.rack.trim() || detail.row.trim() || detail.position.trim();
      })
    );

    const newProduct: Product = {
      id: isEdit && productId ? productId : generateId('PRD'),
      name: productName.trim(),
      sku: resolvedSku,
      type: productType,
      categoryId: resolvedCategoryId,
      category: resolvedCategoryName,
      brandId: resolvedBrand.id || existingProduct?.brandId || '',
      brand: resolvedBrand.name || existingProduct?.brand || '--',
      tax: selectedTax || existingProduct?.tax || '--',
      businessLocation: resolvedLocationName,
      unitPurchasePrice: typeof purchasePrice === 'number' ? purchasePrice : 0,
      sellingPrice: productType === 'Combo' ? comboSellingPrice : (Number(sellingPrice) || 0),
      stock: isEdit && existingProduct
        ? existingProduct.stock
        : (typeof openingStock === 'number' ? openingStock : 0),
      unit: selectedUnit || existingProduct?.unit || 'Pc(s)',
      packagingType: normalizedPackagingType === 'Piece' ? undefined : normalizedPackagingType,
      unitsPerPackage: normalizedUnitsPerPackage,
      warranty: selectedWarranty || undefined,
      image: productImage || existingProduct?.image || '',
      brochureName: brochureName || existingProduct?.brochureName || undefined,
      brochureData: brochureData || existingProduct?.brochureData || undefined,
      description: description || undefined,
      alertQuantity: typeof alertQuantity === 'number' ? alertQuantity : undefined,
      expiryDate: expiryDate || existingProduct?.expiryDate,
      barcodeType,
      taxType,
      weight: typeof weight === 'number' ? weight : undefined,
      serviceStaffTimer: typeof serviceTimer === 'number' ? serviceTimer : existingProduct?.serviceStaffTimer,
      notForSelling: notForSelling || undefined,
      enableSerialNumber: enableSerialNumber || undefined,
      subCategory: subCategory || undefined,
      rack: resolvedRackDetail?.rack || existingProduct?.rack,
      row: resolvedRackDetail?.row || existingProduct?.row,
      position: resolvedRackDetail?.position || existingProduct?.position,
      locationRackDetails: Object.keys(normalizedRackDetails).length > 0
        ? normalizedRackDetails
        : existingProduct?.locationRackDetails,
      openingStock: shouldApplyOpeningStock
        ? (typeof openingStock === 'number' ? openingStock : undefined)
        : existingProduct?.openingStock,
      openingStockLocation: shouldApplyOpeningStock
        ? (resolvedLocationName || existingProduct?.openingStockLocation)
        : existingProduct?.openingStockLocation,
      variationRows: productType === 'Variable' ? normalizedVariationRows : undefined,
      comboItems: productType === 'Combo' ? activeComboItems : undefined,
    };

    if (isEdit && productId) {
      updateProduct(newProduct);
      addNotification({ title: 'Success', message: 'Product updated successfully!', type: 'success' });
      if (onNavigate) onNavigate('products');
    } else {
      addProduct(newProduct);
      addNotification({ title: 'Success', message: 'Product saved successfully!', type: 'success' });
      if (addAnother) {
        resetForm();
      } else {
        if (onNavigate) onNavigate('products');
      }
    }
  };

  // ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-32 animate-fade-in max-w-[1800px] mx-auto">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate?.('products')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Box className="text-blue-600" size={32} />
              {isEdit ? `Edit Product: ${productName}` : 'Add New Product'}
            </h2>
            <p className="text-slate-500 mt-1 text-lg">
              {isEdit ? 'Update product specifications and pricing.' : 'Create a new item in your inventory catalog.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* ── LEFT COLUMN ──────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-8">

          {/* 1. Basic Information */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
              <Info size={20} className="text-blue-500" /> Basic Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Product Name <span className="text-red-500">*</span></label>
                <input
                  type="text" placeholder="Product Name"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-slate-800"
                  value={productName} onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">SKU <Info size={12} className="text-blue-500" /></label>
                <div className="relative">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" placeholder="Auto-generated if blank"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono text-sm text-slate-700"
                    value={sku} onChange={(e) => setSku(e.target.value)}
                  />
                </div>
                {isSkuDuplicate && (
                  <p className="mt-1 text-xs font-bold text-rose-600">This SKU already exists.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Barcode Type <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select
                    value={barcodeType} onChange={(e) => setBarcodeType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                    <option>Code 128 (C128)</option>
                    <option>Code 39 (C39)</option>
                    <option>EAN-13</option>
                    <option>EAN-8</option>
                    <option>UPC-A</option>
                    <option>UPC-E</option>
                    <option>ITF-14</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Unit <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                      <option value="">Please Select</option>
                      {productUnits.map(u => <option key={u.id} value={u.shortName}>{u.name} ({u.shortName})</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                  <button type="button" onClick={() => onNavigate?.('units')} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shrink-0" title="Manage Units">
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling By</label>
                <div className="relative">
                  <select
                    value={packagingType}
                    onChange={(e) => {
                      const nextPackagingType = normalizePackagingType(e.target.value);
                      setPackagingType(nextPackagingType);
                    }}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="Piece">Piece</option>
                    <option value="Pack">Pack</option>
                    <option value="Carton">Carton</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  {packagingType === 'Piece' ? 'Pieces in 1 Carton (Optional)' : `Pieces in 1 ${packagingType}`}
                  {packagingType !== 'Piece' && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder={packagingType === 'Piece' ? 'Total pieces in one carton' : `Total pieces in one ${packagingType.toLowerCase()}`}
                  value={unitsPerPackage}
                  onChange={(e) => setUnitsPerPackage(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border-transparent transition-all text-sm font-medium bg-slate-50 text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />
                {packagingType === 'Piece' && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Optional. If set, Add Sale can switch quantity mode to Carton for this product.
                  </p>
                )}
              </div>

              {packageSizeHint && (
                <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 font-semibold">
                  <p>{packageSizeHint}</p>
                  {packageSellingPrice != null && (
                    <p className="mt-1 font-bold">Selling price per {packageUnitLabel}: {formatCurrency(packageSellingPrice)}</p>
                  )}
                </div>
              )}

              {settings.enableBrands && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Brand</label>
                  <div className="flex gap-2">
                    <div className="relative w-full">
                      <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                        <option value="">Please Select</option>
                        {productBrands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <button type="button" onClick={() => onNavigate?.('brands')} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shrink-0" title="Manage Brands">
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}

              {settings.enableCategories && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                  <div className="flex gap-2">
                    <div className="relative w-full">
                      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                        <option value="">Please Select</option>
                        {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    <button type="button" onClick={() => onNavigate?.('categories')} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md shrink-0" title="Manage Categories">
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Warranty</label>
                <div className="relative">
                  <select value={selectedWarranty} onChange={(e) => setSelectedWarranty(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                    <option value="">No Warranty</option>
                    {warranties.map(w => <option key={w.id} value={w.id}>{w.name} ({w.duration} {w.durationUnit})</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Business Location <Info size={12} className="text-blue-500" /> <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium appearance-none cursor-pointer">
                    <option value="">Select Location</option>
                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Inventory & Logistics */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers size={20} className="text-emerald-500" /> Inventory & Logistics
              </h3>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="manageStock" checked={manageStock} onChange={() => setManageStock(v => !v)}
                  className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                <label htmlFor="manageStock" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                  Manage Stock? <Info size={14} className="text-emerald-500" />
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-400 italic mb-6">Enable stock management at product level</p>

            <div className="space-y-6">
              {manageStock && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Opening Stock</label>
                    <input type="number" placeholder="0" min="0"
                      disabled={isEdit}
                      value={openingStock}
                      onChange={(e) => setOpeningStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className={`w-full px-4 py-3 rounded-xl border-transparent transition-all text-sm font-bold text-slate-700 ${
                        isEdit
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-50 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10'
                      }`} />
                    {isEdit && (
                      <p className="mt-1 text-[10px] text-slate-500 font-semibold">Opening stock can only be set when creating a product.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Alert Quantity <Info size={12} className="text-emerald-500" /></label>
                    <div className="relative">
                      <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                      <input type="number" placeholder="Alert quantity" min="0"
                        value={alertQuantity}
                        onChange={(e) => setAlertQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-700" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-500" /> Rack / Row / Position Details
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {locations.map(loc => (
                    <div key={loc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h5 className="text-[10px] font-bold text-slate-700 mb-2 uppercase">{loc.name} ({loc.id}):</h5>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" placeholder="Rack"
                          value={getLocationRack(loc.id).rack}
                          onChange={(e) => updateLocationRack(loc.id, 'rack', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20" />
                        <input type="text" placeholder="Row"
                          value={getLocationRack(loc.id).row}
                          onChange={(e) => updateLocationRack(loc.id, 'row', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20" />
                        <input type="text" placeholder="Position"
                          value={getLocationRack(loc.id).position}
                          onChange={(e) => updateLocationRack(loc.id, 'position', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Weight (kg)</label>
                  <input type="number" placeholder="Weight" min="0" step="0.001"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Service Staff Timer (Minutes)</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="number" placeholder="Service staff timer" min="0"
                      value={serviceTimer}
                      onChange={(e) => setServiceTimer(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-4">
                {settings.enableSerialNumbers && (
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-300 transition-all">
                    <input type="checkbox" checked={enableSerialNumber} onChange={(e) => setEnableSerialNumber(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">Enable IMEI / Serial Number <Info size={12} className="text-blue-500" /></span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 hover:border-blue-300 transition-all">
                  <input type="checkbox" checked={notForSelling} onChange={(e) => setNotForSelling(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">Not for selling <Info size={12} className="text-blue-500" /></span>
                </label>
              </div>
            </div>
          </div>

          {/* 3. Description */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText size={20} className="text-slate-500" /> Product Description
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => wrapSelectedDescriptionText('**')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Bold size={14} /></button>
                <button type="button" onClick={() => wrapSelectedDescriptionText('*')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Italic size={14} /></button>
                <button type="button" onClick={() => wrapSelectedDescriptionText('<u>', '</u>')} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><Underline size={14} /></button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button type="button" onClick={() => formatDescriptionList(false)} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><List size={14} /></button>
                <button type="button" onClick={() => formatDescriptionList(true)} className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><ListOrdered size={14} /></button>
              </div>
              <textarea
                ref={descriptionRef}
                rows={6}
                className="w-full p-4 text-sm text-slate-700 focus:outline-none resize-y"
                placeholder="Enter detailed product description here..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="bg-slate-50 border-t border-slate-200 p-2 text-[10px] text-right text-slate-400 font-bold uppercase">
                {wordCount} {wordCount === 1 ? 'Word' : 'Words'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Product Brochure</label>
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <FileText size={20} className="text-slate-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-600">{brochureName || 'No file chosen'}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Max size: 5MB. Formats: .pdf, .docx, .jpg</p>
                </div>
                <button type="button" onClick={() => brochureRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                  Choose File
                </button>
                {brochureData && (
                  <a
                    href={brochureData}
                    download={brochureName || 'product-brochure'}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1"
                  >
                    <Download size={12} /> Download
                  </a>
                )}
                {brochureName && (
                  <button
                    type="button"
                    onClick={handleRemoveBrochure}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <input ref={brochureRef} type="file" className="hidden" accept=".pdf,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrochureUpload(f); }} />
              </div>
            </div>
          </div>

          {/* 4. Pricing & Variations */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <DollarSign size={20} className="text-amber-500" /> Pricing & Variations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Applicable Tax</label>
                <div className="relative">
                  <select value={selectedTax} onChange={(e) => setSelectedTax(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                    <option value="--">None</option>
                    {taxRates.map(t => <option key={t.id} value={t.name}>{t.name} ({t.rate}%)</option>)}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price Tax Type <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={taxType} onChange={(e) => setTaxType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                    <option>Exclusive</option>
                    <option>Inclusive</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">Product Type <Info size={12} className="text-amber-500" /> <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={productType} onChange={(e) => setProductType(e.target.value as 'Single' | 'Variable' | 'Combo')}
                    className="w-full px-4 py-3 rounded-xl bg-amber-50 border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-sm font-bold text-amber-900 appearance-none cursor-pointer">
                    <option value="Single">Single</option>
                    <option value="Variable">Variable</option>
                    <option value="Combo">Combo</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" size={16} />
                </div>
              </div>
            </div>

            {/* SINGLE PRODUCT PRICING */}
            {productType === 'Single' && (
              <div className="animate-in fade-in rounded-xl overflow-hidden border border-slate-200">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#5cb85c] text-white text-xs">
                      <th className="p-3 text-left w-1/4 border-r border-[#4cae4c]">Default Purchase Price</th>
                      <th className="p-3 text-left w-20 border-r border-[#4cae4c]">Margin (%)</th>
                      <th className="p-3 text-left w-1/4 border-r border-[#4cae4c]">Default Selling Price</th>
                      <th className="p-3 text-left">Product Image</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    <tr>
                      <td className="p-4 border-r border-slate-100 align-top">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Exc. tax*</label>
                            <input type="number" placeholder="0.000" step="0.001" min="0"
                              value={purchasePrice}
                              onChange={(e) => handlePurchasePriceChange(e.target.value)}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Inc. tax</label>
                            <input type="number" placeholder="0.000" step="0.001" min="0"
                              value={purchasePriceInc || ''}
                              onChange={(e) => handlePurchasePriceIncChange(e.target.value)}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 border-r border-slate-100 align-top pt-9">
                        <input type="number" step="0.01" min="0"
                          value={margin}
                          onChange={(e) => handleMarginChange(e.target.value)}
                          className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                      </td>
                      <td className="p-4 border-r border-slate-100 align-top">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Exc. tax</label>
                            <input type="number" readOnly
                              value={typeof sellingPrice === 'number' ? sellingPrice.toFixed(3) : ''}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold text-slate-700" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Inc. tax</label>
                            <input type="number" placeholder="0.000" step="0.001" min="0"
                              value={sellingPriceInc || ''}
                              onChange={(e) => handleSellingPriceIncChange(e.target.value)}
                              className="w-full px-2 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5cb85c]/20" />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 block uppercase">Product Image</label>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => imageRef.current?.click()}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-bold text-xs hover:bg-white transition-colors">
                              Choose File
                            </button>
                            <span className="text-[10px] text-slate-400">{productImage ? 'Image selected' : 'No file chosen'}</span>
                          </div>
                          {productImage && <img src={productImage} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />}
                          <p className="text-[9px] text-slate-400">Max 5MB · 1:1 ratio</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* VARIABLE PRODUCT */}
            {productType === 'Variable' && (
              <div className="mt-6 space-y-6 animate-in fade-in">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-1 uppercase">Variation SKU Format <Info size={12} className="text-blue-500" /></label>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                        <input type="radio" checked={variationSkuFormat === 'number'} onChange={() => setVariationSkuFormat('number')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                        SKU-Number (e.g. ABC-1, ABC-2)
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                        <input type="radio" checked={variationSkuFormat === 'variation'} onChange={() => setVariationSkuFormat('variation')} className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300" />
                        SKU-Variation (e.g. ABCS, ABCM)
                      </label>
                    </div>
                  </div>
                  <button type="button" onClick={handleAddVariationRow}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md text-sm font-bold flex items-center gap-2">
                    <Plus size={16} /> Add Variation Row
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#5cb85c] text-white text-xs">
                        <th className="p-3 border-r border-[#4cae4c] w-10"></th>
                        <th className="p-3 border-r border-[#4cae4c] text-left">Variation</th>
                        <th className="p-3 border-r border-[#4cae4c] text-left">Values / SKU</th>
                        <th className="p-3 border-r border-[#4cae4c] text-left w-44">Purchase Price<br /><span className="font-normal text-[10px] opacity-80">Exc. | Inc.</span></th>
                        <th className="p-3 border-r border-[#4cae4c] text-left w-20">Margin%</th>
                        <th className="p-3 border-r border-[#4cae4c] text-left w-44">Selling Price<br /><span className="font-normal text-[10px] opacity-80">Exc. | Inc.</span></th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {variationRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                            <div className="flex flex-col items-center gap-2">
                              <Split size={28} className="opacity-20" />
                              <span>Click "Add Variation Row" to get started</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {variationRows.map(row => {
                        const rowPpInc = parseFloat((row.purchasePrice * (1 + selectedTaxRate / 100)).toFixed(3));
                        const rowSpInc = parseFloat((row.sellingPrice * (1 + selectedTaxRate / 100)).toFixed(3));
                        const rowVariationValues = getVariationValues(row.variationId);
                        return (
                          <tr key={row.id} className="border-b border-slate-100">
                            <td className="p-3 border-r border-slate-100 text-center">
                              <button type="button" onClick={() => handleRemoveVariationRow(row.id)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={16} />
                              </button>
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <select value={row.variationId} onChange={(e) => handleVariationRowChange(row.id, 'variationId', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
                                {productVariations.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <div className="space-y-1.5">
                                <select
                                  value={row.values}
                                  onChange={(e) => handleVariationRowChange(row.id, 'values', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                                >
                                  <option value="">Select Value</option>
                                  {rowVariationValues.map(value => (
                                    <option key={`${row.id}-${value}`} value={value}>{value}</option>
                                  ))}
                                </select>
                                <input type="text" readOnly value={row.sku}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] bg-slate-50 text-slate-500 font-mono" />
                                {rowVariationValues.length === 0 && (
                                  <p className="text-[10px] text-amber-600 font-semibold">
                                    No values configured for this variation.
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <div className="grid grid-cols-2 gap-1">
                                <input type="number" placeholder="0.000" step="0.001" min="0"
                                  value={row.purchasePrice || ''}
                                  onChange={(e) => handleVariationRowChange(row.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                  className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs" />
                                <input type="number" readOnly value={rowPpInc || ''}
                                  className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50" />
                              </div>
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <input type="number" step="0.01" min="0" value={row.margin}
                                onChange={(e) => handleVariationRowChange(row.id, 'margin', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                            </td>
                            <td className="p-3 border-r border-slate-100">
                              <div className="grid grid-cols-2 gap-1">
                                <input type="number" readOnly value={row.sellingPrice.toFixed(3)}
                                  className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-bold" />
                                <input type="number" readOnly value={rowSpInc || ''}
                                  className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50" />
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <button type="button" onClick={() => handleDuplicateVariationRow(row.id)} className="w-6 h-6 bg-teal-500 hover:bg-teal-600 rounded-full flex items-center justify-center text-white cursor-pointer mx-auto shadow-sm">
                                <Plus size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* COMBO PRODUCT */}
            {productType === 'Combo' && (
              <div className="mt-6 space-y-6 animate-in fade-in">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
                    placeholder="Search product by name or SKU to add to combo..."
                    value={comboSearchQuery}
                    onChange={(e) => handleComboSearch(e.target.value)}
                    onBlur={() => setTimeout(() => setShowComboDropdown(false), 150)}
                  />
                  {showComboDropdown && comboSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {comboSearchResults.map(p => (
                        <button key={p.id} type="button" onMouseDown={() => handleAddComboItem(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 flex justify-between items-center text-sm border-b border-slate-100 last:border-0">
                          <span className="font-medium text-slate-700">{p.name}</span>
                          <span className="text-xs text-slate-400 font-mono">{p.sku} — {formatCurrency(p.unitPurchasePrice || 0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#5cb85c] text-white text-xs font-bold">
                        <th className="p-3 border-r border-[#4cae4c] text-left w-1/3">Product Name</th>
                        <th className="p-3 border-r border-[#4cae4c] text-center w-32">Quantity</th>
                        <th className="p-3 border-r border-[#4cae4c] text-center w-44">Unit Price (Exc. Tax)</th>
                        <th className="p-3 border-r border-[#4cae4c] text-center w-44">Total (Exc. Tax)</th>
                        <th className="p-3 text-center w-12"><Trash2 size={14} className="mx-auto" /></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {comboItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                            <div className="flex flex-col items-center gap-2">
                              <PackageCheck size={32} className="opacity-20" />
                              <span>Search and add products to create a combo</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {comboItems.map(item => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 border-r border-slate-100">
                            <div className="font-medium text-slate-800">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.productSku}</div>
                          </td>
                          <td className="p-3 border-r border-slate-100 text-center">
                            <input type="number" min="1" value={item.qty}
                              onChange={(e) => handleComboItemQtyChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs text-center font-bold" />
                          </td>
                          <td className="p-3 border-r border-slate-100 text-center font-mono text-slate-700">
                            {item.unitPrice.toFixed(3)}
                          </td>
                          <td className="p-3 border-r border-slate-100 text-center font-bold text-slate-800">
                            {(item.unitPrice * item.qty).toFixed(3)}
                          </td>
                          <td className="p-3 text-center">
                            <button type="button" onClick={() => handleRemoveComboItem(item.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="p-3 text-right font-bold text-slate-700 uppercase text-xs">Net Total Amount:</td>
                        <td className="p-3 text-center font-bold text-slate-800">{formatCurrency(comboTotal)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">x Margin (%)</label>
                    <input type="number" step="0.01" min="0" value={comboMargin}
                      onChange={(e) => setComboMargin(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Default Selling Price (Exc. Tax)</label>
                    <input type="text" readOnly value={formatCurrency(comboSellingPrice)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────── */}
        <div className="space-y-8">

          {/* Image Upload */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
            <h3 className="text-sm font-bold text-slate-900 w-full text-left mb-4 uppercase tracking-wider">Product Image</h3>
            <div
              onClick={() => imageRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageUpload(f); }}
              className="w-full aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-blue-400 transition-all group overflow-hidden"
            >
              {productImage ? (
                <img src={productImage} alt="Product" className="w-full h-full object-cover" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <ImageIcon className="text-slate-400 group-hover:text-blue-500" size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-600">Drag image here</p>
                  <p className="text-[10px] text-slate-400 mt-1">or click to upload</p>
                </>
              )}
            </div>
            <input ref={imageRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            {productImage && (
              <button type="button" onClick={() => setProductImage('')}
                className="mt-2 text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                <X size={12} /> Remove Image
              </button>
            )}
            <p className="text-[10px] text-slate-400 mt-4 text-left w-full">Max size: 5MB. Formats: JPG, PNG, WEBP.</p>
          </div>

          {/* Organization */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-sm font-bold text-slate-900 w-full text-left mb-2 uppercase tracking-wider">Organization</h3>

            {settings.enableSubCategories && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sub Category</label>
                <input type="text" placeholder="Sub category name"
                  value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700" />
              </div>
            )}

            {settings.enableProductExpiry && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expiry Date</label>
                <input type="date"
                  value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium text-slate-700" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-2 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 hover:scale-105 transition-transform duration-300">
        {!isEdit && (
          <>
            <button type="button" onClick={() => handleSave(true)}
              className="px-6 py-2.5 rounded-full font-bold text-xs bg-red-600 hover:bg-red-500 transition flex items-center gap-2">
              <Plus size={14} /> Save And Add Another
            </button>
          </>
        )}
        <button type="button" onClick={() => handleSave(false)}
          className={`px-8 py-2.5 rounded-full font-bold text-xs shadow-lg transition flex items-center gap-2 ${isEdit ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'}`}>
          <Save size={14} /> {isEdit ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default AddProduct;
