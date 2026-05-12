import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import { cn } from "../../lib/utils";
const SAMPLES = [
    "Bu ay ne kadar KDV ödeyeceğim?",
    "KOSGEB'e başvurabilir miyim?",
    "En büyük gider kalemim ne?",
];
export default function ChatPanel({ jobId }) {
    const { messages, sendMessage, isStreaming } = useChat(jobId);
    const [input, setInput] = useState("");
    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }, [messages.length, isStreaming]);
    const submit = () => {
        const text = input.trim();
        if (!text || isStreaming)
            return;
        sendMessage(text);
        setInput("");
    };
    const lastMessage = messages[messages.length - 1];
    const showThinking = isStreaming && (!lastMessage || lastMessage.role !== "assistant");
    return (_jsxs("div", { className: "card flex flex-col h-[calc(100vh-6rem)] sticky top-24 overflow-hidden", children: [_jsx("div", { className: "px-4 py-3 border-b border-border flex items-center justify-between", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600", children: _jsx(Sparkles, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsx("div", { className: "font-display font-semibold text-navy-900 text-sm", children: "AI Dan\u0131\u015Fman" }), _jsxs("div", { className: "flex items-center gap-1.5 text-2xs text-emerald-600", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" }), " ", "\u00C7evrimi\u00E7i"] })] })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-4 py-4 space-y-3", children: [messages.length === 0 ? (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-navy-600", children: "\u00D6rnek sorulardan ba\u015Flayabilirsiniz." }), _jsx("div", { className: "flex flex-wrap gap-2", children: SAMPLES.map((s) => (_jsx("button", { type: "button", onClick: () => sendMessage(s), className: "text-xs px-3 py-1.5 rounded-full bg-navy-50 text-navy-700 hover:bg-navy-100 transition-colors", children: s }, s))) })] })) : (messages.map((m, i) => (_jsx(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 }, className: cn("flex", m.role === "user" ? "justify-end" : "justify-start"), children: _jsxs("div", { className: cn("max-w-[85%] px-4 py-2 text-sm leading-relaxed", m.role === "user"
                                ? "bg-navy-600 text-white rounded-2xl rounded-tr-md"
                                : "bg-surface border border-border text-navy-900 rounded-2xl rounded-tl-md"), children: [m.content, isStreaming &&
                                    i === messages.length - 1 &&
                                    m.role === "assistant" && (_jsx("span", { className: "ml-0.5 animate-pulse", children: "\u258D" }))] }) }, i)))), showThinking && messages.length > 0 && (_jsx("div", { className: "flex justify-start", children: _jsxs("div", { className: "bg-surface border border-border rounded-2xl rounded-tl-md px-4 py-2 flex items-center gap-1", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot" }), _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot", style: { animationDelay: "0.15s" } }), _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-navy-400 animate-pulse-dot", style: { animationDelay: "0.3s" } })] }) })), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "p-3 border-t border-border flex items-end gap-2", children: [_jsx("textarea", { rows: 1, value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }, placeholder: "Bir \u015Fey sorun...", className: "flex-1 resize-none rounded-2xl px-4 py-2 border border-border bg-background text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-500 max-h-32" }), _jsx("button", { type: "button", onClick: submit, disabled: !input.trim() || isStreaming, "aria-label": "Mesaj g\u00F6nder", className: "w-10 h-10 rounded-full bg-navy-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-navy-700 transition-colors flex-shrink-0", children: _jsx(Send, { className: "w-4 h-4" }) })] })] }));
}
