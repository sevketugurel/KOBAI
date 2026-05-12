import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AgentTrace from "./AgentTrace";

describe("AgentTrace", () => {
  it("expands to show step details", () => {
    render(<AgentTrace trace={[
      { agent_name: "risk", action: "assess", input:{}, output:{}, duration_ms: 42, confidence: 4.5 },
    ]} />);
    fireEvent.click(screen.getByText(/risk/i));
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });
});
