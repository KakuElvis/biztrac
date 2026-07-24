import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";
import { debtors as initialDebtors } from "../lib/mockData.js";

function customersFromDebtors(debtors) {
  return debtors.map((debtor) => ({
    id: debtor.id,
    businessId: "demo",
    name: debtor.name,
    phone: "",
    email: "",
    notes: "",
  }));
}

export function useCustomers(repository, businessId, isDemo, refreshAnalytics) {
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setCustomers(customersFromDebtors(initialDebtors));
      setCustomersError("");
      setCustomersLoading(false);
      return undefined;
    }

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
  }, [isDemo, businessId, repository]);

  const handleCreateCustomer = async (customer) => {
    const nextCustomer = await repository.createCustomer(businessId, customer);
    setCustomers((current) => [...current, nextCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    return nextCustomer;
  };

  const handlePayDebt = async (customerId, amount, paymentMethod) => {
    const applied = await repository.payCustomerDebt(businessId, customerId, amount, paymentMethod);
    if (!isDemo && businessId) {
      refreshAnalytics?.(businessId);
    }
    return applied;
  };

  const resetCustomers = (demoDebtors = initialDebtors) => {
    setCustomers(isDemo ? customersFromDebtors(demoDebtors) : []);
  };

  return {
    customers,
    setCustomers,
    customersLoading,
    customersError,
    handleCreateCustomer,
    handlePayDebt,
    resetCustomers,
  };
}
