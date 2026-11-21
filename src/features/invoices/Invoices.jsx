import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Printer,
  Send,
  Save,
  Eye,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  X,
  UserCheck,
} from "lucide-react";
import { formatCurrency as formatCurrencyDefault, formatWhatsAppPhone } from "../../lib/formatters.js";
import { showToast } from "../../lib/toast.js";
import { PrintableDocument } from "./PrintableDocument.jsx";
import { StatusDropdown } from "./StatusDropdown.jsx";
import { CustomerPicker } from "./CustomerPicker.jsx";
import { DocTypeSelector } from "./DocTypeSelector.jsx";
import { InvoiceDateScheduler } from "./InvoiceDateScheduler.jsx";
import {
  generateDocNumber,
  getInitialInvoice,
  listInvoices,
  saveInvoiceRecord,
  deleteInvoiceRecord,
  updateInvoiceStatus,
} from "../../services/invoiceService.js";

export function Invoices({
  business = {},
  products = [],
  customers = [],
  _canManageSettings = true,
  _onNavigate,
}) {
  const businessId = business?.id;
  const formatCurrency = (value) => formatCurrencyDefault(value, business?.currency);

  const [activeSubView, setActiveSubView] = useState("editor"); // 'editor' | 'history'
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDocs, setSavedDocs] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState(null);
  const [searchHistory, setSearchHistory] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notification, setNotification] = useState(null);

  // Initialize document state
  const [doc, setDoc] = useState(() => getInitialInvoice(business));

  const loadDocuments = useCallback(async () => {
    if (!businessId) return;
    try {
      const docs = await listInvoices(businessId);
      setSavedDocs(docs);
    } catch (err) {
      console.warn("Failed to load invoices:", err);
    }
  }, [businessId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Recalculate totals whenever items, discount, or tax_rate changes
  useEffect(() => {
    const sub = (doc.items || []).reduce((sum, item) => sum + (Number(item.line_total) || 0), 0);
    const disc = Math.max(0, Number(doc.discount_amount) || 0);
    const taxableAmount = Math.max(0, sub - disc);
    const taxRate = Number(doc.tax_rate) || 0;
    const tax = Math.round((taxableAmount * (taxRate / 100) + Number.EPSILON) * 100) / 100;
    const total = Math.round((taxableAmount + tax + Number.EPSILON) * 100) / 100;

    setDoc((prev) => {
      if (
        prev.subtotal === sub &&
        prev.tax_amount === tax &&
        prev.total_amount === total
      ) {
        return prev;
      }
      return {
        ...prev,
        subtotal: sub,
        tax_amount: tax,
        total_amount: total,
      };
    });
  }, [doc.items, doc.discount_amount, doc.tax_rate]);

  const showNotice = (message, type = "success") => {
    setNotification({ message, type });
    showToast(message, { type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const handleDocTypeChange = (newType) => {
    setDoc((prev) => ({
      ...prev,
      doc_type: newType,
      doc_number: generateDocNumber(newType),
    }));
  };

  const handleAddItem = () => {
    setDoc((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          id: `line-${Date.now()}-${(prev.items || []).length + 1}`,
          description: "",
          quantity: 1,
          unit_price: 0,
          line_total: 0,
        },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setDoc((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...doc.items];
    const target = { ...updated[index], [field]: value };

    if (field === "quantity" || field === "unit_price") {
      const q = Math.max(0, Number(target.quantity) || 0);
      const p = Math.max(0, Number(target.unit_price) || 0);
      target.line_total = Math.round((q * p + Number.EPSILON) * 100) / 100;
    }

    updated[index] = target;
    setDoc((prev) => ({ ...prev, items: updated }));
  };

  const handleSelectCatalogItem = (index, productId) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const updated = [...doc.items];
    const qty = Number(updated[index].quantity) || 1;
    const price = Number(prod.sellingPrice ?? prod.price ?? 0);

    updated[index] = {
      ...updated[index],
      product_id: prod.id,
      description: prod.name,
      unit_price: price,
      line_total: Math.round((qty * price + Number.EPSILON) * 100) / 100,
    };
    setDoc((prev) => ({ ...prev, items: updated }));
  };

  const handleSelectCustomer = (customerOrId) => {
    const customer =
      typeof customerOrId === "object"
        ? customerOrId
        : customers.find((c) => c.id === customerOrId);
    if (!customer) return;

    setDoc((prev) => ({
      ...prev,
      customer_name: customer.name || "",
      customer_phone: customer.phone || "",
      customer_email: customer.email || "",
      customer_address: customer.address || prev.customer_address || "",
    }));
    showToast(`Loaded customer ${customer.name}`, { type: "info" });
  };

  const handleClearCustomer = () => {
    setDoc((prev) => ({
      ...prev,
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      customer_address: "",
    }));
  };

  const handlePrint = () => {
    if (!showPreview) {
      setShowPreview(true);
      setTimeout(() => {
        window.print();
      }, 350);
    } else {
      window.print();
    }
  };

  const handleSendWhatsApp = () => {
    if (!doc.customer_phone?.trim()) {
      showNotice("Please enter customer phone number first.", "error");
      return;
    }

    const formattedPhone = formatWhatsAppPhone(doc.customer_phone);

    const itemsSummary = (doc.items || [])
      .map((i) => `â€¢ ${i.quantity}x ${i.description || "Item"} â€” ${formatCurrency(i.line_total)}`)
      .join("\n");

    const typeLabels = {
      quotation: "QUOTATION / ESTIMATE",
      invoice: "COMMERCIAL INVOICE",
      receipt: "OFFICIAL RECEIPT",
      proforma: "PROFORMA INVOICE",
    };

    const typeLabel = typeLabels[doc.doc_type] || "INVOICE";
    const storeName = business?.name || "BizTrac Store";

    const message = encodeURIComponent(
      `Hello ${doc.customer_name || "Valued Customer"},\n\n` +
      `Here is your *${typeLabel}* from *${storeName}*:\n\n` +
      `ðŸ“„ *Doc #:* ${doc.doc_number}\n` +
      `ðŸ“… *Date:* ${doc.issue_date}\n` +
      (doc.due_date ? `â° *Due / Valid Until:* ${doc.due_date}\n\n` : `\n`) +
      `ðŸ“¦ *Items:*\n${itemsSummary}\n\n` +
      (Number(doc.discount_amount) > 0 ? `ðŸ·ï¸ *Discount:* -${formatCurrency(doc.discount_amount)}\n` : "") +
      (Number(doc.tax_rate) > 0 ? `ðŸ›ï¸ *Tax / VAT (${doc.tax_rate}%):* ${formatCurrency(doc.tax_amount)}\n` : "") +
      `ðŸ’° *Total Amount Due:* ${formatCurrency(doc.total_amount)}\n\n` +
      (doc.bank_momo_details ? `ðŸ’³ *Payment Details:*\n${doc.bank_momo_details}\n\n` : "") +
      (doc.payment_terms ? `ðŸ“‹ *Terms:*\n${doc.payment_terms}\n\n` : "") +
      `Thank you for choosing ${storeName}!`
    );

    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  };

  const handleSaveDocument = async () => {
    if (!doc.customer_name?.trim()) {
      showNotice("Please provide customer or organization name.", "error");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveInvoiceRecord(businessId, doc);
      setDoc(saved);
      setSelectedSavedId(saved.id);
      showNotice(
        String(saved.id).startsWith("local-")
          ? `Document #${doc.doc_number} saved on this device only. Reconnect and save again to sync it.`
          : `Document #${doc.doc_number} saved successfully!`,
        String(saved.id).startsWith("local-") ? "warn" : "success"
      );
      loadDocuments();
    } catch (err) {
      showNotice(err.message || "Failed to save document.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleStartNew = () => {
    setDoc(getInitialInvoice(business));
    setSelectedSavedId(null);
    setShowPreview(false);
    setActiveSubView("editor");
  };

  const handleLoadDoc = (saved) => {
    setDoc(saved);
    setSelectedSavedId(saved.id || null);
    setActiveSubView("editor");
    setShowPreview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSaved = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      await deleteInvoiceRecord(businessId, id);
      showNotice("Document deleted.", "success");
      if (selectedSavedId === id) {
        handleStartNew();
      }
      loadDocuments();
    } catch (err) {
      showNotice(err?.message || "Failed to delete document.", "error");
    }
  };

  const handleUpdateStatus = async (id, nextStatus, e) => {
    e.stopPropagation();
    try {
      await updateInvoiceStatus(businessId, id, nextStatus);
      if (doc.id === id) {
        setDoc((prev) => ({ ...prev, status: nextStatus }));
      }
      loadDocuments();
      showToast(`Status updated to ${nextStatus}`, { type: "info" });
    } catch {
      showToast("Unable to update status", { type: "error" });
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return savedDocs.filter((d) => {
      const matchesStatus = statusFilter === "all" || d.status === statusFilter;
      const query = searchHistory.toLowerCase().trim();
      if (!query) return matchesStatus;

      const matchesSearch =
        (d.customer_name || "").toLowerCase().includes(query) ||
        (d.doc_number || "").toLowerCase().includes(query) ||
        (d.customer_phone || "").includes(query);

      return matchesStatus && matchesSearch;
    });
  }, [savedDocs, statusFilter, searchHistory]);

  const combinedGhanaVatRate = useMemo(() => {
    const vat = Number(business?.vat_rate ?? 15);
    const nhil = Number(business?.nhil_rate ?? 2.5);
    const getfund = Number(business?.getfund_rate ?? 2.5);
    return Math.round((vat + nhil + getfund) * 10) / 10;
  }, [business]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all shadow-sm ${notification.type === "success"
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-red-50 text-red-800 border-red-200"
            }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 ml-4 font-bold"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setActiveSubView("editor")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${activeSubView === "editor"
                ? "bg-white text-ink shadow-xs"
                : "text-slate-600 hover:text-ink"
                }`}
            >
              Document Editor
            </button>
            <button
              onClick={() => setActiveSubView("history")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${activeSubView === "history"
                ? "bg-white text-ink shadow-xs"
                : "text-slate-600 hover:text-ink"
                }`}
            >
              <FileText className="h-3.5 w-3.5 text-palm" />
              <span>Saved Archive</span>
              <span className="bg-palm/10 text-palm px-2 py-0.5 rounded-full text-[10px] font-black">
                {savedDocs.length}
              </span>
            </button>
          </div>

          <div className="border-l border-slate-200 pl-2 sm:pl-3">
            <DocTypeSelector
              value={doc.doc_type}
              onChange={handleDocTypeChange}
              docNumber={doc.doc_number}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStartNew}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            title="Start a fresh quotation or invoice"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubView("editor");
              setShowPreview(!showPreview);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-palm" />
            <span>{showPreview ? "Edit Form" : "Live A4 Preview"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={!doc.customer_phone}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-xs"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleSaveDocument}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-palm hover:bg-palm/90 text-white text-xs font-black rounded-xl transition-colors shadow-xs disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? "Savingâ€¦" : "Save Document"}</span>
          </button>
        </div>
      </div>

      {/* SUBVIEW 1: SAVED DOCUMENTS ARCHIVE */}
      {activeSubView === "history" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-4 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-ink">Saved Invoices & Quotations</h3>
              <p className="text-xs text-slate-500">
                Click any record to reopen in the generator, print, or dispatch via WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search client or doc #..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-palm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl py-1.5 px-2 bg-slate-50 text-slate-700 font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2 stroke-1" />
              <p className="font-bold text-slate-700">No billing documents found</p>
              <p className="mt-1">Create and save your first quotation or invoice above.</p>
              <button
                type="button"
                onClick={handleStartNew}
                className="mt-4 px-4 py-2 rounded-xl bg-palm text-white font-bold text-xs shadow-xs"
              >
                + Create First Invoice
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDocs.map((item) => (
                <div
                  key={item.id || item.doc_number}
                  onClick={() => handleLoadDoc(item)}
                  className={`py-3.5 px-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedSavedId === item.id ? "bg-palm/5 border border-palm/20" : ""
                    }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-ink">{item.doc_number}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                        {item.doc_type}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${item.status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "sent"
                            ? "bg-blue-100 text-blue-800"
                            : item.status === "declined" || item.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{item.customer_name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Tel: {item.customer_phone || "â€”"}</span>
                      <span>â€¢</span>
                      <span>Date: {item.issue_date}</span>
                      {item.due_date && (
                        <>
                          <span>â€¢</span>
                          <span>Due: {item.due_date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between sm:justify-end gap-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Total</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {formatCurrency(item.total_amount)}
                      </span>
                    </div>

                    <StatusDropdown
                      size="sm"
                      value={item.status}
                      onChange={(nextStatus) => handleUpdateStatus(item.id || "", nextStatus)}
                    />

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSaved(item.id || "", e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 2: DOCUMENT EDITOR & LIVE PREVIEW */}
      {activeSubView === "editor" && (
        <>
          {showPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-palm" />
                  <span>A4 Sheet Live Preview & Print View</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="text-xs font-bold text-palm hover:underline flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Return to Form Editor
                </button>
              </div>
              <PrintableDocument doc={doc} business={business} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Form Fields */}
              <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 space-y-6 shadow-xs">
                {/* Section 1: Client & Timing */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-black text-base text-ink">Client & Document Timing</h3>
                    <p className="text-xs text-slate-500">
                      Enter client details to auto-populate invoices, quotations, or receipts.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Status:</span>
                    <StatusDropdown
                      value={doc.status}
                      onChange={(nextStatus) => setDoc({ ...doc, status: nextStatus })}
                    />
                  </div>
                </div>

                {/* Quick Autofill from existing BizTrac customers */}
                <CustomerPicker
                  customers={customers}
                  selectedName={doc.customer_name}
                  selectedPhone={doc.customer_phone}
                  onSelectCustomer={handleSelectCustomer}
                  onClearCustomer={handleClearCustomer}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Customer / Organization Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={doc.customer_name}
                      onChange={(e) => setDoc({ ...doc, customer_name: e.target.value })}
                      placeholder="e.g. Ama Mensah or Stanbic Bank HR"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-medium text-ink focus:outline-none focus:border-palm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      WhatsApp / Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={doc.customer_phone}
                      onChange={(e) => setDoc({ ...doc, customer_phone: e.target.value })}
                      placeholder="e.g. 024 412 3456"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-medium text-ink focus:outline-none focus:border-palm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Customer Email</label>
                    <input
                      type="email"
                      value={doc.customer_email || ""}
                      onChange={(e) => setDoc({ ...doc, customer_email: e.target.value })}
                      placeholder="client@example.com"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-medium text-ink focus:outline-none focus:border-palm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Delivery / Venue Address</label>
                    <input
                      type="text"
                      value={doc.customer_address || ""}
                      onChange={(e) => setDoc({ ...doc, customer_address: e.target.value })}
                      placeholder="e.g. East Legon, Accra"
                      className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-medium text-ink focus:outline-none focus:border-palm"
                    />
                  </div>
                  <div>
                    <InvoiceDateScheduler
                      label="Issue Date"
                      value={doc.issue_date}
                      onChange={(val) => setDoc({ ...doc, issue_date: val })}
                      required
                    />
                  </div>
                  <div>
                    <InvoiceDateScheduler
                      label="Due / Valid Until Date"
                      value={doc.due_date}
                      onChange={(val) => setDoc({ ...doc, due_date: val })}
                      isDueDate
                    />
                  </div>
                </div>

                {/* Section 2: Line Items & Services */}
                <div>
                  <div className="flex justify-between items-center mb-3 pt-4 border-t border-slate-100">
                    <div>
                      <h3 className="font-black text-sm text-ink">Line Items & Services</h3>
                      <p className="text-[11px] text-slate-500">
                        Pick from store inventory or type custom bespoke services.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 text-xs font-bold text-palm hover:text-palm/80 px-3 py-1.5 rounded-xl bg-palm/10 border border-palm/20"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Line
                    </button>
                  </div>

                  <div className="space-y-3">
                    {doc.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                          {/* Catalog Autofill helper */}
                          <div className="md:col-span-4">
                            <select
                              onChange={(e) => handleSelectCatalogItem(idx, e.target.value)}
                              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-[11px] font-medium text-slate-700 focus:outline-none focus:border-palm"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Quick pick from stock...
                              </option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatCurrency(p.sellingPrice ?? p.price ?? 0)})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-4">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                              placeholder="Item description or service..."
                              className="w-full border border-slate-200 rounded-xl p-2 bg-white font-medium text-ink focus:outline-none focus:border-palm"
                              required
                            />
                          </div>

                          <div className="md:col-span-1">
                            <input
                              type="number"
                              value={item.quantity}
                              min="0.01"
                              step="any"
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-center font-mono font-bold focus:outline-none focus:border-palm"
                              title="Quantity"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                              className="w-full border border-slate-200 rounded-xl p-2 bg-white text-right font-mono font-bold focus:outline-none focus:border-palm"
                              placeholder="Unit Price"
                              title="Unit Price in GHâ‚µ"
                            />
                          </div>

                          <div className="md:col-span-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={doc.items.length <= 1}
                              className="text-slate-400 hover:text-red-600 p-1.5 disabled:opacity-30 transition-colors"
                              title="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-500 font-mono pr-2">
                          Line Total:{" "}
                          <strong className="text-ink font-bold">
                            {formatCurrency(item.line_total)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Adjustments, Payment Instructions, Totals */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 space-y-4 text-xs shadow-xs h-fit">
                <h3 className="font-black text-sm text-ink border-b border-slate-100 pb-2">
                  Adjustments & Settlement
                </h3>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount (GHâ‚µ)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={doc.discount_amount}
                    onChange={(e) => setDoc({ ...doc, discount_amount: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-mono font-bold text-ink focus:outline-none focus:border-palm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Tax / VAT (%)</label>
                    {combinedGhanaVatRate > 0 && (
                      <button
                        type="button"
                        onClick={() => setDoc({ ...doc, tax_rate: combinedGhanaVatRate })}
                        className="text-[10px] font-bold text-palm hover:underline"
                      >
                        Set Act 1151 ({combinedGhanaVatRate}%)
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={doc.tax_rate}
                    onChange={(e) => setDoc({ ...doc, tax_rate: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-mono font-bold text-ink focus:outline-none focus:border-palm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Instructions (MoMo / Bank)</label>
                  <textarea
                    rows={3}
                    value={doc.bank_momo_details}
                    onChange={(e) => setDoc({ ...doc, bank_momo_details: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 font-mono text-[11px] focus:outline-none focus:border-palm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Terms & Milestones</label>
                  <textarea
                    rows={3}
                    value={doc.payment_terms}
                    onChange={(e) => setDoc({ ...doc, payment_terms: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 text-[11px] focus:outline-none focus:border-palm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Notes / Remarks</label>
                  <textarea
                    rows={2}
                    value={doc.notes || ""}
                    onChange={(e) => setDoc({ ...doc, notes: e.target.value })}
                    placeholder="e.g. Delivery timing, packaging, warranties"
                    className="w-full border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 text-[11px] focus:outline-none focus:border-palm"
                  />
                </div>

                {/* Summary Card */}
                <div className="pt-4 border-t border-slate-200 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">{formatCurrency(doc.subtotal)}</span>
                  </div>
                  {Number(doc.discount_amount) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount:</span>
                      <span className="font-mono">- {formatCurrency(doc.discount_amount)}</span>
                    </div>
                  )}
                  {Number(doc.tax_rate) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / VAT ({doc.tax_rate}%):</span>
                      <span className="font-mono font-bold">{formatCurrency(doc.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-ink pt-2 border-t border-slate-200">
                    <span>Total Amount:</span>
                    <span className="text-palm font-mono">{formatCurrency(doc.total_amount)}</span>
                  </div>
                </div>

                {/* Quick actions button */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    disabled={!doc.customer_phone}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> WhatsApp to Customer
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Printer className="h-4 w-4" /> Print / Export to PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
