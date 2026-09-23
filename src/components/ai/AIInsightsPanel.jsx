import { Sparkles, ArrowRight } from "lucide-react";
import { AIInsightCard } from "./AIInsightCard.jsx";
import { generateProactiveAIInsights } from "../../services/aiService.js";

export function AIInsightsPanel({
  products = [],
  customers = [],
  expenses = [],
  onNavigateToAI,
}) {
  const insights = generateProactiveAIInsights({ products, customers, expenses });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-palm text-white shadow-md shadow-palm/20">
            <Sparkles className="h-4 w-4 animate-spin-slow" />
          </div>
          <h2 className="text-lg font-black text-ink">AI Business Insights</h2>
        </div>

        <button
          onClick={() => onNavigateToAI?.("How is my business doing overall today?")}
          className="flex items-center gap-1.5 text-xs font-bold text-palm hover:text-palmDeep hover:underline"
        >
          <span>Open AI Assistant</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight) => (
          <AIInsightCard
            key={insight.id}
            insight={insight}
            onAction={onNavigateToAI}
          />
        ))}
      </div>
    </section>
  );
}
