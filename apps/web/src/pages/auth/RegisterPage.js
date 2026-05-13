import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { v2 } from "../../api/v2";
import { useAuth } from "../../auth/AuthContext";
import { isSupabaseConfigured } from "../../auth/supabaseClient";
const SECTORS = [
    ["gida_perakende", "Gıda Perakende"],
    ["hizmet", "Hizmet"],
    ["imalat", "İmalat"],
    ["perakende", "Perakende"],
    ["insaat", "İnşaat"],
    ["tarim", "Tarım"],
    ["diger", "Diğer"],
];
const COMPANY_TYPES = [
    ["sahis_sirketi", "Şahıs Şirketi"],
    ["ltd_sti", "Limited Şirketi"],
    ["as", "Anonim Şirket"],
];
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
export default function RegisterPage() {
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [slug, setSlug] = useState("");
    const [sector, setSector] = useState("hizmet");
    const [companyType, setCompanyType] = useState("sahis_sirketi");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        if (!SLUG_RE.test(slug)) {
            setError("Slug: 3-50 karakter, küçük harf/rakam/tire, baş-son tire olamaz.");
            return;
        }
        setBusy(true);
        const { error: signUpErr } = await signUp(email, password);
        if (signUpErr) {
            setBusy(false);
            setError(signUpErr);
            return;
        }
        // Supabase mail doğrulama açıksa session henüz hazır olmayabilir.
        // O zaman kullanıcıyı login sayfasına yönlendirelim.
        try {
            await v2.registerTenant({
                slug,
                display_name: displayName,
                sector,
                company_type: companyType,
            });
            navigate(`/${slug}/dashboard`);
        }
        catch (err) {
            setError(err instanceof Error
                ? `Kayıt başarılı; tenant oluşturma sırasında hata: ${err.message}. Lütfen e-postanı doğrula ve tekrar dene.`
                : "Bilinmeyen hata");
        }
        finally {
            setBusy(false);
        }
    }
    if (!isSupabaseConfigured()) {
        return (_jsx("div", { className: "mx-auto max-w-md p-8 text-center text-sm text-neutral-600", children: "Supabase yap\u0131land\u0131r\u0131lmam\u0131\u015F." }));
    }
    return (_jsxs("div", { className: "mx-auto max-w-md p-8", children: [_jsx("h1", { className: "mb-6 font-display text-2xl", children: "KOB\u0130 Kayd\u0131" }), _jsxs("form", { className: "space-y-4", onSubmit: onSubmit, children: [_jsxs("fieldset", { className: "space-y-3", children: [_jsx("legend", { className: "text-sm font-medium text-neutral-700", children: "Hesap" }), _jsx("input", { type: "email", placeholder: "E-posta", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full rounded border border-neutral-300 px-3 py-2" }), _jsx("input", { type: "password", placeholder: "\u015Eifre (en az 6)", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6, className: "w-full rounded border border-neutral-300 px-3 py-2" })] }), _jsxs("fieldset", { className: "space-y-3", children: [_jsx("legend", { className: "text-sm font-medium text-neutral-700", children: "\u0130\u015Fletme" }), _jsx("input", { type: "text", placeholder: "\u0130\u015Fletme Ad\u0131", value: displayName, onChange: (e) => setDisplayName(e.target.value), required: true, className: "w-full rounded border border-neutral-300 px-3 py-2" }), _jsx("input", { type: "text", placeholder: "Slug (URL i\u00E7in)", value: slug, onChange: (e) => setSlug(e.target.value.toLowerCase()), required: true, className: "w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm" }), _jsx("select", { value: sector, onChange: (e) => setSector(e.target.value), className: "w-full rounded border border-neutral-300 px-3 py-2", children: SECTORS.map(([v, label]) => (_jsx("option", { value: v, children: label }, v))) }), _jsx("select", { value: companyType, onChange: (e) => setCompanyType(e.target.value), className: "w-full rounded border border-neutral-300 px-3 py-2", children: COMPANY_TYPES.map(([v, label]) => (_jsx("option", { value: v, children: label }, v))) })] }), error && _jsx("p", { className: "text-sm text-red-600", children: error }), _jsx("button", { type: "submit", disabled: busy, className: "w-full rounded bg-navy-900 px-4 py-2 text-white disabled:opacity-60", children: busy ? "Kaydediliyor…" : "Kayıt Ol" })] }), _jsxs("p", { className: "mt-4 text-sm text-neutral-600", children: ["Hesab\u0131n var m\u0131?", " ", _jsx(Link, { to: "/login", className: "text-navy-700 underline", children: "Giri\u015F yap" })] })] }));
}
