import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "../Select";
describe("Select", () => {
    it("renders options and label", () => {
        render(_jsxs(Select, { label: "Banka", children: [_jsx("option", { value: "a", children: "Akbank" }), _jsx("option", { value: "b", children: "\u0130\u015F Bankas\u0131" })] }));
        expect(screen.getByLabelText("Banka")).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "Akbank" })).toBeInTheDocument();
    });
    it("fires onChange", () => {
        const fn = vi.fn();
        render(_jsxs(Select, { label: "X", onChange: fn, defaultValue: "a", children: [_jsx("option", { value: "a", children: "A" }), _jsx("option", { value: "b", children: "B" })] }));
        fireEvent.change(screen.getByLabelText("X"), { target: { value: "b" } });
        expect(fn).toHaveBeenCalled();
    });
});
