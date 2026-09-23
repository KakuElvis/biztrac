import { Sparkles, RefreshCw, Bot } from "lucide-react";
import { AIChat } from "./AIChat.jsx";
import { AIInput } from "./AIInput.jsx";
import { useBizTracAI } from "../../hooks/useBizTracAI.js";

export function AIAssistant({
  business = { name: "Your Business" },
  products = [],
  sales = [],
  customers = [],
  expenses = [],
  initialPrompt = null,
}) {
  const contextData = { business, products, sales, customers, expenses };

  const {
    messages,
    isThinking,
    thinkingStep,
    error,
    sendMessage,
    clearConversation,
    rateFeedback,
  } = useBizTracAI({ contextData, initialPrompt });

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-[35rem] flex-col rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-white shadow-soft">
      {/* AI HEADER */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-palm to-palmDeep text-white shadow-md shadow-palm/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-ink">BizTrac AI Co-Pilot</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[0.63rem] font-bold text-emerald-800 uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Gemini 2.5 Active
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Intelligence Assistant for {business.name}
            </p>
          </div>
        </div>

        {messages.length > 0 ? (
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-palm/40 hover:text-palm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>New Chat</span>
          </button>
        ) : null}
      </div>

      {/* ERROR BANNER */}
      {error ? (
        <div className="mx-4 mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 sm:mx-6">
          {error}
        </div>
      ) : null}

      {/* CHAT TIMELINE CANVAS */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <AIChat
          messages={messages}
          isThinking={isThinking}
          thinkingStep={thinkingStep}
          onSendMessage={sendMessage}
          onRateFeedback={rateFeedback}
          businessName={business.name}
        />
      </div>

      {/* INPUT TOOLBAR */}
      <div className="border-t border-slate-200 bg-white/90 p-3 backdrop-blur sm:p-4">
        <AIInput
          onSendMessage={sendMessage}
          onClear={clearConversation}
          isThinking={isThinking}
          hasMessages={messages.length > 0}
        />
      </div>
    </div>
  );
}
