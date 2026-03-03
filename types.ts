export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  image?: string;
}

export interface Order {
  id: string;
  customerName: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Shipped' | 'Delivered' | 'Cancelled';
  total: number;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  items: number;
}

export interface MenuItem {
  title: string;
  icon?: any;
  path?: string;
  subItems?: MenuItem[];
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  icon: any;
}