const fs = require('fs');
const path = require('path');

// 1. ReportStock.tsx
const rsPath = path.join('src', 'components', 'reports', 'ReportStock.tsx');
if (fs.existsSync(rsPath)) {
  let content = fs.readFileSync(rsPath, 'utf8');
  const badMap = `    const rows: StockReportItem[] = products.map((product) => buildRow(
      product,
      product.businessLocation || '',
      Number(product.stock) || 0,
      Number(product.unitPurchasePrice) || 0,
      product.id,
    ));`;
  if (content.includes(badMap)) {
    content = content.replace(badMap, `    const rows: StockReportItem[] = [];`);
    fs.writeFileSync(rsPath, content);
    console.log('Patched ReportStock.tsx (Removed Global Duplication)');
  }
}

// 2. ReportStockExpiry.tsx
const rsePath = path.join('src', 'components', 'reports', 'ReportStockExpiry.tsx');
if (fs.existsSync(rsePath)) {
  let content = fs.readFileSync(rsePath, 'utf8');
  const startIdx = content.indexOf('const reportData = useMemo<StockExpiryItem[]>(() => {');
  if (startIdx !== -1) {
    const endIdx = content.indexOf('  }, [products, stockLotBalances, settings.stockExpiryAlertDays');
    if (endIdx !== -1) {
      const oldBlock = content.substring(startIdx, endIdx);
      const newBlock = `const reportData = useMemo<StockExpiryItem[]>(() => {
    const lotsByProduct = new Map<string, typeof stockLotBalances>();
    stockLotBalances.forEach(lot => {
      if ((Number(lot.qty) || 0) <= 0) return;
      const next = lotsByProduct.get(lot.productId) || [];
      lotsByProduct.set(lot.productId, [...next, lot]);
    });

    const data: StockExpiryItem[] = [];

    stockLotBalances.forEach((lot) => {
      const product = products.find((p) => p.id === lot.productId);
      if (!product) return;
      
      let remainingStock = Number(lot.qty) || 0;
      if (remainingStock <= 0) return;

      const parsedExpiry = lot.expiryDate ? new Date(lot.expiryDate) : null;
      if (!parsedExpiry || isNaN(parsedExpiry.getTime())) return;
      
      const row = {
        sku: product.sku || '--',
        product: product.name,
        location: lot.location || product.businessLocation || '--',
        stockLeft: Number(remainingStock.toFixed(3)),
        unit: product.unit || 'Pc(s)',
        lotNumber: lot.lotNumber || '--',
        expDate: parsedExpiry.toISOString().split('T')[0],
      };
      
      data.push(row as any);
    });

    return data;`;
      
      // Wait, let's just make it simpler because `toStockExpiryItem` requires opts.
      // I will just use a simpler replacement if it works, otherwise I will use a Regex.
    }
  }
}

console.log('Script execution partial setup completed.');
