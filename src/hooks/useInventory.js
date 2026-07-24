import { useState, useEffect, useMemo } from "react";
import { showToast } from "../lib/toast.js";
import { products as initialProducts } from "../lib/mockData.js";

function categoriesFromProducts(products) {
  return [...new Set(products.map((product) => product.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ id: name, name }));
}

export function useInventory(repository, businessId, isDemo) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= product.lowStockLimit).length,
    [products]
  );

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setProducts(initialProducts);
      setProductsError("");
      setProductsLoading(false);
      return undefined;
    }

    if (!businessId) {
      setProducts([]);
      return undefined;
    }

    setProductsLoading(true);
    setProductsError("");

    repository
      .listProducts(businessId)
      .then((nextProducts) => {
        if (isMounted) setProducts(nextProducts);
      })
      .catch((error) => {
        console.error("Unable to load products", error);
        showToast("Unable to load products");
        if (isMounted) setProductsError(error.message || "Unable to load inventory.");
      })
      .finally(() => {
        if (isMounted) setProductsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, businessId, repository]);

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setCategories(categoriesFromProducts(initialProducts));
      setCategoriesError("");
      setCategoriesLoading(false);
      return undefined;
    }

    if (!businessId) {
      setCategories([]);
      setCategoriesLoading(false);
      return undefined;
    }

    setCategoriesLoading(true);
    setCategoriesError("");

    repository
      .listCategories(businessId)
      .then((nextCategories) => {
        if (isMounted) setCategories(nextCategories);
      })
      .catch((error) => {
        console.error("Unable to load product categories", error);
        showToast("Unable to load product categories");
        if (isMounted) {
          setCategories([]);
          setCategoriesError(error.message || "Unable to load product categories.");
        }
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isDemo, businessId, repository]);

  const handleCreateProduct = async (product) => {
    const nextProduct = await repository.createProduct(businessId, product);
    setProducts((current) => [nextProduct, ...current]);
    return nextProduct;
  };

  const handleUpdateProduct = async (productId, product) => {
    const nextProduct = await repository.updateProduct(businessId, productId, product);
    setProducts((current) =>
      current.map((item) => (item.id === productId ? nextProduct : item))
    );
    return nextProduct;
  };

  const handleDeleteProduct = async (productId) => {
    await repository.deleteProduct(businessId, productId);
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const handleCreateCategory = async (name) => {
    const nextCategory = await repository.createCategory(businessId, name, categories);
    setCategories((current) =>
      [...current, nextCategory].sort((a, b) => a.name.localeCompare(b.name))
    );
    return nextCategory;
  };

  const resetInventory = (demoProds = initialProducts) => {
    setProducts(isDemo ? demoProds : []);
    setCategories(isDemo ? categoriesFromProducts(demoProds) : []);
  };

  return {
    products,
    setProducts,
    productsLoading,
    productsError,
    categories,
    categoriesLoading,
    categoriesError,
    lowStockCount,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateCategory,
    resetInventory,
  };
}
