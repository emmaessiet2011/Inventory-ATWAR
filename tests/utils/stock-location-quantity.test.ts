import { describe, expect, it } from 'vitest';
import { Product } from '../../src/context/GlobalContext';
import { simulateSeedLocationStock } from '../../src/utils/stockSeeding';
import { simulateStockTransfer, StockTransferRecord } from '../../src/utils/stockTransfers';
import { ProductLocationInventory } from '../../src/utils/stockLocationInventory';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'PRD-CEBICAN',
  name: 'Cebican Daily Care 20kg',
  sku: 'CEBICAN-20KG',
  type: 'Single',
  category: 'Pet Food',
  brand: 'Cebican',
  tax: '--',
  businessLocation: 'Atwar Al Mustaqbal Business, CR:1450968',
  unitPurchasePrice: 10,
  sellingPrice: 15,
  stock: 50,
  unit: 'Pc(s)',
  image: '',
  ...overrides,
});

const transfer = (overrides: Partial<StockTransferRecord> = {}): StockTransferRecord => ({
  id: 'TR-1',
  date: '2026-05-21',
  refNo: 'ST-0001',
  locationFrom: 'Atwar Al Mustaqbal Business, CR:1450968',
  locationTo: 'O2 Pet Shop Mowalah',
  status: 'Completed',
  shippingCharges: 0,
  totalAmount: 10,
  notes: '',
  addedBy: 'Admin',
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-21T00:00:00.000Z',
  items: [{
    productId: 'PRD-CEBICAN',
    productName: 'Cebican Daily Care 20kg',
    sku: 'CEBICAN-20KG',
    qty: 1,
    unit: 'Pc(s)',
    unitCost: 10,
  }],
  ...overrides,
});

const generateId = (prefix: string) => `${prefix}-NEW`;

describe('location stock quantity rules', () => {
  it('seeds one unit into a shop without reducing warehouse stock or duplicating the product', () => {
    const source = product();

    const result = simulateSeedLocationStock({
      location: 'O2 Pet Shop Mowalah',
      locationId: 'LOC-MOWALAH',
      items: [{
        productId: source.id,
        productName: source.name,
        sku: source.sku,
        quantity: 1,
        unitCost: source.unitPurchasePrice,
      }],
      products: [source],
      inventoryRows: [],
      generateId,
      actorName: 'Admin',
      ref: 'SEED-1',
      date: '2026-05-21',
    });

    expect(result.productsAfter).toHaveLength(1);
    expect(result.productsAfter[0].id).toBe(source.id);
    expect(result.productsAfter[0].stock).toBe(50);
    expect(result.productsAfter[0].availableLocationIds).toContain('LOC-MOWALAH');
    expect(result.inventoryAfter).toHaveLength(1);
    expect(result.inventoryAfter[0]).toMatchObject({
      productId: source.id,
      locationId: 'LOC-MOWALAH',
      stock: 1,
    });
  });

  it('transfers only the entered quantity from warehouse to shop', () => {
    const source = product();

    const result = simulateStockTransfer({
      transfer: transfer(),
      direction: 1,
      products: [source],
      inventoryRows: [],
      locationFromId: 'BL0001',
      locationToId: 'LOC-MOWALAH',
      generateId,
      actorName: 'Admin',
    });

    expect(result.productsAfter).toHaveLength(1);
    expect(result.productsAfter[0].id).toBe(source.id);
    expect(result.productsAfter[0].stock).toBe(49);
    expect(result.inventoryAfter).toHaveLength(1);
    expect(result.inventoryAfter[0]).toMatchObject({
      productId: source.id,
      locationId: 'LOC-MOWALAH',
      stock: 1,
    });
    expect(result.ledgerEntries.map(entry => entry.change)).toEqual([-1, 1]);
  });

  it('moves only the entered quantity between shops without changing warehouse stock', () => {
    const source = product({ stock: 50 });
    const inventoryRows: ProductLocationInventory[] = [
      {
        id: 'PINV-MOWALAH',
        productId: source.id,
        locationId: 'LOC-MOWALAH',
        locationName: 'O2 Pet Shop Mowalah',
        stock: 5,
        unitCost: 10,
      },
      {
        id: 'PINV-BARKA',
        productId: source.id,
        locationId: 'LOC-BARKA',
        locationName: 'O2 Pet Shop Barka',
        stock: 2,
        unitCost: 10,
      },
    ];

    const result = simulateStockTransfer({
      transfer: transfer({
        locationFrom: 'O2 Pet Shop Mowalah',
        locationTo: 'O2 Pet Shop Barka',
      }),
      direction: 1,
      products: [source],
      inventoryRows,
      locationFromId: 'LOC-MOWALAH',
      locationToId: 'LOC-BARKA',
      generateId,
      actorName: 'Admin',
    });

    expect(result.productsAfter[0].stock).toBe(50);
    expect(result.inventoryAfter.find(row => row.locationId === 'LOC-MOWALAH')?.stock).toBe(4);
    expect(result.inventoryAfter.find(row => row.locationId === 'LOC-BARKA')?.stock).toBe(3);
    expect(result.ledgerEntries.map(entry => entry.change)).toEqual([-1, 1]);
  });
});
