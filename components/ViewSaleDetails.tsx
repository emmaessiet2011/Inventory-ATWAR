import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, X, Printer, Package, Paperclip } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { formatDateTimeBySettings } from '../src/utils/dateTime';
import { findLocationByIdOrName, resolveInvoiceLayoutRenderConfig } from '../src/utils/receiptPrinting';

interface ViewSaleDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  saleId?: string | null;
  onOpenPackingSlip?: () => void;
  autoPrintRequestId?: string | null;
  /** When true, renders as a full page instead of a modal overlay */
  pageMode?: boolean;
}

const normalizeText = (value?: string): string => String(value || '').trim().toLowerCase();

const ViewSaleDetails: React.FC<ViewSaleDetailsProps> = ({
  isOpen,
  onClose,
  saleId,
  onOpenPackingSlip,
  autoPrintRequestId,
  pageMode = false,
}) => {
  const { sales, payments, settings, formatCurrency, taxRates, invoiceLayouts, customers, locations } = useGlobalContext();

  const sale = useMemo(
    () => (saleId ? sales.find(s => s.id === saleId) : undefined),
    [sales, saleId]
  );

  const layoutConfig = useMemo(
    () => resolveInvoiceLayoutRenderConfig(sale?.invoiceLayout, invoiceLayouts),
    [sale?.invoiceLayout, invoiceLayouts]
  );
  const customerRecord = useMemo(() => {
    if (!sale) return undefined;
    const customerIdRef = String(sale.customerId || '').trim();
    const saleCustomerName = normalizeText(sale.customerName);
    return customers.find(customer => {
      if (customerIdRef && String(customer.id || '').trim() === customerIdRef) return true;
      if (!saleCustomerName) return false;
      return normalizeText(customer.businessName) === saleCustomerName
        || normalizeText(customer.name) === saleCustomerName;
    });
  }, [customers, sale]);
  const locationRecord = useMemo(
    () => findLocationByIdOrName(locations, sale?.location),
    [locations, sale?.location]
  );
  const documentLabel = useMemo(() => {
    const normalizedStatus = String(sale?.status || sale?.saleStatus || '').trim();
    if (normalizedStatus === 'Quotation') return 'Quotation';
    if (normalizedStatus === 'Proforma') return 'Proforma Invoice';
    if (normalizedStatus === 'Draft') return 'Draft';
    return 'Invoice';
  }, [sale?.status, sale?.saleStatus]);

  const formatDateTimeDisplay = (value?: string) => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const invoicePayments = useMemo(() => {
    if (!sale?.invoiceNo) return [];
    const invoiceNoLower = sale.invoiceNo.toLowerCase();
    return payments
      .filter(p => {
        const linked = (p.linkedInvoices || []).some(inv => inv === sale.invoiceNo);
        const refHit = (p.referenceNo || '').toLowerCase().includes(invoiceNoLower);
        const noteHit = (p.note || '').toLowerCase().includes(invoiceNoLower);
        return linked || refHit || noteHit;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payments, sale?.invoiceNo]);

  const fieldPaymentAttachmentMap = useMemo(() => {
    const map = new Map<string, { name: string; data: string }>();
    try {
      const raw = localStorage.getItem('app_field_payments');
      if (raw) {
        const records = JSON.parse(raw);
        if (Array.isArray(records)) {
          records.forEach((r: any) => {
            if (r.referenceNo && r.attachmentName && r.attachmentData) {
              map.set(r.referenceNo, { name: r.attachmentName, data: r.attachmentData });
            }
          });
        }
      }
    } catch {
      // ignore malformed data
    }
    return map;
  }, []);

  const subtotal = Number(
    sale?.subTotal ??
      (sale?.items || []).reduce((sum, item) => sum + (Number(item.subtotal) || Number(item.total) || 0), 0)
  );
  const discountAmountRaw = Number(sale?.discountAmount || 0);
  const discountValue = (sale?.discountType || '').toLowerCase() === 'percentage'
    ? subtotal * (discountAmountRaw / 100)
    : discountAmountRaw;
  const baseBeforeTax = Math.max(0, subtotal - discountValue);
  const taxValue = (() => {
    const orderTaxName = String(sale?.tax || sale?.orderTax || 'None');
    if (!sale || orderTaxName === 'None') return 0;
    const taxRateObj = taxRates.find(r => r.name === orderTaxName);
    if (taxRateObj) return baseBeforeTax * (Number(taxRateObj.rate || 0) / 100);
    return Number((sale.items || []).reduce((sum, item) => sum + (Number(item.tax) || 0), 0));
  })();
  const shippingValue = Number(sale?.shippingCharges || 0);
  const payableBeforeRound = subtotal - discountValue + taxValue + shippingValue;
  const grandTotal = Number(sale?.grandTotal || sale?.totalAmount || payableBeforeRound || 0);
  const roundOff = grandTotal - payableBeforeRound;
  const paidFromPayments = invoicePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPaid = invoicePayments.length > 0 ? paidFromPayments : Number(sale?.totalPaid || 0);
  const totalRemaining = typeof sale?.sellDue === 'number'
    ? Math.max(0, sale.sellDue)
    : Math.max(0, grandTotal - totalPaid);
  const saleReturnRecords = Array.isArray(sale?.sellReturns) ? sale.sellReturns : [];
  const returnTotal = saleReturnRecords.reduce((sum, record) => sum + Number(record.total || 0), 0);
  const returnDue = Math.max(0, Number(sale?.sellReturnDue || 0));
  const netDue = Math.max(0, Number((totalRemaining - returnDue).toFixed(3)));
  const businessName = String(locationRecord?.name || settings.businessName || '--').trim() || '--';
  const businessAddressLine = (() => {
    const configuredAddress = String(settings.businessAddress || '').trim();
    if (configuredAddress) return configuredAddress;
    const parts = [locationRecord?.city, locationRecord?.state, locationRecord?.country]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    const cityFallback = String(settings.businessCity || '').trim();
    return cityFallback || '--';
  })();
  const businessTaxNumber = String(settings.taxNumber || settings.tax1Number || '').trim();
  const customerName = String(sale?.customerName || customerRecord?.businessName || customerRecord?.name || 'Walk-in Customer').trim() || 'Walk-in Customer';
  const customerTaxNumber = String(customerRecord?.taxNumber || '').trim();
  const customerMobile = String(sale?.contactNumber || customerRecord?.mobile || customerRecord?.phone || '--').trim() || '--';
  const netSubtotal = Math.max(0, Number((subtotal - discountValue).toFixed(3)));
  const vatSummaryLabel = `VATIN (${settings.tax1Name || settings.taxLabel || 'VAT'}): (+)`;
  const printGeneratedAt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date()),
    []
  );
  const invoicePublicUrl = useMemo(() => {
    const invoiceNo = String(sale?.invoiceNo || '').trim();
    if (!invoiceNo) return '--';
    if (typeof window === 'undefined') return `invoice/${invoiceNo}`;
    return `${window.location.origin}/invoice/${encodeURIComponent(invoiceNo)}`;
  }, [sale?.invoiceNo]);

  const activityRows = useMemo(() => {
    if (!sale) return [];
    const shippingActivities = Array.isArray(sale.shippingActivities) ? sale.shippingActivities : [];
    if (shippingActivities.length > 0) return shippingActivities;
    return [
      {
        date: sale.date || '',
        action: 'Added',
        by: sale.addedBy || '--',
        note: '',
      },
    ];
  }, [sale]);

  useEffect(() => {
    if (!isOpen || !sale || !autoPrintRequestId) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isOpen, sale, autoPrintRequestId]);

  if (!isOpen) return null;

  return (
    <div
      id="invoice-print-root"
      className={pageMode
        ? 'pb-20 print:p-0 print:bg-white'
        : 'fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm p-2 md:p-4 flex items-center justify-center print:fixed print:inset-0 print:m-0 print:p-0 print:block print:bg-white print:overflow-visible'
      }
    >
      <div className={`border rounded-md overflow-hidden flex flex-col print:h-auto print:max-w-none print:rounded-none print:border-0 print:shadow-none ${pageMode ? 'w-full shadow-sm' : 'w-full max-w-[1900px] h-[95vh] shadow-2xl'} ${layoutConfig.theme.surfaceClass}`}>
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            {pageMode && (
              <button
                onClick={onClose}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                title="Back to Sales"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-sm font-bold text-slate-800">
              Sell Details | {documentLabel} No.: ({sale?.invoiceNo || '--'})
            </h2>
          </div>
          {!pageMode && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {!sale ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Sale record not found.
          </div>
        ) : (
          <div className={`flex-1 overflow-auto p-3 text-slate-700 print:hidden ${layoutConfig.theme.bodyTextSizeClass}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <p><span className="font-bold">Invoice No.:</span> {sale.invoiceNo || '--'}</p>
                <p><span className="font-bold">Status:</span> {sale.status || sale.saleStatus || '--'}</p>
                <p><span className="font-bold">Payment Status:</span> {sale.paymentStatus || '--'}</p>
                <p>
                  <span className="font-bold">Invoice Layout:</span>{' '}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${layoutConfig.theme.layoutBadgeClass}`}>
                    {layoutConfig.layoutName} ({layoutConfig.layoutDesign})
                  </span>
                </p>
                <p><span className="font-bold">Commission Agent:</span> {sale.commissionAgentName || '--'}</p>
                <p><span className="font-bold">Commission:</span> {formatCurrency(Number(sale.commissionAmount || 0))}</p>
              </div>
              <div>
                <p><span className="font-bold">Customer name:</span> {sale.customerName || 'Walk-in Customer'}</p>
                <p><span className="font-bold">Address:</span> {sale.shippingAddress || sale.billingAddress || '--'}</p>
                <p><span className="font-bold">Mobile:</span> {sale.contactNumber || '--'}</p>
              </div>
              <div className="lg:text-right">
                <p>
                  <span className="font-bold">Shipping:</span>{' '}
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-white text-[10px] font-bold ${
                    sale.shippingStatus === 'Delivered' ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}>
                    {sale.shippingStatus || '--'}
                  </span>
                </p>
                <p><span className="font-bold">Date:</span> {formatDateTimeDisplay(sale.date)}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="font-bold text-slate-800 mb-1">Products:</p>
              <div className="overflow-x-auto border border-slate-300">
                <table className="w-full text-left">
                  <thead className={layoutConfig.theme.tableHeadClass}>
                    <tr>
                      <th className="px-2 py-1">#</th>
                      <th className="px-2 py-1">Product</th>
                      <th className="px-2 py-1">Lot / Expiry</th>
                      <th className="px-2 py-1">Quantity</th>
                      <th className="px-2 py-1">Unit Price</th>
                      <th className="px-2 py-1">Discount</th>
                      <th className="px-2 py-1">Tax</th>
                      <th className="px-2 py-1">Price inc. tax</th>
                      <th className="px-2 py-1">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className={`${layoutConfig.theme.tableBodyClass} divide-y divide-slate-300`}>
                    {(sale.items || []).length > 0 ? (
                      sale.items.map((item, idx) => {
                        const qty = Number(item.qty || 0);
                        const unitPrice = Number(item.unitPrice || 0);
                        const lineTax = Number(item.tax || 0);
                        const lineTotal = Number(item.total || 0);
                        const incTaxPerUnit = qty > 0 ? lineTotal / qty : unitPrice;
                        return (
                          <tr key={`${item.id}-${idx}`}>
                            <td className="px-2 py-1">{idx + 1}</td>
                            <td className="px-2 py-1">{item.name || '--'}</td>
                            <td className="px-2 py-1">--</td>
                            <td className="px-2 py-1">
                              {Number(qty).toFixed(settings.quantityPrecision || 3)} {item.unit || ''}
                            </td>
                            <td className="px-2 py-1">{formatCurrency(unitPrice)}</td>
                            <td className="px-2 py-1">{formatCurrency(Number(item.discount || 0))}</td>
                            <td className="px-2 py-1">{formatCurrency(lineTax)}</td>
                            <td className="px-2 py-1">{formatCurrency(incTaxPerUnit)}</td>
                            <td className="px-2 py-1">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-2 py-4 text-center text-slate-500 italic">
                          No products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-bold text-slate-800 mb-1">Payment info:</p>
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full text-left">
                    <thead className={layoutConfig.theme.tableHeadClass}>
                      <tr>
                        <th className="px-2 py-1">#</th>
                        <th className="px-2 py-1">Date</th>
                        <th className="px-2 py-1">Reference No</th>
                        <th className="px-2 py-1">Amount</th>
                        <th className="px-2 py-1">Payment mode</th>
                        <th className="px-2 py-1">Payment note</th>
                        <th className="px-2 py-1">Attachment</th>
                      </tr>
                    </thead>
                    <tbody className={`${layoutConfig.theme.tableBodyClass} divide-y divide-slate-300`}>
                      {invoicePayments.length > 0 ? (
                        invoicePayments.map((payment, idx) => (
                          <tr key={payment.id}>
                            <td className="px-2 py-1">{idx + 1}</td>
                            <td className="px-2 py-1">{formatDateTimeDisplay(payment.date)}</td>
                            <td className="px-2 py-1">{payment.referenceNo || '--'}</td>
                            <td className="px-2 py-1">{formatCurrency(Number(payment.amount || 0))}</td>
                            <td className="px-2 py-1">{payment.method || '--'}</td>
                            <td className="px-2 py-1">{payment.note || '--'}</td>
                            <td className="px-2 py-1">
                              {(() => {
                                // Check inline attachmentData first (NewPayment), then fall back to field payment map
                                const inlineData = (payment as any).attachmentData;
                                const inlineName = payment.attachmentName;
                                if (inlineData && inlineName) {
                                  return (
                                    <a
                                      href={inlineData}
                                      download={inlineName}
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                      title={inlineName}
                                    >
                                      <Paperclip size={11} />
                                      <span className="truncate max-w-[100px]">{inlineName}</span>
                                    </a>
                                  );
                                }
                                const att = payment.referenceNo
                                  ? fieldPaymentAttachmentMap.get(payment.referenceNo)
                                  : undefined;
                                if (!att) return <span className="text-slate-400">--</span>;
                                return (
                                  <a
                                    href={att.data}
                                    download={att.name}
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                    title={att.name}
                                  >
                                    <Paperclip size={11} />
                                    <span className="truncate max-w-[100px]">{att.name}</span>
                                  </a>
                                );
                              })()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-2 py-4 text-center text-slate-500 italic">
                            No payments linked to this invoice.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-800 mb-1">Total:</p>
                <div className={`border ${layoutConfig.theme.panelClass}`}>
                  {[
                    { label: 'Total', value: formatCurrency(subtotal) },
                    { label: 'Discount', value: `(-) ${formatCurrency(discountValue)}` },
                    { label: 'Order Tax', value: `(+)\u00a0${formatCurrency(taxValue)}` },
                    { label: 'Shipping', value: `(+)\u00a0${formatCurrency(shippingValue)}` },
                    { label: 'Round Off', value: formatCurrency(roundOff) },
                    { label: 'Gross Total', value: formatCurrency(grandTotal), bold: true },
                    { label: 'Return Total', value: `(-) ${formatCurrency(returnTotal)}` },
                    { label: 'Total paid', value: formatCurrency(totalPaid), bold: true },
                    { label: 'Invoice Due', value: formatCurrency(totalRemaining), bold: true },
                    { label: 'Return Due', value: formatCurrency(returnDue) },
                    { label: 'Net Due', value: formatCurrency(netDue), bold: true },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`grid grid-cols-2 px-2 py-1 border-b border-slate-300 last:border-b-0 ${
                        row.bold ? 'font-bold text-slate-900' : ''
                      }`}
                    >
                      <span>{row.label}:</span>
                      <span className="text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="font-bold text-slate-800 mb-1">Sell note:</p>
                <div className={`min-h-10 border px-2 py-1 ${layoutConfig.theme.panelClass}`}>
                  {sale.sellNote || '--'}
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-800 mb-1">Staff note:</p>
                <div className={`min-h-10 border px-2 py-1 ${layoutConfig.theme.panelClass}`}>
                  {sale.staffNote || '--'}
                </div>
              </div>
            </div>

            <div>
              <p className="font-bold text-slate-800 mb-1">Activities:</p>
              <div className="overflow-x-auto border border-slate-300">
                <table className="w-full text-left">
                  <thead className={layoutConfig.theme.subHeadClass}>
                    <tr>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Action</th>
                      <th className="px-2 py-1">By</th>
                      <th className="px-2 py-1">Note</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {activityRows.map((act, idx) => (
                      <tr key={`${act.date}-${idx}`}>
                        <td className="px-2 py-1">{formatDateTimeDisplay(act.date)}</td>
                        <td className="px-2 py-1">{act.action || 'Added'}</td>
                        <td className="px-2 py-1">{act.by || sale.addedBy || '--'}</td>
                        <td className="px-2 py-1">
                          {act.note ? (
                            act.note
                          ) : (
                            <div className="space-y-0.5">
                              <div>Status: {sale.status || sale.saleStatus || '--'}</div>
                              <div>Shipping Status: {sale.shippingStatus || '--'}</div>
                              <div>Total: {formatCurrency(grandTotal)}</div>
                              <div>Payment Status: {sale.paymentStatus || '--'}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {sale && (
          <div className="hidden print:block bg-white text-black">
            <style>{`
              @page { size: A4; margin: 5mm; }
              @media print {
                html, body { margin: 0 !important; padding: 0 !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body * { visibility: hidden !important; }
                #invoice-print-root, #invoice-print-root * { visibility: visible !important; }
                #invoice-print-root {
                  position: fixed !important;
                  inset: 0 !important;
                  z-index: 2147483647 !important;
                  background: #fff !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                #invoice-print-root > div { margin: 0 !important; }
              }
            `}</style>

            <div className="mx-auto w-full max-w-[200mm] px-0.5 py-0 text-[11px] leading-snug">
              <div className="border-b border-slate-400 pb-2">
                <div className="grid grid-cols-[84px_1fr_170px] items-start gap-2">
                  <div className="pt-1">
                    {settings.businessLogo ? (
                      <img
                        src={settings.businessLogo}
                        alt="Business logo"
                        className="h-14 w-auto object-contain"
                      />
                    ) : (
                      <div className="h-14 w-14 border border-slate-400 text-[9px] text-slate-500 grid place-items-center">
                        LOGO
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold uppercase tracking-wide">{businessName}</p>
                    <p>{businessAddressLine}</p>
                    <p>VATIN {businessTaxNumber || '--'}</p>
                    <p className="mt-1 text-[13px] font-bold">Tax Invoice</p>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-[78px_1fr] gap-x-1">
                      <span className="font-semibold">Invoice No.</span>
                      <span>{sale.invoiceNo || '--'}</span>
                      <span className="font-semibold">Date</span>
                      <span>{formatDateTimeDisplay(sale.date)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[72px_1fr] gap-y-0.5 gap-x-2">
                <span className="font-semibold">Customer</span>
                <span>{customerName}</span>
                <span className="font-semibold">VATIN</span>
                <span>{customerTaxNumber || '--'}</span>
                <span className="font-semibold">Mobile</span>
                <span>{customerMobile}</span>
              </div>

              <div className="mt-3 border border-slate-400">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border-b border-slate-400 px-2 py-1 text-left font-semibold">Product</th>
                      <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Quantity</th>
                      <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Unit Price</th>
                      <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sale.items || []).length > 0 ? (
                      sale.items.map((item, idx) => {
                        const quantity = Number(item.qty || 0);
                        const unitPrice = Number(item.unitPrice || 0);
                        const lineSubtotal = Number(
                          item.total ?? item.subtotal ?? (quantity * unitPrice)
                        );
                        return (
                          <tr key={`${item.id || item.name || 'row'}-${idx}`}>
                            <td className="border-b border-slate-200 px-2 py-1">{item.name || '--'}</td>
                            <td className="border-b border-slate-200 px-2 py-1 text-right">
                              {quantity.toFixed(settings.quantityPrecision || 3)}
                            </td>
                            <td className="border-b border-slate-200 px-2 py-1 text-right">{formatCurrency(unitPrice)}</td>
                            <td className="border-b border-slate-200 px-2 py-1 text-right">{formatCurrency(lineSubtotal)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-2 py-6 text-center italic text-slate-500">
                          No products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 ml-auto w-full max-w-[96mm] border border-slate-400">
                {[
                  { label: 'Due', value: formatCurrency(totalRemaining) },
                  { label: 'Subtotal', value: formatCurrency(netSubtotal) },
                  { label: vatSummaryLabel, value: formatCurrency(taxValue) },
                  { label: 'Total', value: formatCurrency(grandTotal), bold: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-[1fr_auto] border-b border-slate-300 px-2 py-1 last:border-b-0 ${row.bold ? 'font-bold' : ''}`}
                  >
                    <span>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-6">
                <div>
                  <p className="font-semibold">Credit</p>
                  <p className="mt-4 font-semibold">Received By</p>
                  <p className="mt-3">Name: ____________________</p>
                  <p className="mt-2">Signature: ________________</p>
                </div>
                <div className="self-end text-[10px] text-slate-700">
                  Received in good condition; payment as agreed.
                </div>
              </div>

              <div className="mt-8 grid grid-cols-[auto_auto_1fr_auto] gap-2 border-t border-slate-400 pt-2 text-[10px] text-slate-700">
                <span>{printGeneratedAt}</span>
                <span>{sale.invoiceNo || '--'}</span>
                <span className="truncate">{invoicePublicUrl}</span>
                <span>1/1</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-3 py-2 bg-white border-t border-slate-200 flex justify-end gap-2 print:hidden">
          <button
            onClick={onOpenPackingSlip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
          >
            <Package size={13} /> Packing Slip
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
          >
            <Printer size={13} /> Print {documentLabel}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewSaleDetails;
