import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useBackButtonModal } from "../../hooks/useBackButtonModal.js";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  MessageSquare,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency } from "../../lib/formatters.js";
import { formatReceiptDate, printThermalReceipt } from "../../lib/receiptHtml.js";
import { showToast } from "../../lib/toast.js";
import { calculateSaleTaxes } from "../../lib/taxCalculator.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  enqueueOfflineSale,
  getQueuedSales,
  syncOfflineQueue,
} from "../../services/offlineQueueService.js";

const paymentTypes = ["Cash", "MoMo", "Bank", "Credit"];

function toReceiptLine(line) {
  const qty = Number(line.quantityNum ?? line.quantity) || 0;
  return {
    productId: line.productId,
    name: line.product.name,
    quantity: qty,
    unitPrice: line.product.sellingPrice,
    total: line.lineTotal ?? line.total,
    taxTreatment: line.treatment || line.taxTreatment || line.product?.taxTreatment || "standard",
    taxableAmount: line.taxableAmount,
    vatAmount: line.vatAmount,
    nhilAmount: line.nhilAmount,
    getfundAmount: line.getfundAmount,
    totalTax: line.totalTax,
  };
}

function buildReceiptText(receipt, business) {
  if (!receipt) return "";
  const businessName = business?.name || "BizTrac";
  const businessDetails = [business?.phone, business?.location].filter(Boolean).join(" | ");
  const lines = (receipt.lines || [])
    .map(
      (line) =>
        `${line.quantity} x ${line.name} @ ${formatCurrency(line.unitPrice)} = ${formatCurrency(
          line.total
        )}`
    )
    .join("\n");

  const isMomoOrBank = receipt.paymentType === "MoMo" || receipt.paymentType === "Bank";
  const momoOrBankPaid = receipt.amountPaid ?? receipt.total;
  const momoOrBankBalance = Math.max(0, (receipt.total || 0) - (receipt.amountPaid ?? receipt.total));

  const isCreditOrPartial =
    receipt.paymentType === "Credit" ||
    (!isMomoOrBank && receipt.amountPaid !== undefined && receipt.amountPaid < receipt.total);
  const amountPaid = receipt.amountPaid || 0;
  const balanceDue = Math.max(0, (receipt.total || 0) - amountPaid);
  const hasCashChange =
    receipt.paymentType === "Cash" &&
    receipt.amountTendered !== undefined &&
    receipt.amountTendered >= receipt.total;

  const tin = receipt.tinNumber || business?.tin_number;
  const hasTax = Boolean(receipt.totalTax && receipt.totalTax > 0);
  const vatRate = receipt.vatRate !== undefined ? receipt.vatRate : (business?.vat_rate ?? 15);
  const nhilRate = receipt.nhilRate !== undefined ? receipt.nhilRate : (business?.nhil_rate ?? 2.5);
  const getfundRate = receipt.getfundRate !== undefined ? receipt.getfundRate : (business?.getfund_rate ?? 2.5);

  return [
    businessName,
    business?.slogan || "",
    businessDetails,
    tin ? `TIN: ${tin}` : "",
    business?.momo_details ? `MoMo: ${business.momo_details}` : "",
    "",
    `Receipt: ${receipt.reference || "Draft"}`,
    `Date: ${formatReceiptDate(receipt.createdAt || new Date().toISOString())}`,
    receipt.cashierName ? `Cashier: ${receipt.cashierName}` : "",
    `Customer: ${receipt.customerName || "Walk-in"}`,
    `Payment: ${receipt.paymentType || "Cash"}`,
    receipt.paymentAccount ? `Account / Ref: ${receipt.paymentAccount}` : "",
    receipt.dueDate ? `Credit Due Date: ${formatReceiptDate(receipt.dueDate)}` : "",
    "",
    lines,
    "",
    hasTax ? `Net Subtotal (ex-tax): ${formatCurrency(receipt.subtotalExTax ?? (receipt.total - receipt.totalTax))}` : "",
    hasTax ? `NHIL (${nhilRate}%): ${formatCurrency(receipt.totalNhil || 0)}` : "",
    hasTax ? `GETFund (${getfundRate}%): ${formatCurrency(receipt.totalGetfund || 0)}` : "",
    hasTax ? `VAT (${vatRate}%): ${formatCurrency(receipt.totalVat || 0)}` : "",
    hasTax ? `Total Tax (Act 1151): ${formatCurrency(receipt.totalTax)}` : "",
    `Total: ${formatCurrency(receipt.total || 0)}`,
    hasCashChange ? `Cash Tendered: ${formatCurrency(receipt.amountTendered)}` : "",
    hasCashChange && receipt.changeDue !== undefined ? `Change: ${formatCurrency(receipt.changeDue)}` : "",
    isMomoOrBank && receipt.amountPaid !== undefined ? `Amount Paid (${receipt.paymentType}): ${formatCurrency(momoOrBankPaid)}` : "",
    isMomoOrBank && receipt.amountPaid !== undefined && receipt.amountPaid < receipt.total ? `Balance Due: ${formatCurrency(momoOrBankBalance)}` : "",
    isCreditOrPartial ? `Amount Paid: ${formatCurrency(amountPaid)}` : "",
    isCreditOrPartial ? `Balance Due: ${formatCurrency(balanceDue)}` : "",
    business?.return_policy ? `Return Policy: ${business.return_policy}` : "",
    "",
    business?.receipt_footer || "Thank you for buying from us! Visit again.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function formatGhanaPhoneForWhatsApp(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "233" + digits.slice(1);
  }
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function buildWhatsAppReceiptText(receipt, business) {
  const businessName = business?.name || "BizTrac Business";
  const businessDetails = [business?.phone, business?.location].filter(Boolean).join(" | ");

  const lineItems = (receipt.lines || [])
    .map((line) => `• *${line.name}* (x${line.quantity}) - ${formatCurrency(line.total)}`)
    .join("\n");

  const isCreditOrPartial =
    receipt.paymentType === "Credit" ||
    (receipt.amountPaid !== undefined && receipt.amountPaid < receipt.total);
  const amountPaid = receipt.amountPaid || 0;
  const balanceDue = Math.max(0, receipt.total - amountPaid);
  const hasCashChange =
    receipt.paymentType === "Cash" &&
    receipt.amountTendered !== undefined &&
    receipt.amountTendered >= receipt.total;

  const tin = receipt.tinNumber || business?.tin_number;
  const hasTax = Boolean(receipt.totalTax && receipt.totalTax > 0);
  const vatRate = receipt.vatRate !== undefined ? receipt.vatRate : (business?.vat_rate ?? 15);
  const nhilRate = receipt.nhilRate !== undefined ? receipt.nhilRate : (business?.nhil_rate ?? 2.5);
  const getfundRate = receipt.getfundRate !== undefined ? receipt.getfundRate : (business?.getfund_rate ?? 2.5);

  const lines = [
    `🧾 *RECEIPT - ${businessName.toUpperCase()}*`,
    business?.slogan ? `✨ _${business.slogan}_` : "",
    businessDetails ? `📍 ${businessDetails}` : "",
    tin ? `📋 *TIN:* ${tin}` : "",
    business?.momo_details ? `📱 *${business.momo_details}*` : "",
    `--------------------------------`,
    `🔢 *Ref:* ${receipt.reference || "Draft"}`,
    `📅 *Date:* ${formatReceiptDate(receipt.createdAt || new Date().toISOString())}`,
    receipt.cashierName ? `🧑‍💼 *Cashier:* ${receipt.cashierName}` : "",
    `👤 *Customer:* ${receipt.customerName || "Walk-in"}`,
    `💳 *Payment:* ${receipt.paymentType || "Cash"}`,
    receipt.paymentAccount ? `${receipt.paymentType === "Bank" ? "🏦" : "📱"} *Account / Ref:* ${receipt.paymentAccount}` : "",
    receipt.dueDate ? `📆 *Due Date:* ${formatReceiptDate(receipt.dueDate)}` : "",
    `--------------------------------`,
    `*ITEMS:*`,
    lineItems,
    `--------------------------------`,
  ];

  if (hasTax) {
    lines.push(`Net Subtotal: ${formatCurrency(receipt.subtotalExTax ?? (receipt.total - receipt.totalTax))}`);
    lines.push(`NHIL (${nhilRate}%): ${formatCurrency(receipt.totalNhil || 0)}`);
    lines.push(`GETFund (${getfundRate}%): ${formatCurrency(receipt.totalGetfund || 0)}`);
    lines.push(`VAT (${vatRate}%): ${formatCurrency(receipt.totalVat || 0)}`);
    lines.push(`Total Tax (Act 1151): ${formatCurrency(receipt.totalTax)}`);
  }

  lines.push(`💰 *TOTAL:* ${formatCurrency(receipt.total)}`);

  if (hasCashChange) {
    lines.push(`💵 *Cash Tendered:* ${formatCurrency(receipt.amountTendered)}`);
    if (receipt.changeDue !== undefined) {
      lines.push(`🔄 *Change Given:* ${formatCurrency(receipt.changeDue)}`);
    }
  }

  if (receipt.paymentType === "MoMo" || receipt.paymentType === "Bank") {
    lines.push(`💵 *Amount Paid (${receipt.paymentType}):* ${formatCurrency(receipt.amountPaid ?? receipt.total)}`);
    if (receipt.amountPaid !== undefined && receipt.amountPaid < receipt.total) {
      lines.push(`⚠️ *Balance Due:* ${formatCurrency(receipt.total - receipt.amountPaid)}`);
    }
  } else if (isCreditOrPartial) {
    lines.push(`💵 *Amount Paid:* ${formatCurrency(amountPaid)}`);
    lines.push(`⚠️ *Balance Due:* ${formatCurrency(balanceDue)}`);
  }

  if (business?.return_policy) {
    lines.push(`--------------------------------`);
    lines.push(`ℹ️ _${business.return_policy}_`);
  }

  lines.push("");
  lines.push(`🙏 *${business?.receipt_footer || "Thank you for buying from us! Visit again."}*`);

  return lines.filter((l) => l !== "").join("\n");
}

function normalizePdfText(value) {
  return String(value)
    .replaceAll("GH₵", "GHS ")
    .replaceAll("₵", "GHS ")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return normalizePdfText(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapPdfLine(value, maxLength = 42) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function makePdfObject(objectNumber, body) {
  return `${objectNumber} 0 obj\n${body}\nendobj\n`;
}

function buildPdfDocument(content, width, height) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += makePdfObject(index + 1, body);
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function buildReceiptPdfFile(receipt, business) {
  const receiptLines = buildReceiptText(receipt, business).split("\n").slice(1);
  const lines = receiptLines.flatMap((line) => wrapPdfLine(line));
  const width = 226;
  const height = Math.max(360, 64 + lines.length * 15);
  const content = [
    "BT",
    "/F2 13 Tf",
    `16 ${height - 28} Td`,
    `(${escapePdfText(business?.name || "BizTrac")}) Tj`,
    "/F1 9 Tf",
    ...lines.flatMap((line, index) => {
      const yOffset = index === 0 ? -22 : -14;
      return [`0 ${yOffset} Td`, `(${escapePdfText(line)}) Tj`];
    }),
    "ET",
  ].join("\n");
  const pdf = buildPdfDocument(content, width, height);
  const fileName = `${receipt.reference || "receipt"}.pdf`.replace(/[^a-z0-9.-]+/gi, "-");

  return new File([pdf], fileName, { type: "application/pdf" });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export function Sales({
  business,
  currentUser,
  canViewProfit = true,
  categories = [],
  customers = [],
  customersError,
  customersLoading,
  onCompleteSale,
  products = [],
  queuedCount: propQueuedCount,
  isSyncing: propIsSyncing,
  onTriggerSync,
  onRefreshQueueCount,
}) {
  const [cart, setCart] = useState([]);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [localQueuedCount, setLocalQueuedCount] = useState(0);
  const queuedCount = propQueuedCount !== undefined ? propQueuedCount : localQueuedCount;
  const isSyncing = propIsSyncing !== undefined ? propIsSyncing : false;
  const [lastReceipt, setLastReceipt] = useState(null);

  const cashierName = useMemo(() => {
    if (currentUser?.fullName && currentUser?.staffId) {
      return `${currentUser.fullName} (${currentUser.staffId})`;
    }
    if (currentUser?.fullName) {
      return currentUser.fullName;
    }
    if (currentUser?.user_metadata?.full_name) {
      return currentUser.user_metadata.full_name;
    }
    if (currentUser?.staffId) {
      return `Staff ${currentUser.staffId}`;
    }
    if (business?.owner) {
      return business.owner;
    }
    return "Store Cashier";
  }, [currentUser, business?.owner]);

  // Hook completed sale receipt into Android Back Button to reset counter
  useBackButtonModal(Boolean(lastReceipt), () => setLastReceipt(null), "sales-receipt");
  const [paymentType, setPaymentType] = useState("MoMo");
  const [downPayment, setDownPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customerMode, setCustomerMode] = useState("walk-in");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cashTendered, setCashTendered] = useState("");
  const [momoAccount, setMomoAccount] = useState("");
  const [momoAmount, setMomoAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const searchInputRef = useRef(null);
  const checkoutSectionRef = useRef(null);
  const productGridRef = useRef(null);
  const addToCartRef = useRef(null);
  useEffect(() => {
    let buffer = "";
    let lastKeyAt = 0;
    const onScannerKey = (event) => {
      const target = document.activeElement;
      const isTextInput = target && ["INPUT", "TEXTAREA"].includes(target.tagName);

      if (event.key === "Enter" && buffer.length >= 3) {
        if (!isTextInput) {
          const scanned = buffer.trim().toLowerCase();
          const match = products.find((p) => String(p.sku || "").trim().toLowerCase() === scanned);
          if (match && match.quantity > 0) {
            event.preventDefault();
            event.stopPropagation();
            addToCartRef.current?.(match.id);
            showToast(`${match.name} added to cart`, { type: "success" });
          }
        }
        buffer = "";
        return;
      }
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
      if (isTextInput) return;
      const now = Date.now();
      buffer = now - lastKeyAt > 80 ? event.key : `${buffer}${event.key}`;
      lastKeyAt = now;
      if (buffer.length > 64) buffer = buffer.slice(-64);
    };
    window.addEventListener("keydown", onScannerKey, true);
    return () => window.removeEventListener("keydown", onScannerKey, true);
  }, [products]);

  const scrollToCheckout = () => {
    checkoutSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const availableCategories = useMemo(() => {
    const fromProps = categories.map((c) => (typeof c === "string" ? c : c?.name)).filter(Boolean);
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...fromProps, ...fromProducts])).sort();
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedCategory !== "all") {
      list = list.filter((p) => (p.category || "") === selectedCategory);
    }

    if (productSearch.trim()) {
      const q = productSearch.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.size && p.size.toLowerCase().includes(q)) ||
          (p.colour && p.colour.toLowerCase().includes(q))
      );
    }

    return list;
  }, [products, selectedCategory, productSearch]);

  const productVirtualizer = useVirtualizer({
    count: filteredProducts.length,
    getScrollElement: () => productGridRef.current,
    estimateSize: () => 104,
    overscan: 8,
  });

  const cartLines = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      const qtyNum = line.quantity === "" ? 0 : Number(line.quantity) || 0;
      return product
        ? {
            ...line,
            quantity: line.quantity,
            quantityNum: qtyNum,
            product,
            total: qtyNum * product.sellingPrice,
            taxTreatment: product.taxTreatment || "standard",
          }
        : null;
    })
    .filter(Boolean);

  const taxSummary = useMemo(() => {
    return calculateSaleTaxes(cartLines, business);
  }, [cartLines, business]);

  const total = taxSummary.grandTotal;
  const profit = cartLines.reduce(
    (sum, line) => sum + (line.product.sellingPrice - line.product.costPrice) * (line.quantityNum || 0),
    0
  );

  const tenderedNum = Number(cashTendered) || 0;
  const hasCashChange = paymentType === "Cash" && cashTendered !== "" && tenderedNum >= total;
  const changeDue = cashTendered !== "" ? tenderedNum - total : 0;

  const previewAmountPaid =
    paymentType === "Credit"
      ? downPayment ? Number(downPayment) : 0
      : paymentType === "MoMo"
      ? momoAmount !== "" ? Number(momoAmount) : total
      : paymentType === "Bank"
      ? bankAmount !== "" ? Number(bankAmount) : total
      : total;

  const previewPaymentAccount =
    paymentType === "MoMo"
      ? momoAccount.trim()
      : paymentType === "Bank"
      ? bankAccount.trim()
      : undefined;

  const previewReceipt = cartLines.length
    ? {
        reference: "Draft receipt",
        customerName: getCustomerName(),
        cashierName,
        lines: taxSummary.lines.map(toReceiptLine),
        paymentType,
        total,
        profit,
        amountPaid: previewAmountPaid,
        paymentAccount: previewPaymentAccount || undefined,
        dueDate: paymentType === "Credit" ? dueDate : null,
        amountTendered: hasCashChange ? tenderedNum : undefined,
        changeDue: hasCashChange ? changeDue : undefined,
        tinNumber: business?.tin_number,
        vatEnabled: Boolean(business?.vat_enabled),
        subtotalExTax: taxSummary.subtotalExTax,
        totalVat: taxSummary.totalVat,
        totalNhil: taxSummary.totalNhil,
        totalGetfund: taxSummary.totalGetfund,
        totalTax: taxSummary.totalTax,
        vatRate: taxSummary.vatRate,
        nhilRate: taxSummary.nhilRate,
        getfundRate: taxSummary.getfundRate,
        combinedRate: taxSummary.combinedRate,
      }
    : lastReceipt;

  const activeCustomerPhone = useMemo(() => {
    if (customerMode === "existing") {
      return customers.find((c) => c.id === selectedCustomerId)?.phone || "";
    }
    if (customerMode === "new") return newCustomerPhone.trim();
    return "";
  }, [customerMode, customers, selectedCustomerId, newCustomerPhone]);

  const selectedCustomerObj = useMemo(() => {
    if (customerMode === "existing" && selectedCustomerId) {
      return customers.find((c) => c.id === selectedCustomerId) || null;
    }
    return null;
  }, [customerMode, customers, selectedCustomerId]);

  function getCustomerName() {
    if (customerMode === "existing") {
      return customers.find((customer) => customer.id === selectedCustomerId)?.name || "";
    }

    if (customerMode === "new") return newCustomerName.trim();
    return "Walk-in";
  }

  function getCustomerPayload() {
    if (customerMode === "existing") {
      return selectedCustomerId ? { mode: "existing", id: selectedCustomerId } : null;
    }

    if (customerMode === "new") {
      return {
        mode: "new",
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      };
    }

    return { mode: "walk-in" };
  }

  const readQueueItems = useCallback(async () => {
    try {
      const queued = await getQueuedSales();
      setLocalQueuedCount(queued.length);
      if (onRefreshQueueCount) onRefreshQueueCount();
    } catch {
      setLocalQueuedCount(0);
    }
  }, [onRefreshQueueCount]);

  const flushOfflineQueue = useCallback(async () => {
    if (onTriggerSync) {
      await onTriggerSync();
      await readQueueItems();
      return;
    }
    if (!onCompleteSale) return;
    try {
      const synced = await syncOfflineQueue((bId, payload) => onCompleteSale({ ...payload, clientSaleId: payload.clientSaleId }));
      if (synced > 0) {
        await readQueueItems();
      }
    } catch (err) {
      console.error("Error flushing offline queue", err);
    }
  }, [onCompleteSale, readQueueItems, onTriggerSync]);

  useEffect(() => {
    const onOnline = () => flushOfflineQueue();
    window.addEventListener("online", onOnline);
    if (navigator.onLine) flushOfflineQueue();
    return () => window.removeEventListener("online", onOnline);
  }, [flushOfflineQueue]);

  useEffect(() => {
    readQueueItems();
  }, [readQueueItems]);

  const addToCart = useCallback((productId) => {
    setActionError("");
    setSuccessMessage("");

    setCart((current) => {
      const product = products.find((item) => item.id === productId);
      if (!product || product.quantity <= 0) return current;

      const existing = current.find((line) => line.productId === productId);
      if (existing) {
        if (existing.quantity >= product.quantity) return current;

        return current.map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, { productId, quantity: 1 }];
    });
  }, [products]);
  addToCartRef.current = addToCart;

  const changeQuantity = (productId, change) => {
    setActionError("");
    setSuccessMessage("");

    setCart((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;

          const product = products.find((item) => item.id === productId);
          const maxQuantity = product?.quantity || 0;
          const currentQty = Number(line.quantity) || 0;
          const nextQty = Math.min(maxQuantity, Math.max(0, currentQty + change));
          return { ...line, quantity: nextQty };
        })
        .filter((line) => Number(line.quantity) > 0)
    );
  };

  const updateQuantity = (productId, rawValue) => {
    setActionError("");
    setSuccessMessage("");

    if (rawValue === "" || rawValue === null) {
      setCart((current) =>
        current.map((line) => (line.productId === productId ? { ...line, quantity: "" } : line))
      );
      return;
    }

    const parsed = parseInt(rawValue, 10);
    if (isNaN(parsed)) return;

    setCart((current) =>
      current.map((line) => {
        if (line.productId !== productId) return line;
        const product = products.find((item) => item.id === productId);
        const maxQuantity = product?.quantity || 0;

        if (parsed > maxQuantity) {
          setActionError(`Only ${maxQuantity} in stock for ${product?.name || "this product"}.`);
        }

        const validQty = Math.max(0, Math.min(maxQuantity, parsed));
        return { ...line, quantity: validQty };
      })
    );
  };

  const handleQuantityBlur = (productId) => {
    setCart((current) =>
      current
        .map((line) => {
          if (line.productId !== productId) return line;
          if (line.quantity === "" || line.quantity === null || Number(line.quantity) <= 0) {
            return { ...line, quantity: 1 };
          }
          return line;
        })
        .filter((line) => Number(line.quantity) > 0)
    );
  };

  const removeFromCart = (productId) => {
    setActionError("");
    setSuccessMessage("");
    setCart((current) => current.filter((line) => line.productId !== productId));
  };

  const completeSale = async () => {
    setActionError("");
    setSuccessMessage("");

    if (!cartLines.length) {
      setActionError("Add at least one product to the cart.");
      return;
    }

    if (paymentType === "Credit" && customerMode === "walk-in") {
      setActionError("Select or add a customer for credit sales.");
      return;
    }

    if (customerMode === "existing" && !selectedCustomerId) {
      setActionError("Choose a customer or switch to walk-in.");
      return;
    }

    if (customerMode === "new" && !newCustomerName.trim()) {
      setActionError("Enter the customer name.");
      return;
    }

    const invalidQtyLine = cartLines.find((line) => !line.quantityNum || line.quantityNum <= 0);
    if (invalidQtyLine) {
      setActionError(`Enter a valid quantity for ${invalidQtyLine.product.name}.`);
      return;
    }

    const overStockLine = cartLines.find((line) => line.quantityNum > line.product.quantity);
    if (overStockLine) {
      setActionError(`${overStockLine.product.name} only has ${overStockLine.product.quantity} in stock.`);
      return;
    }

    let parsedAmountPaid;
    let paymentNotes = "";
    let paymentAccount = "";

    if (paymentType === "Credit") {
      parsedAmountPaid = downPayment ? Number(downPayment) : 0;
    } else if (paymentType === "MoMo") {
      parsedAmountPaid = momoAmount !== "" ? Number(momoAmount) : total;
      paymentAccount = momoAccount.trim();
      paymentNotes = paymentAccount ? `MoMo Account: ${paymentAccount}` : "MoMo Payment";
    } else if (paymentType === "Bank") {
      parsedAmountPaid = bankAmount !== "" ? Number(bankAmount) : total;
      paymentAccount = bankAccount.trim();
      paymentNotes = paymentAccount ? `Bank Account: ${paymentAccount}` : "Bank Transfer";
    } else {
      parsedAmountPaid = total;
    }

    if (!Number.isFinite(parsedAmountPaid) || parsedAmountPaid < 0) {
      setActionError("Enter a valid amount paid.");
      return;
    }
    if (parsedAmountPaid < total && customerMode === "walk-in") {
      setActionError("Select or add a customer when a sale will have a balance due.");
      return;
    }
    if (paymentType === "Cash" && cashTendered !== "" && tenderedNum < total) {
      setActionError("Cash tendered must cover the full sale total.");
      return;
    }

    if (cashierName) {
      paymentNotes = paymentNotes ? `${paymentNotes} | Sold by: ${cashierName}` : `Sold by: ${cashierName}`;
    }

    setIsSaving(true);
    const clientSaleId = crypto.randomUUID();
    try {
      const sale = await onCompleteSale({
        customer: getCustomerPayload(),
        lines: cartLines,
        paymentType,
        amountPaid: parsedAmountPaid,
        dueDate: paymentType === "Credit" ? dueDate : null,
        notes: paymentNotes,
        clientSaleId,
      });
      const receipt = {
        reference: sale.reference,
        customerName: getCustomerName(),
        cashierName,
        lines: taxSummary.lines.map(toReceiptLine),
        paymentType,
        total,
        profit,
        amountPaid: parsedAmountPaid,
        paymentAccount: paymentAccount || undefined,
        dueDate: paymentType === "Credit" ? dueDate : null,
        amountTendered: hasCashChange ? tenderedNum : undefined,
        changeDue: hasCashChange ? changeDue : undefined,
        createdAt: new Date().toISOString(),
        tinNumber: sale.tinSnapshot || business?.tin_number,
        vatEnabled: Boolean(business?.vat_enabled),
        subtotalExTax: sale.subtotalExTax ?? taxSummary.subtotalExTax,
        totalVat: sale.totalVat ?? taxSummary.totalVat,
        totalNhil: sale.totalNhil ?? taxSummary.totalNhil,
        totalGetfund: sale.totalGetfund ?? taxSummary.totalGetfund,
        totalTax: sale.totalTax ?? taxSummary.totalTax,
        vatRate: taxSummary.vatRate,
        nhilRate: taxSummary.nhilRate,
        getfundRate: taxSummary.getfundRate,
        combinedRate: taxSummary.combinedRate,
      };

      setLastReceipt(receipt);
      setCart([]);
      setCashTendered("");
      setMomoAccount("");
      setMomoAmount("");
      setBankAccount("");
      setBankAmount("");
      setCustomerMode("walk-in");
      setSelectedCustomerId("");
      setNewCustomerName("");
      setNewCustomerPhone("");
      setDownPayment("");
      setDueDate("");
      setSuccessMessage(`Sale ${sale.reference} recorded.`);
      showToast(`Sale ${sale.reference} recorded.`, { type: "success" });
      if (business?.auto_print_receipt) {
        printThermalReceipt(receipt, business);
      }
      // clear success message after a short delay
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Unable to complete sale", error);
      const isNetworkError = !navigator.onLine || /failed to fetch|networkerror|network error/i.test(error.message || "");
      if (isNetworkError) {
        try {
          const createdAt = new Date().toISOString();
          await enqueueOfflineSale(business?.id || null, {
            clientSaleId,
            customer: getCustomerPayload(),
            lines: cartLines,
            paymentType,
            amountPaid: parsedAmountPaid,
            dueDate: paymentType === "Credit" ? dueDate || null : null,
            notes: paymentNotes,
            staffAccountId: currentUser?.id || null,
          });
          showToast("No network - sale saved to IndexedDB offline queue.", { type: "warn" });
          setActionError("Saved offline - will sync when connection resumes.");
          const draftReceipt = {
            reference: `OFFLINE-${createdAt.replace(/[:.]/g, "-")}`,
            customerName: getCustomerName(),
            cashierName,
            lines: taxSummary.lines.map(toReceiptLine),
            paymentType,
            total,
            profit,
            amountPaid: parsedAmountPaid,
            paymentAccount: paymentAccount || undefined,
            dueDate: paymentType === "Credit" ? dueDate || null : null,
            amountTendered: hasCashChange ? tenderedNum : undefined,
            changeDue: hasCashChange ? changeDue : undefined,
            createdAt,
            tinNumber: business?.tin_number,
            vatEnabled: Boolean(business?.vat_enabled),
            subtotalExTax: taxSummary.subtotalExTax,
            totalVat: taxSummary.totalVat,
            totalNhil: taxSummary.totalNhil,
            totalGetfund: taxSummary.totalGetfund,
            totalTax: taxSummary.totalTax,
            vatRate: taxSummary.vatRate,
            nhilRate: taxSummary.nhilRate,
            getfundRate: taxSummary.getfundRate,
            combinedRate: taxSummary.combinedRate,
          };
          setLastReceipt(draftReceipt);
          setCart([]);
          setCashTendered("");
          setMomoAccount("");
          setMomoAmount("");
          setBankAccount("");
          setBankAmount("");
          if (business?.auto_print_receipt) {
            printThermalReceipt(draftReceipt, business);
          }
          await readQueueItems();
        } catch (qErr) {
          console.error("Failed to queue sale", qErr);
          showToast("Unable to record sale.");
          setActionError(error.message || "Unable to complete sale.");
        }
      } else {
        showToast("Unable to complete sale");
        setActionError(error.message || "Unable to complete sale.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const syncNow = async () => {
    try {
      if (onTriggerSync) {
        await onTriggerSync();
      } else {
        await flushOfflineQueue();
      }
      await readQueueItems();
    } catch (err) {
      console.error("Error in syncNow", err);
    }
  };

  const printReceipt = (receiptToPrint) => {
    setActionError("");

    // Guard against React SyntheticEvent or invalid receipt passed via onClick
    const isSyntheticEvent =
      receiptToPrint &&
      typeof receiptToPrint === "object" &&
      ("nativeEvent" in receiptToPrint || "_reactName" in receiptToPrint || "target" in receiptToPrint);

    const targetReceipt =
      receiptToPrint && typeof receiptToPrint === "object" && !isSyntheticEvent && (receiptToPrint.lines || receiptToPrint.reference)
        ? receiptToPrint
        : lastReceipt;

    if (!targetReceipt) {
      setActionError("Complete a sale before printing a receipt.");
      return;
    }

    const ok = printThermalReceipt(targetReceipt, business, () => {
      setActionError("Allow pop-ups to print the receipt.");
    });
    return ok;
  };

  const shareReceipt = async () => {
    setActionError("");

    if (!lastReceipt) {
      setActionError("Complete a sale before sharing a receipt.");
      return;
    }

    const pdfFile = buildReceiptPdfFile(lastReceipt, business);
    const shareData = {
      files: [pdfFile],
      title: `Receipt ${lastReceipt.reference}`,
      text: "Receipt PDF",
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Unable to share receipt PDF", error);
        showToast("Unable to share receipt PDF");
        setActionError(error.message || "Unable to share the PDF receipt.");
        return;
      }
    }

    downloadFile(pdfFile);
    setActionError("PDF receipt downloaded. Attach it in WhatsApp because this browser cannot share PDF files directly.");
  };

  const sendWhatsAppReceipt = () => {
    setActionError("");
    if (!lastReceipt) {
      setActionError("Complete a sale before sharing a receipt on WhatsApp.");
      return;
    }

    const customerObj = customers.find((c) => c.id === selectedCustomerId);
    const customerPhone = customerObj?.phone || newCustomerPhone || "";
    const formattedPhone = formatGhanaPhoneForWhatsApp(customerPhone);
    const text = buildWhatsAppReceiptText(lastReceipt, business);
    const encodedText = encodeURIComponent(text);

    let url = `https://wa.me/?text=${encodedText}`;
    if (formattedPhone) {
      url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
    }

    window.open(url, "_blank");
    showToast("Opening WhatsApp…", { type: "info" });
  };

  const copyReceiptText = async () => {
    setActionError("");
    if (!lastReceipt) {
      setActionError("Complete a sale before copying the receipt text.");
      return;
    }

    const text = buildWhatsAppReceiptText(lastReceipt, business);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Receipt text copied to clipboard!", { type: "success" });
    } catch (error) {
      console.error("Unable to copy receipt text", error);
      showToast("Unable to copy receipt text.");
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-palm">Sales</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">New sale</h1>
        </div>
        <Button
          icon={UserPlus}
          variant="secondary"
          type="button"
          onClick={() => {
            setCustomerMode("new");
            setActionError("");
            setSuccessMessage("");
          }}
        >
          Add customer
        </Button>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <div className="panel p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="label">Select product</label>
                <span className="ml-2 text-xs font-bold text-slate-400">
                  ({filteredProducts.length} {filteredProducts.length === 1 ? "item" : "items"})
                </span>
              </div>
              <span className="hidden text-[11px] font-semibold text-slate-400 sm:inline">
                Press <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-[10px] font-bold text-slate-500">/</kbd> to search
              </span>
            </div>

            {/* Product Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products by name, SKU, brand, size…"
                className="field pl-10 pr-9 text-sm"
              />
              {productSearch ? (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Category Filter Chips */}
            {availableCategories.length > 0 ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`shrink-0 rounded-xl px-3 py-1.5 font-bold transition ${
                    selectedCategory === "all"
                      ? "bg-palm text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All ({products.length})
                </button>
                {availableCategories.map((cat) => {
                  const count = products.filter((p) => (p.category || "") === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 rounded-xl px-3 py-1.5 font-bold transition ${
                        selectedCategory === cat
                          ? "bg-palm text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div ref={productGridRef} className="max-h-[30rem] overflow-y-auto pr-0.5">
              {!products.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 sm:col-span-2">
                  Add products in Inventory before recording a sale.
                </div>
              ) : null}

              {products.length > 0 && !filteredProducts.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center sm:col-span-2 space-y-1.5">
                  <p className="text-sm font-bold text-ink">No products match your filter</p>
                  <p className="text-xs text-slate-500">Try adjusting your search terms or category selection.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch("");
                      setSelectedCategory("all");
                    }}
                    className="mt-2 inline-block text-xs font-bold text-palm hover:underline"
                  >
                    Clear search & filters
                  </button>
                </div>
              ) : null}

              {filteredProducts.length > 0 ? (
                <div style={{ height: `${productVirtualizer.getTotalSize()}px`, position: "relative" }}>
                {productVirtualizer.getVirtualItems().map((virtualRow) => {
                const product = filteredProducts[virtualRow.index];
                const inCartLine = cartLines.find((l) => l.productId === product.id);
                const inCartQty = inCartLine ? inCartLine.quantityNum : 0;
                const isOutOfStock = product.quantity <= 0;

                return (
                  <button
                    key={product.id}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
                    className={`flex min-h-24 items-center justify-between gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                      inCartQty > 0
                        ? "border-palm ring-2 ring-palm/20 bg-skyglass/40 shadow-sm"
                        : "border-slate-200 bg-white hover:border-palm/40 hover:bg-skyglass/20 hover:shadow-xs"
                    } ${isOutOfStock ? "cursor-not-allowed opacity-50" : ""}`}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(product.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-ink truncate">{product.name}</span>
                      <span className="mt-0.5 block text-xs font-semibold text-slate-500 truncate">
                        {[product.size, product.colour, product.brand].filter(Boolean).join(" | ") || "Standard"}
                      </span>
                      <span className="mt-1.5 block text-sm font-black text-palm">
                        {formatCurrency(product.sellingPrice)}
                      </span>
                    </span>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant={isOutOfStock ? "slate" : product.quantity <= product.lowStockLimit ? "amber" : "slate"}>
                        {isOutOfStock ? "Out of stock" : `${product.quantity} in stock`}
                      </Badge>
                      {inCartQty > 0 ? (
                        <span className="rounded-full bg-palm px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                          x{inCartQty} in cart
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
                })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Cart</p>
                <h2 className="mt-1 text-lg font-black text-ink">
                  {cartLines.length} {cartLines.length === 1 ? "item" : "items"} selected
                </h2>
              </div>
              {cartLines.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-bold text-slate-400 hover:text-red-600 transition"
                >
                  Clear cart
                </button>
              ) : (
                <ShoppingBag className="h-5 w-5 text-slate-400" />
              )}
            </div>

            {!cartLines.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-600">Cart is empty</p>
                <p className="mt-0.5 text-xs text-slate-400">Select products above to add them to this sale</p>
              </div>
            ) : null}

            <div className="mt-4 divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {cartLines.map((line) => (
                <div key={line.productId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-ink">{line.product.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {formatCurrency(line.product.sellingPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      className="icon-button h-10 w-10 sm:h-9 sm:w-9 shrink-0 active:scale-90 transition"
                      onClick={() => changeQuantity(line.productId, -1)}
                      aria-label="Reduce quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={line.product.quantity}
                      className="h-10 sm:h-9 w-16 rounded-xl border border-slate-200 bg-slate-50 px-1 text-center text-base sm:text-sm font-black text-ink transition focus:border-palm focus:bg-white focus:outline-none focus:ring-2 focus:ring-palm/20"
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.productId, e.target.value)}
                      onBlur={() => handleQuantityBlur(line.productId)}
                      onFocus={(e) => e.target.select()}
                      aria-label="Item quantity"
                    />
                    <button
                      type="button"
                      className="icon-button h-10 w-10 sm:h-9 sm:w-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-50 active:scale-90 transition"
                      disabled={Number(line.quantity) >= line.product.quantity}
                      onClick={() => changeQuantity(line.productId, 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="icon-button h-10 w-10 sm:h-9 sm:w-9 shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600 active:scale-90 transition ml-1"
                      onClick={() => removeFromCart(line.productId)}
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside ref={checkoutSectionRef} className="space-y-4">
          <div className="panel p-4">
            <p className="label">Payment type</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {paymentTypes.map((type) => {
                const Icon =
                  type === "Cash"
                    ? Banknote
                    : type === "MoMo"
                    ? Smartphone
                    : type === "Bank"
                    ? CreditCard
                    : Clock;
                return (
                  <button
                    key={type}
                    type="button"
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-black transition active:scale-95 ${
                      paymentType === type
                        ? "border-palm bg-palm text-white shadow-md shadow-palm/20"
                        : "border-slate-200 bg-white text-slate-600 hover:border-palm/40 hover:bg-slate-50"
                    }`}
                    onClick={() => setPaymentType(type)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{type}</span>
                  </button>
                );
              })}
            </div>
            {/* MoMo Payment Details & Amount Paid */}
            {paymentType === "MoMo" && total > 0 ? (
              <div className="mt-3 rounded-2xl border border-amber-300/80 bg-amber-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-amber-600" />
                    <span>MoMo Transfer Details</span>
                  </p>
                  <span className="text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                    Mobile Money
                  </span>
                </div>

                {business?.momo_details ? (
                  <div className="rounded-xl border border-amber-200 bg-white p-2 text-xs text-amber-900 flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>
                      Shop MoMo Merchant: <strong className="font-black text-ink">{business.momo_details}</strong>
                    </span>
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Customer MoMo Phone / Account #
                    </label>
                    {activeCustomerPhone && momoAccount !== activeCustomerPhone ? (
                      <button
                        type="button"
                        onClick={() => setMomoAccount(activeCustomerPhone)}
                        className="text-[11px] font-bold text-palm hover:underline"
                      >
                        Use Customer Phone
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    className="field mt-1 text-sm font-semibold bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500/20"
                    placeholder="e.g. 0244123456 (MTN) or Transaction ID"
                    value={momoAccount}
                    onChange={(event) => setMomoAccount(event.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Amount Paid via MoMo (GH₵)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMomoAmount(String(total))}
                        className="text-[11px] font-bold text-amber-800 hover:underline"
                      >
                        Exact ({formatCurrency(total)})
                      </button>
                      {momoAmount ? (
                        <button
                          type="button"
                          onClick={() => setMomoAmount("")}
                          className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1 text-base font-black text-ink bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500/20"
                    placeholder={`e.g. ${total.toFixed(2)}`}
                    value={momoAmount}
                    onChange={(event) => setMomoAmount(event.target.value)}
                  />
                </div>

                <div className="rounded-xl bg-white p-3 border border-amber-200/80 space-y-1.5 text-xs font-bold shadow-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Cart Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800">
                    <span>MoMo Amount Keyed:</span>
                    <span className="font-black text-ink">
                      {formatCurrency(momoAmount !== "" ? Number(momoAmount) : total)}
                    </span>
                  </div>
                  {momoAmount !== "" && Number(momoAmount) < total ? (
                    <div className="flex justify-between border-t border-amber-100 pt-1.5 text-red-600 font-black">
                      <span>Remaining Balance Due:</span>
                      <span>{formatCurrency(total - Number(momoAmount))}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 border-t border-amber-100 pt-1.5 text-emerald-700 font-black">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Full MoMo payment confirmed</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Bank Payment Details & Amount Paid */}
            {paymentType === "Bank" && total > 0 ? (
              <div className="mt-3 rounded-2xl border border-sky-300/80 bg-sky-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4 text-sky-600" />
                    <span>Bank Transfer / Deposit Details</span>
                  </p>
                  <span className="text-[10px] font-bold rounded-full bg-sky-100 text-sky-800 px-2 py-0.5">
                    Bank Transfer
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block">
                    Bank Name & Account / Transfer Reference
                  </label>
                  <input
                    type="text"
                    className="field mt-1 text-sm font-semibold bg-white border-sky-200 focus:border-sky-500 focus:ring-sky-500/20"
                    placeholder="e.g. GCB Transfer, Ecobank, Cheque #, or Ref"
                    value={bankAccount}
                    onChange={(event) => setBankAccount(event.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Amount Paid via Bank (GH₵)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBankAmount(String(total))}
                        className="text-[11px] font-bold text-sky-800 hover:underline"
                      >
                        Exact ({formatCurrency(total)})
                      </button>
                      {bankAmount ? (
                        <button
                          type="button"
                          onClick={() => setBankAmount("")}
                          className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1 text-base font-black text-ink bg-white border-sky-200 focus:border-sky-500 focus:ring-sky-500/20"
                    placeholder={`e.g. ${total.toFixed(2)}`}
                    value={bankAmount}
                    onChange={(event) => setBankAmount(event.target.value)}
                  />
                </div>

                <div className="rounded-xl bg-white p-3 border border-sky-200/80 space-y-1.5 text-xs font-bold shadow-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Cart Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-800">
                    <span>Bank Amount Keyed:</span>
                    <span className="font-black text-ink">
                      {formatCurrency(bankAmount !== "" ? Number(bankAmount) : total)}
                    </span>
                  </div>
                  {bankAmount !== "" && Number(bankAmount) < total ? (
                    <div className="flex justify-between border-t border-sky-100 pt-1.5 text-red-600 font-black">
                      <span>Remaining Balance Due:</span>
                      <span>{formatCurrency(total - Number(bankAmount))}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 border-t border-sky-100 pt-1.5 text-emerald-700 font-black">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Full bank deposit confirmed</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            {paymentType === "Cash" && total > 0 ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <span>Cash Tendered & Change</span>
                  </p>
                  <span className="text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
                    Calculator
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">
                      Amount Received (GH₵)
                    </label>
                    {cashTendered ? (
                      <button
                        type="button"
                        onClick={() => setCashTendered("")}
                        className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field mt-1 text-base font-black text-ink bg-white border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20"
                    placeholder={`e.g. ${total.toFixed(2)}`}
                    value={cashTendered}
                    onChange={(event) => setCashTendered(event.target.value)}
                  />
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Quick Cash Notes:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                      onClick={() => setCashTendered(String(total))}
                    >
                      Exact ({formatCurrency(total)})
                    </button>
                    {[10, 20, 50, 100, 200].map((note) => (
                      <button
                        key={note}
                        type="button"
                        className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                          Number(cashTendered) === note
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                        }`}
                        onClick={() => setCashTendered(String(note))}
                      >
                        GH₵ {note}
                      </button>
                    ))}
                  </div>
                </div>

                {cashTendered !== "" ? (
                  <div className="rounded-xl bg-white p-3 border border-emerald-200/80 space-y-1.5 text-xs font-bold shadow-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Cart Total:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Cash Handed:</span>
                      <span>{formatCurrency(tenderedNum)}</span>
                    </div>
                    <div
                      className={`flex justify-between items-center border-t pt-1.5 text-sm font-black ${
                        changeDue >= 0
                          ? "border-emerald-100 text-emerald-700"
                          : "border-red-100 text-red-600"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Coins className="h-4 w-4" />
                        <span>{changeDue >= 0 ? "Change to Customer:" : "Amount Still Needed:"}</span>
                      </span>
                      <span className="text-base">{formatCurrency(Math.abs(changeDue))}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {paymentType === "Credit" ? (
              <div className="mt-3 rounded-2xl border border-palm/30 bg-sky-50/50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-palm">
                    Partial Payment & Credit Terms
                  </p>
                  <span className="text-[10px] font-bold rounded-full bg-palm/10 px-2 py-0.5 text-palm">
                    Credit Sale
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block">
                    Amount Paid Upfront (GHS)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={total}
                    step="0.01"
                    className="field mt-1 text-base font-black text-ink bg-white border-palm/40 focus:border-palm"
                    placeholder="0.00 (Enter upfront payment if any)"
                    value={downPayment}
                    onChange={(event) => setDownPayment(event.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-600">
                      Credit Due Date
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">Payment Deadline</span>
                  </div>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    className="field mt-1 text-xs font-bold text-ink bg-white border-palm/40 focus:border-palm"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {[
                      { label: "+7 Days", days: 7 },
                      { label: "+14 Days", days: 14 },
                      { label: "+30 Days", days: 30 },
                    ].map((preset) => (
                      <button
                        key={preset.days}
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:border-palm hover:text-palm"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + preset.days);
                          setDueDate(d.toISOString().slice(0, 10));
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-white p-2.5 border border-slate-200/80 space-y-1 text-xs font-bold">
                  <div className="flex justify-between text-slate-500">
                    <span>Cart Total:</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-palm font-extrabold">
                    <span>Upfront Payment:</span>
                    <span>{formatCurrency(Number(downPayment) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-600 font-extrabold border-t border-slate-100 pt-1">
                    <span>Remaining Balance Owed:</span>
                    <span>{formatCurrency(Math.max(0, total - (Number(downPayment) || 0)))}</span>
                  </div>
                  {dueDate ? (
                    <div className="flex justify-between text-slate-600 font-bold border-t border-slate-100 pt-1">
                      <span>Payment Due Date:</span>
                      <span>{formatReceiptDate(dueDate)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="label">Customer</p>
              {customersLoading ? (
                <span className="text-xs font-bold text-slate-500">Loading</span>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { id: "walk-in", label: "Walk-in" },
                { id: "existing", label: "Existing" },
                { id: "new", label: "New" },
              ].map((mode) => (
                <button
                  key={mode.id}
                  className={`min-h-10 rounded-xl border text-xs font-black transition ${
                    customerMode === mode.id
                      ? "border-palm bg-palm text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  type="button"
                  onClick={() => {
                    setCustomerMode(mode.id);
                    setActionError("");
                    setSuccessMessage("");
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {customerMode === "existing" ? (
              <>
                <select
                  className="field mt-3"
                  disabled={customersLoading}
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.debt > 0 ? `(Owes ${formatCurrency(customer.debt)})` : ""}
                    </option>
                  ))}
                </select>

                {selectedCustomerObj && selectedCustomerObj.debt > 0 ? (
                  <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <span className="font-bold">Outstanding Debt: </span>
                        <span className="font-black text-rose-700">{formatCurrency(selectedCustomerObj.debt)}</span>
                      </div>
                    </div>
                    {paymentType === "Credit" && (
                      <span className="rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                        Review Credit Limit
                      </span>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {customerMode === "new" ? (
              <div className="mt-3 grid gap-2">
                <input
                  className="field"
                  placeholder="Customer name"
                  value={newCustomerName}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Phone"
                  value={newCustomerPhone}
                  onChange={(event) => setNewCustomerPhone(event.target.value)}
                />
              </div>
            ) : null}

            {customersError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">{customersError}</p>
            ) : null}
          </div>

          <ReceiptPreview
            business={business}
            receipt={previewReceipt}
            canViewProfit={canViewProfit}
          />

          {queuedCount ? (
            <div className="panel p-4">
              <p className="label">Queued sales</p>
              <p className="mt-1 text-sm text-slate-500">{queuedCount} sale{queuedCount > 1 ? "s" : ""} saved offline</p>
              <div className="mt-3">
                <Button icon={Send} variant="secondary" onClick={syncNow} isLoading={isSyncing} disabled={isSyncing}>
                  Sync now
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            {actionError ? (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            ) : null}
            {successMessage ? (
              <div className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-semibold text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            ) : null}
            <Button
              icon={ReceiptText}
              disabled={!cartLines.length || isSaving}
              isLoading={isSaving}
              onClick={completeSale}
            >
              Complete sale
            </Button>
            <button
              type="button"
              disabled={!lastReceipt}
              onClick={sendWhatsAppReceipt}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-soft transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Send to WhatsApp</span>
            </button>
            <Button icon={Copy} variant="secondary" disabled={!lastReceipt} onClick={copyReceiptText}>
              Copy receipt text
            </Button>
            <Button icon={Printer} variant="secondary" disabled={!lastReceipt} onClick={() => printReceipt(lastReceipt)}>
              Print receipt ({business?.receipt_width || "58mm"})
            </Button>
            <Button icon={Send} variant="secondary" disabled={!lastReceipt} onClick={shareReceipt}>
              Share PDF receipt
            </Button>
            <Button icon={Trash2} variant="ghost" onClick={() => setCart([])}>
              Clear cart
            </Button>
          </div>
        </aside>
      </section>

      {/* Mobile Sticky Floating Cart Bar */}
      {cartLines.length > 0 ? (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] inset-x-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur transition-all duration-200 animate-in fade-in slide-in-from-bottom lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-palm text-xs font-black text-white shadow-sm">
              {cartLines.reduce((s, l) => s + (l.quantityNum || 0), 0)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Due</p>
              <p className="truncate text-base font-black text-white">{formatCurrency(total)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToCheckout}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-palm px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-palm/30 transition hover:bg-palmDeep active:scale-95"
          >
            <span>Review & Pay</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReceiptPreview({ business, receipt, canViewProfit = true }) {
  const businessName = business?.name || "BizTrac";
  const lines = receipt?.lines || [];
  const tin = receipt?.tinNumber || business?.tin_number;
  const vatRate = receipt?.vatRate !== undefined ? receipt.vatRate : (business?.vat_rate ?? 15);
  const nhilRate = receipt?.nhilRate !== undefined ? receipt.nhilRate : (business?.nhil_rate ?? 2.5);
  const getfundRate = receipt?.getfundRate !== undefined ? receipt.getfundRate : (business?.getfund_rate ?? 2.5);

  return (
    <div className="panel overflow-hidden">
      <div className="bg-ink p-4 text-white">
        <p className="text-sm font-black">{businessName}</p>
        <p className="mt-1 text-xs text-white/60">
          {[business?.phone, business?.location].filter(Boolean).join(" | ") || "Receipt preview"}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500">
          <span>{receipt?.reference || "Draft receipt"}</span>
          <span>{receipt?.paymentType || "Cash"}</span>
        </div>
        {tin ? (
          <div className="mt-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>TIN:</span>
            <span className="font-bold text-ink">{tin}</span>
          </div>
        ) : null}
        {receipt?.cashierName ? (
          <div className="mt-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Cashier:</span>
            <span className="font-bold text-ink">{receipt.cashierName}</span>
          </div>
        ) : null}
        {receipt?.paymentAccount ? (
          <p className="mt-1 text-xs font-black text-palm">
            Account / Ref: {receipt.paymentAccount}
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>Customer:</span>
          <span className="font-bold text-ink">{receipt?.customerName || "Walk-in"}</span>
        </div>
        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div key={line.productId} className="flex justify-between gap-3 text-sm">
              <span className="text-slate-600">{line.quantity} x {line.name}</span>
              <span className="font-black text-ink">{formatCurrency(line.total)}</span>
            </div>
          ))}
          {!lines.length ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-500">
              Add products to preview the receipt.
            </p>
          ) : null}
        </div>
        <div className="mt-4 border-t border-dashed border-slate-200 pt-4 space-y-1.5">
          {canViewProfit && (
            <div className="flex justify-between text-sm font-bold text-slate-500">
              <span>Estimated profit</span>
              <span>{formatCurrency(receipt?.profit || 0)}</span>
            </div>
          )}
          {receipt?.totalTax > 0 ? (
            <div className="rounded-xl bg-slate-50 p-2.5 space-y-1 text-xs mb-2">
              <div className="flex justify-between text-slate-500">
                <span>Net Subtotal (ex-tax):</span>
                <span>{formatCurrency(receipt.subtotalExTax ?? (receipt.total - receipt.totalTax))}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>NHIL ({nhilRate}%):</span>
                <span>{formatCurrency(receipt.totalNhil || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GETFund ({getfundRate}%):</span>
                <span>{formatCurrency(receipt.totalGetfund || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>VAT ({vatRate}%):</span>
                <span>{formatCurrency(receipt.totalVat || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-800 border-t border-slate-200/60 pt-1">
                <span>Total Tax (Act 1151):</span>
                <span>{formatCurrency(receipt.totalTax)}</span>
              </div>
            </div>
          ) : null}
          <div className="flex justify-between text-xl font-black text-ink">
            <span>Total</span>
            <span>{formatCurrency(receipt?.total || 0)}</span>
          </div>
          {receipt?.amountPaid !== undefined && (receipt?.paymentType === "MoMo" || receipt?.paymentType === "Bank" || receipt?.paymentType === "Credit" || receipt?.amountPaid < receipt?.total) ? (
            <>
              <div className="flex justify-between text-xs font-bold text-palm pt-1 border-t border-slate-100">
                <span>Amount Paid ({receipt?.paymentType || "Paid"})</span>
                <span>{formatCurrency(receipt?.amountPaid || 0)}</span>
              </div>
              {receipt?.amountPaid < receipt?.total ? (
                <div className="flex justify-between text-xs font-black text-red-600">
                  <span>Balance Due</span>
                  <span>{formatCurrency(Math.max(0, (receipt?.total || 0) - (receipt?.amountPaid || 0)))}</span>
                </div>
              ) : null}
              {receipt?.dueDate ? (
                <div className="flex justify-between text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
                  <span>Credit Due Date</span>
                  <span>{formatReceiptDate(receipt.dueDate)}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Sales;
