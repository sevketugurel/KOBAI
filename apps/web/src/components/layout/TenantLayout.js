import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTenant } from "../../hooks/useTenant";
/** /:slug/* altındaki tüm v2 rotaları için guard + tenant context. */
export default function TenantLayout() {
    const { slug } = useParams();
    const { user, loading: authLoading } = useAuth();
    const { tenant, loading, status } = useTenant(slug);
    if (authLoading)
        return _jsx(FullPage, { children: "Y\u00FCkleniyor\u2026" });
    if (!user)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (loading)
        return _jsx(FullPage, { children: "Tenant y\u00FCkleniyor\u2026" });
    if (status === "forbidden") {
        return (_jsx(FullPage, { tone: "error", children: "Bu i\u015Fletmeye eri\u015Fim yetkin yok." }));
    }
    if (status === "not_found") {
        return _jsxs(FullPage, { tone: "error", children: ["B\u00F6yle bir i\u015Fletme bulunamad\u0131: ", slug] });
    }
    if (!tenant)
        return _jsx(FullPage, { tone: "error", children: "Beklenmeyen hata." });
    return (_jsxs("div", { className: "min-h-screen bg-background", children: [_jsxs("header", { className: "flex items-center justify-between border-b border-border bg-surface px-6 py-3", children: [_jsxs("div", { children: [_jsx("span", { className: "font-display text-lg", children: tenant.display_name }), _jsxs("span", { className: "ml-3 text-xs text-neutral-500", children: ["/", tenant.slug] })] }), _jsxs("nav", { className: "flex gap-4 text-sm", children: [_jsx(SidebarLink, { to: `/${tenant.slug}/dashboard`, label: "Dashboard" }), _jsx(SidebarLink, { to: `/${tenant.slug}/integrations`, label: "Entegrasyonlar" })] })] }), _jsx("main", { className: "p-6", children: _jsx(Outlet, {}) })] }));
}
function SidebarLink({ to, label }) {
    return (_jsx(NavLink, { to: to, className: ({ isActive }) => isActive ? "font-medium text-navy-900" : "text-neutral-600 hover:text-navy-900", children: label }));
}
function FullPage({ children, tone = "info" }) {
    const color = tone === "error" ? "text-red-700" : "text-neutral-600";
    return (_jsx("div", { className: `grid min-h-screen place-items-center ${color}`, children: _jsx("p", { children: children }) }));
}
