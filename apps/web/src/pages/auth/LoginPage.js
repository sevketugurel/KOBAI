import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isSupabaseConfigured } from "../../auth/supabaseClient";
export default function LoginPage() {
    const { signIn } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error: err } = await signIn(email, password);
        setBusy(false);
        if (err) {
            setError(err);
            return;
        }
        navigate("/");
    }
    if (!isSupabaseConfigured()) {
        return (_jsxs("div", { className: "mx-auto max-w-md p-8 text-center text-sm text-neutral-600", children: ["Supabase yap\u0131land\u0131r\u0131lmam\u0131\u015F. L\u00FCtfen", " ", _jsx("code", { children: "VITE_SUPABASE_URL" }), " ve ", _jsx("code", { children: "VITE_SUPABASE_ANON_KEY" }), " ", "de\u011Fi\u015Fkenlerini tan\u0131mlay\u0131n."] }));
    }
    return (_jsxs("div", { className: "mx-auto max-w-md p-8", children: [_jsx("h1", { className: "mb-6 font-display text-2xl", children: "Giri\u015F Yap" }), _jsxs("form", { className: "space-y-4", onSubmit: onSubmit, children: [_jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-sm text-neutral-700", children: "E-posta" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "mt-1 w-full rounded border border-neutral-300 px-3 py-2" })] }), _jsxs("label", { className: "block", children: [_jsx("span", { className: "block text-sm text-neutral-700", children: "\u015Eifre" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6, className: "mt-1 w-full rounded border border-neutral-300 px-3 py-2" })] }), error && _jsx("p", { className: "text-sm text-red-600", children: error }), _jsx("button", { type: "submit", disabled: busy, className: "w-full rounded bg-navy-900 px-4 py-2 text-white disabled:opacity-60", children: busy ? "Giriş yapılıyor…" : "Giriş Yap" })] }), _jsxs("p", { className: "mt-4 text-sm text-neutral-600", children: ["Hesab\u0131n yok mu?", " ", _jsx(Link, { to: "/register", className: "text-navy-700 underline", children: "Kay\u0131t ol" })] })] }));
}
