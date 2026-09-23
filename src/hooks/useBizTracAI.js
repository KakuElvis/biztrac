import { useState, useCallback, useEffect } from "react";
import { askBizTracAI } from "../services/aiService.js";

const THINKING_STEPS = [
  "✨ Analyzing your request...",
  "📊 Checking real-time database functions...",
  "📦 Evaluating inventory & sales velocity...",
  "💡 Generating personalized business insights...",
];

export function useBizTracAI({ contextData = {}, initialPrompt = null } = {}) {
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(THINKING_STEPS[0]);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(() => "conv-" + Date.now());

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || "").trim();
      if (!trimmed || isThinking) return;

      const userMsgId = "msg-user-" + Date.now();
      const userMsg = {
        id: userMsgId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setError(null);
      setThinkingStep(THINKING_STEPS[0]);

      // Step indicator timer simulation
      let stepIndex = 0;
      const stepInterval = setInterval(() => {
        stepIndex = (stepIndex + 1) % THINKING_STEPS.length;
        setThinkingStep(THINKING_STEPS[stepIndex]);
      }, 700);

      try {
        const response = await askBizTracAI({
          message: trimmed,
          conversationId,
          contextData,
        });

        clearInterval(stepInterval);

        const aiMsgId = "msg-ai-" + Date.now();
        const aiMsg = {
          id: aiMsgId,
          role: "assistant",
          content: response.message || response.answer || "Here is your business analysis.",
          type: response.type || "overview",
          facts: response.facts || [],
          insights: response.insights || [],
          recommendation: response.recommendation || null,
          dataCards: response.dataCards || [],
          suggestions: response.suggestions || [],
          createdAt: new Date().toISOString(),
          feedback: null, // 'up' | 'down'
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        clearInterval(stepInterval);
        console.error("BizTrac AI Error:", err);
        setError("Unable to process AI request. Please check your network connection and try again.");
      } finally {
        setIsThinking(false);
      }
    },
    [conversationId, contextData, isThinking]
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
    setConversationId("conv-" + Date.now());
  }, []);

  const rateFeedback = useCallback((messageId, rating) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, feedback: rating } : msg))
    );
  }, []);

  // Handle initial prompt trigger if supplied
  useEffect(() => {
    if (initialPrompt && messages.length === 0 && !isThinking) {
      sendMessage(initialPrompt);
    }
  }, [initialPrompt, messages.length, isThinking, sendMessage]);

  return {
    messages,
    isThinking,
    thinkingStep,
    error,
    sendMessage,
    clearConversation,
    rateFeedback,
  };
}
