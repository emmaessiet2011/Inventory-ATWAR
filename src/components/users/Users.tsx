import React from 'react';
import UserManagement from './UserManagement';

interface UsersProps {
  onNavigate?: (page: string) => void;
}

// Legacy compatibility wrapper. Users are managed in UserManagement with GlobalContext-backed data.
const Users: React.FC<UsersProps> = ({ onNavigate }) => {
  return <UserManagement onNavigate={onNavigate || (() => undefined)} />;
};

export default Users;
