import React, { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Search, X } from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import ViewProduct from './ViewProduct';
import { Product, useGlobalContext } from '@/context/GlobalContext';

interface ProductViewCatalogProps {
  onNavigate?: (page: string) => void;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const ProductViewCatalog: React.FC<ProductViewCatalogProps> = ({ onNavigate }) => {
  const { products, formatCurrency, settings } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [zoomImage, setZoomImage] = useState<{ src: string; name: string } | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    location: [] as string[],
    category: [] as string[],
    brand: [] as string[],
  });

  const locationOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.businessLocation).filter(Boolean))).sort(),
    [products],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const q = normalize(searchTerm);
    return products.filter((product) => {
      if (q) {
        const hay = [
          product.name,
          product.sku,
          product.category,
          product.brand,
          product.businessLocation,
        ].map(normalize);
        if (!hay.some((value) => value.includes(q))) return false;
      }

      if (filters.location.length > 0 && !filters.location.includes(product.businessLocation)) return false;
      if (filters.category.length > 0 && !filters.category.includes(product.category)) return false;
      if (filters.brand.length > 0 && !filters.brand.includes(product.brand)) return false;
      return true;
    });
  }, [products, searchTerm, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, entriesPerPage]);

  const totalEntries = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const pagedProducts = filteredProducts.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const pageStartEntry = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const pageEndEntry = totalEntries === 0 ? 0 : pageStartIndex + pagedProducts.length;

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const items: Array<number | '...'> = [1];
    const left = Math.max(2, safeCurrentPage - 1);
    const right = Math.min(totalPages - 1, safeCurrentPage + 1);
    if (left > 2) items.push('...');
    for (let page = left; page <= right; page += 1) items.push(page);
    if (right < totalPages - 1) items.push('...');
    items.push(totalPages);
    return items;
  }, [safeCurrentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (selectedProduct) {
    return (
      <ViewProduct
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        onEdit={(product) => onNavigate?.(`edit-product/${product.id}`)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Product View</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Visual product catalog for warehouse and field teams. Click any row to open product details. Click image to zoom.
        </p>
      </div>

      <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by product name, SKU, brand, category, location..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelect
            label="Business Location"
            options={locationOptions}
            selected={filters.location}
            onChange={(value) => setFilters((prev) => ({ ...prev, location: value }))}
          />
          <MultiSelect
            label="Category"
            options={categoryOptions}
            selected={filters.category}
            onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
          />
          <MultiSelect
            label="Brand"
            options={brandOptions}
            selected={filters.brand}
            onChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-[1.25rem] p-8 text-center text-sm text-slate-500">
          No products found for current filters.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[1.25rem] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-3 md:items-center">
            <div className="text-xs text-slate-500 font-semibold">
              Showing {pageStartEntry} to {pageEndEntry} of {totalEntries} entries
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Show</span>
              <select
                value={entriesPerPage}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setEntriesPerPage(Number.isFinite(parsed) && parsed > 0 ? parsed : 25);
                }}
                className="px-2 py-1 border border-slate-300 rounded-md text-slate-700 font-semibold bg-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-500 font-semibold">entries</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">S/N</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Base Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedProducts.map((product, index) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedProduct(product);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open product ${product.name}`}
                  >
                    <td className="px-4 py-3 text-slate-500 font-semibold">{pageStartIndex + index + 1}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (product.image) {
                            setZoomImage({ src: product.image, name: product.name });
                          }
                        }}
                        className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-400 transition"
                        title={product.image ? 'Click to zoom image' : 'No image'}
                      >
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{product.sku || '--'}</td>
                    <td className="px-4 py-3 text-slate-800 font-bold max-w-[240px] truncate" title={product.name}>{product.name}</td>
                    <td className="px-4 py-3 text-slate-600">{product.category || '--'}</td>
                    <td className="px-4 py-3 text-slate-600">{product.brand || '--'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate" title={product.businessLocation}>{product.businessLocation || '--'}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-bold whitespace-nowrap">{formatCurrency(Number(product.sellingPrice || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex justify-end">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              {pageItems.map((item, index) => (
                item === '...'
                  ? <span key={`ellipsis-${index}`} className="px-2 text-xs text-slate-400">...</span>
                  : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`px-3 py-1.5 text-xs font-bold border rounded-md ${
                        item === safeCurrentPage
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  )
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 z-[200] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-[95vw] max-h-[95vh] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-slate-700 transition"
            >
              <X size={14} />
            </button>
            <img
              src={zoomImage.src}
              alt={zoomImage.name}
              className="max-w-[90vw] max-h-[86vh] object-contain rounded-xl"
            />
            <p className="text-xs font-bold text-slate-700 mt-2 text-center">{zoomImage.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductViewCatalog;
