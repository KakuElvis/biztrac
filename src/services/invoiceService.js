import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

const LOCAL_STORAGE_KEY_PREFIX = "biztrac_invoices_";

export function generateDocNumber(type = "invoice") {
  const prefixMap = {
    quotation: "QT",
    invoice: "INV",
    receipt: "REC",
    proforma: "PI",
  };
  const prefix = prefixMap[type] || "DOC";
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `BT-${prefix}-${year}-${random}`;
}

export function getInitialInvoice(business = {}) {
  const isVatEnabled = Boolean(business?.vat_enabled);
  const vatRate = Number(business?.vat_rate ?? 15);
  const nhilRate = Number(business?.nhil_rate ?? 2.5);
  const getfundRate = Number(business?.getfund_rate ?? 2.5);
  const defaultTaxRate = isVatEnabled ? Math.round((vatRate + nhilRate + getfundRate) * 10) / 10 : 0;

  const defaultMomo = business?.momo_details?.trim()
    ? business.momo_details.trim()
    : business?.phone
    ? `Mobile Money: ${business.phone}\nAccount Name: ${business?.name || "BizTrac Store"}`
    : "Mobile Money / Bank Transfer details on request";

  const defaultTerms =
    "• 70% deposit required before commencement.\n• 30% balance payable upon delivery or completion.\n• Validity: 14 days from issue date.";

  return {
    doc_number: generateDocNumber("invoice"),
    doc_type: "invoice",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_address: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
    tax_rate: defaultTaxRate,
    discount_amount: 0,
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    payment_terms: defaultTerms,
    bank_momo_details: defaultMomo,
    notes: `Thank you for choosing ${business?.name || "our business"}!`,
    status: "draft",
    items: [
      {
        id: `line-${Date.now()}-1`,
        description: "",
        quantity: 1,
        unit_price: 0,
        line_total: 0,
      },
    ],
  };
}

function getLocalInvoices(businessId) {
  if (typeof window === "undefined" || !businessId) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalInvoices(businessId, docs) {
  if (typeof window === "undefined" || !businessId) return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(docs));
  } catch {
    // Storage quota errors handled gracefully
  }
}

export async function listInvoices(businessId) {
  if (!businessId) return [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: dbDocs, error } = await supabase
        .from("billing_documents")
        .select("*, billing_document_items(*)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (!error && dbDocs) {
        const mapped = dbDocs.map((doc) => ({
          ...doc,
          tax_rate: Number(doc.tax_rate || 0),
          discount_amount: Number(doc.discount_amount || 0),
          subtotal: Number(doc.subtotal || 0),
          tax_amount: Number(doc.tax_amount || 0),
          total_amount: Number(doc.total_amount || 0),
          items: (doc.billing_document_items || []).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            description: item.description,
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            line_total: Number(item.line_total || 0),
          })),
        }));

        // Keep local cache synced
        saveLocalInvoices(businessId, mapped);
        return mapped;
      }
    } catch {
      // Fall through to local cache on error/offline
    }
  }

  return getLocalInvoices(businessId);
}

