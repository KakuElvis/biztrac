import { useState, useEffect } from "react";
import { showToast } from "../lib/toast.js";
import { expenses as initialExpenses } from "../lib/mockData.js";

export function useExpenses(repository, businessId, userId, isDemo, refreshAnalytics) {
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState("");

  useEffect(() => {
    let isMounted = true;

    if (isDemo) {
      setExpenses(initialExpenses);
      setExpensesError("");
      setExpensesLoading(false);
      return undefined;
    }

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
  }, [isDemo, businessId, repository]);

  const handleCreateExpense = async (expense) => {
    const nextExpense = await repository.createExpense(businessId, userId, expense);
    setExpenses((current) => [nextExpense, ...current]);

    if (!isDemo && businessId) {
      refreshAnalytics?.(businessId);
    }

    return nextExpense;
  };

  const resetExpenses = (demoExps = initialExpenses) => {
    setExpenses(isDemo ? demoExps : []);
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
