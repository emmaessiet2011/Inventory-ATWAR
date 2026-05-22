import React, { useState, useRef } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import type { Product, ProductCategory, ProductVariation, ProductWarranty } from '@/context/GlobalContext';
import { normalizePackagingType, normalizeUnitsPerPackage } from '@/utils/productPackaging';

const BARCODE_TYPE_MAP: Record<string, string> = {
  'c128': 'Code 128 (C128)',
  'code128': 'Code 128 (C128)',
  'code 128 (c128)': 'Code 128 (C128)',
  'code 128': 'Code 128 (C128)',
  'c39': 'Code 39 (C39)',
  'code39': 'Code 39 (C39)',
  'code 39 (c39)': 'Code 39 (C39)',
  'code 39': 'Code 39 (C39)',
  'ean-13': 'EAN-13',
  'ean13': 'EAN-13',
  'ean-8': 'EAN-8',
  'ean8': 'EAN-8',
  'upc-a': 'UPC-A',
  'upca': 'UPC-A',
  'upc-e': 'UPC-E',
  'upce': 'UPC-E',
  'itf-14': 'ITF-14',
  'itf14': 'ITF-14',
};
const DEFAULT_BARCODE_TYPE = 'Code 128 (C128)';

type ColumnKey =
  | 'productName'
  | 'brand'
  | 'warranty'
  | 'unit'
  | 'packagingType'
  | 'unitsPerPackage'
  | 'category'
  | 'subCategory'
  | 'sku'
  | 'barcodeType'
  | 'manageStock'
  | 'alertQuantity'
  | 'expiresIn'
  | 'expiryPeriodUnit'
  | 'applicableTax'
  | 'sellingPriceTaxType'
  | 'productType'
  | 'variationName'
  | 'variationValues'
  | 'variationSkus'
  | 'purchasePriceInc'
  | 'purchasePriceExc'
  | 'profitMargin'
  | 'sellingPrice'
  | 'openingStock'
  | 'openingStockLocation'
  | 'expiryDate'
  | 'enableSerial'
  | 'weight'
  | 'serviceStaffTimer'
  | 'rack'
  | 'row'
  | 'position'
  | 'image'
  | 'productDescription'
  | 'notForSelling'
  | 'productLocations';

interface ColumnDefinition {
  key: ColumnKey;
  name: string;
  required: boolean | 'conditional';
  instruction: string;
  aliases: string[];
}

interface ParsedRow {
  rowNum: number;
  name: string;
  brandId?: string;
  brand: string;
  warranty?: string;
  unit: string;
  packagingType?: Product['packagingType'];
  unitsPerPackage?: number;
  categoryId?: string;
  category: string;
  subCategory: string;
  sku: string;
  barcodeType: string;
  alertQuantity: number;
  type: 'Single' | 'Variable' | 'Combo';
  tax: string;
  taxType: string;
  unitPurchasePrice: number;
  sellingPrice: number;
  stock: number;
  location: string;
  locationNames: string[];
  openingStockLocation: string;
  manageStock: boolean;
  enableSerialNumber: boolean;
  variationName: string;
  variationValues: string[];
  variationSkus: string[];
  expiryPeriod?: number;
  expiryPeriodUnit?: 'Days' | 'Months';
  weight: string;
  serviceStaffTimer?: number;
  rack: string;
  shelfRow: string;
  position: string;
  imageName: string;
  expiryDate: string;
  description: string;
  notForSelling: boolean;
  error?: string;
  warning?: string;
}

