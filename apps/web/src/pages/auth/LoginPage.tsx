import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { isSupabaseConfigured } from "../../auth/supabaseClient";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
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
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-neutral-600">
        Supabase yapılandırılmamış. Lütfen{" "}
        <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code>{" "}
        değişkenlerini tanımlayın.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="mb-6 font-display text-2xl">Giriş Yap</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="block text-sm text-neutral-700">E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-neutral-700">Şifre</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-navy-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        Hesabın yok mu?{" "}
        <Link to="/register" className="text-navy-700 underline">
          Kayıt ol
        </Link>
      </p>
    </div>
  );
}
