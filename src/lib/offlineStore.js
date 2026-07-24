const DB_NAME = "biztrac_offline_db";
const DB_VERSION = 1;

export const STORES = {
  QUEUED_SALES: "queued_sales",
  CACHED_CATALOG: "cached_catalog",
  CACHED_CUSTOMERS: "cached_customers",
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.QUEUED_SALES)) {
        db.createObjectStore(STORES.QUEUED_SALES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.CACHED_CATALOG)) {
        db.createObjectStore(STORES.CACHED_CATALOG, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.CACHED_CUSTOMERS)) {
        db.createObjectStore(STORES.CACHED_CUSTOMERS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putItem(storeName, item) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`[offlineStore] Failed to put item into ${storeName}`, error);
    return null;
  }
}

export async function getItem(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`[offlineStore] Failed to get item from ${storeName}`, error);
    return null;
  }
}

export async function getAllItems(storeName) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`[offlineStore] Failed to get all items from ${storeName}`, error);
    return [];
  }
}

export async function removeItem(storeName, key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`[offlineStore] Failed to remove item from ${storeName}`, error);
    return false;
  }
}

export async function clearStore(storeName) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`[offlineStore] Failed to clear store ${storeName}`, error);
    return false;
  }
}
