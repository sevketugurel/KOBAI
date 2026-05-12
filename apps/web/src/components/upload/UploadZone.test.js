import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import UploadZone from "./UploadZone";
import * as api from "../../api/client";
describe("UploadZone", () => {
    it("calls onUploadSuccess after successful upload", async () => {
        const fakeData = { invoice_id: "i1", data: { vendor_name: "V" } };
        vi.spyOn(api, "uploadInvoice").mockResolvedValue(fakeData);
        const onSuccess = vi.fn();
        render(_jsx(UploadZone, { onUploadSuccess: onSuccess }));
        const file = new File([new Uint8Array([1])], "a.pdf", { type: "application/pdf" });
        const input = screen.getByLabelText(/pdf yükle/i);
        await userEvent.upload(input, file);
        expect(onSuccess).toHaveBeenCalledWith("i1", fakeData.data);
    });
});
