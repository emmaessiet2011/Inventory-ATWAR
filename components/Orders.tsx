import React from 'react';
import ListOrders from './ListOrders';

interface OrdersProps {
  onNavigate?: (page: string) => void;
  onSelectOrder?: (orderId: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canGenerateInvoice?: boolean;
  canApprove?: boolean;
}

const Orders: React.FC<OrdersProps> = ({
  onNavigate,
  onSelectOrder,
  canAdd = true,
  canEdit = true,
  canDelete = canEdit,
  canGenerateInvoice = true,
  canApprove = false,
}) => {
  return (
    <ListOrders
      onNavigate={onNavigate || (() => undefined)}
      onSelectOrder={onSelectOrder}
      canAdd={canAdd}
      canEdit={canEdit}
      canDelete={canDelete}
      canGenerateInvoice={canGenerateInvoice}
      canApprove={canApprove}
    />
  );
};

export default Orders;
