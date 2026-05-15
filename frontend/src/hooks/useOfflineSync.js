/**
 * 1.8.3 Offline-First PWA — useOfflineSync hook
 * Registers the service worker, tracks online/offline state,
 * and triggers background sync when connectivity is restored.
 */
import { useState, useEffect } from "react";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setSwRegistered(true);
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [swRegistered]);

  // Trigger background sync when connectivity returns
  const triggerSync = async () => {
    if (!("serviceWorker" in navigator) || !("SyncManager" in window)) return;
    try {
      setIsSyncing(true);
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register("sync-transactions");
      setTimeout(() => setIsSyncing(false), 3000);
    } catch (err) {
      console.warn("[Sync] Background sync not supported:", err);
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, swRegistered };
}
