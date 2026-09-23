import { useEffect, useRef } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { AIMessage } from "./AIMessage.jsx";
import { AIThinkingIndicator } from "./AIThinkingIndicator.jsx";
import { STARTER_PROMPTS } from "../../services/aiService.js";

export function AIChat({
  messages = [],
  isThinking = false,
  thinkingStep = "",
  onSendMessage,
  onRateFeedback,
  businessName = "Your Business",
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="my-auto space-y-6 py-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-palm to-palmDeep text-white shadow-xl shadow-palm/25">
          <Sparkles className="h-8 w-8" />
        </div>

        <div className="mx-auto max-w-lg space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">
            Welcome to BizTrac AI
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Your intelligent business co-pilot for <span className="font-bold text-palm">{businessName}</span>. Ask questions in natural language to gain actionable insights.
          </p>
        </div>

        {/* STARTER PROMPTS GRID */}
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {STARTER_PROMPTS.map((starter) => (
            <button
              key={starter.id}
              onClick={() => onSendMessage(starter.prompt)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-palm/40 hover:shadow-lg"
            >
              <div>
                <span className="text-lg">{starter.title.split(" ")[0]}</span>
                <h3 className="mt-1 text-sm font-black text-ink group-hover:text-palm">
                  {starter.title.slice(3)}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {starter.subtitle}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-bold text-palm">
                <span>Ask AI</span>
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Strict Privacy: AI uses secure PostgreSQL RPC data contracts only.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {messages.map((msg) => (
        <AIMessage
          key={msg.id}
          message={msg}
          onSelectSuggestion={onSendMessage}
          onRateFeedback={onRateFeedback}
        />
      ))}

      {isThinking ? <AIThinkingIndicator stepText={thinkingStep} /> : null}

      <div ref={bottomRef} />
    </div>
  );
}
