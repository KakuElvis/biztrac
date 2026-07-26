import { useMemo, useState, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Camera,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
  History,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";
import { showToast } from "../../lib/toast.js";

export function Inventory({
  canManageCategories,
  canDeleteProducts,
  categories = [],
  onCreateProduct,
  onCreateCategory,
  onDeleteProduct,
  onUpdateProduct,
  onRestockProduct,
  onFetchProductRestocks,
  products = [],
  productsError,
  productsLoading,
  page = 1,
  pageSize = 50,
  totalCount = products.length,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
}) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockingProduct, setRestockingProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingProductId, setPendingProductId] = useState(null);
  const [isQuickRestockPickerOpen, setIsQuickRestockPickerOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory !== "all") {
      result = result.filter((product) => product.category === selectedCategory);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          (product.sku && product.sku.toLowerCase().includes(q)) ||
          (product.brand && product.brand.toLowerCase().includes(q))
      );
    }

    return result;
  }, [products, selectedCategory, search]);

  const stockStats = useMemo(() => {
    const lowStock = products.filter((product) => product.quantity <= product.lowStockLimit);
    const totalValue = products.reduce(
      (total, product) => total + product.costPrice * product.quantity,
      0
    );
    const totalRetailValue = products.reduce(
      (total, product) => total + product.sellingPrice * product.quantity,
      0
    );

    return {
      totalProducts: totalCount ?? products.length,
      lowStockCount: lowStock.length,
      totalValue,
      totalRetailValue,
    };
  }, [products, totalCount]);

  async function adjustStock(product, delta) {
    const nextQuantity = product.quantity + delta;

    if (nextQuantity < 0) {
      showToast(`Cannot reduce ${product.name} below zero stock.`, { type: "warn" });
      return;
    }

    setPendingProductId(product.id);

    try {
      await onUpdateProduct(product.id, {
        ...product,
        quantity: nextQuantity,
      });
      showToast(
        `${product.name} stock ${delta > 0 ? "increased" : "reduced"} to ${nextQuantity} pcs.`,
        { type: "success" }
      );
    } catch (error) {
      console.error("Unable to adjust stock", error);
      showToast(error?.message || "Unable to adjust stock.", { type: "warn" });
    } finally {
      setPendingProductId(null);
    }
  }

  async function removeProduct(product) {
    const confirmed = window.confirm(`Are you sure you want to delete ${product.name}?`);
    if (!confirmed) return;

    setPendingProductId(product.id);

    try {
      await onDeleteProduct(product.id);
      showToast(`${product.name} deleted.`, { type: "success" });
    } catch (error) {
      console.error("Unable to delete product", error);
      showToast(error?.message || "Unable to delete product.", { type: "warn" });
    } finally {
      setPendingProductId(null);
    }
  }

  async function handleAddCategorySubmit(event) {
    event.preventDefault();
    setCategoryError("");

    try {
      setIsCreatingCategory(true);
      await onCreateCategory(newCategoryName);
      setNewCategoryName("");
      setIsCategoryModalOpen(false);
      showToast("New category created.", { type: "success" });
    } catch (error) {
      setCategoryError(error.message || "Unable to create category.");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Stock & Inventory</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Products</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={PackagePlus}
            variant="secondary"
            onClick={() => setIsQuickRestockPickerOpen(true)}
          >
            Restock Stock
          </Button>
          {canManageCategories && (
            <Button
              icon={Tags}
              variant="secondary"
              onClick={() => setIsCategoryModalOpen(true)}
            >
              Add Category
            </Button>
          )}
          <Button icon={Plus} onClick={() => setIsCreatingProduct(true)}>
            Add Product
          </Button>
        </div>
      </section>

      {productsError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {productsError}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total catalog" value={stockStats.totalProducts} note="Active SKUs" />
        <StatCard
          label="Low stock items"
          value={stockStats.lowStockCount}
          note="At or below limit"
          highlight={stockStats.lowStockCount > 0}
        />
        <StatCard
          label="Cost stock value"
          value={formatCurrency(stockStats.totalValue)}
          note="Purchase cost total"
        />
        <StatCard
          label="Retail stock value"
          value={formatCurrency(stockStats.totalRetailValue)}
          note="Potential revenue"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-semibold text-ink placeholder-slate-400 focus:border-palm focus:bg-white focus:outline-none"
            placeholder="Search by name, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            className={`rounded-2xl px-3 py-2 text-xs font-bold transition shrink-0 ${
              selectedCategory === "all"
                ? "bg-palm text-white shadow-soft"
                : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
            onClick={() => setSelectedCategory("all")}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat.name).length;
            return (
              <button
                key={cat.id || cat.name}
                className={`rounded-2xl px-3 py-2 text-xs font-bold transition shrink-0 ${
                  selectedCategory === cat.name
                    ? "bg-palm text-white shadow-soft"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {productsLoading ? (
        <LoadingInventory />
      ) : filteredProducts.length === 0 ? (
        <EmptyInventory
          hasProducts={products.length > 0}
          onCreate={() => setIsCreatingProduct(true)}
        />
      ) : (
        <div className="space-y-4">
          <VirtualizedProductGrid
            canDeleteProducts={canDeleteProducts}
            pendingProductId={pendingProductId}
            products={filteredProducts}
            adjustStock={adjustStock}
            removeProduct={removeProduct}
            openEditForm={(p) => setEditingProduct(p)}
            openRestockModal={(p) => setRestockingProduct(p)}
            openHistoryModal={(p) => setHistoryProduct(p)}
          />

          <PaginationBar
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}

      {/* Product Create/Edit Form Modal */}
      {(isCreatingProduct || editingProduct) && (
        <ProductForm
          categories={categories}
          product={editingProduct}
          onClose={() => {
            setIsCreatingProduct(false);
            setEditingProduct(null);
          }}
          onCreate={onCreateProduct}
          onUpdate={onUpdateProduct}
        />
      )}

      {/* Restock Product Modal */}
      {restockingProduct && (
        <RestockModal
          product={restockingProduct}
          onClose={() => setRestockingProduct(null)}
          onRestock={onRestockProduct}
        />
      )}

      {/* Quick Restock Product Picker Modal */}
      {isQuickRestockPickerOpen && (
        <QuickRestockPickerModal
          products={products}
          onClose={() => setIsQuickRestockPickerOpen(false)}
          onSelectProduct={(product) => {
            setIsQuickRestockPickerOpen(false);
            setRestockingProduct(product);
          }}
        />
      )}

      {/* Restock Batch History Modal */}
      {historyProduct && (
        <RestockHistoryModal
          product={historyProduct}
          onClose={() => setHistoryProduct(null)}
          onFetchRestocks={onFetchProductRestocks}
        />
      )}

      {/* Category Creation Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            onSubmit={handleAddCategorySubmit}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-palm">Categories</p>
                <h3 className="text-xl font-black text-ink">New Category</h3>
              </div>
              <button
                type="button"
                className="icon-button h-8 w-8"
                onClick={() => setIsCategoryModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Category Name</label>
              <input
                className="field mt-1"
                placeholder="e.g. Footwear, Fabrics, Accessories"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {categoryError && <p className="text-xs font-bold text-red-600">{categoryError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-palm py-3 text-sm font-black text-white shadow-soft hover:bg-palm/90"
                disabled={isCreatingCategory}
              >
                {isCreatingCategory ? "Saving…" : "Save Category"}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
                onClick={() => setIsCategoryModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, note, highlight }) {
  return (
    <div
      className={`rounded-3xl border p-4 shadow-sm transition ${
        highlight
          ? "border-amber-200 bg-amber-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-black ${highlight ? "text-amber-800" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{note}</p>
    </div>
  );
}

function ProductCard({
  canDelete,
  isPending,
  onAdjust,
  onDelete,
  onEdit,
  onOpenRestock,
  onOpenHistory,
  product,
}) {
  const isLow = product.quantity <= product.lowStockLimit;

  return (
    <article className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-palm/30 hover:shadow-soft">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-palm">
              {product.category || "General"}
            </span>
            <h3 className="truncate text-base font-black text-ink">{product.name}</h3>
            {product.sku && (
              <p className="text-xs font-semibold text-slate-400">SKU: {product.sku}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="icon-button h-8 w-8 text-slate-400 hover:text-palm"
              onClick={() => onEdit(product)}
              title="Edit product info"
              aria-label={`Edit ${product.name}`}
            >
              <Edit3 className="h-4 w-4" />
            </button>
            {canDelete && (
              <button
                className="icon-button h-8 w-8 text-slate-400 hover:text-red-600"
                onClick={() => onDelete(product)}
                title="Delete product"
                aria-label={`Delete ${product.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Badge variant={isLow ? "amber" : "green"}>{product.quantity} pcs</Badge>
          <span className="text-xs font-black text-palm">{formatCurrency(product.sellingPrice)}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Info label="Cost Price" value={formatCurrency(product.costPrice)} />
          <Info label="Selling Price" value={formatCurrency(product.sellingPrice)} />
          <Info label="Supplier" value={product.supplier || "-"} />
          <Info label="Brand / Type" value={product.brand || product.itemType || "-"} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 p-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex items-center gap-1 rounded-xl bg-palm px-3 py-1.5 text-xs font-bold text-white shadow-soft transition hover:bg-palm/90"
            onClick={() => onOpenRestock(product)}
          >
            <PackagePlus className="h-3.5 w-3.5" />
            <span>Restock</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
            onClick={() => onOpenHistory(product)}
            title="View Restock Batch History"
          >
            <History className="h-3.5 w-3.5 text-palm" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="icon-button h-8 w-8 text-slate-500 hover:text-slate-700"
            disabled={isPending || product.quantity === 0}
            onClick={() => onAdjust(product, -1)}
            title="Quick reduce 1 pc"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            className="icon-button h-8 w-8 text-slate-500 hover:text-slate-700"
            disabled={isPending}
            onClick={() => onAdjust(product, 1)}
            title="Quick add 1 pc"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="font-semibold text-slate-400">{label}</p>
      <p className="mt-1 truncate font-black text-slate-700">{value}</p>
    </div>
  );
}

function QuickRestockPickerModal({ products, onClose, onSelectProduct }) {
  const [pickerSearch, setPickerSearch] = useState("");

  const filtered = useMemo(() => {
    if (!pickerSearch.trim()) return products;
    const q = pickerSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, pickerSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-palm">Quick Restock</p>
            <h3 className="text-xl font-black text-ink">Select Product to Restock</h3>
          </div>
          <button type="button" className="icon-button h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-bold text-ink placeholder-slate-400 focus:border-palm focus:bg-white focus:outline-none"
            placeholder="Search product to restock…"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            autoFocus
          />
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs font-bold text-slate-400">No matching products found.</p>
          ) : (
            filtered.map((product) => {
              const isLow = product.quantity <= product.lowStockLimit;
              return (
                <button
                  key={product.id}
                  type="button"
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-skyglass transition"
                  onClick={() => onSelectProduct(product)}
                >
                  <div>
                    <p className="text-xs font-black text-ink">{product.name}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {product.category || "General"} • {formatCurrency(product.sellingPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isLow ? "amber" : "green"}>{product.quantity} pcs</Badge>
                    <span className="rounded-xl bg-palm px-2.5 py-1 text-xs font-bold text-white shadow-soft">
                      Restock
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RestockModal({ product, onClose, onRestock }) {
  const [quantityAdded, setQuantityAdded] = useState("10");
  const [newCostPrice, setNewCostPrice] = useState(String(product.costPrice || 0));
  const [newSellingPrice, setNewSellingPrice] = useState(String(product.sellingPrice || 0));
  const [supplierName, setSupplierName] = useState(product.supplier || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addedNum = Number(quantityAdded) || 0;
  const costNum = Number(newCostPrice) || 0;
  const sellingNum = Number(newSellingPrice) || 0;

  const newTotalQuantity = product.quantity + addedNum;
  const costDiff = costNum - product.costPrice;
  const sellingDiff = sellingNum - product.sellingPrice;
  const unitProfitMargin = sellingNum - costNum;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!addedNum || addedNum <= 0) {
      setError("Quantity added must be a whole number greater than zero.");
      return;
    }

    if (costNum < 0 || sellingNum < 0) {
      setError("Prices cannot be negative.");
      return;
    }

    try {
      setSubmitting(true);
      if (onRestock) {
        await onRestock(product.id, {
          quantityAdded: addedNum,
          newCostPrice: costNum,
          newSellingPrice: sellingNum,
          supplierName: supplierName.trim(),
          notes: notes.trim(),
        });
      }
      showToast(`Restocked +${addedNum} pcs of ${product.name}.`, { type: "success" });
      onClose();
    } catch (err) {
      console.error("Restock failed", err);
      setError(err?.message || "Unable to complete product restock.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
      <form
        className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl my-8"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-palm">Stock Arrival</p>
            <h3 className="text-xl font-black text-ink">Restock {product.name}</h3>
          </div>
          <button type="button" className="icon-button h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Calculation Preview Banner */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Batch Preview Calculation</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-white p-2 rounded-xl border border-sky-100">
              <span className="text-slate-500 block text-[10px] font-bold">New Qty</span>
              <span className="text-sm font-black text-ink">{newTotalQuantity} pcs</span>
              <span className="text-[10px] text-palm font-bold block">(+{addedNum})</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-sky-100">
              <span className="text-slate-500 block text-[10px] font-bold">Cost Price</span>
              <span className="text-sm font-black text-ink">{formatCurrency(costNum)}</span>
              {costDiff !== 0 ? (
                <span className={`text-[10px] font-bold block ${costDiff > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {costDiff > 0 ? `+${formatCurrency(costDiff)}` : formatCurrency(costDiff)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block">Unchanged</span>
              )}
            </div>
            <div className="bg-white p-2 rounded-xl border border-sky-100">
              <span className="text-slate-500 block text-[10px] font-bold">Selling Price</span>
              <span className="text-sm font-black text-ink">{formatCurrency(sellingNum)}</span>
              {sellingDiff !== 0 ? (
                <span className={`text-[10px] font-bold block ${sellingDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {sellingDiff > 0 ? `+${formatCurrency(sellingDiff)}` : formatCurrency(sellingDiff)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block">Unchanged</span>
              )}
            </div>
            <div className="bg-white p-2 rounded-xl border border-sky-100">
              <span className="text-slate-500 block text-[10px] font-bold">Unit Margin</span>
              <span className="text-sm font-black text-emerald-700">{formatCurrency(unitProfitMargin)}</span>
              <span className="text-[10px] text-slate-500 block font-bold">
                {sellingNum > 0 ? `${((unitProfitMargin / sellingNum) * 100).toFixed(1)}%` : "0%"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-500">New Quantity Added (pcs)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="field mt-1 text-base font-black text-ink"
              value={quantityAdded}
              onChange={(e) => setQuantityAdded(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Supplier Name / Source</label>
            <input
              type="text"
              className="field mt-1"
              placeholder="e.g. Makola Wholesalers"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold text-slate-500">New Unit Cost Price (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field mt-1 font-bold text-ink"
              value={newCostPrice}
              onChange={(e) => setNewCostPrice(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">New Unit Selling Price (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field mt-1 font-bold text-ink"
              value={newSellingPrice}
              onChange={(e) => setNewSellingPrice(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500">Batch Notes / Waybill Ref</label>
          <input
            type="text"
            className="field mt-1"
            placeholder="Optional invoice # or batch notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-2xl bg-palm py-3 text-sm font-black text-white shadow-soft transition hover:bg-palm/90"
            disabled={submitting}
          >
            {submitting ? "Confirming Restock…" : "Confirm Restock"}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function RestockHistoryModal({ product, onClose, onFetchRestocks }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (onFetchRestocks) {
      onFetchRestocks(product.id)
        .then((res) => {
          if (isMounted) setLogs(res || []);
        })
        .catch((err) => {
          console.warn("Unable to load restock history", err);
          if (isMounted) setLogs([]);
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [product, onFetchRestocks]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-palm">Batch Restock Ledger</p>
            <h3 className="text-xl font-black text-ink">{product.name}</h3>
          </div>
          <button type="button" className="icon-button h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-palm" />
              Loading batch logs…
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
              No restock logs recorded yet for this product.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden">
              {logs.map((log) => {
                const costDiff = log.newCostPrice - log.oldCostPrice;
                const sellingDiff = log.newSellingPrice - log.oldSellingPrice;

                return (
                  <div key={log.id} className="p-3.5 space-y-1.5 hover:bg-slate-50/50">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-ink font-black">
                        {new Date(log.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                      </span>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-black">
                        +{log.quantityAdded} pcs
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Quantity: {log.previousQuantity} → {log.newQuantity} pcs</span>
                      <span>{log.supplierName ? `Supplier: ${log.supplierName}` : "Direct supplier"}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block font-semibold">Cost Price</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(log.oldCostPrice)} → {formatCurrency(log.newCostPrice)}
                        </span>
                        {costDiff !== 0 && (
                          <span className={`block font-black text-[10px] ${costDiff > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {costDiff > 0 ? `+${formatCurrency(costDiff)}` : formatCurrency(costDiff)}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block font-semibold">Selling Price</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(log.oldSellingPrice)} → {formatCurrency(log.newSellingPrice)}
                        </span>
                        {sellingDiff !== 0 && (
                          <span className={`block font-black text-[10px] ${sellingDiff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {sellingDiff > 0 ? `+${formatCurrency(sellingDiff)}` : formatCurrency(sellingDiff)}
                          </span>
                        )}
                      </div>
                    </div>

                    {log.notes && (
                      <p className="text-[11px] font-medium text-slate-500 italic bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        Note: {log.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingInventory() {
  return (
    <div className="panel grid min-h-56 place-items-center p-6">
      <div className="flex items-center gap-3 text-sm font-bold text-palm">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading inventory
      </div>
    </div>
  );
}

function EmptyInventory({ hasProducts, onCreate }) {
  return (
    <div className="panel grid min-h-56 place-items-center p-6 text-center">
      <div>
        <PackagePlus className="mx-auto h-8 w-8 text-slate-400" />
        <h2 className="mt-3 text-lg font-black text-ink">
          {hasProducts ? "No matching products" : "Your inventory is empty"}
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {hasProducts ? "Try another search or category." : "Add your first product to get started."}
        </p>
        {!hasProducts && (
          <Button className="mt-4" icon={Plus} onClick={onCreate}>
            Add product
          </Button>
        )}
      </div>
    </div>
  );
}

const emptyProduct = {
  name: "",
  category: "",
  sku: "",
  costPrice: 0,
  sellingPrice: 0,
  quantity: 0,
  lowStockLimit: 2,
  supplier: "",
  size: "",
  colour: "",
  brand: "",
  itemType: "",
};

function ProductForm({
  categories,
  product,
  onClose,
  onCreate,
  onUpdate,
}) {
  const [form, setForm] = useState(product ? { ...product } : emptyProduct);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const categoryOptions = useMemo(() => {
    const names = categories.map((category) => category.name);
    if (form.category && !names.includes(form.category)) return [...names, form.category];
    return names;
  }, [categories, form.category]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const nextProduct = {
      ...form,
      name: form.name.trim(),
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      quantity: Number(form.quantity),
      lowStockLimit: Number(form.lowStockLimit),
    };
    const numericValues = [
      nextProduct.costPrice,
      nextProduct.sellingPrice,
      nextProduct.quantity,
      nextProduct.lowStockLimit,
    ];

    if (!nextProduct.name) {
      setError("Product name is required.");
      return;
    }

    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Prices and stock values must be zero or greater.");
      return;
    }

    if (!Number.isInteger(nextProduct.quantity) || !Number.isInteger(nextProduct.lowStockLimit)) {
      setError("Quantity and low stock limit must be whole numbers.");
      return;
    }

    setIsSaving(true);
    try {
      if (product) {
        await onUpdate(product.id, nextProduct);
      } else {
        await onCreate(nextProduct);
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Unable to save this product.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-palm">Catalog</p>
            <h3 className="text-xl font-black text-ink">
              {product ? `Edit ${product.name}` : "New Product"}
            </h3>
          </div>
          <button type="button" className="icon-button h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Product Name" required>
            <input
              className="field mt-1"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Kente Cloth Fabric"
              required
            />
          </FormField>
          <FormField label="Category">
            <select
              className="field mt-1"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              <option value="">Select Category</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Cost Price (GHS)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field mt-1"
              value={form.costPrice}
              onChange={(e) => setField("costPrice", e.target.value)}
              required
            />
          </FormField>
          <FormField label="Selling Price (GHS)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              className="field mt-1"
              value={form.sellingPrice}
              onChange={(e) => setField("sellingPrice", e.target.value)}
              required
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Current Stock Quantity" required>
            <input
              type="number"
              min="0"
              step="1"
              className="field mt-1"
              value={form.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
              required
            />
          </FormField>
          <FormField label="Low Stock Warning Limit" required>
            <input
              type="number"
              min="0"
              step="1"
              className="field mt-1"
              value={form.lowStockLimit}
              onChange={(e) => setField("lowStockLimit", e.target.value)}
              required
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="SKU / Barcode">
            <input
              className="field mt-1"
              value={form.sku}
              onChange={(e) => setField("sku", e.target.value)}
              placeholder="Optional SKU"
            />
          </FormField>
          <FormField label="Supplier">
            <input
              className="field mt-1"
              value={form.supplier}
              onChange={(e) => setField("supplier", e.target.value)}
              placeholder="Supplier name"
            />
          </FormField>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Brand">
            <input
              className="field mt-1"
              value={form.brand}
              onChange={(e) => setField("brand", e.target.value)}
              placeholder="Brand"
            />
          </FormField>
          <FormField label="Size">
            <input
              className="field mt-1"
              value={form.size}
              onChange={(e) => setField("size", e.target.value)}
              placeholder="Size (S, M, L, XL)"
            />
          </FormField>
          <FormField label="Colour">
            <input
              className="field mt-1"
              value={form.colour}
              onChange={(e) => setField("colour", e.target.value)}
              placeholder="Colour"
            />
          </FormField>
        </div>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-2xl bg-palm py-3 text-sm font-black text-white shadow-soft hover:bg-palm/90"
            disabled={isSaving}
          >
            {isSaving ? "Saving Product…" : product ? "Update Product" : "Save Product"}
          </button>
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function VirtualizedProductGrid({
  products,
  canDeleteProducts,
  pendingProductId,
  adjustStock,
  removeProduct,
  openEditForm,
  openRestockModal,
  openHistoryModal,
}) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-y-auto pr-1">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const product = products[virtualRow.index];
          if (!product) return null;
          return (
            <div
              key={product.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-4"
            >
              <ProductCard
                canDelete={canDeleteProducts}
                isPending={pendingProductId === product.id}
                onAdjust={adjustStock}
                onDelete={removeProduct}
                onEdit={openEditForm}
                onOpenRestock={openRestockModal}
                onOpenHistory={openHistoryModal}
                product={product}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaginationBar({
  page = 1,
  pageSize = 50,
  totalCount = 0,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
}) {
  if (!onPageChange) return null;

  const startItem = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-semibold text-slate-500">
        Showing <span className="font-bold text-ink">{startItem}</span> to{" "}
        <span className="font-bold text-ink">{endItem}</span> of{" "}
        <span className="font-bold text-ink">{totalCount}</span> products
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <span>Per page:</span>
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-ink focus:border-palm focus:outline-none"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange?.(Number(e.target.value));
              onPageChange?.(1);
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="icon-button h-8 w-8 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-bold text-ink">
            Page {page} of {totalPages}
          </span>
          <button
            className="icon-button h-8 w-8 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Inventory;
