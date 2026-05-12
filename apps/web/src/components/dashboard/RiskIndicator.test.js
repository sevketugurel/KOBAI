import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RiskIndicator from "./RiskIndicator";
describe("RiskIndicator", () => {
    it("renders explanation and active color", () => {
        render(_jsx(RiskIndicator, { risk_label: "yellow", risk_score: 3, explanation: "Dikkat: gelir d\u00FC\u015F\u00FC\u015F\u00FC." }));
        expect(screen.getByText(/Dikkat/)).toBeInTheDocument();
        expect(screen.getByTestId("light-yellow")).toHaveClass("opacity-100");
    });
});
