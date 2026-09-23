import { Sparkles } from "lucide-react";

export function AIThinkingIndicator({ stepText }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-palm/20 bg-gradient-to-r from-skyglass/80 via-white to-skyglass/50 px-4 py-3 text-xs font-bold text-palm shadow-sm animate-pulse">
      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-palm text-white shadow-md shadow-palm/30">
        <Sparkles className="h-3.5 w-3.5 animate-spin" />
      </div>
      <span>{stepText || "✨ BizTrac AI is analyzing your business data..."}</span>
    </div>
  );
}
