import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Trash2, HelpCircle } from "lucide-react";
import { STARTER_PROMPTS } from "../../services/aiService.js";

export function AIInput({
  onSendMessage,
  onClear,
  isThinking,
  hasMessages,
}) {
  const [text, setText] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isThinking) return;
    onSendMessage(text);
    setText("");
    setShowMenu(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectStarter = (promptText) => {
    onSendMessage(promptText);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      {/* QUICK STARTER PROMPT POPOVER */}
      {showMenu ? (
        <div className="absolute bottom-full mb-3 inset-x-0 z-20 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quick AI Prompts
            </span>
            <button
              onClick={() => setShowMenu(false)}
              className="text-xs font-bold text-slate-400 hover:text-ink"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {STARTER_PROMPTS.map((starter) => (
              <button
                key={starter.id}
                onClick={() => handleSelectStarter(starter.prompt)}
                className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:border-palm/30 hover:bg-skyglass"
              >
                <div className="text-sm">{starter.title.split(" ")[0]}</div>
                <div>
                  <p className="text-xs font-bold text-ink">{starter.title.slice(3)}</p>
                  <p className="text-[0.7rem] font-medium text-slate-500">{starter.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-soft focus-within:border-palm focus-within:ring-4 focus-within:ring-palm/10">
        <button
          type="button"
          onClick={() => setShowMenu((prev) => !prev)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-skyglass hover:text-palm"
          title="Quick prompts"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask BizTrac anything about sales, stock, debts, or expenses..."
          rows={1}
          disabled={isThinking}
          className="max-h-32 min-h-[2.5rem] w-full resize-none border-none bg-transparent py-2.5 text-sm font-semibold text-ink placeholder-slate-400 outline-none"
        />

        {hasMessages ? (
          <button
            type="button"
            onClick={onClear}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Clear Chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!text.trim() || isThinking}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-palm text-white shadow-md shadow-palm/20 transition hover:bg-palmDeep disabled:opacity-40 disabled:hover:bg-palm"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
