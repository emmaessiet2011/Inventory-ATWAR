import {
  ProductLocationInventory,
  fetchLocationInventoryFromDB,
  LOCATION_INVENTORY_UPDATED_EVENT,
} from '@/utils/stockLocationInventory';
import { isLocationAccessible } from '@/utils/productVisibility';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar, Search, Trash2, Info, ChevronDown, Save, X, SlidersHorizontal } from 'lucide-react';
import { Product, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  bootstrapStockAdjustmentsFromDB,
  StockAdjustmentDamageDisposition,
  StockAdjustmentItem,
  StockAdjustmentRecord,
  StockAdjustmentStatus,
  normalizeStockAdjustmentDamageDisposition,
  StockAdjustmentType,
  makeNextStockAdjustmentRef,
  normalizeStockAdjustmentStatus,
  readStockAdjustments,
  writeStockAdjustments,
} from '@/utils/stockAdjustments';

interface AddStockAdjustmentProps {
  onNavigate?: (page: string) => void;
  editAdjustmentId?: string;
  canAdd?: boolean;
  canEdit?: boolean;
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

const TYPE_OPTIONS: StockAdjustmentType[] = ['Normal', 'Abnormal', 'Damage'];
const DAMAGE_DISPOSITION_OPTIONS: StockAdjustmentDamageDisposition[] = ['Unsellable', 'Sellable'];
const DEFAULT_DAMAGE_SELLABLE_LOCATION = 'DMG-SALEABLE';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const isAdjustmentOwnerMatch = (
  adjustment: StockAdjustmentRecord,
  ownerIdFilter: string,
  ownerNameFilter: string,
) => {
  if (!ownerIdFilter && !ownerNameFilter) return true;
  const adjustmentOwnerId = normalize(adjustment.addedById);
  const adjustmentOwnerName = normalize(adjustment.addedBy);
  if (ownerIdFilter && ownerNameFilter) {
    return adjustmentOwnerId === ownerIdFilter && adjustmentOwnerName === ownerNameFilter;
  }
  if (ownerIdFilter) return adjustmentOwnerId === ownerIdFilter;
  if (ownerNameFilter) return adjustmentOwnerName === ownerNameFilter;
  return false;
};

const getNowLocalDateTime = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const toDateTimeInput = (value: string) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return getNowLocalDateTime();
  const d = new Date(parsed);
  d.setSeconds(0, 0);
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const toIso = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const AddStockAdjustment: React.FC<AddStockAdjustmentProps> = ({
  onNavigate,
  editAdjustmentId,
  canAdd = true,
  canEdit = true,
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  const { locations, products, generateId, settings, currentUser, formatCurrency, addActivityLog } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [date, setDate] = useState(getNowLocalDateTime());
  const [referenceNo, setReferenceNo] = useState('');
  const [location, setLocation] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentType>('Normal');
  const [damageDisposition, setDamageDisposition] = useState<StockAdjustmentDamageDisposition>('Unsellable');
  const [damageSellableLocation, setDamageSellableLocation] = useState('');
  const [reason, setReason] = useState('');
  const [totalRecovered, setTotalRecovered] = useState('0');
  const [productSearch, setProductSearch] = useState('');
  const [rows, setRows] = useState<StockAdjustmentItem[]>([]);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);

  useEffect(() => {
    let isMounted = true;
    const refreshInventory = () => {
      fetchLocationInventoryFromDB().then((records) => {
        if (isMounted) setLocationInventory(records);
      }).catch(() => {
        if (isMounted) setLocationInventory([]);
      });
    };
    refreshInventory();
    const onInventoryUpdated = () => { refreshInventory(); };
    window.addEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    };
  }, []);

