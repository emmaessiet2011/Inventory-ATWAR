import React from 'react';
import Sales from './Sales';

interface ListQuotationsProps {
  onNavigate: (page: string) => void;
}

// Legacy compatibility wrapper. Quotations list is handled by Sales with statusFilter='Quotation'.
const ListQuotations: React.FC<ListQuotationsProps> = ({ onNavigate }) => {
  return (
    <Sales
      onNavigate={onNavigate}
      statusFilter="Quotation"
      title="Quotations"
      addPage="add-quotation"
      addButtonLabel="Add Quotation"
    />
  );
};

export default ListQuotations;
