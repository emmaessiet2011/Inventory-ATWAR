import React from 'react';
import AddSale from './AddSale';

interface AddQuotationProps {
  onNavigate?: (page: string) => void;
}

// Legacy compatibility wrapper. Quotation entry is handled by AddSale with status='Quotation'.
const AddQuotation: React.FC<AddQuotationProps> = ({ onNavigate }) => {
  return <AddSale onNavigate={onNavigate} initialStatus="Quotation" strictInitialStatus />;
};

export default AddQuotation;