  const getAvailableStock = (productId: string, locName: string) => {
    const locId = locations.find(l => normalize(l.name) === normalize(locName))?.id;
    if (!locId) return 0;
    const match = locationInventory.find((record) => (
      record.productId === productId && record.locationId === locId
    ));
    return round3(Number(match?.stock || 0));
  };

  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<StockAdjustmentStatus>('Pending');
  const [isEditMode, setIsEditMode] = useState(false);
  const permissionRedirectedRef = useRef(false);
  const isAdminUser = normalize(currentUser?.role) === 'admin';
  const ownerIdFilter = normalize(restrictToAddedById);
  const ownerNameFilter = normalize(restrictToAddedByName);
  const activeLocations = useMemo(
    () => locations.filter(row => row.isActive !== false),
    [locations]
  );
  const locationPool = useMemo(
    () => (isAdminUser ? locations : activeLocations),
    [activeLocations, isAdminUser, locations],
  );
  const selectableLocations = useMemo(() => {
      let filteredPool = locationPool.filter(loc => isLocationAccessible(loc.name, currentUser, locations));
      if (!location) return filteredPool;
      const current = locations.find(loc => normalize(loc.name) === normalize(location));
      if (
        current &&
        current.isActive === false &&
        !filteredPool.some(loc => normalize(loc.id) === normalize(current.id))
      ) {
        return [current, ...filteredPool];
      }
      return filteredPool;
    }, [locationPool, locations, location, currentUser]);
  const sellableDamageLocations = useMemo(
    () => activeLocations.filter((row) => normalize(row.name) !== normalize(location)),
    [activeLocations, location],
  );
  const preferredDamageSellableLocation = useMemo(() => {
    const exact = sellableDamageLocations.find(
      (row) => normalize(row.name) === normalize(DEFAULT_DAMAGE_SELLABLE_LOCATION),
    );
    if (exact) return exact.name;
    const keyword = sellableDamageLocations.find((row) => normalize(row.name).includes('damage'));
    if (keyword) return keyword.name;
    return sellableDamageLocations[0]?.name || '';
  }, [sellableDamageLocations]);

  useEffect(() => {
    let isMounted = true;
    const loadAdjustment = async () => {
      await bootstrapStockAdjustmentsFromDB().catch(() => {});
      if (!isMounted) return;

      const editId = String(editAdjustmentId || '').trim();
      setIsEditMode(!!editId);
      if (!editId) {
        setEditingAdjustmentId(null);
        setEditingStatus('Pending');
        setDate(getNowLocalDateTime());
        setReferenceNo('');
        setLocation('');
        setAdjustmentType('Normal');
        setDamageDisposition('Unsellable');
        setDamageSellableLocation('');
        setReason('');
        setTotalRecovered('0');
        setRows([]);
        if (!canAdd) {
          addNotification({
            title: 'Access Denied',
            message: 'You do not have permission to add stock adjustments.',
            type: 'error',
          });
          onNavigate?.('list-stock-adjustments');
        }
        return;
      }
      if (!canEdit) {
        addNotification({
          title: 'Access Denied',
          message: 'You do not have permission to edit stock adjustments.',
          type: 'error',
        });
        onNavigate?.('list-stock-adjustments');
        return;
      }
      const existing = readStockAdjustments().find((row) => row.id === editId);
      if (!existing) {
        if (!canAdd) {
          addNotification({
            title: 'Adjustment Not Found',
            message: 'The stock adjustment you tried to edit no longer exists.',
            type: 'error',
          });
          onNavigate?.('list-stock-adjustments');
        }
        return;
      }
      if (!isAdjustmentOwnerMatch(existing, ownerIdFilter, ownerNameFilter)) {
        addNotification({
          title: 'Access Denied',
          message: 'You can edit only your own stock adjustments.',
          type: 'error',
        });
        onNavigate?.('list-stock-adjustments');
        return;
      }
      const status = normalizeStockAdjustmentStatus(existing.status);
      if (status === 'Approved') {
        addNotification({
          title: 'Action Blocked',
          message: 'Approved stock adjustments cannot be edited. Create a new adjustment or delete this one with permission.',
          type: 'error',
        });
        onNavigate?.('list-stock-adjustments');
        return;
      }
      setEditingAdjustmentId(existing.id);
      setEditingStatus(status);
      setDate(toDateTimeInput(existing.date));
      setReferenceNo(existing.referenceNo || '');
      setLocation(existing.location || '');
      setAdjustmentType(existing.adjustmentType);
      setDamageDisposition(normalizeStockAdjustmentDamageDisposition(existing.damageDisposition));
      setDamageSellableLocation(String(existing.damageSellableLocation || ''));
      setReason(existing.reason || '');
      setTotalRecovered(String(existing.totalRecovered ?? 0));
      setRows(
        (existing.items || []).map((item) => ({
          productId: String(item.productId || ''),
          productName: String(item.productName || ''),
          sku: String(item.sku || ''),
          unit: item.unit || '',
          quantity: round3(Number(item.quantity || 0)),
          unitCost: round3(Number(item.unitCost || 0)),
          currentStockBefore: round3(Number(item.currentStockBefore || 0)),
        })),
      );
    };
    loadAdjustment();
    return () => {
      isMounted = false;
    };
  }, [editAdjustmentId, canAdd, canEdit, addNotification, onNavigate, ownerIdFilter, ownerNameFilter]);

