import { useCallback, useState } from "react";
import { streamChat } from "../api/client";
export function useChat(jobId) {
    const [messages, setMessages] = useState([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState(null);
    const sendMessage = useCallback(async (text) => {
        const userMsg = { role: "user", content: text };
        setMessages(m => [...m, userMsg, { role: "assistant", content: "" }]);
        setIsStreaming(true);
        setError(null);
        try {
            await streamChat(text, jobId, [...messages, userMsg], (chunk) => {
                setMessages(m => {
                    const copy = m.slice();
                    const last = copy[copy.length - 1];
                    if (last && last.role === "assistant")
                        copy[copy.length - 1] = { ...last, content: last.content + chunk };
                    return copy;
                });
            });
        }
        catch (e) {
            setError(e instanceof Error ? e : new Error("chat error"));
        }
        finally {
            setIsStreaming(false);
        }
    }, [jobId, messages]);
    return { messages, sendMessage, isStreaming, error };
}
