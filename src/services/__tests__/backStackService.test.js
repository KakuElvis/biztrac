import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerModal,
  handleBackPop,
  getBackStackDepth,
  clearBackStack,
} from "../navigation/backStackService.js";

describe("backStackService - Android Hardware & Gesture Back Button", () => {
  beforeEach(() => {
    clearBackStack();
    vi.restoreAllMocks();

    // Mock history state
    let state = {};
    globalThis.window = {
      history: {
        get state() {
          return state;
        },
        pushState: vi.fn((newState) => {
          state = newState;
        }),
        back: vi.fn(),
      },
      location: {
        href: "http://localhost:5173/?screen=dashboard",
      },
    };
  });

  it("registers a modal and pushes history state", () => {
    const onClose = vi.fn();
    const unregister = registerModal("test-modal", onClose);

    expect(getBackStackDepth()).toBe(1);
    expect(window.history.pushState).toHaveBeenCalledWith(
      expect.objectContaining({ isModal: true, modalId: "test-modal" }),
      "",
      expect.any(String)
    );

    unregister();
  });

  it("invokes top modal onClose and consumes popstate when back is pressed", () => {
    const onClose = vi.fn();
    registerModal("test-modal", onClose);

    expect(getBackStackDepth()).toBe(1);

    // Simulate Android hardware back press triggering popstate
    const handled = handleBackPop();

    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getBackStackDepth()).toBe(0);
  });

  it("returns false if backStack is empty so screen navigation can proceed", () => {
    expect(getBackStackDepth()).toBe(0);
    const handled = handleBackPop();
    expect(handled).toBe(false);
  });

  it("handles multiple stacked modals in LIFO (Last-In-First-Out) order", () => {
    const closeBottom = vi.fn();
    const closeTop = vi.fn();

    registerModal("bottom-modal", closeBottom);
    registerModal("top-modal", closeTop);

    expect(getBackStackDepth()).toBe(2);

    // First back press should close the top modal
    const handledFirst = handleBackPop();
    expect(handledFirst).toBe(true);
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBottom).not.toHaveBeenCalled();
    expect(getBackStackDepth()).toBe(1);

    // Second back press should close the bottom modal
    const handledSecond = handleBackPop();
    expect(handledSecond).toBe(true);
    expect(closeBottom).toHaveBeenCalledTimes(1);
    expect(getBackStackDepth()).toBe(0);

    // Third back press should not be handled by modals
    const handledThird = handleBackPop();
    expect(handledThird).toBe(false);
  });

  it("calls window.history.back() when modal is closed programmatically via UI", () => {
    const onClose = vi.fn();
    const unregister = registerModal("ui-closed-modal", onClose);

    expect(getBackStackDepth()).toBe(1);

    // User clicks the "X" button or backdrop, calling unregister
    unregister();

    expect(getBackStackDepth()).toBe(0);
    expect(window.history.back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
