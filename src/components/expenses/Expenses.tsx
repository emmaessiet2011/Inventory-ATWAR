import React from 'react';
import ListExpenses from './ListExpenses';

interface ExpensesProps {
  onNavigate?: (page: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

const Expenses: React.FC<ExpensesProps> = ({
  onNavigate,
  canAdd = true,
  canEdit = true,
  canDelete = canEdit,
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  return (
    <ListExpenses
      onNavigate={onNavigate || (() => undefined)}
      canAdd={canAdd}
      canEdit={canEdit}
      canDelete={canDelete}
      restrictToAddedById={restrictToAddedById}
      restrictToAddedByName={restrictToAddedByName}
    />
  );
};

export default Expenses;
