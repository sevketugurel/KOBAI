import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { v2 } from "../../api/v2";
import { useAuth } from "../../auth/AuthContext";
import { isSupabaseConfigured, supabase } from "../../auth/supabaseClient";

const PENDING_TENANT_KEY = "kobai_pending_tenant";

const SECTORS = [
  ["gida_perakende", "Gıda Perakende"],
  ["hizmet", "Hizmet"],
  ["imalat", "İmalat"],
  ["perakende", "Perakende"],
  ["insaat", "İnşaat"],
  ["tarim", "Tarım"],
  ["diger", "Diğer"],
] as const;

const COMPANY_TYPES = [
  ["sahis_sirketi", "Şahıs Şirketi"],
  ["ltd_sti", "Limited Şirketi"],
  ["as", "Anonim Şirket"],
] as const;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [sector, setSector] = useState<string>("hizmet");
  const [companyType, setCompanyType] = useState<string>("sahis_sirketi");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
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

    const tenantPayload = { slug, display_name: displayName, sector, company_type: companyType };

    // Supabase mail doğrulama kapalıysa session hemen hazır olur; açıksa null gelir.
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      // E-posta doğrulama gerekiyor → tenant verisini sakla, giriş sonrasında işle.
      localStorage.setItem(PENDING_TENANT_KEY, JSON.stringify(tenantPayload));
      setBusy(false);
      setError(
        "Hesabın oluşturuldu! E-postana bir doğrulama bağlantısı gönderdik. " +
        "Doğruladıktan sonra giriş yap, işletme kaydın otomatik tamamlanacak.",
      );
      return;
    }

    try {
      await v2.registerTenant(tenantPayload);
      navigate(`/${slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-neutral-600">
        Supabase yapılandırılmamış.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-6 font-display text-2xl">KOBİ Kaydı</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-neutral-700">Hesap</legend>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Şifre (en az 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-neutral-700">İşletme</legend>
          <input
            type="text"
            placeholder="İşletme Adı"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
          <input
            type="text"
            placeholder="Slug (URL için)"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm"
          />
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          >
            {SECTORS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={companyType}
            onChange={(e) => setCompanyType(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2"
          >
            {COMPANY_TYPES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </fieldset>
        {error && (
          <p className={`text-sm ${error.startsWith("Hesabın oluşturuldu") ? "text-blue-700" : "text-red-600"}`}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-navy-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Kaydediliyor…" : "Kayıt Ol"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Hesabın var mı?{" "}
        <Link to="/login" className="text-navy-700 underline">
          Giriş yap
        </Link>
      </p>
    </div>
  );
}
