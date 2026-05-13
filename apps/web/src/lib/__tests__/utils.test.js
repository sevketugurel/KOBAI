import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { cn, formatTRY, formatPercent, formatDate, formatDateTime, formatRelative, } from "../utils";
describe("cn", () => {
    it("joins truthy classes", () => {
        expect(cn("a", false, undefined, "b", null, "c")).toBe("a b c");
    });
});
describe("formatTRY / formatPercent (regression)", () => {
    it("formats currency", () => {
        expect(formatTRY(1234)).toContain("1.234");
    });
    it("formats percent", () => {
        expect(formatPercent(12.5)).toBe("%12,5");
    });
});
describe("formatDate", () => {
    it("formats ISO string as 'DD Mon YYYY'", () => {
        const out = formatDate("2026-05-13");
        expect(out).toMatch(/13\s+May\s+2026/);
    });
    it("accepts Date instance", () => {
        const out = formatDate(new Date(2026, 0, 5));
        expect(out).toMatch(/05\s+Oca\s+2026/);
    });
});
describe("formatDateTime", () => {
    it("includes time component", () => {
        const out = formatDateTime(new Date(2026, 4, 13, 22, 45));
        expect(out).toMatch(/13/);
        expect(out).toMatch(/22:45/);
    });
});
describe("formatRelative", () => {
    beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 4, 13, 12, 0, 0));
    });
    afterAll(() => {
        vi.useRealTimers();
    });
    it("returns 'bugün' for today", () => {
        expect(formatRelative(new Date(2026, 4, 13, 15, 0, 0))).toBe("bugün");
    });
    it("returns past phrase for 2 days ago", () => {
        const out = formatRelative(new Date(2026, 4, 11, 12, 0, 0));
        expect(out).toMatch(/önce/);
    });
    it("returns future phrase for 3 days ahead", () => {
        const out = formatRelative(new Date(2026, 4, 16, 12, 0, 0));
        expect(out).toMatch(/sonra/);
    });
});
