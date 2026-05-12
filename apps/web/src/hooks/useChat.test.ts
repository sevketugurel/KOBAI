import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as api from "../api/client";
import { useChat } from "./useChat";

describe("useChat", () => {
  it("appends streamed chunks to last assistant message", async () => {
    vi.spyOn(api, "streamChat").mockImplementation(async (_m,_j,_h, onChunk) => {
      onChunk("Mer"); onChunk("haba");
    });
    const { result } = renderHook(() => useChat("j1"));
    await act(async () => { await result.current.sendMessage("selam"); });
    await waitFor(() => expect(result.current.messages.at(-1)?.content).toContain("Merhaba"));
  });
});
