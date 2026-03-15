import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Search, Printer, Settings, Info, X,
  ChevronDown
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import type { Product, SellingPriceGroup } from '../src/context/GlobalContext';

type BarcodeSettingKey = string;

type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'UPCE' | 'ITF14';
type PriceType = 'Inc. tax' | 'Exc. tax';

interface PrintLabelsProps {
  initialProductId?: string;
}

interface LabelProduct {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  count: number;
  lotNumber: string;
  expDate: string;
  packingDate: string;
  priceGroupId: string;
}

interface BarcodePayload {
  format: BarcodeFormat;
  value: string;
  displayText: string;
}

interface PreparedLabel {
  key: string;
  name: string;
  sku: string;
  lotNumber: string;
  expDate: string;
  packingDate: string;
  displayPrice: number;
  priceType: PriceType;
  barcode: BarcodePayload;
}

interface TemplateSetting {
  value: string;
  label: string;
  sheetWidth: number;
  sheetHeight: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  rows: number;
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
}

interface ResolvedTemplate {
  key: BarcodeSettingKey;
  labelWidth: number;
  labelHeight: number;
  pageWidth: number;
  pageHeight: number;
  columns: number;
  rows: number;
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
  continuous: boolean;
}

const TEMPLATE_SETTINGS: TemplateSetting[] = [
  {
    value: '20-per-sheet',
    label: '20 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 4" x 1"',
    sheetWidth: 8.5,
    sheetHeight: 11,
    labelWidth: 4,
    labelHeight: 1,
    columns: 2,
    rows: 10,
    marginX: 0.25,
    marginY: 0.5,
    gapX: 0,
    gapY: 0,
  },
  {
    value: '30-per-sheet',
    label: '30 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2.625" x 1"',
    sheetWidth: 8.5,
    sheetHeight: 11,
    labelWidth: 2.625,
    labelHeight: 1,
    columns: 3,
    rows: 10,
    marginX: 0.3125,
    marginY: 0.5,
    gapX: 0,
    gapY: 0,
  },
  {
    value: '32-per-sheet',
    label: '32 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2" x 1.25"',
    sheetWidth: 8.5,
    sheetHeight: 11,
    labelWidth: 2,
    labelHeight: 1.25,
    columns: 4,
    rows: 8,
    marginX: 0.25,
    marginY: 0.5,
    gapX: 0,
    gapY: 0,
  },
  {
    value: '40-per-sheet',
    label: '40 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2" x 1"',
    sheetWidth: 8.5,
    sheetHeight: 11,
    labelWidth: 2,
    labelHeight: 1,
    columns: 4,
    rows: 10,
    marginX: 0.25,
    marginY: 0.5,
    gapX: 0,
    gapY: 0,
  },
  {
    value: '50-per-sheet',
    label: '50 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 1.5" x 1"',
    sheetWidth: 8.5,
    sheetHeight: 11,
    labelWidth: 1.5,
    labelHeight: 1,
    columns: 5,
    rows: 10,
    marginX: 0.5,
    marginY: 0.5,
    gapX: 0,
    gapY: 0,
  },
];

const BARCODE_SETTINGS = [
  ...TEMPLATE_SETTINGS.map(t => ({ value: t.value, label: t.label })),
  { value: 'continuous' as const, label: 'Continuous Rolls' },
];

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
const normalizeSku = (value: unknown) => normalizeText(value);
const clampNumber = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const splitIntoPages = <T,>(rows: T[], size: number): T[][] => {
  if (size <= 0) return [rows];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
};

const mapBarcodeTypeToFormat = (barcodeType?: string): BarcodeFormat => {
  const normalized = normalizeText(barcodeType);
  if (normalized.includes('code 39') || normalized.includes('c39')) return 'CODE39';
  if (normalized.includes('ean-8') || normalized.includes('ean8')) return 'EAN8';
  if (normalized.includes('ean-13') || normalized.includes('ean13')) return 'EAN13';
  if (normalized.includes('upc-e') || normalized.includes('upce')) return 'UPCE';
  if (normalized.includes('itf-14') || normalized.includes('itf14')) return 'ITF14';
  if (normalized.includes('upc-a') || normalized.includes('upca')) return 'UPC';
  return 'CODE128';
};

