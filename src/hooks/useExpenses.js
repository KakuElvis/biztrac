import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";

export function useExpenses(repository, businessId, userId, refreshAnalytics) {
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (!businessId) {
      setExpenses([]);
      setExpensesLoading(false);
      return undefined;
    }

    setExpensesLoading(true);
    setExpensesError("");

    repository
      .listExpenses(businessId)
      .then((nextExpenses) => {
        if (isMounted) setExpenses(nextExpenses);
      })
      .catch((error) => {
        console.error("Unable to load expenses", error);
        showToast("Unable to load expenses");
        if (isMounted) {
          setExpenses([]);
          setExpensesError(error.message || "Unable to load expenses.");
        }
      })
      .finally(() => {
        if (isMounted) setExpensesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [businessId, repository]);

  const handleCreateExpense = async (expense) => {
    const nextExpense = await repository.createExpense(businessId, userId, expense);
    setExpenses((current) => [nextExpense, ...current]);

    if (businessId) {
      refreshAnalytics?.(businessId);
    }

    return nextExpense;
  };

  const resetExpenses = () => {
    setExpenses([]);
  };

  return {
    expenses,
    setExpenses,
    expensesLoading,
    expensesError,
    handleCreateExpense,
    resetExpenses,
  };
}
