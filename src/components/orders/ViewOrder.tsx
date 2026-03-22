import React, { useMemo } from 'react';
import { X, Printer, Check } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { useNotifications } from '@/context/NotificationContext';
import { findLocationByIdOrName, notifyReceiptPrintFallback, resolveInvoiceLayoutRenderConfig } from '@/utils/receiptPrinting';

interface ViewOrderProps {
  onClose: () => void;
  invoiceNo?: string;
  orderId?: string;
  saleId?: string;
}

const ViewOrder: React.FC<ViewOrderProps> = ({ onClose, invoiceNo, orderId, saleId }) => {
  const { orders, sales, settings, formatCurrency, invoiceLayouts, locations, printers } = useGlobalContext();
  const { addNotification } = useNotifications();

  const order = useMemo(
    () => (orderId ? orders.find(o => o.id === orderId) : undefined),
    [orders, orderId]
  );

  const sale = useMemo(
    () => {
      if (saleId) return sales.find(s => s.id === saleId);
      if (invoiceNo) return sales.find(s => s.invoiceNo === invoiceNo);
      return undefined;
    },
    [sales, saleId, invoiceNo]
  );

  const layoutConfig = useMemo(
    () => resolveInvoiceLayoutRenderConfig(sale?.invoiceLayout, invoiceLayouts),
    [sale?.invoiceLayout, invoiceLayouts]
  );

  const formatDateTimeDisplay = (value?: string) => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const lineItems = useMemo(() => {
    if (order) {
      return order.items.map((item) => ({
        id: String(item.id),
        name: item.name,
        qty: item.qty,
        unitPrice: item.price,
        total: item.total,
        tax: 0,
      }));
    }

    if (sale) {
      return (sale.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        total: item.total,
        tax: item.tax || 0,
      }));
    }

    return [];
  }, [order, sale]);

  const documentNo = order?.orderNumber || sale?.invoiceNo || invoiceNo || '--';
  const customerName = order?.customerName || sale?.customerName || 'Walk-in Customer';
  const customerPhone = order?.customerPhone || sale?.contactNumber || '--';
  const invoiceDate = order?.orderDate || sale?.date || new Date().toISOString().slice(0, 16);
  const subTotal = order?.subTotal ?? sale?.subTotal ?? lineItems.reduce((acc, item) => acc + item.total, 0);
  const taxAmount = order?.taxAmount ?? lineItems.reduce((acc, item) => acc + item.tax, 0);
  const shippingCharges = order ? 0 : (sale?.shippingCharges || 0);
  const grandTotal = order?.total ?? sale?.grandTotal ?? sale?.totalAmount ?? (subTotal + taxAmount + shippingCharges);
  const totalPaid = order
    ? (order.paymentStatus === 'Paid' ? grandTotal : 0)
    : (sale?.totalPaid || 0);
  const totalDue = order
    ? Math.max(0, grandTotal - totalPaid)
    : (sale?.sellDue || 0);
  const paymentMethod = order?.paymentMethod || sale?.paymentMethod || '--';
  const printableLocation = useMemo(
    () => findLocationByIdOrName(locations, order?.businessLocation || sale?.location),
    [locations, order?.businessLocation, sale?.location]
  );

  const handlePrint = () => {
    notifyReceiptPrintFallback({
      location: printableLocation,
      printers,
      addNotification,
      documentLabel: order ? 'Order Invoice' : 'Invoice',
    });
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:p-0 print:bg-white print:static print:h-auto print:block">
      <div className={`w-full max-w-[210mm] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:h-auto print:max-w-none print:rounded-none print:overflow-visible border ${layoutConfig.theme.surfaceClass}`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0 print:hidden">
          <h2 className="text-lg font-bold text-slate-700">Invoice Preview</h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
            >
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar print:p-0 print:bg-white print:overflow-visible ${layoutConfig.theme.contentWrapClass}`}>
          <div className="max-w-[210mm] mx-auto bg-white shadow-sm p-12 min-h-[297mm] print:shadow-none print:p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-900">{settings.businessName}</h1>
              <p className="text-xs text-slate-500 mt-1">Tax Invoice</p>
              <p className="mt-2">
                <span className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-bold ${layoutConfig.theme.layoutBadgeClass}`}>
                  Layout: {layoutConfig.layoutName} ({layoutConfig.layoutDesign})
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
              <div className="space-y-1.5">
                <p className="font-bold text-slate-900">Invoice No: <span className="font-medium text-slate-700">{documentNo}</span></p>
                <p className="font-bold text-slate-900">Customer: <span className="font-medium text-slate-700">{customerName}</span></p>
                <p className="font-bold text-slate-900">Mobile: <span className="font-medium text-slate-700">{customerPhone}</span></p>
              </div>
              <div className="text-right space-y-1.5">
                <p className="font-bold text-slate-900">Date: <span className="font-medium text-slate-700">{formatDateTimeDisplay(invoiceDate)}</span></p>
                <p className="font-bold text-slate-900">Payment Method: <span className="font-medium text-slate-700">{paymentMethod}</span></p>
                {order && (
                  order.isApproved ? (
                    <p className="flex items-center gap-1 justify-end">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <Check size={10} /> Approved by {order.approvedBy || 'Manager'}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 justify-end">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                        Pending Approval
                      </span>
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`${layoutConfig.theme.tableHeadClass} border-b border-slate-300`}>
                    <th className="text-left py-2">Product</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-right py-2">Unit Price</th>
                    <th className="text-right py-2">Line Total</th>
                  </tr>
                </thead>
                <tbody className={layoutConfig.theme.tableBodyClass}>
                  {lineItems.length > 0 ? (
                    lineItems.map(item => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-2 text-slate-700">{item.name}</td>
                        <td className="py-2 text-center text-slate-700">{item.qty}</td>
                        <td className="py-2 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 text-right font-bold text-slate-800">{formatCurrency(item.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No line items available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={`ml-auto w-full max-w-sm space-y-1.5 text-sm p-3 rounded border ${layoutConfig.theme.panelClass}`}>
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-700">{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tax</span>
                <span className="font-medium text-slate-700">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Shipping</span>
                <span className="font-medium text-slate-700">{formatCurrency(shippingCharges)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 text-base">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-black text-slate-900">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Paid</span>
                <span className="font-medium text-emerald-700">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Due</span>
                <span className="font-medium text-amber-700">{formatCurrency(totalDue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewOrder;
