/**
 * printUtils.ts
 * Beautiful A4 print document generator for ATWAR BSS ERP.
 * Opens a styled print window showing only table data — no filters, no pagination, no UI chrome.
 */
import { formatDateTimeBySettings } from './dateTime';

export interface PrintColumn {
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface PrintStat {
  label: string;
  value: string;
  color?: 'blue' | 'green' | 'amber' | 'rose' | 'slate';
}

export interface PrintConfig {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  /** Each inner array maps 1-to-1 with columns. Cells may contain plain text or badge() HTML. */
  rows: string[][];
  stats?: PrintStat[];
  /** Optional totals row appended at the bottom of the table */
  totalRow?: string[];
  businessName: string;
  businessAddress?: string;
  businessLogo?: string;
  printedBy?: string;
}

export interface PrintActiveReportTableConfig {
  title?: string;
  subtitle?: string;
  businessName?: string;
  businessAddress?: string;
  printedBy?: string;
  /** Optional selector to scope which part of the page should be inspected for tables. */
  rootSelector?: string;
}

export interface PrintElementSnapshotConfig {
  elementId: string;
  title?: string;
  extraStyles?: string;
  windowFeatures?: string;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Creates a coloured badge HTML string for use inside a print cell. */
export function badge(
  text: string,
  color: 'green' | 'amber' | 'blue' | 'rose' | 'purple' | 'sky' | 'slate' = 'slate',
): string {
  return `<span class="badge badge-${color}">${esc(text)}</span>`;
}

/** Resolves payment-status text to a badge colour. */
export function paymentBadge(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return badge(status, 'green');
  if (s === 'partial') return badge(status, 'sky');
  if (s === 'overdue') return badge(status, 'rose');
  if (s === 'due') return badge(status, 'amber');
  return badge(status, 'slate');
}

/** Resolves generic order/purchase/shipping status to a badge colour. */
export function statusBadge(status: string): string {
  const s = String(status || '').toLowerCase();
  if (['received', 'delivered', 'completed', 'final', 'active'].includes(s)) return badge(status, 'green');
  if (['pending', 'processing', 'ordered', 'packed'].includes(s)) return badge(status, 'amber');
  if (['shipped', 'ready', 'approved'].includes(s)) return badge(status, 'blue');
  if (['cancelled', 'rejected'].includes(s)) return badge(status, 'rose');
  if (['quotation', 'draft'].includes(s)) return badge(status, 'purple');
  return badge(status, 'slate');
}

function resolveLogoFromStorage(): string {
  try {
    const raw = localStorage.getItem('app_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return (parsed.businessLogo as string) || '';
    }
  } catch { /* ignore */ }
  return '';
}

function resolvePrintDateSettings(): { dateFormat: string; timeFormat: string; timeZone: string } {
  const fallback = {
    dateFormat: 'dd/mm/yyyy',
    timeFormat: '12',
    timeZone: 'Asia/Dubai',
  };
  try {
    const raw = localStorage.getItem('app_settings');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      dateFormat: String(parsed.dateFormat || fallback.dateFormat),
      timeFormat: String(parsed.timeFormat || fallback.timeFormat),
      timeZone: String(parsed.timeZone || fallback.timeZone),
    };
  } catch {
    return fallback;
  }
}

function getGeneratedTimestamp(): string {
  const settings = resolvePrintDateSettings();
  return formatDateTimeBySettings(
    new Date().toISOString(),
    settings.dateFormat,
    settings.timeFormat,
    settings.timeZone,
  );
}

export function printDocument(config: PrintConfig): void {
  const w = window.open('', '_blank', 'width=960,height=720');
  if (!w) return;

  const {
    title, subtitle, columns, rows, stats, totalRow,
    businessName, businessAddress, printedBy,
  } = config;

  const businessLogo = config.businessLogo ?? resolveLogoFromStorage();
  const generatedAt = getGeneratedTimestamp();

  const colWidthAttrs = columns
    .map(col => (col.width ? `<col style="width:${esc(col.width)}">` : '<col>'))
    .join('');

  const headerCells = columns
    .map((col, i) =>
      `<th style="text-align:${col.align || 'left'}"${columns[i].width ? ` width="${esc(columns[i].width!)}"` : ''}>${esc(col.label)}</th>`
    )
    .join('');

  const bodyRows = rows
    .map(row =>
      `<tr>${columns.map((col, i) => `<td style="text-align:${col.align || 'left'}">${row[i] ?? ''}</td>`).join('')}</tr>`
    )
    .join('');

  const statsHtml = stats && stats.length > 0
    ? `<div class="stats-row">${stats.map(s =>
      `<div class="stat-box stat-${s.color || 'slate'}">
        <div class="stat-label">${esc(s.label)}</div>
        <div class="stat-value">${esc(s.value)}</div>
      </div>`).join('')}</div>`
    : '';

  const totalRowHtml = totalRow
    ? `<tfoot><tr class="summary-row">${columns.map((col, i) =>
      `<td style="text-align:${col.align || 'left'}">${totalRow[i] ?? ''}</td>`).join('')}</tr></tfoot>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title)} — ${esc(businessName)}</title>
<style>
@page { size: A4; margin: 14mm 12mm 12mm 12mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#1e293b;background:#fff}

/* ── Header ── */
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:11px;border-bottom:2.5px solid #e2e8f0;margin-bottom:13px}
.biz-wrap{display:flex;align-items:center;gap:11px}
.biz-logo{width:40px;height:40px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15pt;flex-shrink:0}
.biz-name{font-size:13.5pt;font-weight:900;color:#0f172a;letter-spacing:-.3px;line-height:1.15}
.biz-sub{font-size:7.5pt;color:#64748b;margin-top:2px}
.report-meta{text-align:right}
.report-title{font-size:12.5pt;font-weight:800;color:#1e293b}
.report-subtitle{font-size:7.5pt;color:#64748b;margin-top:3px}
.report-date{font-size:6.5pt;color:#94a3b8;margin-top:3px}

/* ── Stats ── */
.stats-row{display:flex;gap:9px;margin-bottom:12px}
.stat-box{padding:7px 11px;border-radius:6px;flex:1;border:1px solid}
.stat-slate{background:#f8fafc;border-color:#e2e8f0}
.stat-blue{background:#eff6ff;border-color:#bfdbfe}
.stat-green{background:#f0fdf4;border-color:#bbf7d0}
.stat-amber{background:#fffbeb;border-color:#fde68a}
.stat-rose{background:#fff1f2;border-color:#fecdd3}
.stat-label{font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700}
.stat-value{font-size:11pt;font-weight:900;color:#0f172a;margin-top:2px}

/* ── Table ── */
table{width:100%;border-collapse:collapse;font-size:8pt}
thead tr{background:#f1f5f9}
th{padding:6px 7px;text-align:left;font-weight:700;font-size:6.8pt;text-transform:uppercase;letter-spacing:.35px;color:#475569;border-bottom:1.5px solid #cbd5e1;white-space:nowrap}
td{padding:5.5px 7px;border-bottom:.5px solid #e2e8f0;vertical-align:top;line-height:1.4}
tbody tr:nth-child(even) td{background:#f8fafc}
.summary-row td{background:#f1f5f9!important;border-top:2px solid #cbd5e1;font-weight:700;font-size:8.5pt}

/* ── Badges ── */
.badge{display:inline-block;padding:1.5px 6px;border-radius:4px;font-size:6.5pt;font-weight:700;letter-spacing:.3px;white-space:nowrap}
.badge-green{background:#dcfce7;color:#15803d}
.badge-amber{background:#fef3c7;color:#b45309}
.badge-blue{background:#dbeafe;color:#1d4ed8}
.badge-rose{background:#fee2e2;color:#b91c1c}
.badge-purple{background:#f3e8ff;color:#7e22ce}
.badge-sky{background:#e0f2fe;color:#0369a1}
.badge-slate{background:#f1f5f9;color:#475569}

/* ── Footer ── */
.footer{margin-top:13px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8}

@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<div class="header">
  <div class="biz-wrap">
    ${businessLogo
      ? `<img src="${businessLogo}" style="width:40px;height:40px;object-fit:contain;border-radius:8px;flex-shrink:0" alt="logo">`
      : `<div class="biz-logo">${esc((businessName || 'B').trim().charAt(0).toUpperCase())}</div>`}
    <div>
      <div class="biz-name">${esc(businessName)}</div>
      ${businessAddress ? `<div class="biz-sub">${esc(businessAddress)}</div>` : ''}
    </div>
  </div>
  <div class="report-meta">
    <div class="report-title">${esc(title)}</div>
    ${subtitle ? `<div class="report-subtitle">${esc(subtitle)}</div>` : ''}
    <div class="report-date">Generated: ${generatedAt}</div>
  </div>
</div>

${statsHtml}

<table>
  <colgroup>${colWidthAttrs}</colgroup>
  <thead><tr>${headerCells}</tr></thead>
  <tbody>${bodyRows || `<tr><td colspan="${columns.length}" style="text-align:center;padding:20px;color:#94a3b8">No records found</td></tr>`}</tbody>
  ${totalRowHtml}
</table>

<div class="footer">
  <span>${printedBy ? `Printed by: ${esc(printedBy)}` : 'ATWAR BSS ERP'}</span>
  <span>${rows.length} record${rows.length !== 1 ? 's' : ''}</span>
  <span>${generatedAt}</span>
</div>

<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()};}<\/script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
}

function compactText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function hasClassTokenInAncestors(el: Element, token: string): boolean {
  let node: Element | null = el;
  while (node) {
    if (node instanceof HTMLElement && node.classList.contains(token)) return true;
    node = node.parentElement;
  }
  return false;
}

function isLikelyCalendarTable(table: HTMLTableElement): boolean {
  if (
    table.closest('.react-datepicker, .rdrCalendarWrapper, .react-calendar, [class*="calendar"], [class*="date-picker"], [class*="datepicker"]')
  ) {
    return true;
  }

  const headerRow = table.tHead?.rows[0] || table.querySelector('tr');
  const headerCells = headerRow
    ? Array.from(headerRow.cells).map((cell) => compactText(cell.textContent || '').toLowerCase())
    : [];
  const shortDays = new Set(['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  if (headerCells.length >= 7 && headerCells.every((cell) => shortDays.has(cell))) {
    return true;
  }

  const bodyCells = Array.from(table.querySelectorAll('tbody td'));
  if (bodyCells.length === 0) return false;
  const numericCells = bodyCells.filter((cell) => /^\d{1,2}$/.test(compactText(cell.textContent || '')));
  return numericCells.length > 0 && numericCells.length / bodyCells.length > 0.8;
}

function isVisibleElement(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function resolveBusinessMeta(config: Pick<PrintActiveReportTableConfig, 'businessName' | 'businessAddress'>): {
  businessName: string;
  businessAddress?: string;
} {
  if (config.businessName) {
    return {
      businessName: compactText(config.businessName) || 'ATWAR BSS',
      businessAddress: compactText(config.businessAddress || '') || undefined,
    };
  }

  try {
    const raw = localStorage.getItem('app_settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const nameCandidates = [
        parsed.businessName,
        parsed.shopName,
        parsed.companyName,
        (parsed.business as Record<string, unknown> | undefined)?.name,
      ];
      const addressCandidates = [
        parsed.businessAddress,
        parsed.address,
        (parsed.business as Record<string, unknown> | undefined)?.address,
      ];
      const resolvedName = compactText(nameCandidates.find(Boolean) || '');
      const resolvedAddress = compactText(addressCandidates.find(Boolean) || '');
      if (resolvedName) {
        return {
          businessName: resolvedName,
          businessAddress: resolvedAddress || undefined,
        };
      }
    }
  } catch {
    // Ignore storage parse issues and fall back to defaults.
  }

  return {
    businessName: 'ATWAR BSS',
    businessAddress: compactText(config.businessAddress || '') || undefined,
  };
}

/**
 * Builds a clean A4 report document from the currently visible table in the active page area.
 * Use this for report Print buttons to avoid printing filter/toolbars/page chrome.
 */
export function printActiveReportTable(config: PrintActiveReportTableConfig = {}): void {
  const roots = config.rootSelector
    ? Array.from(document.querySelectorAll(config.rootSelector))
    : [];
  const mainRoot =
    roots.find(isVisibleElement) ||
    document.querySelector('main') ||
    document.querySelector('[class*="flex-1"]') ||
    document.body;

  if (!(mainRoot instanceof HTMLElement)) return;

  const visibleTables = Array.from(mainRoot.querySelectorAll('table'))
    .filter(isVisibleElement)
    .filter((table) => !hasClassTokenInAncestors(table, 'print:hidden'));
  const scoreTable = (table: HTMLTableElement) => {
    const bodyRows = Array.from(table.tBodies).reduce((sum, body) => sum + body.rows.length, 0);
    const allRows = table.querySelectorAll('tr').length;
    const headerRow = table.tHead?.rows[0] || table.querySelector('tr');
    const colCount = headerRow?.cells.length || table.rows[0]?.cells.length || 0;
    const hasThead = Boolean(table.tHead && table.tHead.rows.length > 0);
    const controlCount = table.querySelectorAll('input,select,button,textarea').length;

    let score = bodyRows * 120 + allRows * 4 + colCount * 8 + (hasThead ? 40 : 0);
    if (colCount <= 2) score -= 200;
    if (controlCount > 0) score -= 120;
    if (table.closest('[role="dialog"], [role="menu"], [role="listbox"]')) score -= 500;
    if (isLikelyCalendarTable(table)) score -= 1500;
    return score;
  };
  const targetTable = visibleTables.sort((a, b) => scoreTable(b) - scoreTable(a))[0];

  const businessMeta = resolveBusinessMeta({
    businessName: config.businessName,
    businessAddress: config.businessAddress,
  });
  const titleFromHeading = compactText(mainRoot.querySelector('h1, h2, h3')?.textContent || '');
  const title = compactText(config.title || titleFromHeading || 'Report');
  const subtitle = compactText(config.subtitle || '');

  if (!targetTable) {
    printDocument({
      title,
      subtitle: subtitle || undefined,
      columns: [{ label: 'Info' }],
      rows: [['No table data available for print']],
      businessName: businessMeta.businessName,
      businessAddress: businessMeta.businessAddress,
      printedBy: compactText(config.printedBy || '') || undefined,
    });
    return;
  }

  const rowToCells = (row: HTMLTableRowElement): string[] =>
    Array.from(row.cells).map((cell) => compactText(cell.textContent || ''));

  const headerRow = targetTable.tHead?.rows[0] || targetTable.querySelector('tr');
  let headerLabels = headerRow ? rowToCells(headerRow) : [];
  if (headerLabels.length === 0) {
    const fallbackRow = targetTable.tBodies[0]?.rows[0];
    const fallbackCells = fallbackRow ? rowToCells(fallbackRow) : [];
    headerLabels = fallbackCells.map((_, index) => `Column ${index + 1}`);
  }
  if (headerLabels.length === 0) {
    headerLabels = ['Value'];
  }

  const bodyRows =
    targetTable.tBodies.length > 0
      ? Array.from(targetTable.tBodies).flatMap((body) => Array.from(body.rows))
      : Array.from(targetTable.querySelectorAll('tr')).slice(headerRow ? 1 : 0);

  const normalizedRows = bodyRows
    .map((row) => {
      const cells = rowToCells(row);
      while (cells.length < headerLabels.length) cells.push('');
      return cells.slice(0, headerLabels.length);
    })
    .filter((cells) => cells.some((cell) => cell !== ''));

  const footerRow = targetTable.tFoot?.rows[0];
  let totalRow: string[] | undefined;
  if (footerRow) {
    totalRow = rowToCells(footerRow);
    while (totalRow.length < headerLabels.length) totalRow.push('');
    totalRow = totalRow.slice(0, headerLabels.length);
  }

  printDocument({
    title,
    subtitle: subtitle || undefined,
    columns: headerLabels.map((label) => ({ label: label || 'Column' })),
    rows: normalizedRows,
    totalRow,
    businessName: businessMeta.businessName,
    businessAddress: businessMeta.businessAddress,
    printedBy: compactText(config.printedBy || '') || undefined,
  });
}

export function printElementSnapshot(config: PrintElementSnapshotConfig): void {
  const target = document.getElementById(config.elementId);
  if (!(target instanceof HTMLElement)) return;

  const printWindow = window.open(
    '',
    '_blank',
    config.windowFeatures || 'width=1100,height=760',
  );
  if (!printWindow) return;

  const headAssets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');
  const title = esc(config.title || document.title || 'Print');
  const extraStyles = String(config.extraStyles || '').trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
${headAssets}
<style>
html, body { margin: 0; padding: 0; background: #fff; }
${extraStyles}
</style>
</head>
<body>
${target.outerHTML}
<script>
window.onload = function () {
  setTimeout(function () {
    window.print();
    window.onafterprint = function () { window.close(); };
  }, 80);
};
<\/script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Document-style prints (Packing Slip, Delivery Note)
// ─────────────────────────────────────────────────────────────────────────────

export interface ShippingDocItem {
  name: string;
  qty: number;
  unit?: string;
}

export interface ShippingDocConfig {
  /** 'Packing Slip' shows no "received by" row; 'Delivery Note' adds it. */
  documentType: 'Packing Slip' | 'Delivery Note';
  invoiceNo: string;
  date: string;
  customerName: string;
  mobile?: string;
  shippingAddress?: string;
  items: ShippingDocItem[];
  businessName: string;
  businessAddress?: string;
  businessLogo?: string;
  printedBy?: string;
}

export function printShippingDocument(cfg: ShippingDocConfig): void {
  const w = window.open('', '_blank', 'width=860,height=700');
  if (!w) return;

  const businessLogo = cfg.businessLogo ?? resolveLogoFromStorage();
  const logo = esc((cfg.businessName || 'B').trim().charAt(0).toUpperCase());
  const isDelivery = cfg.documentType === 'Delivery Note';
  const generatedAt = getGeneratedTimestamp();

  const itemRows = cfg.items.length > 0
    ? cfg.items.map((item, i) =>
        `<tr>
          <td class="text-center">${i + 1}</td>
          <td>${esc(item.name)}</td>
          <td class="text-right num">${Number(item.qty).toFixed(3)} ${esc(item.unit || 'Pc(s)')}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;padding:18px;color:#94a3b8">No items</td></tr>`;

  const receivedByHtml = isDelivery
    ? `<p style="font-size:8.5pt;font-weight:700;color:#1e293b;margin:14px 0 10px">Above mentioned items received in good condition</p>
       <div style="display:flex;gap:40px;margin-bottom:14px;font-size:8.5pt;font-weight:700;color:#1e293b">
         <div>Received by:&nbsp;<span style="display:inline-block;border-bottom:1.5px solid #94a3b8;width:130px">&nbsp;</span></div>
         <div>Date:&nbsp;<span style="display:inline-block;border-bottom:1.5px solid #94a3b8;width:100px">&nbsp;</span></div>
       </div>`
    : '';

  const sharedCss = `
@page { size: A4; margin: 16mm 14mm 14mm 14mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2.5px solid #e2e8f0;margin-bottom:16px}
.biz-wrap{display:flex;align-items:center;gap:11px}
.biz-logo{width:44px;height:44px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16pt;flex-shrink:0}
.biz-name{font-size:13.5pt;font-weight:900;color:#0f172a;letter-spacing:-.3px;line-height:1.15}
.biz-sub{font-size:7.5pt;color:#64748b;margin-top:2px}
.doc-type{font-size:20pt;font-weight:300;color:#64748b;text-align:right;margin-bottom:6px}
.meta-table{border-collapse:collapse;margin-left:auto}
.meta-table td{font-size:8.5pt;padding:2px 0;vertical-align:top}
.meta-table td:first-child{color:#64748b;padding-right:14px;text-align:right}
.meta-table td:last-child{font-weight:700;color:#0f172a;text-align:right}
.addr-grid{display:flex;gap:24px;margin-bottom:16px}
.addr-block{flex:1}
.addr-label{font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;margin-bottom:5px}
.addr-value{font-size:8.5pt;color:#1e293b;line-height:1.6}
.addr-strong{font-weight:700;color:#0f172a}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#f1f5f9}
th{padding:6px 8px;text-align:left;font-weight:700;font-size:6.8pt;text-transform:uppercase;letter-spacing:.35px;color:#475569;border-bottom:1.5px solid #cbd5e1}
td{padding:5.5px 8px;border-bottom:.5px solid #e2e8f0;font-size:8.5pt;vertical-align:top}
tbody tr:nth-child(even) td{background:#f8fafc}
.text-right{text-align:right}.text-center{text-align:center}
.num{font-variant-numeric:tabular-nums}
.sig-section{display:flex;gap:36px;margin-top:20px}
.sig-block{flex:1}
.sig-heading{font-size:7pt;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;margin-bottom:22px}
.sig-line{border-bottom:1.5px solid #94a3b8;margin-bottom:4px}
.sig-sub{font-size:7pt;color:#94a3b8}
.footer{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${esc(cfg.documentType)} — ${esc(cfg.businessName)}</title>
<style>${sharedCss}</style></head>
<body>
<div class="header">
  <div class="biz-wrap">
    ${businessLogo
      ? `<img src="${businessLogo}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;flex-shrink:0" alt="logo">`
      : `<div class="biz-logo">${logo}</div>`}
    <div>
      <div class="biz-name">${esc(cfg.businessName)}</div>
      ${cfg.businessAddress ? `<div class="biz-sub">${esc(cfg.businessAddress)}</div>` : ''}
    </div>
  </div>
  <div>
    <div class="doc-type">${esc(cfg.documentType)}</div>
    <table class="meta-table">
      <tr><td>Invoice No.</td><td>${esc(cfg.invoiceNo)}</td></tr>
      <tr><td>Date</td><td>${esc(cfg.date)}</td></tr>
    </table>
  </div>
</div>

<div class="addr-grid">
  <div class="addr-block">
    <div class="addr-label">Customer</div>
    <div class="addr-value">
      <div class="addr-strong">${esc(cfg.customerName)}</div>
      ${cfg.mobile ? `<div>Mobile: ${esc(cfg.mobile)}</div>` : ''}
    </div>
  </div>
  <div class="addr-block">
    <div class="addr-label">Shipping Address</div>
    <div class="addr-value">${esc(cfg.shippingAddress || '--')}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Product</th>
    <th class="text-right">Quantity</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

${receivedByHtml}

<div class="sig-section">
  <div class="sig-block">
    <div class="sig-heading">Authorized Signatory</div>
    <div class="sig-line"></div>
    <div class="sig-sub">Name &amp; Signature</div>
  </div>
  <div class="sig-block">
    <div class="sig-heading">Received By</div>
    <div class="sig-line"></div>
    <div class="sig-sub">Name &amp; Signature</div>
  </div>
</div>

<p style="margin-top:14px;font-size:8pt;font-style:italic;color:#475569">"Received in good condition; payment as agreed."</p>

<div class="footer">
  <span>${cfg.printedBy ? `Printed by: ${esc(cfg.printedBy)}` : esc(cfg.businessName)}</span>
  <span>${generatedAt}</span>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()};}<\/script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Credit Note print (Sell Return)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditNoteItem {
  name: string;
  returnQty: number;
  unitPrice: number;
  lineTotal: number;
  unit?: string;
}

export interface CreditNoteConfig {
  referenceNo: string;
  parentInvoiceNo: string;
  date: string;
  customerName: string;
  location?: string;
  items: CreditNoteItem[];
  subTotal: number;
  discountValue: number;
  taxValue: number;
  total: number;
  settlementMode: string;
  appliedToInvoice: number;
  creditedToAdvance: number;
  refundNow: number;
  paymentDue: number;
  note?: string;
  businessName: string;
  businessAddress?: string;
  businessLogo?: string;
  printedBy?: string;
  /** Pre-formatted currency function result strings */
  fmtSubTotal: string;
  fmtDiscount: string;
  fmtTax: string;
  fmtTotal: string;
  fmtApplied: string;
  fmtCredit: string;
  fmtRefund: string;
  fmtDue: string;
}

export function printCreditNote(cfg: CreditNoteConfig): void {
  const w = window.open('', '_blank', 'width=860,height=700');
  if (!w) return;

  const businessLogo = cfg.businessLogo ?? resolveLogoFromStorage();
  const logo = esc((cfg.businessName || 'B').trim().charAt(0).toUpperCase());
  const generatedAt = getGeneratedTimestamp();

  const itemRows = cfg.items.length > 0
    ? cfg.items.map((item, i) =>
        `<tr>
          <td class="text-center">${i + 1}</td>
          <td>${esc(item.name)}</td>
          <td class="text-right num">${Number(item.returnQty).toFixed(3)} ${esc(item.unit || 'Pc(s)')}</td>
          <td class="text-right num">${esc(item.unitPrice.toFixed(3))}</td>
          <td class="text-right num">${esc(item.lineTotal.toFixed(3))}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:18px;color:#94a3b8">No items</td></tr>`;

  const settlementLabel = (mode: string) => {
    if (mode === 'apply_to_invoice_due') return 'Applied to Invoice Due';
    if (mode === 'customer_credit') return 'Kept as Customer Credit';
    if (mode === 'refund_now') return 'Refunded Immediately';
    if (mode === 'refund_due') return 'Refund Pending';
    return esc(mode);
  };

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Credit Note ${esc(cfg.referenceNo)} — ${esc(cfg.businessName)}</title>
<style>
@page { size: A4; margin: 16mm 14mm 14mm 14mm; }
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2.5px solid #e2e8f0;margin-bottom:14px}
.biz-wrap{display:flex;align-items:center;gap:11px}
.biz-logo{width:44px;height:44px;background:linear-gradient(135deg,#ef4444,#f97316);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16pt;flex-shrink:0}
.biz-name{font-size:13.5pt;font-weight:900;color:#0f172a;letter-spacing:-.3px;line-height:1.15}
.biz-sub{font-size:7.5pt;color:#64748b;margin-top:2px}
.doc-type{font-size:18pt;font-weight:800;color:#b91c1c;text-align:right;letter-spacing:-.3px;margin-bottom:6px}
.meta-table{border-collapse:collapse;margin-left:auto}
.meta-table td{font-size:8.5pt;padding:2px 0}
.meta-table td:first-child{color:#64748b;padding-right:14px;text-align:right}
.meta-table td:last-child{font-weight:700;color:#0f172a;text-align:right}
.info-row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px;margin-bottom:14px;display:flex;gap:20px}
.info-field{flex:1}.info-label{font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;margin-bottom:3px}
.info-value{font-size:8.5pt;font-weight:700;color:#0f172a}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
thead tr{background:#f1f5f9}
th{padding:6px 8px;font-weight:700;font-size:6.8pt;text-transform:uppercase;letter-spacing:.35px;color:#475569;border-bottom:1.5px solid #cbd5e1}
td{padding:5.5px 8px;border-bottom:.5px solid #e2e8f0;font-size:8.5pt;vertical-align:top}
tbody tr:nth-child(even) td{background:#f8fafc}
.text-right{text-align:right}.text-center{text-align:center}
.num{font-variant-numeric:tabular-nums}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:14px}
.totals{width:250px;border-collapse:collapse}
.totals td{font-size:8.5pt;padding:3.5px 8px}
.totals td:last-child{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.totals .final-row td{background:#fee2e2;border-top:2px solid #fca5a5;font-weight:900;font-size:10pt;padding:6px 8px;color:#b91c1c}
.settlement{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:9px 12px;margin-bottom:14px}
.settlement-title{font-size:6.5pt;text-transform:uppercase;letter-spacing:.5px;color:#1d4ed8;font-weight:700;margin-bottom:7px}
.settlement-grid{display:flex;flex-wrap:wrap;gap:6px 20px}
.s-item{font-size:8pt;color:#475569;min-width:40%}
.s-item strong{color:#1e293b}
.note-box{font-size:8pt;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:7px 10px;margin-bottom:14px}
.note-box strong{color:#0f172a}
.footer{margin-top:14px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:7pt;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body>
<div class="header">
  <div class="biz-wrap">
    ${businessLogo
      ? `<img src="${businessLogo}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;flex-shrink:0" alt="logo">`
      : `<div class="biz-logo">${logo}</div>`}
    <div>
      <div class="biz-name">${esc(cfg.businessName)}</div>
      ${cfg.businessAddress ? `<div class="biz-sub">${esc(cfg.businessAddress)}</div>` : ''}
    </div>
  </div>
  <div>
    <div class="doc-type">Credit Note</div>
    <table class="meta-table">
      <tr><td>Reference No.</td><td>${esc(cfg.referenceNo)}</td></tr>
      <tr><td>Date</td><td>${esc(cfg.date)}</td></tr>
      <tr><td>Original Invoice</td><td>${esc(cfg.parentInvoiceNo)}</td></tr>
    </table>
  </div>
</div>

<div class="info-row">
  <div class="info-field">
    <div class="info-label">Customer</div>
    <div class="info-value">${esc(cfg.customerName)}</div>
  </div>
  ${cfg.location ? `<div class="info-field"><div class="info-label">Location</div><div class="info-value">${esc(cfg.location)}</div></div>` : ''}
  <div class="info-field">
    <div class="info-label">Settlement Method</div>
    <div class="info-value">${settlementLabel(cfg.settlementMode)}</div>
  </div>
</div>

<table>
  <thead><tr>
    <th style="width:36px">#</th>
    <th>Product</th>
    <th class="text-right">Return Qty</th>
    <th class="text-right">Unit Price</th>
    <th class="text-right">Line Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals-wrap">
  <table class="totals">
    <tr><td>Subtotal</td><td>${esc(cfg.fmtSubTotal)}</td></tr>
    <tr><td>Discount</td><td>(−) ${esc(cfg.fmtDiscount)}</td></tr>
    <tr><td>Tax</td><td>(+) ${esc(cfg.fmtTax)}</td></tr>
    <tr class="final-row"><td>Return Total</td><td>${esc(cfg.fmtTotal)}</td></tr>
  </table>
</div>

<div class="settlement">
  <div class="settlement-title">Settlement Breakdown</div>
  <div class="settlement-grid">
    <div class="s-item">Applied to invoice due: <strong>${esc(cfg.fmtApplied)}</strong></div>
    <div class="s-item">Customer credit: <strong>${esc(cfg.fmtCredit)}</strong></div>
    <div class="s-item">Refund now: <strong>${esc(cfg.fmtRefund)}</strong></div>
    <div class="s-item">Return due: <strong>${esc(cfg.fmtDue)}</strong></div>
  </div>
</div>

${cfg.note ? `<div class="note-box"><strong>Note:</strong> ${esc(cfg.note)}</div>` : ''}

<div class="footer">
  <span>${cfg.printedBy ? `Printed by: ${esc(cfg.printedBy)}` : esc(cfg.businessName)}</span>
  <span>${generatedAt}</span>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()};}<\/script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}
