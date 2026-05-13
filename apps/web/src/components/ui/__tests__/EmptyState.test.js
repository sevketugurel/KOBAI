import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
describe("EmptyState", () => {
    it("renders title, message, and action", () => {
        render(_jsx(EmptyState, { title: "Veri yok", message: "Hen\u00FCz hareket eklemediniz", action: _jsx("button", { children: "Ekle" }) }));
        expect(screen.getByRole("heading", { name: "Veri yok" })).toBeInTheDocument();
        expect(screen.getByText("Henüz hareket eklemediniz")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ekle" })).toBeInTheDocument();
    });
    it("renders without message or action", () => {
        render(_jsx(EmptyState, { title: "Bo\u015F" }));
        expect(screen.getByRole("heading", { name: "Boş" })).toBeInTheDocument();
    });
});
