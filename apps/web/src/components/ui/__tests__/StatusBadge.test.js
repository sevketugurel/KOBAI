import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";
describe("StatusBadge", () => {
    it("renders label with success variant classes", () => {
        render(_jsx(StatusBadge, { variant: "success", label: "Aktif" }));
        const el = screen.getByText("Aktif");
        expect(el.className).toMatch(/bg-emerald-100/);
    });
    it("applies danger variant classes", () => {
        render(_jsx(StatusBadge, { variant: "danger", label: "Hata" }));
        expect(screen.getByText("Hata").className).toMatch(/bg-red-100/);
    });
    it("renders dot when prop set", () => {
        render(_jsx(StatusBadge, { variant: "info", label: "Bilgi", dot: true }));
        const dot = screen.getByText("Bilgi").querySelector("span[aria-hidden='true']");
        expect(dot).not.toBeNull();
    });
});
