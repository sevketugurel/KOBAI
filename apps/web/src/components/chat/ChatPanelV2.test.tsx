import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatPanelV2 from "./ChatPanelV2";
import AIActionButton from "../copilot/AIActionButton";
import { TenantAIActionProvider } from "../copilot/TenantAIActionContext";

const sendMessage = vi.fn();

vi.mock("../../hooks/useV2Chat", () => ({
  useV2Chat: () => ({
    messages: [],
    sendMessage,
    isStreaming: false,
    isLoadingHistory: false,
    error: null,
  }),
}));

describe("ChatPanelV2", () => {
  it("renders example prompts when history is empty", () => {
    render(<ChatPanelV2 slug="acme" sessionId="s-1" />);
    expect(screen.getByText(/kritik finansal riskim/i)).toBeInTheDocument();
  });

  it("sends external AI action prompt through chat", () => {
    render(
      <TenantAIActionProvider>
        <AIActionButton
          action={{
            id: "risk",
            label: "Riski Derinleştir",
            prompt: "Riski detaylandır.",
            variant: "analyze",
          }}
        />
        <ChatPanelV2 slug="acme" sessionId="s-1" />
      </TenantAIActionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /riski derinleştir/i }));
    expect(sendMessage).toHaveBeenCalledWith("Riski detaylandır.");
  });
});
