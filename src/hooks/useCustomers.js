import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";

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

  const handleCreateCustomer = async (customer) => {
    const nextCustomer = await repository.createCustomer(businessId, customer);
    setCustomers((current) => [...current, nextCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    return nextCustomer;
  };

  const handlePayDebt = async (customerId, amount, paymentMethod) => {
    const res = await repository.payCustomerDebt(businessId, customerId, amount, paymentMethod);
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
    setCustomers((current) =>
      current.map((c) => {
        if (String(c.id) === String(customerId)) {
          return { ...c, debt: 0 };
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

  const fetchCustomerDetails = async (customerId) => {
    return repository.getCustomerDetails(businessId, customerId);
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
