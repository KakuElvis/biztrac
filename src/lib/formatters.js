export const currency = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const compactCurrency = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value, currencyCode = "GHS", locale) {
  const num = Number(value);
  const code = String(currencyCode || "GHS").toUpperCase();
  try {
    return new Intl.NumberFormat(locale || (code === "GHS" ? "en-GH" : undefined), {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  } catch {
    return currency.format(Number.isFinite(num) ? num : 0);
  }
}

export function formatCompactCurrency(value) {
  const num = Number(value);
  return compactCurrency.format(Number.isFinite(num) ? num : 0);
}

export function formatWhatsAppPhone(phone, defaultCountry = "233") {
  if (!phone) return "";
  const raw = String(phone).trim();
  const international = raw.startsWith("+") || raw.startsWith("00");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (international || digits.startsWith(defaultCountry)) return digits;
  if (digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  return `${defaultCountry}${digits}`;
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
