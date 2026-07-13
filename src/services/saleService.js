import { supabase } from "../lib/supabase.js";
import { toCustomer } from "./customerService.js";

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and anon key to .env.");
  }

  return supabase;
}

function toNumber(value) {
  return Number(value || 0);
}

function toPaymentMethod(value) {
  const normalized = String(value || "cash").toLowerCase();
  if (normalized === "momo") return "momo";
  if (normalized === "bank") return "bank";
  if (normalized === "credit") return "credit";
  return "cash";
}

function toProduct(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    category: row.category || "",
    sku: row.sku || "",
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    quantity: row.quantity,
    lowStockLimit: row.low_stock_limit,
    supplier: row.supplier || "",
    size: row.size || "",
    colour: row.colour || "",
    brand: row.brand || "",
    itemType: row.item_type || "",
  };
}

function toSale(row) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    reference: row.reference,
    paymentMethod: row.payment_method,
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    total: toNumber(row.total),
    amountPaid: toNumber(row.amount_paid),
    soldAt: row.sold_at,
  };
}

function validateLines(lines) {
  if (!lines.length) {
    throw new Error("Add at least one product to the cart.");
  }

  lines.forEach((line) => {
    if (!line.product?.id) throw new Error("A cart item is missing its product.");
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Sale quantities must be whole numbers greater than zero.");
    }
    if (line.quantity > line.product.quantity) {
      throw new Error(`${line.product.name} only has ${line.product.quantity} in stock.`);
    }
  });
}

export async function createSale(businessId, { customer, lines, paymentType }) {
  validateLines(lines);

  const paymentMethod = toPaymentMethod(paymentType);
  const customerId = customer?.mode === "existing" ? customer.id : null;
  const customerName = customer?.mode === "new" ? customer.name : null;
  const customerPhone = customer?.mode === "new" ? customer.phone : null;

  if (paymentMethod === "credit" && !customerId && !customerName?.trim()) {
    throw new Error("Credit sales require a customer.");
  }

  const { data, error } = await requireSupabase().rpc("record_sale", {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_items: lines.map((line) => ({
      product_id: line.product.id,
      quantity: line.quantity,
    })),
    p_notes: null,
    p_payment_method: paymentMethod,
  });

  if (error) throw error;

  return {
    sale: toSale(data.sale),
    customer: data.customer ? toCustomer(data.customer) : null,
    updatedProducts: (data.updated_products || []).map(toProduct),
  };
}
