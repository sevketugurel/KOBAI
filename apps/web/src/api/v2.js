/** v2 tenant-aware API çağrıları. v1 client.ts korunur; Faz 1'de paralel yaşar. */
import { supabase } from "../auth/supabaseClient";
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export class V2ApiError extends Error {
    status;
    detail;
    constructor(status, message, detail) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}
async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}
async function _json(path, init = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(await authHeader()),
        ...(init.headers ?? {}),
    };
    const r = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    if (!r.ok) {
        let detail = null;
        try {
            detail = await r.json();
        }
        catch {
            /* ignore */
        }
        throw new V2ApiError(r.status, `HTTP ${r.status}`, detail);
    }
    return (await r.json());
}
export const v2 = {
    registerTenant: (payload) => _json("/v2/tenants", { method: "POST", body: JSON.stringify(payload) }),
    listMyTenants: () => _json("/v2/tenants/me"),
    getTenant: (slug) => _json(`/v2/tenants/${encodeURIComponent(slug)}`),
    updateTenant: (slug, patch) => _json(`/v2/tenants/${encodeURIComponent(slug)}`, {
        method: "PUT",
        body: JSON.stringify(patch),
    }),
    listMembers: (slug) => _json(`/v2/tenants/${encodeURIComponent(slug)}/members`),
    // Faz 4 — vergi takvimi
    listTaxCalendar: (slug, opts) => {
        const q = new URLSearchParams();
        if (opts?.upcomingDays)
            q.set("upcoming_days", String(opts.upcomingDays));
        if (opts?.status)
            q.set("status_filter", opts.status);
        const qs = q.toString();
        return _json(`/v2/${encodeURIComponent(slug)}/tax-calendar${qs ? "?" + qs : ""}`);
    },
    patchTaxCalendarItem: (slug, itemId, patch) => _json(`/v2/${encodeURIComponent(slug)}/tax-calendar/${encodeURIComponent(itemId)}`, { method: "PATCH", body: JSON.stringify(patch) }),
};
