import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";
import { supabase } from "../lib/supabase.js";

export function useCustomers(repository, businessId, refreshAnalytics) {
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!businessId) {
      setCustomers([]);
      setCustomersLoading(false);
      return undefined;
    }

    setCustomersLoading(true);
    setCustomersError("");

    repository
      .listCustomers(businessId)
      .then((nextCustomers) => {
        if (isMounted) setCustomers(nextCustomers);
      })
      .catch((error) => {
        console.error("Unable to load customers", error);
        showToast("Unable to load customers");
        if (isMounted) {
          setCustomers([]);
          setCustomersError(error.message || "Unable to load customers.");
        }
      })
      .finally(() => {
        if (isMounted) setCustomersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessId, repository]);

  // Realtime subscription for debtor balance and customer updates across counter terminals
  useEffect(() => {
    if (!businessId || !supabase) return undefined;

    let isSubscribed = true;
    let debounceTimer = null;

    const reloadDebtorBalances = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        repository
          .listCustomers(businessId)
          .then((next) => {
            if (isSubscribed) {
              setCustomers(next);
              refreshAnalytics?.(businessId);
            }
          })
          .catch((err) => {
            console.warn("[useCustomers] Realtime sync error:", err?.message || err);
          });
      }, 300);
    };

    const channel = supabase
      .channel(`customers-realtime:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          reloadDebtorBalances();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          reloadDebtorBalances();
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [businessId, repository, refreshAnalytics]);

  const handleCreateCustomer = async (customer) => {
    const nextCustomer = await repository.createCustomer(businessId, customer);
    setCustomers((current) => [...current, nextCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    return nextCustomer;
  };

  const handlePayDebt = async (customerId, amount, paymentMethod, staffAccountId) => {
    const res = await repository.payCustomerDebt(businessId, customerId, amount, paymentMethod, staffAccountId);
    const applied = typeof res === "object" ? res.appliedAmount : Number(res || amount);
    setCustomers((current) =>
      current.map((c) => {
        if (String(c.id) === String(customerId)) {
          const newDebt = Math.max(0, (c.debt || 0) - applied);
          return { ...c, debt: newDebt };
        }
        return c;
      })
    );
    if (businessId) {
      refreshAnalytics?.(businessId);
    }
    return res;
  };

  const handleForgiveDebt = async (customerId, options) => {
    const res = await repository.forgiveCustomerDebt(businessId, customerId, options);
    const forgivenAmount = Number(res) || 0;
    setCustomers((current) =>
      current.map((c) => {
        if (String(c.id) === String(customerId)) {
          const nextDebt = options?.saleId ? Math.max(0, (c.debt || 0) - forgivenAmount) : 0;
          return { ...c, debt: nextDebt };
        }
        return c;
      })
    );
    if (businessId) {
      refreshAnalytics?.(businessId);
    }
    return res;
  };

  const handleUpdateCustomer = async (customerId, updates) => {
    const updated = await repository.updateCustomer(businessId, customerId, updates);
    setCustomers((current) =>
      current.map((c) => (String(c.id) === String(customerId) ? { ...c, ...updated } : c))
    );
    return updated;
  };

  const fetchCustomerDetails = async (customerId, options) => {
    return repository.getCustomerDetails(businessId, customerId, options);
  };

  const resetCustomers = () => {
    setCustomers([]);
  };

  return {
    customers,
    setCustomers,
    customersLoading,
    customersError,
    handleCreateCustomer,
    handleUpdateCustomer,
    fetchCustomerDetails,
    handlePayDebt,
    handleForgiveDebt,
    resetCustomers,
  };
}
