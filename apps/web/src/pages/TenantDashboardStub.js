import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Link, useParams } from "react-router-dom";
/** Faz 1'de placeholder: gerçek tenant dashboard'u Faz 2'de mevcut DashboardPage'i
 *  tenant-aware'a refaktörledikten sonra eklenecek. */
export default function TenantDashboardStub() {
    const { slug } = useParams();
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("h1", { className: "font-display text-xl", children: ["Ho\u015F geldin \u2014 /", slug, " dashboard"] }), _jsx("p", { className: "text-sm text-neutral-600", children: "Faz 1 iskelet: kimlik do\u011Frulama + tenant izolasyonu \u00E7al\u0131\u015F\u0131yor. Tenant-aware analiz ak\u0131\u015F\u0131 Faz 2'de ba\u011Flanacak." }), _jsx(Link, { to: "/demo/dashboard/00000000-0000-0000-0000-000000000001", className: "text-navy-700 underline", children: "v1 demo dashboard'u" })] }));
}
