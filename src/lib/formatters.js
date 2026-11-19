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

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
