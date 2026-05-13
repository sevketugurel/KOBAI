import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "../PageHeader";
describe("PageHeader", () => {
    it("renders title, subtitle, and actions", () => {
        render(_jsx(PageHeader, { title: "Dashboard", subtitle: "Son g\u00FCncelleme", actions: _jsx("button", { children: "Yenile" }) }));
        expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
        expect(screen.getByText("Son güncelleme")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Yenile" })).toBeInTheDocument();
    });
});
