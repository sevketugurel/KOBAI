import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";
describe("Button", () => {
    it("renders children", () => {
        render(_jsx(Button, { children: "Kaydet" }));
        expect(screen.getByRole("button", { name: /kaydet/i })).toBeInTheDocument();
    });
    it("applies primary variant classes by default", () => {
        render(_jsx(Button, { children: "OK" }));
        expect(screen.getByRole("button").className).toMatch(/bg-navy-600/);
    });
    it("applies danger variant classes", () => {
        render(_jsx(Button, { variant: "danger", children: "Sil" }));
        expect(screen.getByRole("button").className).toMatch(/bg-red-600/);
    });
    it("is disabled when loading", () => {
        render(_jsx(Button, { loading: true, children: "Y\u00FCkleniyor" }));
        const btn = screen.getByRole("button");
        expect(btn).toBeDisabled();
        expect(btn).toHaveAttribute("aria-busy", "true");
    });
    it("fires onClick", () => {
        const fn = vi.fn();
        render(_jsx(Button, { onClick: fn, children: "Click" }));
        fireEvent.click(screen.getByRole("button"));
        expect(fn).toHaveBeenCalledOnce();
    });
    it("does not fire onClick when loading", () => {
        const fn = vi.fn();
        render(_jsx(Button, { onClick: fn, loading: true, children: "Click" }));
        fireEvent.click(screen.getByRole("button"));
        expect(fn).not.toHaveBeenCalled();
    });
});
