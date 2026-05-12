import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as api from "../api/client";
import { useAnalysis } from "./useAnalysis";

describe("useAnalysis", () => {
  it("stops polling on completed", async () => {
    const spy = vi.spyOn(api, "getAnalysisStatus")
      .mockResolvedValueOnce({ status: "processing" } as any)
      .mockResolvedValueOnce({ status: "completed" } as any);
    const { result } = renderHook(() => useAnalysis("j1", 10));
    await waitFor(() => expect(result.current.status).toBe("completed"));
    const count = spy.mock.calls.length;
    await new Promise(r => setTimeout(r, 50));
    expect(spy.mock.calls.length).toBe(count);
  });
});
