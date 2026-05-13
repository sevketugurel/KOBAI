import { Navigate, Outlet, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { useTenant } from "../../hooks/useTenant";

/** /:slug/* altındaki tüm v2 rotaları için guard + tenant context. */
export default function TenantLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading, status } = useTenant(slug);

  if (authLoading) return <FullPage>Yükleniyor…</FullPage>;
  if (!user) return <Navigate to="/login" replace />;
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
      <header className="border-b border-border bg-surface px-6 py-3">
        <span className="font-display text-lg">{tenant.display_name}</span>
        <span className="ml-3 text-xs text-neutral-500">/{tenant.slug}</span>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
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
