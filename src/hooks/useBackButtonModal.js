import { useEffect, useRef } from "react";
import { registerModal } from "../services/navigation/backStackService.js";

/**
 * Hook to bind any modal or drawer's lifecycle to the Android Back button & Browser History.
 *
 * When the modal is open, pressing the Android hardware or gesture back button
 * will trigger the `onClose` callback and close the modal instead of exiting the page.
 *
 * @param {boolean} isOpen Whether the modal is currently open
 * @param {Function} onClose Callback to close the modal
 * @param {string} [id] Unique identifier for the modal
 */
export function useBackButtonModal(isOpen, onClose, id = "modal") {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const unregister = registerModal(id, () => {
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    });

    return () => {
      unregister();
    };
  }, [isOpen, id]);
}
