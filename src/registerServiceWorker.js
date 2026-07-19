export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service worker registered:", registration);
      })
      .catch((registrationError) => {
        console.error("Service worker registration failed:", registrationError);
      });
  });
}
