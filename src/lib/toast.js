let _handler = null;

function toSafeString(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val instanceof Error) return val.message || String(val);
  if (typeof val === "object") {
    if (val.message && typeof val.message === "string") return val.message;
    try {
      return JSON.stringify(val);
    } catch {
      return "[Object]";
    }
  }
  return String(val);
}

export function setToastHandler(fn) {
  _handler = fn;
}

export function showToast(message, { type = "error", duration = 5000 } = {}) {
  const safeMessage = toSafeString(message);
  if (_handler) {
    _handler({ message: safeMessage, type, duration });
  } else {
    // Fallback to console if UI handler not registered
    if (type === "error") console.error(safeMessage);
    else if (type === "warn") console.warn(safeMessage);
    else console.log(safeMessage);
  }
}

export default { setToastHandler, showToast };