export async function saveInvoiceRecord(businessId, doc) {
  if (!businessId) throw new Error("Business ID is required to save an invoice.");
  if (!doc.customer_name?.trim()) throw new Error("Customer name is required.");
  if (!doc.items || doc.items.length === 0) throw new Error("Add at least one line item.");

  const cleanDoc = {
    ...doc,
    business_id: businessId,
    customer_name: doc.customer_name.trim(),
    customer_phone: doc.customer_phone?.trim() || "",
    customer_email: doc.customer_email?.trim() || null,
    customer_address: doc.customer_address?.trim() || null,
    discount_amount: Number(doc.discount_amount || 0),
    tax_rate: Number(doc.tax_rate || 0),
    subtotal: Number(doc.subtotal || 0),
    tax_amount: Number(doc.tax_amount || 0),
    total_amount: Number(doc.total_amount || 0),
    status: doc.status || "draft",
    updated_at: new Date().toISOString(),
  };

  let savedId = doc.id;

  if (isSupabaseConfigured && supabase) {
    try {
      const payload = {
        business_id: businessId,
        doc_number: cleanDoc.doc_number,
        doc_type: cleanDoc.doc_type,
        status: cleanDoc.status,
        customer_name: cleanDoc.customer_name,
        customer_phone: cleanDoc.customer_phone,
        customer_email: cleanDoc.customer_email,
        customer_address: cleanDoc.customer_address,
        issue_date: cleanDoc.issue_date,
        due_date: cleanDoc.due_date || null,
        subtotal: cleanDoc.subtotal,
        discount_amount: cleanDoc.discount_amount,
        tax_rate: cleanDoc.tax_rate,
        tax_amount: cleanDoc.tax_amount,
        total_amount: cleanDoc.total_amount,
        payment_terms: cleanDoc.payment_terms || "",
        bank_momo_details: cleanDoc.bank_momo_details || "",
        notes: cleanDoc.notes || "",
      };

      if (cleanDoc.id && !String(cleanDoc.id).startsWith("local-")) {
        const { error: updateErr } = await supabase
          .from("billing_documents")
          .update(payload)
          .eq("id", cleanDoc.id)
          .eq("business_id", businessId);

        if (updateErr) throw updateErr;

        // Replace items
        await supabase.from("billing_document_items").delete().eq("document_id", cleanDoc.id);
        savedId = cleanDoc.id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("billing_documents")
          .insert(payload)
          .select("id")
          .single();

        if (insertErr) throw insertErr;
        savedId = inserted.id;
      }

      if (savedId) {
        const itemsPayload = cleanDoc.items.map((i) => ({
          document_id: savedId,
          product_id: i.product_id || null,
          description: i.description || "Item",
          quantity: Number(i.quantity || 1),
          unit_price: Number(i.unit_price || 0),
          line_total: Number(i.line_total || 0),
        }));

        const { error: itemsErr } = await supabase
          .from("billing_document_items")
          .insert(itemsPayload);

        if (itemsErr) console.warn("[invoiceService] items error:", itemsErr);
      }
    } catch (dbErr) {
      console.warn("[invoiceService] Supabase save failed, saving to local cache:", dbErr.message);
      if (!savedId) {
        savedId = `local-${Date.now()}`;
      }
    }
  } else {
    if (!savedId) {
      savedId = `local-${Date.now()}`;
    }
  }

  const finalDoc = {
    ...cleanDoc,
    id: savedId,
    created_at: cleanDoc.created_at || new Date().toISOString(),
  };

  // Update local storage
  const localList = getLocalInvoices(businessId);
  const existingIdx = localList.findIndex((d) => d.id === finalDoc.id || d.doc_number === finalDoc.doc_number);
  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = finalDoc;
  } else {
    updatedList = [finalDoc, ...localList];
  }
  saveLocalInvoices(businessId, updatedList);

  return finalDoc;
}

export async function deleteInvoiceRecord(businessId, docId) {
  if (!businessId || !docId) return;

  if (isSupabaseConfigured && supabase && !String(docId).startsWith("local-")) {
    try {
      await supabase
        .from("billing_documents")
        .delete()
        .eq("id", docId)
        .eq("business_id", businessId);
    } catch {
      // Local deletion proceeds regardless
    }
  }

  const localList = getLocalInvoices(businessId).filter((d) => d.id !== docId);
  saveLocalInvoices(businessId, localList);
}

export async function updateInvoiceStatus(businessId, docId, nextStatus) {
  if (!businessId || !docId) return;

  if (isSupabaseConfigured && supabase && !String(docId).startsWith("local-")) {
    try {
      await supabase
        .from("billing_documents")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", docId)
        .eq("business_id", businessId);
    } catch {
      // Fallback to local
    }
  }

  const localList = getLocalInvoices(businessId).map((d) =>
    d.id === docId ? { ...d, status: nextStatus, updated_at: new Date().toISOString() } : d
  );
  saveLocalInvoices(businessId, localList);
}