const resolveBarcodePayload = (rawValue: string, barcodeType?: string): BarcodePayload => {
  const format = mapBarcodeTypeToFormat(barcodeType);
  const source = String(rawValue || '').trim();
  const safeDefault = source || '000000';

  if (format === 'EAN13') {
    const digits = source.replace(/\D/g, '');
    if (digits.length === 12 || digits.length === 13) {
      return { format: 'EAN13', value: digits.slice(0, 13), displayText: digits.slice(0, 13) };
    }
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  if (format === 'UPC') {
    const digits = source.replace(/\D/g, '');
    if (digits.length === 11 || digits.length === 12) {
      return { format: 'UPC', value: digits.slice(0, 12), displayText: digits.slice(0, 12) };
    }
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  if (format === 'EAN8') {
    const digits = source.replace(/\D/g, '');
    if (digits.length === 7 || digits.length === 8) {
      return { format: 'EAN8', value: digits.slice(0, 8), displayText: digits.slice(0, 8) };
    }
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  if (format === 'UPCE') {
    const digits = source.replace(/\D/g, '');
    if (digits.length >= 6 && digits.length <= 8) {
      return { format: 'UPCE', value: digits.slice(0, 8), displayText: digits.slice(0, 8) };
    }
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  if (format === 'ITF14') {
    const digits = source.replace(/\D/g, '');
    if (digits.length === 13 || digits.length === 14) {
      return { format: 'ITF14', value: digits.slice(0, 14), displayText: digits.slice(0, 14) };
    }
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  if (format === 'CODE39') {
    const code39 = source.toUpperCase().replace(/[^0-9A-Z\-.\$\/+% ]/g, '');
    if (code39) return { format: 'CODE39', value: code39, displayText: code39 };
    return { format: 'CODE128', value: safeDefault, displayText: safeDefault };
  }

  const normalized = safeDefault.replace(/\s+/g, ' ');
  return { format: 'CODE128', value: normalized, displayText: normalized };
};

const createBarcodeSvgMarkup = (payload: BarcodePayload): string => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, payload.value, {
      format: payload.format,
      displayValue: false,
      margin: 0,
      height: 28,
      width: 1.2,
    });
    return svg.outerHTML;
  } catch {
    return `<div style="font-size:10px;font-weight:bold;text-align:center;">${escapeHtml(payload.displayText)}</div>`;
  }
};

const createBarcodeImage = (payload: BarcodePayload, heightPx = 42): string | null => {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, payload.value, {
      format: payload.format,
      displayValue: false,
      margin: 0,
      height: heightPx,
      width: 2,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

const PrintLabels: React.FC<PrintLabelsProps> = ({ initialProductId }) => {
  const {
    products,
    sellingPriceGroups,
    barcodeSettings,
    settings,
    taxRates,
    formatCurrency,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const businessName = settings?.businessName || 'ATWAR AL MUSTAQBAL';

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<LabelProduct[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState({
    showProductName: true, productNameSize: 15,
    showVariation: true, variationSize: 17,
    showPrice: true, priceSize: 17,
    showBusinessName: true, businessNameSize: 20,
    showPackingDate: false, packingDateSize: 12,
    showLotNumber: false, lotNumberSize: 12,
    showExpDate: false, expDateSize: 12,
    priceType: 'Inc. tax' as PriceType,
  });

  const [barcodeSetting, setBarcodeSetting] = useState<BarcodeSettingKey>('');
  const [continuousWidth, setContinuousWidth] = useState('3');
  const [continuousHeight, setContinuousHeight] = useState('1.5');
  const selectedBarcodeSettingRecord = useMemo(
    () => barcodeSettings.find(setting => setting.id === barcodeSetting),
    [barcodeSettings, barcodeSetting],
  );
  const barcodeSettingOptions = useMemo(() => {
    if (barcodeSettings.length === 0) {
      return BARCODE_SETTINGS.map((setting) => ({
        value: setting.value,
        label: setting.label,
      }));
    }
    return barcodeSettings.map((setting) => {
      const detail = setting.isContinuousFeed
        ? `Continuous ${setting.stickerWidth}" x ${setting.stickerHeight}"`
        : `${setting.stickersInOneSheet} labels, ${setting.paperWidth}" x ${setting.paperHeight}"`;
      return {
        value: setting.id,
        label: `${setting.name} (${detail})`,
      };
    });
  }, [barcodeSettings]);
  const isContinuousSelected = selectedBarcodeSettingRecord
    ? selectedBarcodeSettingRecord.isContinuousFeed
    : barcodeSetting === 'continuous';

  useEffect(() => {
    if (barcodeSettingOptions.length === 0) {
      if (barcodeSetting) setBarcodeSetting('');
      return;
    }
    const currentExists = barcodeSettingOptions.some(option => option.value === barcodeSetting);
    if (currentExists) return;
    const defaultId = barcodeSettings.find(setting => setting.isDefault)?.id || barcodeSettingOptions[0].value;
    setBarcodeSetting(defaultId);
  }, [barcodeSettingOptions, barcodeSettings, barcodeSetting]);

  useEffect(() => {
    if (!selectedBarcodeSettingRecord || !selectedBarcodeSettingRecord.isContinuousFeed) return;
    setContinuousWidth(String(selectedBarcodeSettingRecord.stickerWidth || 3));
    setContinuousHeight(String(selectedBarcodeSettingRecord.stickerHeight || 1.5));
  }, [selectedBarcodeSettingRecord]);

  useEffect(() => {
    if (searchTerm.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const term = searchTerm.toLowerCase();
    const results = products.filter(p =>
      p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
    ).slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchTerm, products]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!initialProductId) return;
    const normalizedId = decodeURIComponent(initialProductId).trim();
    if (!normalizedId) return;
    const product = products.find(p => p.id === normalizedId || p.sku === normalizedId);
    if (!product) return;

    setSelectedProducts(prev => {
      if (prev.some(x => x.productId === product.id)) return prev;
      return [
        ...prev,
        {
          id: generateId('LBL'),
          productId: product.id,
          name: product.name,
          sku: product.sku,
          price: product.sellingPrice,
          count: 1,
          lotNumber: '',
          expDate: '',
          packingDate: '',
          priceGroupId: '',
        },
      ];
    });
  }, [initialProductId, products, generateId]);

  const addProductToList = (product: Product) => {
    const existing = selectedProducts.find(p => p.productId === product.id);
    if (existing) {
      setSelectedProducts(prev => prev.map(p => p.productId === product.id ? { ...p, count: p.count + 1 } : p));
    } else {
      setSelectedProducts(prev => [...prev, {
        id: generateId('LBL'),
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        count: 1,
        lotNumber: '',
        expDate: '',
        packingDate: '',
        priceGroupId: '',
      }]);
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeProduct = (id: string) => setSelectedProducts(prev => prev.filter(p => p.id !== id));

  const updateItem = (id: string, field: keyof LabelProduct, value: string | number) => {
    setSelectedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateConfig = (field: string, value: boolean | number | string) => setConfig(prev => ({ ...prev, [field]: value }));

  const getTaxRateForProduct = (product: Product | undefined, selectedGroup?: SellingPriceGroup): number => {
    if (selectedGroup && Number.isFinite(Number(selectedGroup.taxRate))) {
      return Math.max(0, Number(selectedGroup.taxRate));
    }

    const taxValue = String(product?.tax || '').trim();
    if (!taxValue || taxValue === '--' || /^none$/i.test(taxValue)) return 0;

    const directMatch = taxValue.match(/(\d+(\.\d+)?)/);
    if (directMatch) return Number.parseFloat(directMatch[1]);

    const taxByName = taxRates.find(t => normalizeText(t.name) === normalizeText(taxValue));
    return taxByName ? Math.max(0, Number(taxByName.rate || 0)) : 0;
  };

  const computeGroupedPrice = (
    basePrice: number,
    productId: string,
    productSku: string,
    selectedGroup?: SellingPriceGroup
  ): number => {
    if (!selectedGroup) return Math.max(0, basePrice);
    const adjustedBase = basePrice * (1 + (Number(selectedGroup.priceCalcPercentage || 0) / 100));
    const applicable = selectedGroup.applicableProducts || [];

    if (applicable.length === 0) {
      return Math.max(0, adjustedBase * (1 - (Number(selectedGroup.discount || 0) / 100)));
    }

    const productRule = applicable.find(p =>
      p.id === productId || (p.sku && normalizeSku(p.sku) === normalizeSku(productSku))
    );

    if (!productRule) return Math.max(0, basePrice);

    const productDiscount = Number.isFinite(Number(productRule.discount))
      ? Number(productRule.discount)
      : Number(selectedGroup.discount || 0);

    return Math.max(0, adjustedBase * (1 - (productDiscount / 100)));
  };

  const preparedLabels = useMemo<PreparedLabel[]>(() => {
    const rows: PreparedLabel[] = [];
    selectedProducts.forEach((item) => {
      const product = products.find(p => p.id === item.productId);
      const activeGroup = sellingPriceGroups.find(g => g.id === item.priceGroupId && g.status === 'Active');
      const basePrice = Number.isFinite(Number(product?.sellingPrice))
        ? Number(product?.sellingPrice)
        : Number(item.price || 0);
      const groupAdjustedPrice = computeGroupedPrice(basePrice, item.productId, item.sku, activeGroup);
      const taxRate = config.priceType === 'Inc. tax' ? getTaxRateForProduct(product, activeGroup) : 0;
      const finalDisplayPrice = Number((groupAdjustedPrice * (1 + taxRate / 100)).toFixed(3));
      const count = Math.max(1, Math.floor(Number(item.count) || 1));
      const barcode = resolveBarcodePayload(item.sku || product?.sku || '', product?.barcodeType);

      for (let i = 0; i < count; i += 1) {
        rows.push({
          key: `${item.id}-${i + 1}`,
          name: item.name,
          sku: item.sku,
          lotNumber: item.lotNumber,
          expDate: item.expDate,
          packingDate: item.packingDate,
          displayPrice: finalDisplayPrice,
          priceType: config.priceType,
          barcode,
        });
      }
    });
    return rows;
  }, [selectedProducts, products, sellingPriceGroups, config.priceType, taxRates]);

  const resolveTemplate = (): ResolvedTemplate | null => {
    if (selectedBarcodeSettingRecord) {
      if (selectedBarcodeSettingRecord.isContinuousFeed) {
        const width = Number.parseFloat(String(selectedBarcodeSettingRecord.stickerWidth || continuousWidth));
        const height = Number.parseFloat(String(selectedBarcodeSettingRecord.stickerHeight || continuousHeight));
        const pageWidth = Number.parseFloat(String(selectedBarcodeSettingRecord.paperWidth || width));
        const pageHeight = Number.parseFloat(String(selectedBarcodeSettingRecord.paperHeight || height));
        if (
          !Number.isFinite(width) || width <= 0
          || !Number.isFinite(height) || height <= 0
          || !Number.isFinite(pageWidth) || pageWidth <= 0
          || !Number.isFinite(pageHeight) || pageHeight <= 0
        ) {
          addNotification({
            type: 'error',
            title: 'Invalid Size',
            message: 'Enter a valid continuous-roll width and height before printing or exporting.',
          });
          return null;
        }
        return {
          key: selectedBarcodeSettingRecord.id,
          labelWidth: width,
          labelHeight: height,
          pageWidth,
          pageHeight,
          columns: 1,
          rows: 1,
          marginX: Math.max(0, Number(selectedBarcodeSettingRecord.additionalLeftMargin || 0)),
          marginY: Math.max(0, Number(selectedBarcodeSettingRecord.additionalTopMargin || 0)),
          gapX: 0,
          gapY: 0,
          continuous: true,
        };
      }

      const columns = Math.max(1, Math.floor(Number(selectedBarcodeSettingRecord.stickersInOneRow || 1)));
      const stickersPerSheet = Math.max(
        1,
        Math.floor(Number(selectedBarcodeSettingRecord.stickersInOneSheet || columns)),
      );
      const rows = Math.max(1, Math.ceil(stickersPerSheet / columns));
      return {
        key: selectedBarcodeSettingRecord.id,
        labelWidth: Number(selectedBarcodeSettingRecord.stickerWidth),
        labelHeight: Number(selectedBarcodeSettingRecord.stickerHeight),
        pageWidth: Number(selectedBarcodeSettingRecord.paperWidth),
        pageHeight: Number(selectedBarcodeSettingRecord.paperHeight),
        columns,
        rows,
        marginX: Number(selectedBarcodeSettingRecord.additionalLeftMargin || 0),
        marginY: Number(selectedBarcodeSettingRecord.additionalTopMargin || 0),
        gapX: Number(selectedBarcodeSettingRecord.distanceBetweenColumns || 0),
        gapY: Number(selectedBarcodeSettingRecord.distanceBetweenRows || 0),
        continuous: false,
      };
    }

    if (barcodeSetting === 'continuous') {
      const width = Number.parseFloat(continuousWidth);
      const height = Number.parseFloat(continuousHeight);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        addNotification({
          type: 'error',
          title: 'Invalid Size',
          message: 'Enter a valid continuous-roll width and height before printing or exporting.',
        });
        return null;
      }
      return {
        key: 'continuous',
        labelWidth: width,
        labelHeight: height,
        pageWidth: width,
        pageHeight: height,
        columns: 1,
        rows: 1,
        marginX: 0,
        marginY: 0,
        gapX: 0,
        gapY: 0,
        continuous: true,
      };
    }

    const selected = TEMPLATE_SETTINGS.find(t => t.value === barcodeSetting) || TEMPLATE_SETTINGS[0];
    return {
      key: selected.value,
      labelWidth: selected.labelWidth,
      labelHeight: selected.labelHeight,
      pageWidth: selected.sheetWidth,
      pageHeight: selected.sheetHeight,
      columns: selected.columns,
      rows: selected.rows,
      marginX: selected.marginX,
      marginY: selected.marginY,
      gapX: selected.gapX,
      gapY: selected.gapY,
      continuous: false,
    };
  };

  const renderLabelHtml = (label: PreparedLabel) => {
    const businessNameSize = clampNumber(Number(config.businessNameSize), 8, 42, 20);
    const productNameSize = clampNumber(Number(config.productNameSize), 8, 36, 15);
    const skuSize = clampNumber(Number(config.variationSize) - 4, 8, 30, 13);
    const lotSize = clampNumber(Number(config.lotNumberSize), 8, 24, 12);
    const packSize = clampNumber(Number(config.packingDateSize), 8, 24, 12);
    const expSize = clampNumber(Number(config.expDateSize), 8, 24, 12);
    const priceSize = clampNumber(Number(config.priceSize), 8, 32, 17);
    const barcodeSvg = createBarcodeSvgMarkup(label.barcode);

    return `
      <div class="label">
        ${config.showBusinessName ? `<div style="font-size:${businessNameSize}px;font-weight:700;margin-bottom:2px;">${escapeHtml(businessName)}</div>` : ''}
        ${config.showProductName ? `<div style="font-size:${productNameSize}px;font-weight:600;margin-bottom:2px;">${escapeHtml(label.name)}</div>` : ''}
        ${config.showVariation ? `<div style="font-size:${skuSize}px;color:#444;">SKU: ${escapeHtml(label.sku)}</div>` : ''}
        ${config.showLotNumber && label.lotNumber ? `<div style="font-size:${lotSize}px;">Lot: ${escapeHtml(label.lotNumber)}</div>` : ''}
        ${config.showPackingDate && label.packingDate ? `<div style="font-size:${packSize}px;">Pack: ${escapeHtml(label.packingDate)}</div>` : ''}
        ${config.showExpDate && label.expDate ? `<div style="font-size:${expSize}px;">Exp: ${escapeHtml(label.expDate)}</div>` : ''}
        ${config.showPrice ? `<div style="font-size:${priceSize}px;font-weight:700;margin-top:4px;">${escapeHtml(formatCurrency(label.displayPrice))} ${escapeHtml(label.priceType)}</div>` : ''}
        <div style="margin-top:4px;text-align:center;">${barcodeSvg}</div>
        <div style="font-size:9px;text-align:center;letter-spacing:1px;">${escapeHtml(label.barcode.displayText)}</div>
      </div>
    `;
  };

  const buildPrintDocument = (labels: PreparedLabel[], template: ResolvedTemplate): string => {
    const labelsPerPage = template.continuous ? 1 : template.columns * template.rows;
    const pages = splitIntoPages(labels, labelsPerPage);

    const pageHtml = pages.map(page => `
      <section class="page">
        <div class="label-grid">
          ${page.map(renderLabelHtml).join('')}
        </div>
      </section>
    `).join('');

    const pageCss = template.continuous
      ? `
        @page { size: ${template.pageWidth}in ${template.pageHeight}in; margin: 0; }
        html, body { margin: 0; padding: 0; width: ${template.pageWidth}in; height: ${template.pageHeight}in; font-family: Arial, sans-serif; }
        @media print {
          html, body { width: ${template.pageWidth}in; height: ${template.pageHeight}in; }
        }
        .page { width: ${template.pageWidth}in; height: ${template.pageHeight}in; box-sizing: border-box; page-break-after: always; break-after: page; overflow: hidden; }
        .page:last-child { page-break-after: auto; }
        .label-grid { box-sizing: border-box; width: ${template.pageWidth}in; height: ${template.pageHeight}in; padding: ${template.marginY}in ${template.marginX}in; display: flex; align-items: flex-start; justify-content: flex-start; }
        .label { box-sizing: border-box; width: ${template.labelWidth}in; height: ${template.labelHeight}in; border: 1px solid #cbd5e1; padding: 6px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
      `
      : `
        @page { size: ${template.pageWidth}in ${template.pageHeight}in; margin: 0; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .page { width: ${template.pageWidth}in; height: ${template.pageHeight}in; box-sizing: border-box; page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .label-grid {
          box-sizing: border-box;
          width: ${template.pageWidth}in;
          height: ${template.pageHeight}in;
          padding: ${template.marginY}in ${template.marginX}in;
          display: grid;
          grid-template-columns: repeat(${template.columns}, ${template.labelWidth}in);
          grid-auto-rows: ${template.labelHeight}in;
          column-gap: ${template.gapX}in;
          row-gap: ${template.gapY}in;
          align-content: start;
        }
        .label {
          box-sizing: border-box;
          width: ${template.labelWidth}in;
          height: ${template.labelHeight}in;
          border: 1px solid #cbd5e1;
          padding: 6px;
          display: inline-flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          page-break-inside: avoid;
        }
      `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Labels</title>
          <style>
            ${pageCss}
            .label svg { width: 100%; height: 28px; }
          </style>
        </head>
        <body>
          ${pageHtml}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          <\/script>
        </body>
      </html>
    `;
  };

  const drawPdfLabel = (
    pdf: jsPDF,
    label: PreparedLabel,
    template: ResolvedTemplate,
    x: number,
    y: number
  ) => {
    const businessNameSize = clampNumber(Number(config.businessNameSize), 8, 42, 20);
    const productNameSize = clampNumber(Number(config.productNameSize), 8, 36, 15);
    const skuSize = clampNumber(Number(config.variationSize) - 4, 8, 30, 13);
    const lotSize = clampNumber(Number(config.lotNumberSize), 8, 24, 12);
    const packSize = clampNumber(Number(config.packingDateSize), 8, 24, 12);
    const expSize = clampNumber(Number(config.expDateSize), 8, 24, 12);
    const priceSize = clampNumber(Number(config.priceSize), 8, 32, 17);

    const pad = 0.06;
    const contentWidth = Math.max(0.2, template.labelWidth - (pad * 2));
    let cursorY = y + pad + 0.03;

    pdf.setDrawColor(190, 190, 190);
    pdf.setLineWidth(0.004);
    pdf.rect(x, y, template.labelWidth, template.labelHeight);

    const writeLine = (text: string, sizePx: number, bold = false) => {
      if (!text) return;
      const sizePt = clampNumber(sizePx * 0.75, 6, 18, 9);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(sizePt);
      const lines = pdf.splitTextToSize(text, contentWidth);
      pdf.text(lines, x + pad, cursorY, { baseline: 'top' });
      cursorY += lines.length * ((sizePt / 72) + 0.01);
    };

    if (config.showBusinessName) writeLine(businessName, businessNameSize, true);
    if (config.showProductName) writeLine(label.name, productNameSize, true);
    if (config.showVariation) writeLine(`SKU: ${label.sku}`, skuSize);
    if (config.showLotNumber && label.lotNumber) writeLine(`Lot: ${label.lotNumber}`, lotSize);
    if (config.showPackingDate && label.packingDate) writeLine(`Pack: ${label.packingDate}`, packSize);
    if (config.showExpDate && label.expDate) writeLine(`Exp: ${label.expDate}`, expSize);
    if (config.showPrice) writeLine(`${formatCurrency(label.displayPrice)} ${label.priceType}`, priceSize, true);

    const barcodeHeight = Math.max(0.12, Math.min(0.26, template.labelHeight * 0.25));
    const barcodeY = y + template.labelHeight - barcodeHeight - 0.08;
    if (barcodeY > cursorY + 0.01) {
      const barcodeImage = createBarcodeImage(label.barcode, Math.round(barcodeHeight * 160));
      if (barcodeImage) {
        pdf.addImage(barcodeImage, 'PNG', x + pad, barcodeY, contentWidth, barcodeHeight, undefined, 'FAST');
      }
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(label.barcode.displayText, x + (template.labelWidth / 2), y + template.labelHeight - 0.02, {
      align: 'center',
      baseline: 'bottom',
    });
  };

  const handlePrint = () => {
    if (preparedLabels.length === 0) {
      addNotification({ type: 'warning', title: 'No Products', message: 'Add at least one product before printing labels.' });
      return;
    }

    const substitutedNames: string[] = [];
    selectedProducts.forEach((item) => {
      const product = products.find(p => p.id === item.productId);
      const expectedFormat = mapBarcodeTypeToFormat(product?.barcodeType);
      const label = preparedLabels.find(l => l.key?.startsWith(`${item.id}-`));
      if (label && label.barcode.format !== expectedFormat) {
        substitutedNames.push(product?.name || item.sku || item.productId);
      }
    });
    if (substitutedNames.length > 0) {
      addNotification({
        type: 'warning',
        title: 'Barcode Type Adjusted',
        message: `CODE128 was used instead of the configured barcode type for: ${substitutedNames.join(', ')}. The SKU format did not match the required barcode digit count.`,
      });
    }

    const template = resolveTemplate();
    if (!template) return;

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      addNotification({ type: 'error', title: 'Popup Blocked', message: 'Allow popups to print labels.' });
      return;
    }

    printWindow.document.write(buildPrintDocument(preparedLabels, template));
    printWindow.document.close();
  };

  const handleExportPDF = () => {
    if (preparedLabels.length === 0) {
      addNotification({ type: 'warning', title: 'No Products', message: 'Add at least one product before exporting PDF.' });
      return;
    }

    const template = resolveTemplate();
    if (!template) return;

    const orientation = template.pageWidth > template.pageHeight ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: [template.pageWidth, template.pageHeight],
      compress: true,
    });

    const labelsPerPage = template.continuous ? 1 : template.columns * template.rows;

    preparedLabels.forEach((label, index) => {
      if (index > 0 && index % labelsPerPage === 0) {
        pdf.addPage([template.pageWidth, template.pageHeight], orientation);
      }

      const indexInPage = template.continuous ? 0 : index % labelsPerPage;
      const row = template.continuous ? 0 : Math.floor(indexInPage / template.columns);
      const col = template.continuous ? 0 : indexInPage % template.columns;
      const x = template.marginX + col * (template.labelWidth + template.gapX);
      const y = template.marginY + row * (template.labelHeight + template.gapY);
      drawPdfLabel(pdf, label, template, x, y);
    });

    const filename = `labels-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    addNotification({
      type: 'success',
      title: 'PDF Exported',
      message: `${preparedLabels.length} label(s) exported to ${filename}.`,
    });
  };

  const totalLabels = selectedProducts.reduce((sum, p) => sum + Math.max(1, Number(p.count) || 1), 0);

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1800px] mx-auto">
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          Print Labels <Info size={18} className="text-blue-500" />
        </h2>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
        <h3 className="text-sm font-semibold text-slate-600 mb-4">Add products to generate labels</h3>

        <div className="mb-6 relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={16} />
          <input
            type="text"
            placeholder="Search product by name or SKU..."
            className="w-full pl-10 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-slate-800 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          />
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onClick={() => addProductToList(p)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="font-bold text-sm text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-500">SKU: {p.sku} | {formatCurrency(p.sellingPrice)} | Stock: {p.stock}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-700 w-1/4">Products</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-32">No. of labels</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-48">Lot Number</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-48">EXP Date</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-48">Packing Date</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-48">Selling Price Group</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {selectedProducts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">
                    <div>{p.name}</div>
                    <div className="text-slate-400 font-mono text-[10px]">{p.sku}</div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs"
                      value={p.count}
                      onChange={(e) => updateItem(p.id, 'count', Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs"
                      value={p.lotNumber}
                      onChange={(e) => updateItem(p.id, 'lotNumber', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs text-slate-500"
                      value={p.expDate}
                      onChange={(e) => updateItem(p.id, 'expDate', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs text-slate-500"
                      value={p.packingDate}
                      onChange={(e) => updateItem(p.id, 'packingDate', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded focus:border-blue-500 outline-none text-xs cursor-pointer"
                      value={p.priceGroupId}
                      onChange={(e) => updateItem(p.id, 'priceGroupId', e.target.value)}
                    >
                      <option value="">None</option>
                      {sellingPriceGroups.filter(g => g.status === 'Active').map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {selectedProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic text-sm">
                    Search and add products above
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
        <h3 className="text-sm font-semibold text-slate-600 mb-6">Information to show in labels</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showProductName} onChange={(e) => updateConfig('showProductName', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Product Name</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.productNameSize} onChange={(e) => updateConfig('productNameSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showVariation} onChange={(e) => updateConfig('showVariation', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">SKU / Variation</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.variationSize} onChange={(e) => updateConfig('variationSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showPrice} onChange={(e) => updateConfig('showPrice', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Product Price</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.priceSize} onChange={(e) => updateConfig('priceSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800">Show Price:</label>
            <div className="relative">
              <Info size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="w-full pl-7 pr-4 py-1.5 rounded border border-slate-300 text-xs font-medium focus:border-blue-500 outline-none appearance-none cursor-pointer" value={config.priceType} onChange={(e) => updateConfig('priceType', e.target.value as PriceType)}>
                <option value="Inc. tax">Inc. tax</option>
                <option value="Exc. tax">Exc. tax</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showBusinessName} onChange={(e) => updateConfig('showBusinessName', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Business name</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.businessNameSize} onChange={(e) => updateConfig('businessNameSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showPackingDate} onChange={(e) => updateConfig('showPackingDate', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Print packing date</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.packingDateSize} onChange={(e) => updateConfig('packingDateSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showLotNumber} onChange={(e) => updateConfig('showLotNumber', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Print lot number</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.lotNumberSize} onChange={(e) => updateConfig('lotNumberSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={config.showExpDate} onChange={(e) => updateConfig('showExpDate', e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-800">Print expiry date</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-500">Size</span>
              <input type="number" value={config.expDateSize} onChange={(e) => updateConfig('expDateSize', Number(e.target.value))} className="w-full px-2 py-1 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 my-8"></div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-800">Barcode setting:</h4>
          <div className="relative max-w-xl">
            <Settings size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              className="w-full pl-9 pr-8 py-2 rounded border border-slate-300 focus:border-blue-500 font-medium text-xs text-slate-700 appearance-none cursor-pointer outline-none"
              value={barcodeSetting}
              onChange={(e) => setBarcodeSetting(e.target.value as BarcodeSettingKey)}
            >
              {barcodeSettingOptions.map(bs => (
                <option key={bs.value} value={bs.value}>{bs.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
          {isContinuousSelected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Width (in)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={continuousWidth}
                  onChange={(e) => setContinuousWidth(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:border-blue-500 outline-none text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Height (in)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={continuousHeight}
                  onChange={(e) => setContinuousHeight(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:border-blue-500 outline-none text-xs font-medium"
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center items-center gap-4 border-t border-slate-100 pt-6">
          {selectedProducts.length > 0 && (
            <span className="text-xs font-bold text-slate-500">{totalLabels} label{totalLabels !== 1 ? 's' : ''} will be printed</span>
          )}
          <button
            onClick={handleExportPDF}
            disabled={selectedProducts.length === 0}
            className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export PDF
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedProducts.length === 0}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> Print Labels
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintLabels;
