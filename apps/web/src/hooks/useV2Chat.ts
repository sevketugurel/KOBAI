import { useCallback, useEffect, useState } from "react";
import { v2, V2ApiError, type ChatMessageV2 } from "../api/v2";

interface UseV2ChatOptions {
  slug: string;
  sessionId: string;
  jobId?: string | null;
}

export function useV2Chat({ slug, sessionId, jobId = null }: UseV2ChatOptions) {
  const [messages, setMessages] = useState<ChatMessageV2[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingHistory(true);
    v2.getChatHistory(slug, sessionId)
      .then(history => {
        if (!cancelled) setMessages(history);
      })
      .catch(e => {
        if (cancelled) return;
        if (e instanceof V2ApiError && e.status === 404) {
          setMessages([]);
        } else {
          setError(e instanceof Error ? e : new Error("history error"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, [slug, sessionId]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessageV2 = { role: "user", content: text };
    setMessages(m => [...m, userMsg, { role: "assistant", content: "" }]);
    setIsStreaming(true);
    setError(null);
    try {
      await v2.streamChatV2(
        slug,
        { message: text, session_id: sessionId, job_id: jobId ?? undefined },
        (chunk) => {
          setMessages(m => {
            const copy = m.slice();
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e : new Error("chat error"));
    } finally {
      setIsStreaming(false);
    }
  }, [slug, sessionId, jobId]);

  return { messages, sendMessage, isStreaming, isLoadingHistory, error };
}
