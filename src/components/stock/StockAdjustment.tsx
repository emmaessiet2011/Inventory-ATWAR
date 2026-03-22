import React from 'react';
import ListStockAdjustments from './ListStockAdjustments';

interface StockAdjustmentProps {
  onNavigate?: (page: string) => void;
  canManage?: boolean;
}

// Legacy compatibility wrapper. The real implementation lives in ListStockAdjustments.
const StockAdjustment: React.FC<StockAdjustmentProps> = ({ onNavigate, canManage = true }) => {
  const safeNavigate = onNavigate || (() => undefined);
  return <ListStockAdjustments onNavigate={safeNavigate} canManage={canManage && !!onNavigate} />;
};

export default StockAdjustment;
