import { useState, useEffect, useCallback } from "react";
import { getQueuedSales, syncOfflineQueue } from "../services/offlineQueueService.js";

export function useOfflineSync(onCompleteSale, isOnline, onSyncComplete) {
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueueCount = useCallback(async () => {
    try {
      const items = await getQueuedSales();
      setQueuedCount(items.length);
    } catch (error) {
      console.warn("[useOfflineSync] Error reading queue items:", error);
      setQueuedCount(0);
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
    isSyncing,
    refreshQueueCount,
    triggerSync,
  };
}