  useEffect(() => {
    if (permissionRedirectedRef.current) return;
    if (isEditMode) {
      if (canEdit) return;
      permissionRedirectedRef.current = true;
      addNotification({
        title: 'Access Denied',
        message: 'Your role no longer allows editing stock adjustments.',
        type: 'error',
      });
      onNavigate?.('list-stock-adjustments');
      return;
    }
    if (!canAdd) {
      permissionRedirectedRef.current = true;
      addNotification({
        title: 'Access Denied',
        message: 'Your role no longer allows adding stock adjustments.',
        type: 'error',
      });
      onNavigate?.('list-stock-adjustments');
    }
  }, [isEditMode, canAdd, canEdit, addNotification, onNavigate]);

  useEffect(() => {
    if (adjustmentType !== 'Damage') return;
    if (damageDisposition !== 'Sellable') return;
    const selectedIsValid = sellableDamageLocations.some(
      (row) => normalize(row.name) === normalize(damageSellableLocation),
    );
    if (selectedIsValid) return;
    if (preferredDamageSellableLocation) {
      setDamageSellableLocation(preferredDamageSellableLocation);
    }
  }, [
    adjustmentType,
    damageDisposition,
    damageSellableLocation,
    sellableDamageLocations,
    preferredDamageSellableLocation,
  ]);

  const locationProducts = useMemo(
    () => products.filter((p) => !location || normalize(p.businessLocation) === normalize(location)),
    [products, location],
  );

  const filteredProducts = useMemo(() => {
    const q = normalize(productSearch);
    if (!q) return locationProducts.slice(0, 20);
    return locationProducts
      .filter((product) => String(product.type || '').trim().toLowerCase() !== 'combo' && (normalize(product.name).includes(q) || normalize(product.sku).includes(q)))
      .slice(0, 20);
  }, [locationProducts, productSearch]);

  const totals = useMemo(() => {
    const totalAmount = rows.reduce((sum, row) => {
      const qty = Math.abs(Number(row.quantity) || 0);
      const unitCost = Number(row.unitCost) || 0;
      return sum + (qty * unitCost);
    }, 0);
    return {
      totalAmount: round3(totalAmount),
      totalItems: rows.length,
    };
  }, [rows]);