const columns: ColumnDefinition[] = [
  { key: 'productName', name: 'Product Name', required: true, instruction: 'Name of the product', aliases: [] },
  { key: 'brand', name: 'Brand', required: false, instruction: 'Name of the brand', aliases: [] },
  { key: 'warranty', name: 'Warranty', required: false, instruction: 'Warranty name from Warranty master', aliases: [] },
  { key: 'unit', name: 'Unit', required: true, instruction: 'Name of the unit', aliases: [] },
  { key: 'packagingType', name: 'Packaging Type', required: false, instruction: 'Piece, Pack or Carton', aliases: ['Package Type'] },
  { key: 'unitsPerPackage', name: 'Units Per Package', required: false, instruction: 'Integer > 0. Required when Packaging Type is Pack/Carton', aliases: ['Pieces Per Package', 'Units per package'] },
  { key: 'category', name: 'Category', required: false, instruction: 'Name of the Category', aliases: [] },
  { key: 'subCategory', name: 'Sub category', required: false, instruction: 'Name of the Sub-Category', aliases: ['Subcategory'] },
  { key: 'sku', name: 'SKU', required: false, instruction: 'Product SKU. If blank an SKU will be automatically generated', aliases: [] },
  { key: 'barcodeType', name: 'Barcode Type', required: false, instruction: 'Barcode Type: C128, C39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14', aliases: [] },
  { key: 'manageStock', name: 'Manage Stock?', required: false, instruction: '1 = Yes, 0 = No', aliases: ['Manage Stock'] },
  { key: 'alertQuantity', name: 'Alert quantity', required: false, instruction: 'Alert quantity', aliases: ['Alert Quantity'] },
  { key: 'expiresIn', name: 'Expires in', required: false, instruction: 'Product expiry period (numbers only)', aliases: [] },
  { key: 'expiryPeriodUnit', name: 'Expiry Period Unit', required: false, instruction: 'days or months', aliases: [] },
  { key: 'applicableTax', name: 'Applicable Tax', required: false, instruction: 'Name of the Tax Rate', aliases: [] },
  { key: 'sellingPriceTaxType', name: 'Selling Price Tax Type', required: true, instruction: 'inclusive or exclusive', aliases: [] },
  { key: 'productType', name: 'Product Type', required: true, instruction: 'single', aliases: [] },
  { key: 'variationName', name: 'Variation Name', required: 'conditional', instruction: 'Name of the variation (Ex: Size, Color)', aliases: [] },
  { key: 'variationValues', name: 'Variation Values', required: 'conditional', instruction: 'Values separated by |', aliases: [] },
  { key: 'variationSkus', name: 'Variation SKUs', required: false, instruction: 'SKUs of each variation separated by |', aliases: [] },
  { key: 'purchasePriceInc', name: 'Purchase Price (Including Tax)', required: false, instruction: 'Numbers only', aliases: [] },
  { key: 'purchasePriceExc', name: 'Purchase Price (Excluding Tax)', required: false, instruction: 'Numbers only', aliases: [] },
  { key: 'profitMargin', name: 'Profit Margin %', required: false, instruction: 'Numbers only', aliases: [] },
  { key: 'sellingPrice', name: 'Selling Price', required: false, instruction: 'Numbers only', aliases: [] },
  { key: 'openingStock', name: 'Opening Stock', required: false, instruction: 'Numbers only', aliases: [] },
  { key: 'openingStockLocation', name: 'Opening Stock Location', required: false, instruction: 'Name of the business location', aliases: [] },
  { key: 'expiryDate', name: 'Expiry Date', required: false, instruction: 'Format: mm-dd-yyyy', aliases: [] },
  { key: 'enableSerial', name: 'Enable Product description, IMEI or Serial Number', required: false, instruction: '1 = Yes, 0 = No', aliases: ['Enable Product Description, IMEI or Serial Number'] },
  { key: 'weight', name: 'Weight', required: false, instruction: 'Optional', aliases: [] },
  { key: 'serviceStaffTimer', name: 'Service Staff Timer (min)', required: false, instruction: 'Optional minutes, numbers only', aliases: ['Service Staff Timer', 'Service Timer'] },
  { key: 'rack', name: 'Rack', required: false, instruction: 'Rack details separated by |', aliases: [] },
  { key: 'row', name: 'Row', required: false, instruction: 'Row details separated by |', aliases: [] },
  { key: 'position', name: 'Position', required: false, instruction: 'Position details separated by |', aliases: [] },
  { key: 'image', name: 'Image', required: false, instruction: 'Image URL or image filename with extension', aliases: ['Image Link', 'Image URL', 'Image Url', 'Product Image', 'Product Image URL', 'Product Image Url'] },
  { key: 'productDescription', name: 'Product Description', required: false, instruction: '', aliases: ['Description'] },
  { key: 'notForSelling', name: 'Not for selling', required: false, instruction: '1 = Yes, 0 = No', aliases: [] },
  { key: 'productLocations', name: 'Product locations', required: false, instruction: 'Comma separated business location names', aliases: ['Product Locations'] },
];

const TEMPLATE_HEADERS = columns.map(col => col.name);

const parseCSVLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: string) => normalizeText(value.replace(/^\uFEFF/, '')).toLowerCase();
const parseBooleanValue = (value: string) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};
const appendWarning = (base: string | undefined, next: string) => (base ? `${base}; ${next}` : next);
const toFiniteNumber = (value: string): number | undefined => {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const resolveHeaderIndexes = (headerCells: string[]): Partial<Record<ColumnKey, number>> => {
  const normalizedHeaders = headerCells.map(normalizeHeader);
  const resolved: Partial<Record<ColumnKey, number>> = {};
  columns.forEach((col) => {
    const aliases = [col.name, ...col.aliases].map(normalizeHeader);
    const index = normalizedHeaders.findIndex(h => aliases.includes(h));
    if (index >= 0) resolved[col.key] = index;
  });
  return resolved;
};

type Step = 'upload' | 'preview' | 'done';

const ImportProducts: React.FC = () => {
  const {
    addProduct,
    addProductBrand,
    addProductCategory,
    addProductVariation,
    updateProductVariation,
    generateId,
    locations,
    products,
    productBrands,
    warranties,
    productUnits,
    productCategories,
    productVariations,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultLocation = locations[0]?.name || 'Main Store';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep('upload');
      setParsedRows([]);
      setImportResults(null);
    }
  };

  const handleDownloadTemplate = () => {
    const exampleRowByKey: Partial<Record<ColumnKey, string>> = {
      productName: 'Wireless Keyboard',
      brand: 'Logitech',
      warranty: '1 Year Warranty',
      unit: 'Pieces',
      packagingType: 'Carton',
      unitsPerPackage: '12',
      category: 'Electronics',
      sku: 'SKU-KB-001',
      barcodeType: 'C128',
      manageStock: '1',
      alertQuantity: '5',
      applicableTax: 'VAT@5%',
      sellingPriceTaxType: 'exclusive',
      productType: 'single',
      purchasePriceExc: '15.000',
      profitMargin: '10',
      sellingPrice: '20.000',
      openingStock: '50',
      openingStockLocation: defaultLocation,
      enableSerial: '0',
      serviceStaffTimer: '0',
      productDescription: 'USB wireless keyboard',
      notForSelling: '0',
      productLocations: defaultLocation,
    };
    const exampleRow = columns.map(col => exampleRowByKey[col.key] || '');
    const csv = [TEMPLATE_HEADERS.join(','), exampleRow.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseFile = () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onerror = () => {
      addNotification({ type: 'error', title: 'Read Error', message: 'Unable to read the selected file.' });
    };
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        addNotification({ type: 'error', title: 'Empty File', message: 'No data rows found in the file.' });
        return;
      }

      const headerCells = parseCSVLine(lines[0]).map(c => normalizeText(c.replace(/^\uFEFF/, '')));
      const headerIndexes = resolveHeaderIndexes(headerCells);
      const missingRequiredHeaders = columns
        .filter(col => col.required === true && headerIndexes[col.key] === undefined)
        .map(col => col.name);
      if (missingRequiredHeaders.length > 0) {
        addNotification({
          type: 'error',
          title: 'Invalid Template',
          message: `Missing required column(s): ${missingRequiredHeaders.join(', ')}`,
        });
        return;
      }

      const existingSkus = new Set<string>();
      products.forEach((product) => {
        if (product.sku?.trim()) existingSkus.add(product.sku.trim().toLowerCase());
        (product.variationRows || []).forEach((variationRow) => {
          if (variationRow.sku?.trim()) existingSkus.add(variationRow.sku.trim().toLowerCase());
        });
      });
      const fileSkus = new Set<string>();
      const unitLookup = new Map<string, string>();
      productUnits.forEach((u) => {
        unitLookup.set(normalizeText(u.name).toLowerCase(), u.shortName);
        unitLookup.set(normalizeText(u.shortName).toLowerCase(), u.shortName);
      });
      const categoryLookup = new Map<string, { id: string; name: string }>(
        productCategories.map(c => [normalizeText(c.name).toLowerCase(), { id: c.id, name: c.name }] as [string, { id: string; name: string }])
      );
      const brandLookup = new Map<string, { id: string; name: string }>(
        productBrands.map(b => [normalizeText(b.name).toLowerCase(), { id: b.id, name: b.name }] as [string, { id: string; name: string }])
      );
      const warrantyLookup = new Map<string, ProductWarranty>(
        warranties.flatMap(warranty => [
          [normalizeText(warranty.id).toLowerCase(), warranty],
          [normalizeText(warranty.name).toLowerCase(), warranty],
        ] as [string, ProductWarranty][])
      );
      const locationNameLookup = new Map<string, string>(
        locations.map(l => [normalizeText(l.name).toLowerCase(), l.name] as [string, string])
      );

      const rows: ParsedRow[] = [];

      for (let i = 1; i < lines.length; i += 1) {
        const cells = parseCSVLine(lines[i]);
        const c = (key: ColumnKey) => {
          const idx = headerIndexes[key];
          return idx === undefined ? '' : normalizeText(cells[idx] || '');
        };

        const name = c('productName');
        const rawBrand = c('brand');
        const matchedBrand = brandLookup.get(rawBrand.toLowerCase());
        const brand = matchedBrand?.name || rawBrand;
        const brandId = matchedBrand?.id || '';
        const rawWarranty = c('warranty');
        const matchedWarranty = warrantyLookup.get(rawWarranty.toLowerCase());
        const warranty = matchedWarranty?.id || '';
        const rawUnit = c('unit');
        const unit = unitLookup.get(rawUnit.toLowerCase()) || '';
        const rawPackagingType = c('packagingType');
        const normalizedPackagingType = normalizePackagingType(rawPackagingType || 'Piece');
        const normalizedRawPackagingType = normalizeText(rawPackagingType).toLowerCase();
        const hasUnknownPackagingType = !!rawPackagingType && normalizedRawPackagingType !== normalizedPackagingType.toLowerCase();
        const unitsPerPackageRaw = c('unitsPerPackage');
        const parsedUnitsPerPackage = toFiniteNumber(unitsPerPackageRaw);
        const unitsPerPackage = normalizeUnitsPerPackage(parsedUnitsPerPackage);
        const rawCategory = c('category');
        const matchedCategory = categoryLookup.get(rawCategory.toLowerCase());
        const category = matchedCategory?.name || rawCategory;
        const categoryId = matchedCategory?.id || '';
        const subCategory = c('subCategory');
        const sku = c('sku');
        const rawBarcodeType = c('barcodeType');
        const mappedBarcodeType = rawBarcodeType ? (BARCODE_TYPE_MAP[rawBarcodeType.toLowerCase()] || '') : '';
        const barcodeType = mappedBarcodeType || DEFAULT_BARCODE_TYPE;
        const manageStock = parseBooleanValue(c('manageStock'));
        const alertQuantityRaw = c('alertQuantity');
        const alertQuantity = toFiniteNumber(alertQuantityRaw) ?? 0;
        const taxName = c('applicableTax') || '--';
        const rawTaxType = c('sellingPriceTaxType').toLowerCase();
        const taxType = rawTaxType === 'inclusive' ? 'Inclusive' : rawTaxType === 'exclusive' ? 'Exclusive' : '';
        const productTypeRaw = c('productType').toLowerCase();
        const variationName = c('variationName');
        const variationValues = c('variationValues') ? c('variationValues').split('|').map(v => normalizeText(v)).filter(Boolean) : [];
        const variationSkus = c('variationSkus') ? c('variationSkus').split('|').map(v => normalizeText(v)).filter(Boolean) : [];
        const purchaseIncludingTaxRaw = c('purchasePriceInc');
        const purchaseExcludingTaxRaw = c('purchasePriceExc');
        const profitMarginRaw = c('profitMargin');
        const sellingPriceRaw = c('sellingPrice');
        const purchaseIncludingTax = toFiniteNumber(purchaseIncludingTaxRaw);
        const purchaseExcludingTax = toFiniteNumber(purchaseExcludingTaxRaw);
        const profitMargin = toFiniteNumber(profitMarginRaw);
        const parsedSellingPrice = toFiniteNumber(sellingPriceRaw);
        const openingStockRaw = c('openingStock');
        const openingStock = toFiniteNumber(openingStockRaw) ?? 0;
        const openingStockLocationInput = c('openingStockLocation');
        const openingStockLocation = locationNameLookup.get(openingStockLocationInput.toLowerCase()) || openingStockLocationInput || defaultLocation;
        const expiryDate = c('expiryDate');
        const enableSerialNumber = parseBooleanValue(c('enableSerial'));
        const expiresInRaw = c('expiresIn');
        const expiryPeriod = toFiniteNumber(expiresInRaw);
        const expiryPeriodUnitRaw = c('expiryPeriodUnit').toLowerCase();
        const expiryPeriodUnit = expiryPeriodUnitRaw === 'days' || expiryPeriodUnitRaw === 'day'
          ? 'Days'
          : expiryPeriodUnitRaw === 'months' || expiryPeriodUnitRaw === 'month'
          ? 'Months'
          : undefined;
        const weight = c('weight');
        const serviceStaffTimerRaw = c('serviceStaffTimer');
        const serviceStaffTimer = toFiniteNumber(serviceStaffTimerRaw);
        const rack = c('rack');
        const shelfRow = c('row');
        const position = c('position');
        const imageName = c('image');
        const description = c('productDescription');
        const notForSelling = parseBooleanValue(c('notForSelling'));
        const productLocationTokens = c('productLocations').split(',').map(v => normalizeText(v)).filter(Boolean);
        const locationNames = Array.from(new Set(
          productLocationTokens
            .map(loc => locationNameLookup.get(loc.toLowerCase()) || '')
            .filter(Boolean)
        ));
        const location = locationNames[0] || locationNameLookup.get(openingStockLocation.toLowerCase()) || defaultLocation;

        let type: 'Single' | 'Variable' | 'Combo' | '' = '';
        if (productTypeRaw === 'single') type = 'Single';
        // Variable/Combo completely blocked from import
        else if (productTypeRaw === 'variable' || productTypeRaw === 'combo') type = '';

        let unitPurchasePrice = Number.isFinite(purchaseExcludingTax) ? purchaseExcludingTax : 0;
        if (unitPurchasePrice <= 0 && Number.isFinite(purchaseIncludingTax)) unitPurchasePrice = purchaseIncludingTax;
        let sellingPrice = Number.isFinite(parsedSellingPrice) ? parsedSellingPrice : 0;
        if (sellingPrice <= 0 && unitPurchasePrice > 0 && Number.isFinite(profitMargin)) {
          sellingPrice = parseFloat((unitPurchasePrice * (1 + (profitMargin / 100))).toFixed(3));
        }
        const stock = manageStock ? openingStock : 0;

        let error: string | undefined;
        let warning: string | undefined;
        if (rawBarcodeType && !mappedBarcodeType) {
          warning = appendWarning(
            warning,
            `Unknown Barcode Type "${rawBarcodeType}". Defaulted to "${DEFAULT_BARCODE_TYPE}".`,
          );
        }
        if (!name) error = 'Product Name is required';
        else if (!rawUnit) error = 'Unit is required';
        else if (!unit) error = `Unit "${rawUnit}" not found in Unit master`;
        else if (unitsPerPackageRaw && !Number.isFinite(parsedUnitsPerPackage)) error = `Invalid Units Per Package "${unitsPerPackageRaw}"`;
        else if (Number.isFinite(parsedUnitsPerPackage) && (!Number.isInteger(parsedUnitsPerPackage) || parsedUnitsPerPackage <= 0)) error = 'Units Per Package must be a positive whole number';
        else if (normalizedPackagingType !== 'Piece' && !unitsPerPackage) error = `Units Per Package is required when Packaging Type is "${normalizedPackagingType}"`;
        else if (!rawTaxType) error = 'Selling Price Tax Type is required';
        else if (!taxType) error = `Invalid Selling Price Tax Type "${rawTaxType}"`;
        else if (!productTypeRaw) error = 'Product Type is required';
        else if (!type) error = `Invalid Product Type "${productTypeRaw}"`;
        else if (type === 'Combo') error = 'Combo import is not supported. Create Combo products from Add New Product.';
        else if (sku && existingSkus.has(sku.toLowerCase())) error = `SKU "${sku}" already exists`;
        else if (sku && fileSkus.has(sku.toLowerCase())) error = `SKU "${sku}" duplicated in import file`;
        else if (alertQuantityRaw && !Number.isFinite(toFiniteNumber(alertQuantityRaw))) error = `Invalid Alert quantity "${alertQuantityRaw}"`;
        else if (purchaseIncludingTaxRaw && !Number.isFinite(purchaseIncludingTax)) error = `Invalid Purchase Price (Including Tax) "${purchaseIncludingTaxRaw}"`;
        else if (purchaseExcludingTaxRaw && !Number.isFinite(purchaseExcludingTax)) error = `Invalid Purchase Price (Excluding Tax) "${purchaseExcludingTaxRaw}"`;
        else if (profitMarginRaw && !Number.isFinite(profitMargin)) error = `Invalid Profit Margin "${profitMarginRaw}"`;
        else if (sellingPriceRaw && !Number.isFinite(parsedSellingPrice)) error = `Invalid Selling Price "${sellingPriceRaw}"`;
        else if (openingStockRaw && !Number.isFinite(toFiniteNumber(openingStockRaw))) error = `Invalid Opening Stock "${openingStockRaw}"`;
        else if (expiresInRaw && !Number.isFinite(expiryPeriod)) error = `Invalid Expires in "${expiresInRaw}"`;
        else if (expiryPeriodUnitRaw && !expiryPeriodUnit) error = `Invalid Expiry Period Unit "${expiryPeriodUnitRaw}"`;
        else if (weight && !Number.isFinite(Number(weight))) error = `Invalid Weight "${weight}"`;
        else if (serviceStaffTimerRaw && !Number.isFinite(serviceStaffTimer)) error = `Invalid Service Staff Timer "${serviceStaffTimerRaw}"`;
        else if (alertQuantity < 0) error = 'Alert quantity cannot be negative';
        else if (type === 'Variable' && !variationName) error = 'Variable product requires Variation Name';
        else if (type === 'Variable' && variationValues.length === 0) error = 'Variable product requires Variation Values';
        else if (manageStock && openingStock < 0) error = 'Opening Stock cannot be negative';
        else if (unitPurchasePrice < 0) error = 'Purchase Price cannot be negative';
        else if (sellingPrice < 0) error = 'Selling Price cannot be negative';
        else if (typeof serviceStaffTimer === 'number' && serviceStaffTimer < 0) error = 'Service Staff Timer cannot be negative';

        const variationSkuSet = new Set<string>();
        if (!error && variationSkus.length > variationValues.length) {
          warning = appendWarning(warning, 'Variation SKUs count is greater than Variation Values; extra SKUs will be ignored.');
        }
        if (!error) {
          for (const variationSku of variationSkus) {
            const normalizedSku = variationSku.toLowerCase();
            if (variationSkuSet.has(normalizedSku)) {
              error = `Variation SKU "${variationSku}" duplicated in this row`;
              break;
            }
            variationSkuSet.add(normalizedSku);
            if (existingSkus.has(normalizedSku) || fileSkus.has(normalizedSku)) {
              error = `Variation SKU "${variationSku}" already exists`;
              break;
            }
          }
        }

        if (!error && sku) fileSkus.add(sku.toLowerCase());
        if (!error) variationSkus.forEach(vs => { if (vs) fileSkus.add(vs.toLowerCase()); });
        if (!error && rawBrand && !brandLookup.has(rawBrand.toLowerCase())) {
          warning = appendWarning(warning, `Brand "${brand}" not in Brand master (will be auto-created)`);
        }
        if (!error && hasUnknownPackagingType) {
          warning = appendWarning(
            warning,
            `Unknown Packaging Type "${rawPackagingType}". Defaulted to "Piece".`,
          );
        }
        if (!error && rawWarranty && !warrantyLookup.has(rawWarranty.toLowerCase())) {
          warning = appendWarning(warning, `Warranty "${rawWarranty}" not found in Warranty master (ignored)`);
        }
        if (!error && category && !categoryLookup.has(category.toLowerCase())) {
          warning = appendWarning(warning, `Category "${category}" not in Category master (will be auto-created)`);
        }
        if (!error && productLocationTokens.length > locationNames.length) {
          const unknownLocations = productLocationTokens.filter(loc => !locationNameLookup.has(loc.toLowerCase()));
          if (unknownLocations.length > 0) {
            warning = appendWarning(warning, `Unknown location(s): ${unknownLocations.join(', ')} (ignored)`);
          }
        }
        if (!error && openingStockLocationInput && !locationNameLookup.has(openingStockLocationInput.toLowerCase())) {
          warning = appendWarning(warning, `Opening Stock Location "${openingStockLocationInput}" not found. Using "${location}".`);
        }
        if (!error && expiryPeriodUnit && !expiryPeriod) {
          warning = appendWarning(warning, 'Expiry Period Unit provided without Expires in value (ignored).');
        }
        if (!error && expiryPeriod && !expiryPeriodUnit) {
          warning = appendWarning(warning, 'Expires in provided without unit; defaulting unit to Days.');
        }

        rows.push({
          rowNum: i,
          name,
          brandId,
          brand,
          warranty,
          unit,
          packagingType: normalizedPackagingType === 'Piece' ? undefined : normalizedPackagingType,
          unitsPerPackage,
          categoryId,
          category,
          subCategory,
          sku,
          barcodeType,
          alertQuantity,
          type: (type || 'Single'),
          tax: taxName,
          taxType,
          unitPurchasePrice,
          sellingPrice,
          stock,
          location,
          locationNames: locationNames.length > 0 ? locationNames : [location],
          openingStockLocation,
          manageStock,
          enableSerialNumber,
          variationName,
          variationValues,
          variationSkus,
          expiryPeriod,
          expiryPeriodUnit: expiryPeriodUnit || (expiryPeriod ? 'Days' : undefined),
          weight,
          serviceStaffTimer,
          rack,
          shelfRow,
          position,
          imageName,
          expiryDate,
          description,
          notForSelling,
          error,
          warning,
        });
      }
      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = async () => {
    try {
    const validRows = parsedRows.filter(r => !r.error);
    let imported = 0;
    const knownCategoriesByName = new Map<string, ProductCategory>(
      productCategories.map(category => [category.name.trim().toLowerCase(), { ...category }])
    );
    const knownBrandsByName = new Map<string, { id: string; name: string }>(
      productBrands.map(brand => [brand.name.trim().toLowerCase(), { id: brand.id, name: brand.name }])
    );
    const locationIdByName = new Map<string, string>(
      locations.map(l => [normalizeText(l.name).toLowerCase(), l.id] as [string, string])
    );
    const knownVariations = new Map<string, ProductVariation>(
      productVariations.map(v => [normalizeText(v.name).toLowerCase(), { ...v }])
    );
    const usedSkus = new Set<string>();
    products.forEach((product) => {
      if (product.sku?.trim()) usedSkus.add(product.sku.trim().toLowerCase());
      (product.variationRows || []).forEach((variationRow) => {
        if (variationRow.sku?.trim()) usedSkus.add(variationRow.sku.trim().toLowerCase());
      });
    });

    const reserveSku = (raw: string, fallbackPrefix: string): string => {
      let candidate = normalizeText(raw) || generateId(fallbackPrefix);
      const base = candidate;
      let counter = 1;
      while (usedSkus.has(candidate.toLowerCase())) {
        candidate = `${base}-${counter}`;
        counter += 1;
      }
      usedSkus.add(candidate.toLowerCase());
      return candidate;
    };

    const ensureVariation = async (rawName: string, rawValues: string[]) => {
      const name = normalizeText(rawName) || 'Imported Variation';
      const key = name.toLowerCase();
      const cleanedValues = rawValues.map(normalizeText).filter(Boolean);
      let variation = knownVariations.get(key);

      if (!variation) {
        const uniqueValues = Array.from(new Set(cleanedValues.map(v => v.toLowerCase())))
          .map(lower => cleanedValues.find(v => v.toLowerCase() === lower) || lower);
        const created: ProductVariation = {
          id: generateId('VAR'),
          name,
          values: uniqueValues.length > 0 ? uniqueValues : ['Default'],
        };
        const createResult = await addProductVariation(created);
        if (!createResult.ok) {
          throw new Error(createResult.error || `Unable to create variation "${name}".`);
        }
        knownVariations.set(key, created);
        return created;
      }

      const existingValueKeys = new Set(variation.values.map(v => normalizeText(v).toLowerCase()));
      const mergedValues = [...variation.values];
      cleanedValues.forEach((value) => {
        const valueKey = value.toLowerCase();
        if (!existingValueKeys.has(valueKey)) {
          existingValueKeys.add(valueKey);
          mergedValues.push(value);
        }
      });
      if (mergedValues.length !== variation.values.length) {
        const updated = { ...variation, values: mergedValues };
        const updateResult = await updateProductVariation(updated);
        if (!updateResult.ok) {
          throw new Error(updateResult.error || `Unable to update variation "${name}".`);
        }
        knownVariations.set(key, updated);
        variation = updated;
      }
      return variation;
    };

    for (const row of validRows) {
      const resolvedProductSku = reserveSku(row.sku, 'SKU');
      const rowCategoryKey = row.category.trim().toLowerCase();
      if (row.category && !knownCategoriesByName.has(rowCategoryKey)) {
        const createdCategory: ProductCategory = {
          id: generateId('CAT'),
          name: row.category.trim(),
          code: '',
          description: 'Auto-created from product import',
        };
        const categoryResult = await addProductCategory(createdCategory);
        if (!categoryResult.ok) {
          throw new Error(categoryResult.error || `Unable to create category "${createdCategory.name}".`);
        }
        knownCategoriesByName.set(rowCategoryKey, createdCategory);
      }
      const resolvedCategory = row.category
        ? knownCategoriesByName.get(rowCategoryKey)
        : undefined;

      const rowBrandKey = row.brand.trim().toLowerCase();
      let resolvedBrand = row.brand
        ? knownBrandsByName.get(rowBrandKey)
        : undefined;
      if (row.brand && !resolvedBrand) {
        const createdBrand = {
          id: generateId('BRD'),
          name: row.brand.trim(),
          note: 'Auto-created from product import',
        };
        const brandResult = await addProductBrand(createdBrand);
        if (!brandResult.ok) {
          throw new Error(brandResult.error || `Unable to create brand "${createdBrand.name}".`);
        }
        resolvedBrand = { id: createdBrand.id, name: createdBrand.name };
        knownBrandsByName.set(rowBrandKey, resolvedBrand);
      }

      const margin = row.unitPurchasePrice > 0
        ? parseFloat((((row.sellingPrice - row.unitPurchasePrice) / row.unitPurchasePrice) * 100).toFixed(2))
        : 0;
      let variationRows: Product['variationRows'] = undefined;
      if (row.type === 'Variable' && row.variationValues.length > 0) {
        const cleanedVariationValues = row.variationValues.map(normalizeText).filter(Boolean);
        const variation = await ensureVariation(row.variationName, cleanedVariationValues);
        variationRows = cleanedVariationValues.map((value, idx) => ({
          id: generateId('VR'),
          variationId: variation.id,
          values: value,
          sku: reserveSku(row.variationSkus[idx] || `${resolvedProductSku}-${idx + 1}`, `${resolvedProductSku}-${idx + 1}`),
          purchasePrice: row.unitPurchasePrice,
          margin,
          sellingPrice: row.sellingPrice,
        }));
      }

      const locationRackDetails: Record<string, { rack: string; row: string; position: string }> = row.locationNames.reduce((acc: Record<string, { rack: string; row: string; position: string }>, locationName, idx) => {
        const locationId = locationIdByName.get(normalizeText(locationName).toLowerCase());
        if (!locationId) return acc;
        acc[locationId] = {
          rack: idx === 0 ? row.rack : '',
          row: idx === 0 ? row.shelfRow : '',
          position: idx === 0 ? row.position : '',
        };
        return acc;
      }, {});

      const product: Product = {
        id: generateId('PRD'),
        name: row.name,
        sku: resolvedProductSku,
        type: row.type,
        categoryId: resolvedCategory?.id || row.categoryId || '',
        category: resolvedCategory?.name || row.category || 'Uncategorized',
        subCategory: row.subCategory || undefined,
        brandId: resolvedBrand?.id || row.brandId || '',
        brand: resolvedBrand?.name || row.brand || '--',
        warranty: row.warranty || undefined,
        tax: row.tax,
        taxType: row.taxType,
        businessLocation: row.location || defaultLocation,
        unitPurchasePrice: row.unitPurchasePrice,
        sellingPrice: row.sellingPrice,
        stock: row.stock,
        openingStock: row.stock,
        openingStockLocation: row.openingStockLocation || row.location || defaultLocation,
        unit: row.unit,
        packagingType: row.packagingType,
        unitsPerPackage: row.unitsPerPackage,
        image: row.imageName || '',
        alertQuantity: row.alertQuantity || undefined,
        barcodeType: row.barcodeType || undefined,
        expiryDate: row.expiryDate || undefined,
        expiryPeriod: row.expiryPeriod,
        expiryPeriodUnit: row.expiryPeriodUnit,
        enableSerialNumber: row.enableSerialNumber || undefined,
        weight: row.weight ? parseFloat(row.weight) : undefined,
        serviceStaffTimer: row.serviceStaffTimer,
        rack: row.rack || undefined,
        row: row.shelfRow || undefined,
        position: row.position || undefined,
        locationRackDetails: Object.keys(locationRackDetails).length > 0 ? locationRackDetails : undefined,
        description: row.description || undefined,
        variationRows,
        notForSelling: row.notForSelling || undefined,
      };
      const productResult = await addProduct(product);
      if (!productResult.ok) {
        throw new Error(productResult.error || `Unable to import product "${product.name}".`);
      }
      imported += 1;
    }
    setImportResults({ imported, skipped: parsedRows.length - validRows.length });
    setStep('done');
    addNotification({ type: 'success', title: 'Import Complete', message: `${imported} product(s) imported successfully.` });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Import Failed',
        message: error instanceof Error ? error.message : 'Product import failed while saving to Postgres.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep('upload');
    setParsedRows([]);
    setImportResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount = parsedRows.filter(r => !r.error).length;
  const errorCount = parsedRows.filter(r => !!r.error).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Products</h2>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500"></div>

        {step !== 'done' && (
          <>
            <div className="flex flex-col md:flex-row gap-6 mb-8 items-start border-b border-slate-100 pb-8">
              <div className="w-full md:w-1/2 space-y-3">
                <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">File To Import:</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="px-6 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-2">
                      <Upload size={16} /> Choose File
                    </span>
                    <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                  </label>
                  <span className="text-sm text-slate-500 italic">{selectedFile ? selectedFile.name : 'No file chosen'}</span>
                </div>
                {selectedFile && <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold"><CheckCircle2 size={14} /> Ready to parse</div>}
              </div>

              <div className="w-full md:w-1/2 flex justify-end items-end h-full gap-3 pt-6">
                {step === 'upload' && (
                  <button
                    onClick={handleParseFile}
                    disabled={!selectedFile}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Parse & Preview
                  </button>
                )}
                {step === 'preview' && (
                  <>
                    <button onClick={handleReset} className="px-6 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                      Reset
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={validCount === 0}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Confirm Import ({validCount} rows)
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-10">
              <button onClick={handleDownloadTemplate} className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95">
                <Download size={16} /> Download template file
              </button>
            </div>
          </>
        )}

        {step === 'done' && importResults && (
          <div className="text-center py-16">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} />
            <h3 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h3>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600">{importResults.imported}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Imported</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-rose-500">{importResults.skipped}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Skipped</div>
              </div>
            </div>
            <button onClick={handleReset} className="mt-10 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
              Import More Products
            </button>
          </div>
        )}

        {step === 'preview' && parsedRows.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-base font-bold text-slate-800">Preview ({parsedRows.length} rows)</h3>
              {validCount > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{validCount} valid</span>}
              {errorCount > 0 && <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">{errorCount} errors</span>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 w-8">#</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Product Name</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Unit</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Purchase Price</th>
                    <th className="px-3 py-3">Selling Price</th>
                    <th className="px-3 py-3">Opening Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map(row => (
                    <tr key={row.rowNum} className={row.error ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-400">{row.rowNum}</td>
                      <td className="px-3 py-2">
                        {row.error
                          ? <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertCircle size={12} />{row.error}</span>
                          : row.warning
                          ? <span className="flex items-center gap-1 text-amber-600 font-bold"><AlertCircle size={12} />{row.warning}</span>
                          : <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={12} />Ready</span>}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800">{row.name || '--'}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono">{row.sku || 'auto'}</td>
                      <td className="px-3 py-2">{row.unit || '--'}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.unitPurchasePrice.toFixed(3)}</td>
                      <td className="px-3 py-2">{row.sellingPrice.toFixed(3)}</td>
                      <td className="px-3 py-2">{row.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="border rounded-xl overflow-hidden border-slate-200">
            <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Instructions</h3>
              <p className="text-sm text-slate-500 mt-1">Follow the instructions carefully. Columns must be in the following order.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white text-xs uppercase text-slate-500 font-extrabold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 w-32">Col #</th>
                    <th className="px-6 py-4 w-64">Column Name</th>
                    <th className="px-6 py-4">Instruction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {columns.map((col, idx) => (
                    <tr key={col.key} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono font-medium">{idx + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {col.name}
                        {col.required === true && <span className="text-[10px] text-red-500 font-bold ml-1 italic">(Required)</span>}
                        {col.required === false && <span className="text-[10px] text-slate-400 font-normal ml-1 italic">(Optional)</span>}
                        {col.required === 'conditional' && <span className="text-[10px] text-amber-500 font-bold ml-1 italic">(Conditional)</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed text-xs font-medium">{col.instruction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportProducts;
