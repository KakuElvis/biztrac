/**
 * Back Stack Service for Android Hardware & Gesture Back Button Navigation
 *
 * Coordinates modal dismissals, drawer closing, and browser history
 * so pressing back on mobile dismisses overlays in LIFO order before
 * navigating screens or exiting the app.
 */

let backStack = [];
let isProgrammaticPop = false;

/**
 * Register an active modal or overlay with the back stack.
 * Pushes a history state entry to trap the back button.
 *
 * @param {string} id Unique identifier for the modal
 * @param {Function} onClose Callback to execute when back button is pressed
 * @returns {Function} Unregister function to call when modal closes via UI
 */
export function registerModal(id, onClose) {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Push modal history state so Android back button triggers popstate
  try {
    const currentState = window.history.state || {};
    window.history.pushState(
      { ...currentState, isModal: true, modalId: id, timestamp: Date.now() },
      "",
      window.location.href
    );
  } catch {
    // Ignore history push errors in restrictive environments
  }

  const entry = { id, onClose };
  backStack.push(entry);

  let unregisterCalled = false;

  return function unregister() {
    if (unregisterCalled) return;
    unregisterCalled = true;

    const index = backStack.findIndex((item) => item.id === id);
    if (index !== -1) {
      backStack.splice(index, 1);

      // If closed programmatically (e.g. X button, Backdrop tap, Form submit)
      // and not by a browser pop event, pop the history entry to keep history clean.
      if (!isProgrammaticPop) {
        isProgrammaticPop = true;
        try {
          window.history.back();
        } catch {
          // Ignore
        }
        setTimeout(() => {
          isProgrammaticPop = false;
        }, 60);
      }
    }
  };
}

/**
 * Handles browser popstate events.
 * If a modal is active on the back stack, dismisses the topmost modal.
 *
 * @returns {boolean} True if the pop event was consumed by an overlay/modal, false otherwise.
 */
export function handleBackPop() {
  if (isProgrammaticPop) {
    isProgrammaticPop = false;
    return true;
  }

  if (backStack.length > 0) {
    const top = backStack.pop();
    if (top && typeof top.onClose === "function") {
      try {
        top.onClose();
      } catch (err) {
        console.error("Error invoking modal back handler:", err);
      }
    }
    return true;
  }

  return false;
}

/**
 * Returns the current depth of active overlays.
 */
export function getBackStackDepth() {
  return backStack.length;
}

/**
 * Clears the back stack (e.g. on sign out or hard reset).
 */
export function clearBackStack() {
  backStack = [];
  isProgrammaticPop = false;
}
