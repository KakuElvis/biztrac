import { useState, useEffect, useMemo } from "react";
import { showToast } from "../lib/toast.js";
import { products as initialProducts } from "../lib/mockData.js";
import { supabase } from "../lib/supabase.js";
import { toProduct } from "../services/productService.js";

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / (pageSize || 50))),
    [totalCount, pageSize]
  );

  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= product.lowStockLimit).length,
    [products]
  );

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setProducts(initialProducts);
      setTotalCount(initialProducts.length);
      setProductsError("");
      setProductsLoading(false);
      return undefined;
    }

    if (!businessId) {
      setProducts([]);
      setTotalCount(0);
      return undefined;
    }

    setProductsLoading(true);
    setProductsError("");

    repository
      .listProducts(businessId, { page, pageSize })
      .then((nextResult) => {
        if (isMounted) {
          if (Array.isArray(nextResult)) {
            setProducts(nextResult);
            setTotalCount(nextResult.length);
          } else if (nextResult?.data) {
            setProducts(nextResult.data);
            setTotalCount(nextResult.totalCount ?? nextResult.data.length);
          }
        }
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
  }, [isDemo, businessId, repository, page, pageSize]);

  useEffect(() => {
    if (isDemo || !businessId || !supabase) return undefined;

    const channel = supabase
      .channel(`products-realtime:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newProduct = toProduct(payload.new);
            setProducts((current) => {
              if (current.some((item) => item.id === newProduct.id)) return current;
              return [newProduct, ...current].sort((a, b) => a.name.localeCompare(b.name));
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedProduct = toProduct(payload.new);
            setProducts((current) =>
              current.map((item) => (item.id === updatedProduct.id ? updatedProduct : item))
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setProducts((current) => current.filter((item) => item.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDemo, businessId]);

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
    page,
    pageSize,
    totalCount,
    totalPages,
    setPage,
    setPageSize,
    handleCreateProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    handleCreateCategory,
    resetInventory,
  };
}
