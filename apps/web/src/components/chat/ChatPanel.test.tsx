import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatPanel from "./ChatPanel";

vi.mock("../../hooks/useChat", () => ({
  useChat: () => ({ messages: [], sendMessage: vi.fn(), isStreaming: false, error: null }),
}));

describe("ChatPanel", () => {
  it("renders example prompts", () => {
    render(<ChatPanel jobId="j1" />);
    expect(screen.getByText(/KDV ödeyeceğim/i)).toBeInTheDocument();
  });
});
