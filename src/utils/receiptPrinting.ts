import type {
  InvoiceLayout,
  Location,
  ReceiptPrinter,
} from '../context/GlobalContext';
import type { NotificationType } from '../context/NotificationContext';

type AddNotification = (payload: { title: string; message: string; type: NotificationType }) => void;

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

export const findLocationByIdOrName = (
  locations: Location[],
  refValue?: string
): Location | undefined => {
  const normalizedRef = normalizeText(refValue);
  if (!normalizedRef) return undefined;
  return locations.find(location =>
    normalizeText(location.id) === normalizedRef ||
    normalizeText(location.name) === normalizedRef
  );
};

export const resolveReceiptPrinterForLocation = (
  location: Location | undefined,
  printers: ReceiptPrinter[]
): ReceiptPrinter | null => {
  if (!location) return null;
  const printerId = String(location.receiptPrinterId || '').trim();
  if (!printerId) return null;
  return printers.find(printer => String(printer.id || '').trim() === printerId) || null;
};

export const notifyReceiptPrintFallback = ({
  location,
  printers,
  addNotification,
  documentLabel = 'Invoice',
}: {
  location: Location | undefined;
  printers: ReceiptPrinter[];
  addNotification: AddNotification;
  documentLabel?: string;
}): void => {
  if (!location || location.receiptPrinterType !== 'network') return;

  const configuredPrinter = resolveReceiptPrinterForLocation(location, printers);
  if (configuredPrinter) {
    addNotification({
      title: 'Printer notice',
      message: `${documentLabel} is configured for "${configuredPrinter.name}". Browser print preview opened as fallback.`,
      type: 'info',
    });
    return;
  }

  addNotification({
    title: 'Printer configuration missing',
    message: `${documentLabel} is set to Network/Thermal printing for "${location.name}", but no receipt printer is assigned. Browser print preview opened.`,
    type: 'warning',
  });
};

export type InvoiceLayoutVariant = 'classic' | 'modern' | 'compact';

export interface InvoiceLayoutTheme {
  surfaceClass: string;
  contentWrapClass: string;
  tableHeadClass: string;
  tableBodyClass: string;
  panelClass: string;
  subHeadClass: string;
  layoutBadgeClass: string;
  bodyTextSizeClass: string;
}

export interface InvoiceLayoutRenderConfig {
  layoutName: string;
  layoutDesign: string;
  variant: InvoiceLayoutVariant;
  theme: InvoiceLayoutTheme;
  template: InvoiceLayoutTemplateConfig;
}

export interface InvoiceLayoutTemplateLabels {
  invoiceNo: string;
  date: string;
  customer: string;
  customerTaxNumber: string;
  mobile: string;
  product: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  tax: string;
  total: string;
  paid: string;
  due: string;
}

export interface InvoiceLayoutTemplateConfig {
  invoiceHeading: string;
  showInvoiceLogo: boolean;
  showBusinessName: boolean;
  showLocationName: boolean;
  showCustomerTaxNumber: boolean;
  showCustomerMobile: boolean;
  showPaymentInformation: boolean;
  footerText: string;
  labels: InvoiceLayoutTemplateLabels;
}

const DEFAULT_INVOICE_TEMPLATE_LABELS: InvoiceLayoutTemplateLabels = {
  invoiceNo: 'Invoice No.',
  date: 'Date',
  customer: 'Customer',
  customerTaxNumber: 'VATIN',
  mobile: 'Mobile',
  product: 'Product',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  subtotal: 'Subtotal',
  tax: 'VATIN',
  total: 'Total',
  paid: 'Amount Paid',
  due: 'Due',
};

const DEFAULT_INVOICE_TEMPLATE_CONFIG: InvoiceLayoutTemplateConfig = {
  invoiceHeading: 'Tax Invoice',
  showInvoiceLogo: true,
  showBusinessName: true,
  showLocationName: true,
  showCustomerTaxNumber: true,
  showCustomerMobile: true,
  showPaymentInformation: true,
  footerText: '',
  labels: DEFAULT_INVOICE_TEMPLATE_LABELS,
};

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toOptionalString = (value: unknown): string | undefined => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : undefined;
};

