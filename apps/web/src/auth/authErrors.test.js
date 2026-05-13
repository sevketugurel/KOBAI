import { describe, expect, it } from "vitest";
import { formatAuthError, normalizeAuthEmail } from "./authErrors";
function mockAuthError(partial) {
    return partial;
}
describe("normalizeAuthEmail", () => {
    it("trims and lowercases", () => {
        expect(normalizeAuthEmail("  Test@Example.COM \t")).toBe("test@example.com");
    });
});
describe("formatAuthError", () => {
    it("returns null for null", () => {
        expect(formatAuthError(null)).toBeNull();
    });
    it("maps invalid_credentials", () => {
        expect(formatAuthError(mockAuthError({
            name: "AuthApiError",
            message: "Invalid login credentials",
            status: 400,
            code: "invalid_credentials",
        }))).toContain("E-posta veya şifre hatalı");
    });
    it("maps English message without code", () => {
        expect(formatAuthError(mockAuthError({
            name: "AuthApiError",
            message: "Invalid login credentials",
            status: 400,
        }))).toContain("E-posta veya şifre hatalı");
    });
    it("maps email_not_confirmed", () => {
        expect(formatAuthError(mockAuthError({
            name: "AuthApiError",
            message: "Email not confirmed",
            status: 400,
            code: "email_not_confirmed",
        }))).toContain("doğrulanmamış");
    });
});
