import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";
describe("Input", () => {
    it("renders label and associates it with input", () => {
        render(_jsx(Input, { label: "E-posta" }));
        const input = screen.getByLabelText("E-posta");
        expect(input).toBeInTheDocument();
    });
    it("shows error message and red border class when error provided", () => {
        render(_jsx(Input, { label: "E-posta", error: "Ge\u00E7ersiz" }));
        expect(screen.getByText("Geçersiz")).toBeInTheDocument();
        expect(screen.getByLabelText("E-posta").className).toMatch(/border-red-500/);
    });
    it("shows hint when no error", () => {
        render(_jsx(Input, { label: "\u015Eifre", hint: "En az 8 karakter" }));
        expect(screen.getByText("En az 8 karakter")).toBeInTheDocument();
    });
    it("error takes precedence over hint", () => {
        render(_jsx(Input, { label: "X", hint: "hint", error: "err" }));
        expect(screen.getByText("err")).toBeInTheDocument();
        expect(screen.queryByText("hint")).not.toBeInTheDocument();
    });
});
