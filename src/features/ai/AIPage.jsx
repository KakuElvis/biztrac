import { AIAssistant } from "../../components/ai/AIAssistant.jsx";

export function AIPage({
  business,
  products = [],
  sales = [],
  customers = [],
  expenses = [],
  initialPrompt = null,
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-ink sm:text-3xl">BizTrac AI Assistant</h1>
        <p className="text-xs font-medium text-slate-500 sm:text-sm">
          Ask questions, analyze financial trends, and receive instant business recommendations powered by Gemini AI.
        </p>
      </div>

      <AIAssistant
        business={business}
        products={products}
        sales={sales}
        customers={customers}
        expenses={expenses}
        initialPrompt={initialPrompt}
      />
    </div>
  );
}

export default AIPage;
