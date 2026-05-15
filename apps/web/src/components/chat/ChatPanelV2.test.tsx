import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatPanelV2 from "./ChatPanelV2";

vi.mock("../../hooks/useV2Chat", () => ({
  useV2Chat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isStreaming: false,
    isLoadingHistory: false,
    error: null,
  }),
}));

describe("ChatPanelV2", () => {
  it("renders example prompts when history is empty", () => {
    render(<ChatPanelV2 slug="acme" sessionId="s-1" />);
    expect(screen.getByText(/KDV ödeyeceğim/i)).toBeInTheDocument();
  });
});
