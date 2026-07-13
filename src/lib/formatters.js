export const currency = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

export const compactCurrency = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value) {
  return currency.format(value);
}

export function formatCompactCurrency(value) {
  return compactCurrency.format(value);
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
