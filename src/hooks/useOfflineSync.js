import { useState, useEffect, useCallback } from "react";
import {
  getQueuedSales,
  getConflictedSales,
  removeConflictedSale,
  clearConflictedSales,
  retryConflictedSale,
  syncOfflineQueue,
} from "../services/offlineQueueService.js";

export function useOfflineSync(onCompleteSale, isOnline, onSyncComplete) {
  const [queuedCount, setQueuedCount] = useState(0);
  const [conflictedCount, setConflictedCount] = useState(0);
  const [conflictedSales, setConflictedSales] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueueCount = useCallback(async () => {
    try {
      const [queuedItems, conflictedItems] = await Promise.all([
        getQueuedSales(),
        getConflictedSales(),
      ]);
      setQueuedCount(queuedItems.length);
      setConflictedCount(conflictedItems.length);
      setConflictedSales(conflictedItems);
    } catch (error) {
      console.warn("[useOfflineSync] Error reading queue items:", error);
      setQueuedCount(0);
      setConflictedCount(0);
      setConflictedSales([]);
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!onCompleteSale || isSyncing || !isOnline) return 0;

    setIsSyncing(true);
    try {
      const syncedCount = await syncOfflineQueue(async (businessId, payload) => {
        return onCompleteSale(payload);
      });

      await refreshQueueCount();

      if (syncedCount > 0 && typeof onSyncComplete === "function") {
        await onSyncComplete();
      }

      return syncedCount;
    } catch (error) {
      console.error("[useOfflineSync] Error during sync offline queue:", error);
      return 0;
    } finally {
      setIsSyncing(false);
    }
  }, [onCompleteSale, isSyncing, isOnline, refreshQueueCount, onSyncComplete]);

  const dismissConflicted = useCallback(async (id) => {
    await removeConflictedSale(id);
    await refreshQueueCount();
  }, [refreshQueueCount]);

  const dismissAllConflicted = useCallback(async () => {
    await clearConflictedSales();
    await refreshQueueCount();
  }, [refreshQueueCount]);

  const retryConflicted = useCallback(async (id) => {
    await retryConflictedSale(id);
    await refreshQueueCount();
    if (isOnline) {
      triggerSync();
    }
  }, [refreshQueueCount, isOnline, triggerSync]);

  useEffect(() => {
    refreshQueueCount();
  }, [refreshQueueCount]);

  useEffect(() => {
    if (isOnline && queuedCount > 0 && !isSyncing) {
      triggerSync();
    }
  }, [isOnline, queuedCount, isSyncing, triggerSync]);

  return {
    queuedCount,
    conflictedCount,
    conflictedSales,
    isSyncing,
    refreshQueueCount,
    triggerSync,
    dismissConflicted,
    dismissAllConflicted,
    retryConflicted,
  };
}
