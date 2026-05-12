import { useState } from "react";
import { useChat } from "../../hooks/useChat";

const SAMPLES = [
  "Bu ay ne kadar KDV ödeyeceğim?",
  "KOSGEB'e başvurabilir miyim?",
  "En büyük gider kalemim ne?",
];

export default function ChatPanel({ jobId }: { jobId: string }) {
  const { messages, sendMessage, isStreaming } = useChat(jobId);
  const [input, setInput] = useState("");

  const submit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input); setInput("");
  };

  return (
    <div className="flex flex-col h-full border border-stone-200 rounded bg-white/60 p-4">
      <div className="flex-1 overflow-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <div className="text-sm text-stone-600">
            <div className="mb-2">Örnek sorular:</div>
            <ul className="space-y-1">
              {SAMPLES.map(s => <li key={s}><button className="text-emerald-700 underline" onClick={() => sendMessage(s)}>{s}</button></li>)}
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={`inline-block px-3 py-1 rounded ${m.role === "user" ? "bg-emerald-100" : "bg-stone-100"}`}>
              {m.content}{isStreaming && i === messages.length - 1 && m.role === "assistant" && <span className="animate-pulse">▍</span>}
            </span>
          </div>
        ))}
        {isStreaming && <div className="text-xs text-stone-500">Düşünüyor…</div>}
      </div>
      <textarea
        className="w-full border border-stone-300 rounded p-2 text-sm"
        rows={2} value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Bir şey sorun…"
      />
    </div>
  );
}
