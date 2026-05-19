import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { useV2Chat } from "../../hooks/useV2Chat";
import { isMockMode, type AIQuickAction } from "../../api/v2";
import { cn } from "../../lib/utils";
import { useTenantAIActionEvent } from "../copilot/TenantAIActionContext";

const SAMPLES = [
  "Bugün en kritik finansal riskim ne?",
  "Bu hafta hangi ödemeleri öne almalıyım?",
  "Tahsilat ve POS tarafında nerede sorun görüyor musun?",
];

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

interface ChatPanelV2Props {
  slug: string;
  sessionId: string;
  jobId?: string | null;
  title?: string;
  introCopy?: string;
  samplePrompts?: string[];
  quickActions?: AIQuickAction[];
}

export default function ChatPanelV2({
  slug,
  sessionId,
  jobId = null,
  title = "AI Danışman",
  introCopy,
  samplePrompts = SAMPLES,
  quickActions = [],
}: ChatPanelV2Props) {
  const { messages, sendMessage, isStreaming, isLoadingHistory, error } = useV2Chat({
    slug,
    sessionId,
    jobId,
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const externalAction = useTenantAIActionEvent();
  const handledExternalNonceRef = useRef<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length, isStreaming]);

  useEffect(() => {
    if (!externalAction) return;
    if (externalAction.nonce === handledExternalNonceRef.current) return;
    handledExternalNonceRef.current = externalAction.nonce;
    sendMessage(externalAction.action.prompt);
  }, [externalAction, sendMessage]);

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage(text);
    setInput("");
  };

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isStreaming && (!lastMessage || lastMessage.role !== "assistant");

  return (
    <div className="card flex min-h-[560px] max-h-[calc(100vh-8rem)] flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display font-semibold text-navy-900 text-sm">
              {title}
            </div>
            <div className="flex items-center gap-1.5 text-2xs text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />{" "}
              Çevrimiçi
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoadingHistory ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton h-8 w-1/2 ml-auto" />
            <div className="skeleton h-8 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-navy-600">
              {introCopy ?? (isMockMode
                ? "Mock copilot verisiyle risk, tahsilat ve vergi önceliklerinden başlayabilirsiniz."
                : "Copilot dashboard, vergi, banka, POS ve ajan snapshot verilerini okuyarak yanıt verir; örnek sorularla başlayabilirsiniz.")}
            </p>
            {quickActions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => sendMessage(action.prompt)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-navy-700 transition-colors hover:bg-navy-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="text-xs px-3 py-1.5 rounded-full bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div
              key={m.id ?? i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[92%] whitespace-pre-wrap break-words px-4 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-navy-600 text-white rounded-2xl rounded-tr-md sm:max-w-[88%]"
                    : "bg-surface border border-border text-navy-900 rounded-2xl rounded-tl-md",
                )}
              >
                <MessageContent content={m.content} />
                {isStreaming &&
                  i === messages.length - 1 &&
                  m.role === "assistant" && (
                    <span className="ml-0.5 animate-pulse">▍</span>
                  )}
              </div>
            </motion.div>
          ))
        )}

        {showThinking && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            AI paneli şu anda yanıt veremiyor. Mock modunda demo yanıtı, gerçek API modunda ise RAG dokümanları ve chat servisi beklenir.
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border flex items-end gap-2">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Bugünün finansal önceliğini sorun..."
          className="flex-1 resize-none rounded-2xl px-4 py-2 border border-border bg-background text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-500 max-h-32"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!input.trim() || isStreaming}
          aria-label="Mesaj gönder"
          className="w-10 h-10 rounded-full bg-navy-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-navy-700 transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
