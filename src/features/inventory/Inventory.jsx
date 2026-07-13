import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Camera,
  Edit3,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";

export function Inventory({
  canManageCategories,
  canDeleteProducts,
  categories = [],
  categoriesError,
  categoriesLoading,
  onCreateProduct,
  onCreateCategory,
  onDeleteProduct,
  onUpdateProduct,
  products,
  productsError,
  productsLoading,
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [editingProduct, setEditingProduct] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState(null);
  const [actionError, setActionError] = useState("");

  const categoryFilters = useMemo(
    () => [
      "All",
      ...new Set(
        [
          ...categories.map((category) => category.name),
          ...products.map((product) => product.category),
        ]
          .filter(Boolean)
          .filter((category) => !["All", "Low stock"].includes(category))
      ),
      "Low stock",
    ],
    [categories, products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "All" ||
        (activeCategory === "Low stock"
          ? product.quantity <= product.lowStockLimit
          : product.category === activeCategory);
      const matchesSearch =
        !term ||
        [product.name, product.category, product.supplier, product.sku, product.brand].some(
          (value) => value?.toLowerCase().includes(term)
        );

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, search]);

  function openCreateForm() {
    setEditingProduct(null);
    setIsFormOpen(true);
    setActionError("");
  }

  function openEditForm(product) {
    setEditingProduct(product);
    setIsFormOpen(true);
    setActionError("");
  }

  async function adjustStock(product, direction) {
    const quantity = Math.max(0, product.quantity + direction);
    if (quantity === product.quantity) return;

    setPendingProductId(product.id);
    setActionError("");
    try {
      await onUpdateProduct(product.id, { ...product, quantity });
    } catch (error) {
      setActionError(error.message || "Unable to update stock.");
    } finally {
      setPendingProductId(null);
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete "${product.name}" from inventory?`)) return;

    setPendingProductId(product.id);
    setActionError("");
    try {
      await onDeleteProduct(product.id);
    } catch (error) {
      setActionError(error.message || "Unable to delete this product.");
    } finally {
      setPendingProductId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Inventory</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">Stock room</h1>
        </div>
        <Button icon={Plus} onClick={openCreateForm}>
          Add product
        </Button>
      </section>

      <section className="panel p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, category, supplier"
            value={search}
          />
        </label>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categoryFilters.map((category) => (
            <button
              key={category}
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-bold transition ${
                activeCategory === category
                  ? "border-palm bg-palm text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-palm/40 hover:text-palm"
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <CategoryManager
        canManageCategories={canManageCategories}
        categories={categories}
        categoriesLoading={categoriesLoading}
        onCreateCategory={onCreateCategory}
      />

      {(productsError || categoriesError || actionError) && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{actionError || productsError || categoriesError}</p>
        </div>
      )}

      {productsLoading ? (
        <LoadingInventory />
      ) : filteredProducts.length === 0 ? (
        <EmptyInventory
          hasProducts={products.length > 0}
          onCreate={openCreateForm}
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {filteredProducts.map((product) => (
            <ProductCard
              canDelete={canDeleteProducts}
              isPending={pendingProductId === product.id}
              key={product.id}
              onAdjust={adjustStock}
              onDelete={removeProduct}
              onEdit={openEditForm}
              product={product}
            />
          ))}
        </section>
      )}

      {isFormOpen && (
        <ProductForm
          product={editingProduct}
          categories={categories}
          categoriesLoading={categoriesLoading}
          onClose={() => setIsFormOpen(false)}
          onCreate={onCreateProduct}
          onUpdate={onUpdateProduct}
        />
      )}
    </div>
  );
}

function CategoryManager({
  canManageCategories,
  categories,
  categoriesLoading,
  onCreateCategory,
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!canManageCategories) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await onCreateCategory(name);
      setName("");
    } catch (createError) {
      setError(createError.message || "Unable to create category.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-palm" />
            <p className="label">Product categories</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categoriesLoading ? (
              <Badge>Loading</Badge>
            ) : categories.length ? (
              categories.map((category) => (
                <Badge key={category.id} variant="blue">
                  {category.name}
                </Badge>
              ))
            ) : (
              <Badge>No categories</Badge>
            )}
          </div>
        </div>

        <form className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto]" onSubmit={handleSubmit}>
          <input
            className="field"
            placeholder="Dresses"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button icon={Plus} isLoading={isSaving} type="submit">
            Add category
          </Button>
        </form>
      </div>
      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
    </section>
  );
}

function ProductCard({ canDelete, isPending, onAdjust, onDelete, onEdit, product }) {
  const isLow = product.quantity <= product.lowStockLimit;

  return (
    <article className="panel overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-slate-100 text-palm">
          <Camera className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-black text-ink">{product.name}</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {[product.category, product.supplier].filter(Boolean).join(" | ") || "Uncategorised"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                className="icon-button h-9 w-9"
                onClick={() => onEdit(product)}
                title="Edit product"
                aria-label={`Edit ${product.name}`}
              >
                <Edit3 className="h-4 w-4" />
              </button>
              {canDelete && (
                <button
                  className="icon-button h-9 w-9 hover:border-red-300 hover:text-red-600"
                  disabled={isPending}
                  onClick={() => onDelete(product)}
                  title="Delete product"
                  aria-label={`Delete ${product.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-2">
            <Badge variant={isLow ? "amber" : "green"}>{product.quantity} pcs</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Info label="Cost" value={formatCurrency(product.costPrice)} />
            <Info label="Selling" value={formatCurrency(product.sellingPrice)} />
            <Info label="Size" value={product.size || "-"} />
            <Info label="Colour" value={product.colour || "-"} />
            <Info label="Brand" value={product.brand || "-"} />
            <Info label="Type" value={product.itemType || "-"} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          {isLow ? (
            <AlertTriangle className="h-4 w-4 text-warning" />
          ) : (
            <Boxes className="h-4 w-4 text-palm" />
          )}
          <p className="text-xs font-bold text-slate-600">Low limit: {product.lowStockLimit}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="icon-button h-10 w-10"
            disabled={isPending || product.quantity === 0}
            onClick={() => onAdjust(product, -1)}
            aria-label={`Reduce ${product.name} stock`}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </button>
          <button
            className="icon-button h-10 w-10"
            disabled={isPending}
            onClick={() => onAdjust(product, 1)}
            aria-label={`Increase ${product.name} stock`}
          >
            <Plus className="h-4 w-4" />
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
  categoriesLoading,
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-form-title"
    >
      <form
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onSubmit={handleSubmit}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="label">Inventory</p>
            <h2 className="mt-1 text-xl font-black text-ink" id="product-form-title">
              {product ? "Edit product" : "Add product"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            type="button"
            aria-label="Close product form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormField className="sm:col-span-2" label="Product name" required>
            <input
              autoFocus
              className="field mt-2"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </FormField>
          <FormField label="Category">
            <select
              className="field mt-2"
              disabled={categoriesLoading}
              value={form.category}
              onChange={(event) => setField("category", event.target.value)}
            >
              <option value="">Uncategorised</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="SKU">
            <input
              className="field mt-2"
              placeholder="DRS-001"
              value={form.sku}
              onChange={(event) => setField("sku", event.target.value)}
            />
          </FormField>
          <NumberField form={form} label="Cost price" name="costPrice" setField={setField} step="0.01" />
          <NumberField form={form} label="Selling price" name="sellingPrice" setField={setField} step="0.01" />
          <NumberField form={form} label="Quantity" name="quantity" setField={setField} />
          <NumberField form={form} label="Low stock limit" name="lowStockLimit" setField={setField} />
          <TextField form={form} label="Supplier" name="supplier" setField={setField} />
          <TextField form={form} label="Brand" name="brand" setField={setField} />
          <TextField form={form} label="Size" name="size" setField={setField} />
          <TextField form={form} label="Colour" name="colour" setField={setField} />
          <FormField className="sm:col-span-2" label="Item type">
            <input
              className="field mt-2"
              placeholder="Ready-to-wear"
              value={form.itemType}
              onChange={(event) => setField("itemType", event.target.value)}
            />
          </FormField>

          {error && (
            <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 sm:col-span-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button icon={product ? Edit3 : Plus} isLoading={isSaving} type="submit">
            {product ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormField({ children, className = "", label, required = false }) {
  return (
    <label className={className}>
      <span className="label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function NumberField({ form, label, name, setField, step = "1" }) {
  return (
    <FormField label={label}>
      <input
        className="field mt-2"
        min="0"
        step={step}
        type="number"
        value={form[name]}
        onChange={(event) => setField(name, event.target.value)}
      />
    </FormField>
  );
}

function TextField({ form, label, name, setField }) {
  return (
    <FormField label={label}>
      <input
        className="field mt-2"
        value={form[name]}
        onChange={(event) => setField(name, event.target.value)}
      />
    </FormField>
  );
}
