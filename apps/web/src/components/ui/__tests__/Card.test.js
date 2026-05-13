import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";
describe("Card", () => {
    it("renders title and body", () => {
        render(_jsxs(Card, { children: [_jsx(Card.Header, { title: "Ba\u015Fl\u0131k" }), _jsx(Card.Body, { children: "\u0130\u00E7erik" })] }));
        expect(screen.getByRole("heading", { name: "Başlık" })).toBeInTheDocument();
        expect(screen.getByText("İçerik")).toBeInTheDocument();
    });
    it("renders subtitle and action", () => {
        render(_jsxs(Card, { children: [_jsx(Card.Header, { title: "T", subtitle: "alt", action: _jsx("button", { children: "X" }) }), _jsx(Card.Body, { children: "body" })] }));
        expect(screen.getByText("alt")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "X" })).toBeInTheDocument();
    });
});
