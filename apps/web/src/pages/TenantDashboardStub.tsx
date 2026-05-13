import { Link, useParams } from "react-router-dom";

/** Faz 1'de placeholder: gerçek tenant dashboard'u Faz 2'de mevcut DashboardPage'i
 *  tenant-aware'a refaktörledikten sonra eklenecek. */
export default function TenantDashboardStub() {
  const { slug } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl">Hoş geldin — /{slug} dashboard</h1>
      <p className="text-sm text-neutral-600">
        Faz 1 iskelet: kimlik doğrulama + tenant izolasyonu çalışıyor.
        Tenant-aware analiz akışı Faz 2'de bağlanacak.
      </p>
      <Link to="/demo/dashboard/00000000-0000-0000-0000-000000000001" className="text-navy-700 underline">
        v1 demo dashboard'u
      </Link>
    </div>
  );
}