const toBooleanWithFallback = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const resolveInvoiceLayoutTemplateConfig = (layout?: InvoiceLayout): InvoiceLayoutTemplateConfig => {
  const topLevel = toObject(layout);
  const bodyTemplate = toObject(layout?.bodyTemplate);
  const labels = toObject(bodyTemplate.labels);

  const resolveLabel = (key: keyof InvoiceLayoutTemplateLabels): string =>
    toOptionalString(labels[key]) ||
    toOptionalString(bodyTemplate[key]) ||
    toOptionalString(topLevel[key]) ||
    DEFAULT_INVOICE_TEMPLATE_LABELS[key];

  return {
    invoiceHeading:
      toOptionalString(bodyTemplate.invoiceHeading) ||
      toOptionalString(topLevel.invoiceHeading) ||
      DEFAULT_INVOICE_TEMPLATE_CONFIG.invoiceHeading,
    showInvoiceLogo: toBooleanWithFallback(
      bodyTemplate.showInvoiceLogo ?? topLevel.showInvoiceLogo ?? topLevel.showClientLogo,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showInvoiceLogo,
    ),
    showBusinessName: toBooleanWithFallback(
      bodyTemplate.showBusinessName ?? topLevel.showBusinessName,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showBusinessName,
    ),
    showLocationName: toBooleanWithFallback(
      bodyTemplate.showLocationName ?? topLevel.showLocationName,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showLocationName,
    ),
    showCustomerTaxNumber: toBooleanWithFallback(
      bodyTemplate.showCustomerTaxNumber ?? topLevel.showCustomerTaxNumber,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showCustomerTaxNumber,
    ),
    showCustomerMobile: toBooleanWithFallback(
      bodyTemplate.showCustomerMobile ?? topLevel.showCustomerMobile,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showCustomerMobile,
    ),
    showPaymentInformation: toBooleanWithFallback(
      bodyTemplate.showPaymentInformation ?? topLevel.showPaymentInformation,
      DEFAULT_INVOICE_TEMPLATE_CONFIG.showPaymentInformation,
    ),
    footerText:
      toOptionalString(bodyTemplate.footerText) ||
      toOptionalString(topLevel.footerText) ||
      DEFAULT_INVOICE_TEMPLATE_CONFIG.footerText,
    labels: {
      invoiceNo: resolveLabel('invoiceNo'),
      date: resolveLabel('date'),
      customer: resolveLabel('customer'),
      customerTaxNumber: resolveLabel('customerTaxNumber'),
      mobile: resolveLabel('mobile'),
      product: resolveLabel('product'),
      quantity: resolveLabel('quantity'),
      unitPrice: resolveLabel('unitPrice'),
      subtotal: resolveLabel('subtotal'),
      tax: resolveLabel('tax'),
      total: resolveLabel('total'),
      paid: resolveLabel('paid'),
      due: resolveLabel('due'),
    },
  };
};

const resolveInvoiceLayoutVariant = (layout?: InvoiceLayout): InvoiceLayoutVariant => {
  const token = `${layout?.name || ''} ${layout?.design || ''}`.toLowerCase();
  if (token.includes('modern') || token.includes('clean')) return 'modern';
  if (token.includes('compact') || token.includes('minimal') || token.includes('simple')) return 'compact';
  return 'classic';
};

const getInvoiceLayoutTheme = (variant: InvoiceLayoutVariant): InvoiceLayoutTheme => {
  if (variant === 'modern') {
    return {
      surfaceClass: 'bg-white border-slate-200',
      contentWrapClass: 'bg-white',
      tableHeadClass: 'bg-slate-900 text-white',
      tableBodyClass: 'bg-white',
      panelClass: 'bg-slate-50 border-slate-200',
      subHeadClass: 'bg-slate-100 text-slate-700',
      layoutBadgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      bodyTextSizeClass: 'text-[11px]',
    };
  }

  if (variant === 'compact') {
    return {
      surfaceClass: 'bg-white border-slate-200',
      contentWrapClass: 'bg-slate-50',
      tableHeadClass: 'bg-blue-700 text-white',
      tableBodyClass: 'bg-white',
      panelClass: 'bg-white border-slate-200',
      subHeadClass: 'bg-blue-50 text-blue-800',
      layoutBadgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
      bodyTextSizeClass: 'text-[10px]',
    };
  }

  return {
    surfaceClass: 'bg-slate-100 border-slate-300',
    contentWrapClass: 'bg-slate-100',
    tableHeadClass: 'bg-emerald-500 text-white',
    tableBodyClass: 'bg-slate-200/80',
    panelClass: 'bg-slate-200/80 border-slate-300',
    subHeadClass: 'bg-slate-100 text-slate-700',
    layoutBadgeClass: 'border-slate-300 bg-slate-200 text-slate-700',
    bodyTextSizeClass: 'text-[11px]',
  };
};

export const resolveInvoiceLayoutRenderConfig = (
  invoiceLayoutName: string | undefined,
  invoiceLayouts: InvoiceLayout[]
): InvoiceLayoutRenderConfig => {
  const normalizedLayoutName = normalizeText(invoiceLayoutName);
  const matchedLayout = normalizedLayoutName
    ? invoiceLayouts.find(layout => normalizeText(layout.name) === normalizedLayoutName)
    : undefined;
  const fallbackLayout = invoiceLayouts.find(layout => layout.isDefault) || invoiceLayouts[0];
  const activeLayout = matchedLayout || fallbackLayout;
  const variant = resolveInvoiceLayoutVariant(activeLayout);

  return {
    layoutName: activeLayout?.name || 'Default',
    layoutDesign: activeLayout?.design || 'Classic',
    variant,
    theme: getInvoiceLayoutTheme(variant),
    template: resolveInvoiceLayoutTemplateConfig(activeLayout),
  };
};
