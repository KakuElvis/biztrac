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

export function formatCurrency(value) {
  const num = Number(value);
  return currency.format(Number.isFinite(num) ? num : 0);
}

export function formatCompactCurrency(value) {
  const num = Number(value);
  return compactCurrency.format(Number.isFinite(num) ? num : 0);
}

export function formatWhatsAppPhone(phone, defaultCountry = "233") {
  if (!phone) return "";
  let raw = String(phone).trim();
  if (raw.startsWith("+")) raw = raw.slice(1);
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (raw.startsWith("+") || digits.startsWith(defaultCountry)) return digits;
  if (digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  return `${defaultCountry}${digits}`;
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
