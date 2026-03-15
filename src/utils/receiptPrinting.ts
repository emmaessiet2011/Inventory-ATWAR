import type { InvoiceLayout, Location, ReceiptPrinter } from '../context/GlobalContext';
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
}

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
  };
};