  const handleAddProduct = (product: Product) => {
    setRows((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit || '',
          quantity: 0,
          unitCost: round3(Number(product.unitPurchasePrice || 0)),
          currentStockBefore: getAvailableStock(product.id, location),
        },
      ];
    });
    setProductSearch('');
  };

  const handleRemoveProduct = (productId: string) => {
    setRows((prev) => prev.filter((row) => row.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, value: string) => {
    const parsed = round3(Number(value));
    setRows((prev) => prev.map((row) => (
      row.productId === productId
        ? { ...row, quantity: Number.isFinite(parsed) ? parsed : 0 }
        : row
    )));
  };

  const handleUpdateUnitCost = (productId: string, value: string) => {
    const parsed = round3(Number(value));
    setRows((prev) => prev.map((row) => (
      row.productId === productId
        ? { ...row, unitCost: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }
        : row
    )));
  };

  const handleAdjustmentTypeChange = (nextType: StockAdjustmentType) => {
    setAdjustmentType(nextType);
    if (nextType !== 'Damage') {
      setDamageDisposition('Unsellable');
      setDamageSellableLocation('');
      return;
    }
    if (damageDisposition !== 'Sellable') return;
    if (preferredDamageSellableLocation) {
      setDamageSellableLocation(preferredDamageSellableLocation);
    }
  };

  const handleLocationChange = (nextLocation: string) => {
    const nextNormalized = normalize(nextLocation);
    const currentNormalized = normalize(location);
    if (nextNormalized === currentNormalized) {
      setLocation(nextLocation);
      return;
    }

    const remappedRows = rows
      .map((row) => {
        const exact = products.find(
          (product) =>
            product.id === row.productId &&
            normalize(product.businessLocation) === nextNormalized,
        );
        if (exact) {
          return {
            ...row,
            productName: exact.name,
            sku: exact.sku,
            unit: exact.unit || row.unit,
            currentStockBefore: getAvailableStock(exact.id, nextLocation),
          };
        }
        const bySku = products.find(
          (product) =>
            normalize(product.sku) === normalize(row.sku) &&
            normalize(product.businessLocation) === nextNormalized,
        );
        if (!bySku) return null;
        return {
          ...row,
          productId: bySku.id,
          productName: bySku.name,
          sku: bySku.sku,
          unit: bySku.unit || row.unit,
          currentStockBefore: getAvailableStock(bySku.id, nextLocation),
        };
      })
      .filter((row): row is StockAdjustmentItem => !!row);

    if (rows.length > 0 && remappedRows.length !== rows.length) {
      addNotification({
        title: 'Location changed',
        message: 'Products from the previous location were removed. Re-add products for the selected location.',
        type: 'warning',
      });
    }

    setLocation(nextLocation);
    setRows(remappedRows);
    setProductSearch('');
  };

  const handleCancel = () => {
    onNavigate?.('list-stock-adjustments');
  };

  const handleSave = async () => {
    const editContextId = editingAdjustmentId;
    if (editContextId && !canEdit) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to edit stock adjustments.',
        type: 'error',
      });
      return;
    }
    if (!editContextId && !canAdd) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to add stock adjustments.',
        type: 'error',
      });
      return;
    }

    if (!location) {
      addNotification({ title: 'Validation Error', message: 'Select a business location.', type: 'error' });
      return;
    }
    const selectedLocationRecord = locationPool.find(row => normalize(row.name) === normalize(location));
    if (!selectedLocationRecord) {
      addNotification({ title: 'Validation Error', message: 'Selected business location does not exist.', type: 'error' });
      return;
    }
    if (!isAdminUser && selectedLocationRecord.isActive === false) {
      addNotification({ title: 'Validation Error', message: 'Selected business location is inactive.', type: 'error' });
      return;
    }

    const cleanRows = rows
      .map((row) => {
        const latestProduct = products.find((p) => p.id === row.productId);
        return {
          ...row,
          quantity: round3(Number(row.quantity || 0)),
          unitCost: round3(Number(row.unitCost || 0)),
          currentStockBefore: latestProduct ? getAvailableStock(latestProduct.id, location) : row.currentStockBefore,
        };
      })
      .filter((row) => row.productId && row.quantity !== 0);

    if (cleanRows.length === 0) {
      addNotification({ title: 'Validation Error', message: 'Add at least one product with a non-zero adjustment quantity.', type: 'error' });
      return;
    }

    const locationNormalized = normalize(location);
    const resolvedRows = cleanRows
      .map((row) => {
        const exact = products.find(
          (product) =>
            product.id === row.productId &&
            normalize(product.businessLocation) === locationNormalized,
        );
        if (exact) {
          return {
            ...row,
            productName: exact.name,
            sku: exact.sku,
            unit: exact.unit || row.unit,
            currentStockBefore: getAvailableStock(exact.id, location),
          };
        }
        const bySku = products.find(
          (product) =>
            normalize(product.sku) === normalize(row.sku) &&
            normalize(product.businessLocation) === locationNormalized,
        );
        if (!bySku) return null;
        return {
          ...row,
          productId: bySku.id,
          productName: bySku.name,
          sku: bySku.sku,
          unit: bySku.unit || row.unit,
          currentStockBefore: getAvailableStock(bySku.id, location),
        };
      })
      .filter((row): row is StockAdjustmentItem => !!row);

    const negativeStockRows = resolvedRows.filter(
      (row) => row.quantity < 0 && row.currentStockBefore + row.quantity < 0,
    );
    if (negativeStockRows.length > 0) {
      addNotification({
        title: 'Insufficient Stock',
        message: `Cannot reduce stock below zero. Check quantities for: ${negativeStockRows.map((r) => r.productName || r.sku).join(', ')}`,
        type: 'error',
      });
      return;
    }

    if (resolvedRows.length !== cleanRows.length) {
      addNotification({
        title: 'Validation Error',
        message: 'Some selected products no longer exist in the chosen location. Re-select products and try again.',
        type: 'error',
      });
      return;
    }
    if (adjustmentType === 'Damage' && !reason.trim()) {
      addNotification({
        title: 'Validation Error',
        message: 'Reason is required for damage adjustments.',
        type: 'error',
      });
      return;
    }
    if (adjustmentType === 'Damage') {
      const invalidDamageQty = resolvedRows.some((row) => Number(row.quantity || 0) >= 0);
      if (invalidDamageQty) {
        addNotification({
          title: 'Validation Error',
          message: 'Damage quantities must be negative (stock-out values).',
          type: 'error',
        });
        return;
      }
      if (damageDisposition === 'Sellable') {
        if (!damageSellableLocation) {
          addNotification({
            title: 'Validation Error',
            message: 'Select the sellable damage location.',
            type: 'error',
          });
          return;
        }
        if (normalize(damageSellableLocation) === normalize(location)) {
          addNotification({
            title: 'Validation Error',
            message: 'Sellable damage location must be different from the source location.',
            type: 'error',
          });
          return;
        }
        const destination = activeLocations.find(
          (row) => normalize(row.name) === normalize(damageSellableLocation),
        );
        if (!destination) {
          addNotification({
            title: 'Validation Error',
            message: 'Selected sellable damage location is inactive or does not exist.',
            type: 'error',
          });
          return;
        }
      }
    }

    await bootstrapStockAdjustmentsFromDB().catch(() => {});
    const allAdjustments = readStockAdjustments();
    const editingRecord = editContextId
      ? allAdjustments.find((row) => row.id === editContextId)
      : undefined;
    if (editContextId && !editingRecord) {
      setEditingAdjustmentId(null);
      addNotification({
        title: 'Adjustment Not Found',
        message: 'The stock adjustment you tried to edit no longer exists.',
        type: 'error',
      });
      if (!canAdd) {
        onNavigate?.('list-stock-adjustments');
      }
      return;
    }
    if (editingRecord && !isAdjustmentOwnerMatch(editingRecord, ownerIdFilter, ownerNameFilter)) {
      addNotification({
        title: 'Access Denied',
        message: 'You can edit only your own stock adjustments.',
        type: 'error',
      });
      onNavigate?.('list-stock-adjustments');
      return;
    }
    if (editingRecord && normalizeStockAdjustmentStatus(editingRecord.status) !== 'Pending') {
      addNotification({
        title: 'Action Blocked',
        message: 'Approved stock adjustments cannot be edited.',
        type: 'error',
      });
      onNavigate?.('list-stock-adjustments');
      return;
    }
    const resolvedRef = String(referenceNo || '').trim()
      || makeNextStockAdjustmentRef(settings.stockAdjustmentPrefix || 'SA', allAdjustments);
    const duplicateRef = allAdjustments.find((row) =>
      row.id !== editContextId &&
      normalize(row.referenceNo) === normalize(resolvedRef),
    );
    if (duplicateRef) {
      addNotification({ title: 'Validation Error', message: `Reference "${resolvedRef}" already exists.`, type: 'error' });
      return;
    }

    const recovered = round3(Number(totalRecovered || 0));
    if (!Number.isFinite(recovered) || recovered < 0) {
      addNotification({ title: 'Validation Error', message: 'Total recovered must be a valid non-negative number.', type: 'error' });
      return;
    }
    if (recovered > totals.totalAmount) {
      addNotification({ title: 'Validation Error', message: 'Total recovered cannot exceed total amount.', type: 'error' });
      return;
    }

    const nowIso = new Date().toISOString();
    const nextRecord: StockAdjustmentRecord = {
      id: editingRecord?.id || generateId('SA'),
      date: toIso(date),
      referenceNo: resolvedRef,
      location,
      adjustmentType,
      status: 'Pending',
      damageDisposition: adjustmentType === 'Damage' ? damageDisposition : undefined,
      damageSellableLocation: adjustmentType === 'Damage' && damageDisposition === 'Sellable'
        ? damageSellableLocation
        : '',
      reason: reason.trim(),
      totalAmount: totals.totalAmount,
      totalRecovered: recovered,
      items: resolvedRows,
      addedById: editingRecord ? (editingRecord.addedById || '') : (currentUser?.id || ''),
      addedBy: editingRecord?.addedBy || currentUser?.name || 'System',
      approvedById: '',
      approvedBy: '',
      approvedAt: '',
      linkedTransferId: '',
      linkedExpenseId: '',
      createdAt: editingRecord?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      const mergedAdjustments = editingRecord
        ? allAdjustments.map((row) => (row.id === editingRecord.id ? nextRecord : row))
        : [nextRecord, ...allAdjustments];
      const saved = await writeStockAdjustments(
        mergedAdjustments.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
        nextRecord.id,
      );
      if (!saved) {
        throw new Error('Unable to save stock adjustment in Postgres.');
      }

      addNotification({
        title: editingRecord ? 'Pending Adjustment Updated' : 'Pending Adjustment Saved',
        message: `${nextRecord.referenceNo} has been ${editingRecord ? 'updated' : 'created'} as pending. ${
          nextRecord.adjustmentType === 'Damage' && nextRecord.damageDisposition === 'Sellable'
            ? 'Approval will transfer stock to sellable-damage location.'
            : 'Stock updates will apply after approval.'
        }`,
        type: 'success',
      });
      await addActivityLog({
        action: editingRecord ? 'Updated' : 'Created',
        module: 'Stock Adjustments',
        description: `${nextRecord.referenceNo} ${editingRecord ? 'updated' : 'created'} as pending`,
      });
      onNavigate?.('list-stock-adjustments');
    } catch (error) {
      addNotification({
        title: 'Unable to Save Adjustment',
        message: error instanceof Error ? error.message : 'Unexpected error while applying stock adjustment.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCancel}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="p-2.5 bg-rose-600 rounded-2xl shadow-md">
          <SlidersHorizontal size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {editingAdjustmentId ? 'Edit Stock Adjustment' : 'Add Stock Adjustment'}
          </h2>
          <p className="text-slate-500 mt-0.5 text-sm">
            {editingAdjustmentId
              ? `Edit pending adjustment (${editingStatus}) before approval`
              : 'Adjust stock quantities up or down for a location'}
          </p>
        </div>
      </div>

      {/* Adjustment Info Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Info size={18} className="text-blue-500" /> Adjustment Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="datetime-local"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reference No</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder={`Auto if blank (prefix: ${settings.stockAdjustmentPrefix || 'SA'})`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
              Adjustment Type * <Info size={12} className="text-rose-500" />
            </label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={adjustmentType}
                onChange={(e) => handleAdjustmentTypeChange(e.target.value as StockAdjustmentType)}
              >
                {TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location *</label>
            <div className="relative">
              <select
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
              >
                <option value="">Please Select</option>
                {selectableLocations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Total Amount Recovered</label>
            <input
              type="number"
              min="0"
              step="0.001"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              value={totalRecovered}
              onChange={(e) => setTotalRecovered(e.target.value)}
            />
          </div>
        </div>
        {adjustmentType === 'Damage' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Damage Bucket *</label>
              <div className="relative">
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  value={damageDisposition}
                  onChange={(e) => setDamageDisposition(e.target.value as StockAdjustmentDamageDisposition)}
                >
                  {DAMAGE_DISPOSITION_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Sellable damage transfers to a dedicated location. Unsellable damage is written off as loss.
              </p>
            </div>
            {damageDisposition === 'Sellable' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sellable Damage Location *</label>
                <div className="relative">
                  <select
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                    value={damageSellableLocation}
                    onChange={(e) => setDamageSellableLocation(e.target.value)}
                  >
                    <option value="">Please Select</option>
                    {sellableDamageLocations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Recommended location name: {DEFAULT_DAMAGE_SELLABLE_LOCATION}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Products Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <SlidersHorizontal size={18} className="text-rose-500" /> Adjustment Items
        </h3>

        <div className="relative w-full mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            placeholder={location ? 'Search products by name / SKU' : 'Select "Business Location" first'}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            disabled={!location}
          />
          {location && productSearch.trim() && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAddProduct(product)}
                  className="w-full text-left px-4 py-2.5 hover:bg-rose-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="text-sm font-bold text-slate-800">{product.name}</div>
                  <div className="text-[11px] text-slate-500">
                    SKU: {product.sku} | Stock: {Number(product.stock || 0).toFixed(3)} {product.unit}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-center">Adjustment Qty</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-center w-16"><Trash2 size={14} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.productId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.productName}</div>
                      <div className="text-[11px] text-slate-500">SKU: {row.sku} {row.unit ? `| ${row.unit}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{Number(row.currentStockBefore || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-right focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.unitCost || 0}
                        onChange={(e) => handleUpdateUnitCost(row.productId, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="0.001"
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                        value={row.quantity || 0}
                        onChange={(e) => handleUpdateQuantity(row.productId, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {formatCurrency(Math.abs((Number(row.unitCost) || 0) * (Number(row.quantity) || 0)))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleRemoveProduct(row.productId)} className="text-rose-500 hover:text-rose-700 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                    No products selected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-6">
          Use negative quantity to reduce stock and positive quantity to increase stock. Changes are saved as pending and apply to stock only after approval.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reason</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex flex-col justify-end items-end text-sm gap-1">
            <div><span className="text-slate-500">Total Items:</span> <span className="font-bold text-slate-800 ml-2">{totals.totalItems}</span></div>
            <div><span className="text-slate-500">Total Amount:</span> <span className="font-black text-rose-700 ml-2">{formatCurrency(totals.totalAmount)}</span></div>
            <div><span className="text-slate-500">Recovered:</span> <span className="font-bold text-slate-800 ml-2">{formatCurrency(Number(totalRecovered || 0))}</span></div>
          </div>
        </div>
      </div>

      {/* Actions Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition active:scale-95"
          >
            <X size={14} /> Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
          >
            <Save size={14} /> {editingAdjustmentId ? 'Update Pending Adjustment' : 'Save as Pending'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStockAdjustment;
