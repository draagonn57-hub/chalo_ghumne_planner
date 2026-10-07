import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

const SUGGESTED = [
  "What's the weather like on Day 3?",
  "Can you suggest a cheaper hotel?",
  "What should I pack for this trip?",
  "Is this trip budget-friendly?",
  "What's the best way to get around?",
  "Are there any hidden costs I should know about?",
];

function formatTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TravelAssistant({ itinerary }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const scroll = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scroll();
  }, [messages, scroll]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      text: trimmed,
      time: formatTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/assistant/ask", {
        question: trimmed,
        itinerary: itinerary || {},
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: res.data.reply,
          time: formatTime(),
        },
      ]);
    } catch (err) {
      const detail =
        err.response?.data?.detail || err.message || "Something went wrong.";
      setError(detail);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          time: formatTime(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0D5C75] text-white shadow-xl flex items-center justify-center hover:bg-[#0a4a5e] transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Ask AI assistant"
        data-testid="assistant-toggle"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>

        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F2B48A] rounded-full flex items-center justify-center">
            <Sparkles size={10} className="text-[#0D5C75]" />
          </span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 max-h-[70vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            data-testid="assistant-panel"
          >
            {/* Header */}
            <div className="bg-[#0D5C75] text-white px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <div className="font-display text-lg leading-tight">
                  Travel Assistant
                </div>
                <div className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  AI-powered · here to help
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Close assistant"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50"
            >
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-[#0D5C75]/10 flex items-center justify-center mx-auto">
                    <MessageCircle size={28} className="text-[#0D5C75]" />
                  </div>
                  <p className="text-slate-600 font-medium mt-3">
                    Ask me anything about your trip!
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    I can help with weather, costs, activities, packing, and more.
                  </p>

                  <div className="mt-5 space-y-2">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="block w-full text-left text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2.5 hover:border-[#0D5C75] hover:text-[#0D5C75] transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-[#0D5C75] text-white rounded-br-md"
                        : msg.isError
                        ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-md"
                        : "bg-white border border-slate-200 text-slate-700 rounded-bl-md"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    <span
                      className={`block text-[10px] mt-1 ${
                        msg.role === "user" ? "text-white/50" : "text-slate-400"
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 rounded-full bg-[#0D5C75]"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 p-3 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about your trip..."
                  rows={1}
                  className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0D5C75] focus:ring-1 focus:ring-[#0D5C75] max-h-24"
                  data-testid="assistant-input"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="w-10 h-10 rounded-xl bg-[#0D5C75] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0a4a5e] transition-colors shrink-0"
                  aria-label="Send message"
                  data-testid="assistant-send"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
