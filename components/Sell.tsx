import React from 'react';
import Sales from './Sales';

interface SellProps {
  onNavigate?: (page: string) => void;
}

// Legacy compatibility wrapper.
const Sell: React.FC<SellProps> = ({ onNavigate }) => {
  return <Sales onNavigate={onNavigate} statusFilter="Final" title="All Sales" />;
};

export default Sell;
