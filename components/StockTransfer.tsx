import React from 'react';
import ListStockTransfers from './ListStockTransfers';

interface StockTransferProps {
  onNavigate?: (page: string) => void;
  canManage?: boolean;
}

// Legacy compatibility wrapper. The real implementation lives in ListStockTransfers.
const StockTransfer: React.FC<StockTransferProps> = ({ onNavigate, canManage = true }) => {
  const safeNavigate = onNavigate || (() => undefined);
  return <ListStockTransfers onNavigate={safeNavigate} canManage={canManage && !!onNavigate} />;
};

export default StockTransfer;
