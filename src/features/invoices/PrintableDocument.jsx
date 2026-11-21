import { formatCurrency } from "../../lib/formatters.js";
import { createPortal } from "react-dom";

export function PrintableDocument({ doc, business = {} }) {
  const typeTitles = {
    quotation: "QUOTATION / ESTIMATE",
    invoice: "COMMERCIAL INVOICE",
    receipt: "OFFICIAL RECEIPT",
    proforma: "PROFORMA INVOICE",
  };

  const title = typeTitles[doc.doc_type] || "INVOICE";
  const currencyCode = business?.currency || "GHS";

  const statusStyles = {
    paid: "border-emerald-500 bg-emerald-50 text-emerald-800",
    sent: "border-blue-500 bg-blue-50 text-blue-800",
    draft: "border-amber-500 bg-amber-50 text-amber-800",
    declined: "border-red-500 bg-red-50 text-red-800",
    cancelled: "border-slate-500 bg-slate-50 text-slate-800",
  };

  const badgeClass = statusStyles[doc.status] || "border-slate-300 bg-slate-50 text-slate-700";

  const documentMarkup = (
    <div className="printable-document-root w-full flex justify-center py-2 sm:py-6 bg-slate-100 print:bg-white print:p-0">
      <style>{`
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body > * { display: none !important; }
          body > .printable-document-root { display: block !important; }
          .printable-document-root { position: static !important; }
          #printable-invoice-sheet {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: auto;
          }
          #printable-invoice-sheet tr { page-break-inside: avoid; }
          #printable-invoice-sheet table { page-break-inside: auto; }
          #printable-invoice-sheet thead { display: table-header-group; }
          #printable-invoice-sheet .overflow-x-auto { overflow: visible !important; }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="printable-invoice-sheet"
        className="w-full max-w-[210mm] min-h-[297mm] bg-white p-6 sm:p-10 rounded-2xl shadow-lg border border-slate-200/80 text-slate-800 flex flex-col justify-between"
      >
        <div>
          {/* Header Bar: Business Info & Document Meta */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-900 pb-6">
            <div className="space-y-1.5 max-w-sm">
              {business?.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name || "Business Logo"}
                  className="h-14 w-auto object-contain mb-2"
                />
              ) : (
                <div className="inline-block bg-slate-900 text-white px-3 py-1.5 rounded-lg font-black text-lg tracking-wider uppercase mb-1">
                  {business?.name || "BIZTRAC STORE"}
                </div>
              )}
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {business?.name || "BizTrac Store"}
              </h1>
              {business?.slogan && (
                <p className="text-xs italic text-slate-500">{business.slogan}</p>
              )}
              <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                {business?.location && <p><span className="font-semibold text-slate-700">Location:</span> {business.location}</p>}
                {business?.phone && <p><span className="font-semibold text-slate-700">Tel:</span> {business.phone}</p>}
                {business?.email && <p><span className="font-semibold text-slate-700">Email:</span> {business.email}</p>}
                {business?.tin_number && (
                  <p className="font-semibold text-slate-800">
                    TIN: <span className="font-mono">{business.tin_number}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right space-y-2">
              <div className="inline-block">
                <span className="text-2xl font-black uppercase tracking-wider text-slate-900 block">
                  {title}
                </span>
                <span
                  className={`mt-1 inline-block px-3 py-0.5 rounded-full text-[11px] font-black uppercase border tracking-wider ${badgeClass}`}
                >
                  {doc.status}
                </span>
              </div>

              <div className="text-xs space-y-1 font-mono pt-2">
                <div>
                  <span className="text-slate-500 uppercase">Doc #: </span>
                  <strong className="text-slate-900 text-sm font-black">{doc.doc_number}</strong>
                </div>
                <div>
                  <span className="text-slate-500 uppercase">Issue Date: </span>
                  <strong className="text-slate-800">{doc.issue_date}</strong>
                </div>
                {doc.due_date && (
                  <div>
                    <span className="text-slate-500 uppercase">Due / Valid Until: </span>
                    <strong className="text-slate-800">{doc.due_date}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bill To & Customer Info Card */}
          <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Billed To / Customer:
              </p>
              <h3 className="text-base font-black text-slate-900">
                {doc.customer_name || "Valued Customer"}
              </h3>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                {doc.customer_phone && <p>Tel: {doc.customer_phone}</p>}
                {doc.customer_email && <p>Email: {doc.customer_email}</p>}
                {doc.customer_address && <p>Address: {doc.customer_address}</p>}
              </div>
            </div>

            <div className="sm:text-right flex flex-col justify-end">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                Currency & Settlement
              </p>
              <p className="text-xs font-semibold text-slate-700">
                Operating Currency: <strong>{currencyCode}</strong>
              </p>
              <p className="text-xs text-slate-500">
                All amounts are in {currencyCode}.
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900">
                  <th className="py-2.5 px-3 font-black uppercase w-10">#</th>
                  <th className="py-2.5 px-3 font-black uppercase">Item / Description</th>
                  <th className="py-2.5 px-3 font-black uppercase text-center w-20">Qty</th>
                  <th className="py-2.5 px-3 font-black uppercase text-right w-28">Unit Price</th>
                  <th className="py-2.5 px-3 font-black uppercase text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(doc.items || []).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{item.description || "—"}</p>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 my-6 pt-4 border-t border-slate-200">
            {/* Left: Payment Instructions & Terms */}
            <div className="w-full sm:w-7/12 space-y-4 text-xs">
              {doc.bank_momo_details && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    💳 Payment Details (Bank / MoMo)
                  </p>
                  <p className="font-mono text-slate-700 whitespace-pre-line text-[11px] leading-relaxed">
                    {doc.bank_momo_details}
                  </p>
                </div>
              )}

              {doc.payment_terms && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    📋 Payment Terms & Conditions
                  </p>
                  <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                    {doc.payment_terms}
                  </p>
                </div>
              )}

              {doc.notes && (
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                    📝 Notes & Remarks
                  </p>
                  <p className="text-slate-600 italic text-[11px]">{doc.notes}</p>
                </div>
              )}
            </div>

            {/* Right: Calculations */}
            <div className="w-full sm:w-5/12 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">{formatCurrency(doc.subtotal)}</span>
              </div>

              {Number(doc.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono">- {formatCurrency(doc.discount_amount)}</span>
                </div>
              )}

              {Number(doc.tax_rate) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    Tax / VAT ({doc.tax_rate}%):
                  </span>
                  <span className="font-mono font-medium">
                    {formatCurrency(doc.tax_amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-3 border-t-2 border-slate-900">
                <span className="uppercase tracking-tight">Total Amount Due:</span>
                <span className="text-base font-black font-mono text-emerald-800">
                  {formatCurrency(doc.total_amount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer & Signature Block */}
        <div className="pt-8 border-t border-slate-200 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-500">
            <div>
              <p className="font-bold text-slate-700">{business?.name || "BizTrac Store"}</p>
              <p className="text-[11px]">Computer generated invoice. Valid without seal unless specified.</p>
            </div>

            <div className="text-center sm:text-right w-52 space-y-2">
              <div className="border-b border-slate-400 h-10 w-full" />
              <p className="font-black text-slate-800 uppercase text-[10px] tracking-wider">
                Authorized Signature & Stamp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined"
    ? documentMarkup
    : createPortal(documentMarkup, document.body);
}
