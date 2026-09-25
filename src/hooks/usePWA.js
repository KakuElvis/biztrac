import { useState, useEffect, useCallback } from "react";
import { registerSW } from "virtual:pwa-register";
import { showToast } from "../lib/toast.js";

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateSWFn, setUpdateSWFn] = useState(null);

  useEffect(() => {
    // Register Service Worker with vite-plugin-pwa virtual module
    try {
      const update = registerSW({
        onNeedRefresh() {
          setNeedRefresh(true);
          showToast("A new version of BizTrac is available!", { type: "info" });
        },
        onOfflineReady() {
          setOfflineReady(true);
          showToast("BizTrac is ready for offline use", { type: "success" });
        },
        onRegisterError(error) {
          console.warn("Service worker registration error:", error);
        },
      });
      setUpdateSWFn(() => update);
    } catch (err) {
      console.warn("SW registration exception:", err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if already installed / running standalone
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone ||
        document.referrer.includes("android-app://");
      setIsInstalled(!!isStandalone);
    };

    checkStandalone();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleStandaloneChange = (e) => setIsInstalled(e.matches);
    mediaQuery.addEventListener("change", handleStandaloneChange);

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isApple = /iphone|ipad|ipod/i.test(ua);
    setIsIOS(isApple && !window.navigator.standalone);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalled(true);
      showToast("BizTrac app installed successfully!", { type: "success" });
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener("change", handleStandaloneChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        showToast("To install on iOS: Tap Share and select 'Add to Home Screen'", { type: "info" });
      }
      return false;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setCanInstall(false);
        setDeferredPrompt(null);
        showToast("Installing BizTrac...", { type: "info" });
        return true;
      }
    } catch (err) {
      console.warn("PWA install error:", err);
    }
    return false;
  }, [deferredPrompt, isIOS]);

  const updateApp = useCallback(() => {
    if (updateSWFn) {
      updateSWFn(true);
    } else {
      window.location.reload();
    }
  }, [updateSWFn]);

  return {
    canInstall,
    isInstalled,
    isIOS,
    needRefresh,
    offlineReady,
    installApp,
    updateApp,
  };
}
