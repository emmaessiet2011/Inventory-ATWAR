import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AddOpeningStock from '../../src/components/products/AddOpeningStock';

// Mock the context and utility functions
vi.mock('@/context/GlobalContext', () => ({
  useGlobalContext: () => ({
    currentUser: { name: 'Admin' },
    locations: [{ id: 'loc1', name: 'Warehouse' }],
    formatCurrency: (val: number) => `$${val.toFixed(2)}`,
    generateId: () => 'test-id',
    updateProduct: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));

vi.mock('@/utils/stockTransfers', () => ({
  fetchStockLedgerFromDB: vi.fn().mockResolvedValue([]), // Return empty ledger
  appendStockLedgerEntriesStrict: vi.fn(),
  deleteStockLedgerEntry: vi.fn(),
}));

vi.mock('@/utils/apiClient', () => ({
  fetchDedicated: vi.fn().mockResolvedValue([]),
}));

describe('AddOpeningStock Legacy Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('synthesizes a legacy row when a product has stock but no ledger entries', async () => {
    const mockLegacyProduct = {
      id: 'p1',
      name: 'Legacy Widget',
      sku: 'WIDG-001',
      unitPurchasePrice: 15.50,
      openingStock: 250, // They had 250 stock!
      stock: 250,
      businessLocation: 'Warehouse'
    };

    render(<AddOpeningStock product={mockLegacyProduct as any} isOpen={true} />);

    // Wait for the ledger load to complete
    await waitFor(() => {
      // The synthesized row quantity (250) should be in an input box
      const quantityInputs = screen.getAllByRole('spinbutton');
      // Look for the one containing '250'
      const has250 = quantityInputs.some(input => (input as HTMLInputElement).value === '250');
      expect(has250).toBe(true);
    });
    
    // We expect NO empty default rows because mappedEntries handled it
    const inputs = screen.getAllByRole('spinbutton');
    const emptyRows = inputs.filter(i => (i as HTMLInputElement).value === '0');
    expect(emptyRows.length).toBe(0);
  });
  
  it('shows an empty row if product has no opening stock and no ledger entries', async () => {
    const mockNewProduct = {
      id: 'p2',
      name: 'New Widget',
      sku: 'WIDG-002',
      unitPurchasePrice: 10,
      openingStock: 0, 
      stock: 0,
      businessLocation: 'Warehouse'
    };

    render(<AddOpeningStock product={mockNewProduct as any} isOpen={true} />);

    await waitFor(() => {
      const quantityInputs = screen.getAllByRole('spinbutton');
      const has0 = quantityInputs.some(input => (input as HTMLInputElement).value === '0');
      expect(has0).toBe(true);
    });
  });
});