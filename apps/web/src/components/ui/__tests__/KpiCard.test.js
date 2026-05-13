import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../KpiCard";
describe("KpiCard", () => {
    it("renders label and value", () => {
        render(_jsx(KpiCard, { label: "Net Ak\u0131\u015F", value: "\u20BA 1.234" }));
        expect(screen.getByText("Net Akış")).toBeInTheDocument();
        expect(screen.getByText("₺ 1.234")).toBeInTheDocument();
    });
    it("shows skeleton when loading", () => {
        const { container } = render(_jsx(KpiCard, { label: "X", value: "0", loading: true }));
        expect(container.querySelector(".skeleton")).not.toBeNull();
        expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
    it("renders positive trend in emerald", () => {
        render(_jsx(KpiCard, { label: "X", value: "100", trend: { value: 12, label: "geçen aya göre" } }));
        const trendText = screen.getByText("geçen aya göre").parentElement;
        expect(trendText?.className).toMatch(/text-emerald-600/);
    });
    it("renders negative trend in red", () => {
        render(_jsx(KpiCard, { label: "X", value: "100", trend: { value: -5, label: "düşüş" } }));
        const trendText = screen.getByText("düşüş").parentElement;
        expect(trendText?.className).toMatch(/text-red-600/);
    });
});
