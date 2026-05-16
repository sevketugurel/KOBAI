import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { isMockMode } from "../../api/v2";
import { useTenant } from "../../hooks/useTenant";

/** /:slug/* altındaki tüm v2 rotaları için guard + tenant context. */
export default function TenantLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading, status } = useTenant(slug);

  if (authLoading) return <FullPage>Yükleniyor…</FullPage>;
  if (!user && !isMockMode) return <Navigate to="/login" replace />;
  if (loading) return <FullPage>Tenant yükleniyor…</FullPage>;

  if (status === "forbidden") {
    return (
      <FullPage tone="error">
        Bu işletmeye erişim yetkin yok.
      </FullPage>
    );
  }
  if (status === "not_found") {
    return <FullPage tone="error">Böyle bir işletme bulunamadı: {slug}</FullPage>;
  }
  if (!tenant) return <FullPage tone="error">Beklenmeyen hata.</FullPage>;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-col gap-3 border-b border-border bg-surface px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            İşletme / {tenant.slug}
          </div>
          <span className="font-display text-lg text-navy-900">{tenant.display_name}</span>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <SidebarLink to={`/${tenant.slug}/dashboard`} label="Dashboard" />
          <SidebarLink to={`/${tenant.slug}/integrations`} label="Entegrasyonlar" />
          <SidebarLink to={`/${tenant.slug}/tax-calendar`} label="Vergi Takvimi" />
          <SidebarLink to={`/${tenant.slug}/pos`} label="POS" />
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-full px-3 py-1.5 transition-colors",
          isActive
            ? "bg-navy-900 font-medium text-white"
            : "text-neutral-600 hover:bg-navy-50 hover:text-navy-900",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

function FullPage({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" }) {
  const color = tone === "error" ? "text-red-700" : "text-neutral-600";
  return (
    <div className={`grid min-h-screen place-items-center ${color}`}>
      <p>{children}</p>
    </div>
  );
}
