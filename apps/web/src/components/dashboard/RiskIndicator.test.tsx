import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RiskIndicator from "./RiskIndicator";

describe("RiskIndicator", () => {
  it("renders explanation and active color", () => {
    render(<RiskIndicator risk_label="yellow" risk_score={3} explanation="Dikkat: gelir düşüşü." />);
    expect(screen.getByText(/Dikkat/)).toBeInTheDocument();
    expect(screen.getByTestId("light-yellow")).toHaveClass("opacity-100");
  });
});
