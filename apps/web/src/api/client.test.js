import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadInvoice, getAnalysisStatus, ApiError } from "./client";
describe("api client", () => {
    beforeEach(() => { vi.restoreAllMocks(); });
    it("uploads PDF and returns invoice data", async () => {
        const fakeResp = { invoice_id: "i1", data: { vendor_name: "V" } };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fakeResp), { status: 200 })));
        const f = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
        const r = await uploadInvoice(f);
        expect(r.invoice_id).toBe("i1");
    });
    it("throws ApiError on 4xx", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 400 })));
        await expect(getAnalysisStatus("x")).rejects.toBeInstanceOf(ApiError);
    });
});
